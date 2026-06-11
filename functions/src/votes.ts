import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const db = admin.firestore();
const SMOOTHING_FACTOR = 5;

// Whitelisted fields for place metadata snapshot — no vote/score/admin fields allowed
const PLACE_DATA_WHITELIST = ['name', 'address', 'categories', 'lat', 'lon', 'openingHours'] as const;

function sanitizePlaceData(raw: any): Record<string, any> | null {
  if (!raw || typeof raw !== 'object') return null;
  const clean: Record<string, any> = {};
  let hasFields = false;
  for (const key of PLACE_DATA_WHITELIST) {
    if (raw[key] !== undefined && raw[key] !== null) {
      clean[key] = raw[key];
      hasFields = true;
    }
  }
  return hasFields ? clean : null;
}

/**
 * Secure Cloud Function for place voting.
 *
 * - Reads user role server-side from Firestore (client cannot fake it)
 * - Stores `userVoteWeights[uid]` so role changes don't corrupt reverts
 * - `upvotes`/`downvotes` always change by ±1 (visible display)
 * - `weightedUpvotes`/`weightedDownvotes` change by ±weight (ranking)
 * - `superboost` is removed — only 'up', 'down', 'none' are valid
 */
export const secureVotePlace = onCall(async (request) => {
  // 1. Auth check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }
  const uid = request.auth.uid;

  // 2. Input validation
  const { placeId, type, placeData: rawPlaceData } = request.data || {};
  if (!placeId || typeof placeId !== 'string') {
    throw new HttpsError("invalid-argument", "placeId is required.");
  }
  if (!['up', 'down', 'none'].includes(type)) {
    throw new HttpsError("invalid-argument", "type must be 'up', 'down', or 'none'.");
  }

  // 3. Read user role server-side (cannot be faked by client)
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }
  const userData = userDoc.data()!;
  if (userData.isBanned === true) {
    throw new HttpsError("permission-denied", "Banned users are not allowed to vote.");
  }
  const isAdmin = userData.role === 'admin' || userData.isAdmin === true;
  const weight = isAdmin ? 50 : 1;

  // 4. Sanitize placeData (whitelist only safe fields)
  const safePlaceData = sanitizePlaceData(rawPlaceData);

  // 5. Run transaction
  const placeRef = db.collection('places').doc(placeId);

  const result = await db.runTransaction(async (transaction) => {
    const placeSnap = await transaction.get(placeRef);

    let data: any = {
      upvotes: 0, downvotes: 0,
      weightedUpvotes: 0, weightedDownvotes: 0,
      userVotes: {}, userVoteWeights: {}
    };
    if (placeSnap.exists) {
      data = placeSnap.data()!;
    }

    const userVotes: Record<string, string> = data.userVotes || {};
    const userVoteWeights: Record<string, number> = data.userVoteWeights || {};
    const previousVote = userVotes[uid] as 'up' | 'down' | undefined;
    // Use the STORED weight for reverting, not the current weight
    const previousWeight = userVoteWeights[uid] ?? 1;

    // --- Toggle Off (clicking same vote again) ---
    if (previousVote === type) {
      let rawUpDelta = 0, rawDownDelta = 0;
      let weightedUpDelta = 0, weightedDownDelta = 0;

      if (type === 'up') { rawUpDelta = -1; weightedUpDelta = -previousWeight; }
      else if (type === 'down') { rawDownDelta = -1; weightedDownDelta = -previousWeight; }

      const newU = Math.max(0, (data.upvotes || 0) + rawUpDelta);
      const newD = Math.max(0, (data.downvotes || 0) + rawDownDelta);
      const newWU = Math.max(0, (data.weightedUpvotes ?? data.upvotes ?? 0) + weightedUpDelta);
      const newWD = Math.max(0, (data.weightedDownvotes ?? data.downvotes ?? 0) + weightedDownDelta);
      const globalScore = (newU - newD) / (newU + newD + SMOOTHING_FACTOR);
      const weightedScore = (newWU - newWD) / (newWU + newWD + SMOOTHING_FACTOR);
      const voteBoostScore = newWU - newWD;

      const updates: any = {
        upvotes: newU,
        downvotes: newD,
        weightedUpvotes: newWU,
        weightedDownvotes: newWD,
        globalScore,
        weightedCommunityScore: weightedScore,
        voteBoostScore,
        [`userVotes.${uid}`]: admin.firestore.FieldValue.delete(),
        [`userVoteWeights.${uid}`]: admin.firestore.FieldValue.delete(),
      };
      transaction.update(placeRef, updates);
      return { weightedCommunityScore: weightedScore };
    }

    // --- Vote change or new vote ---
    let rawUpDelta = 0, rawDownDelta = 0;
    let weightedUpDelta = 0, weightedDownDelta = 0;

    // Revert previous vote using the STORED weight
    if (previousVote === 'up') { rawUpDelta -= 1; weightedUpDelta -= previousWeight; }
    else if (previousVote === 'down') { rawDownDelta -= 1; weightedDownDelta -= previousWeight; }

    // Apply new vote using CURRENT weight
    if (type === 'up') { rawUpDelta += 1; weightedUpDelta += weight; }
    else if (type === 'down') { rawDownDelta += 1; weightedDownDelta += weight; }
    // type === 'none' → just revert, don't apply anything new

    const newU = Math.max(0, (data.upvotes || 0) + rawUpDelta);
    const newD = Math.max(0, (data.downvotes || 0) + rawDownDelta);
    const newWU = Math.max(0, (data.weightedUpvotes ?? data.upvotes ?? 0) + weightedUpDelta);
    const newWD = Math.max(0, (data.weightedDownvotes ?? data.downvotes ?? 0) + weightedDownDelta);
    const globalScore = (newU - newD) / (newU + newD + SMOOTHING_FACTOR);
    const weightedScore = (newWU - newWD) / (newWU + newWD + SMOOTHING_FACTOR);
    const voteBoostScore = newWU - newWD;

    const updates: any = {
      upvotes: newU,
      downvotes: newD,
      weightedUpvotes: newWU,
      weightedDownvotes: newWD,
      globalScore,
      weightedCommunityScore: weightedScore,
      voteBoostScore,
    };

    if (type === 'none') {
      // Remove vote entirely
      updates[`userVotes.${uid}`] = admin.firestore.FieldValue.delete();
      updates[`userVoteWeights.${uid}`] = admin.firestore.FieldValue.delete();
    } else {
      // Set new vote + store current weight for future reverts
      updates[`userVotes.${uid}`] = type;
      updates[`userVoteWeights.${uid}`] = weight;
    }

    if (placeSnap.exists) {
      // Include safe metadata snapshot if provided
      if (safePlaceData) {
        Object.assign(updates, safePlaceData);
      }
      transaction.update(placeRef, updates);
    } else {
      // Create new place document
      if (type !== 'none') {
        updates.userVotes = { [uid]: type };
        updates.userVoteWeights = { [uid]: weight };
        updates.voteBoostScore = voteBoostScore;
        if (safePlaceData) {
          Object.assign(updates, safePlaceData);
        }
        transaction.set(placeRef, updates);
      }
    }

    return { weightedCommunityScore: weightedScore };
  });

  return result;
});


/**
 * Secure Cloud Function for activity voting.
 *
 * Same security model as secureVotePlace:
 * - Server-side role lookup
 * - userVoteWeights tracking
 * - Only 'up', 'down', 'none' allowed (superboost removed)
 */
export const secureVoteActivity = onCall(async (request) => {
  // 1. Auth check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }
  const uid = request.auth.uid;

  // 2. Input validation
  const { activityId, type } = request.data || {};
  if (!activityId || typeof activityId !== 'string') {
    throw new HttpsError("invalid-argument", "activityId is required.");
  }
  if (!['up', 'down', 'none'].includes(type)) {
    throw new HttpsError("invalid-argument", "type must be 'up', 'down', or 'none'.");
  }

  // 3. Read user role server-side
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }
  const userData = userDoc.data()!;
  if (userData.isBanned === true) {
    throw new HttpsError("permission-denied", "Banned users are not allowed to vote.");
  }
  const isAdmin = userData.role === 'admin' || userData.isAdmin === true;
  const weight = isAdmin ? 50 : 1;

  // 4. Run transaction
  const activityRef = db.collection('activities').doc(activityId);

  const result = await db.runTransaction(async (transaction) => {
    const activitySnap = await transaction.get(activityRef);
    if (!activitySnap.exists) {
      throw new HttpsError("not-found", "Activity not found.");
    }

    const activityData = activitySnap.data()!;
    if (activityData.status === 'cancelled' || activityData.status === 'completed' || activityData.status === 'blacklisted') {
      throw new HttpsError("failed-precondition", "Voting is not allowed on completed, cancelled, or blacklisted activities.");
    }

    const userVotes: Record<string, string> = activityData.userVotes || {};
    const userVoteWeights: Record<string, number> = activityData.userVoteWeights || {};
    const previousVote = userVotes[uid] as 'up' | 'down' | undefined;
    const previousWeight = userVoteWeights[uid] ?? 1;

    let weightedUpDelta = 0, weightedDownDelta = 0;

    const fallbackUp = (activityData.communityScore && activityData.communityScore > 0) ? activityData.communityScore : 0;
    const fallbackDown = (activityData.communityScore && activityData.communityScore < 0) ? -activityData.communityScore : 0;

    // Toggle Off
    if (previousVote === type) {
      if (type === 'up') { weightedUpDelta = -previousWeight; }
      else if (type === 'down') { weightedDownDelta = -previousWeight; }

      const newWU = Math.max(0, (activityData.weightedUpvotes ?? fallbackUp) + weightedUpDelta);
      const newWD = Math.max(0, (activityData.weightedDownvotes ?? fallbackDown) + weightedDownDelta);
      const finalScore = newWU - newWD;

      transaction.update(activityRef, {
        communityScore: finalScore,
        weightedUpvotes: newWU,
        weightedDownvotes: newWD,
        voteBoostScore: finalScore,
        [`userVotes.${uid}`]: admin.firestore.FieldValue.delete(),
        [`userVoteWeights.${uid}`]: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { communityScore: finalScore };
    }

    // Revert previous vote using STORED weight
    if (previousVote === 'up') { weightedUpDelta -= previousWeight; }
    else if (previousVote === 'down') { weightedDownDelta -= previousWeight; }

    // Apply new vote using CURRENT weight
    if (type === 'up') { weightedUpDelta += weight; }
    else if (type === 'down') { weightedDownDelta += weight; }
    // type === 'none' → just revert

    const newWU = Math.max(0, (activityData.weightedUpvotes ?? fallbackUp) + weightedUpDelta);
    const newWD = Math.max(0, (activityData.weightedDownvotes ?? fallbackDown) + weightedDownDelta);
    const newCommunityScore = newWU - newWD;

    const updates: any = {
      communityScore: newCommunityScore,
      weightedUpvotes: newWU,
      weightedDownvotes: newWD,
      voteBoostScore: newCommunityScore,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (type === 'none') {
      updates[`userVotes.${uid}`] = admin.firestore.FieldValue.delete();
      updates[`userVoteWeights.${uid}`] = admin.firestore.FieldValue.delete();
    } else {
      updates[`userVotes.${uid}`] = type;
      updates[`userVoteWeights.${uid}`] = weight;
    }

    transaction.update(activityRef, updates);

    // Auto-moderation trigger: critical community score
    if (newCommunityScore <= -5 && !activityData.isVerified) {
      const reportRef = db.collection('reports').doc();
      transaction.set(reportRef, {
        reportedEntityId: activityId,
        entityType: 'activity',
        reason: 'Automated Moderation Trigger: Critical Community Score',
        status: 'moderation_review',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return { communityScore: newCommunityScore };
  });

  return result;
});
