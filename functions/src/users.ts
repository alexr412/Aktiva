import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { isReservedUsername, isValidUsername } from './reserved-usernames';

/**
 * MODUL 23: Production-Grade Fan-Out System.
 * Synchronisiert Profiländerungen (Name, Photo) sicher über alle Aktivitäten und Chats.
 * Nutze atomare Chunks zur Vermeidung von Batch-Limit-Fehlern (> 500 Docs).
 */
export const syncUserProfileUpdates = onDocumentUpdated({
  document: 'users/{userId}',
  retry: true // Retry bei transienten Fehlern (z.B. Transaction Contention)
}, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  if (!before || !after) return null;

  // Nur triggern wenn Name, Foto, Username oder Badges sich ändern
  if (
    before.displayName === after.displayName && 
    before.photoURL === after.photoURL &&
    before.username === after.username &&
    before.isPremium === after.isPremium &&
    before.isSupporter === after.isSupporter &&
    before.isCreator === after.isCreator
  ) {
    return null;
  }

  const userId = event.params.userId;
  const newUsername = after.username || null;
  const newPhotoURL = after.photoURL || null;
  const userLanguage = after.language || 'de';
  const usernameFormatted = newUsername ? `@${newUsername.replace(/^@/, '')}` : (userLanguage === 'de' ? 'Aktiva-Nutzer' : 'Aktiva user');
  const newName = usernameFormatted;
  const db = admin.firestore();

  // 0. Update publicProfiles projection
  if (newUsername) {
    await db.collection('publicProfiles').doc(userId).set({
      uid: userId,
      username: newUsername,
      photoURL: newPhotoURL,
      isPremium: after.isPremium || false,
      isSupporter: after.isSupporter || false,
      isCreator: after.isCreator || false
    }, { merge: true });
  } else {
    await db.collection('publicProfiles').doc(userId).delete().catch(() => {});
  }

  // Liste aller Dokument-Referenzen sammeln, die geupdatet werden müssen
  const targets: { ref: admin.firestore.DocumentReference, updates: any }[] = [];

  // 1. Aktivitäten suchen (als Teilnehmer oder Host)
  const activitiesSnap = await db.collection('activities')
    .where('participantIds', 'array-contains', userId)
    .get();

  activitiesSnap.forEach(doc => {
    const data = doc.data();
    const updates: any = {};
    let needsUpdate = false;

    if (data.hostId === userId) {
      if (data.hostName !== newName) { updates.hostName = newName; needsUpdate = true; }
      if (data.hostUsername !== newUsername) { updates.hostUsername = newUsername; needsUpdate = true; }
      if (data.hostPhotoURL !== newPhotoURL) { updates.hostPhotoURL = newPhotoURL; needsUpdate = true; }
    }

    if (data.participantDetails?.[userId]) {
      updates[`participantDetails.${userId}.displayName`] = newName;
      updates[`participantDetails.${userId}.username`] = newUsername;
      updates[`participantDetails.${userId}.photoURL`] = newPhotoURL;
      updates[`participantDetails.${userId}.isPremium`] = after.isPremium || false;
      updates[`participantDetails.${userId}.isSupporter`] = after.isSupporter || false;
      updates[`participantDetails.${userId}.isCreator`] = after.isCreator || false;
      needsUpdate = true;
    }

    if (Array.isArray(data.participantsPreview)) {
      const idx = data.participantsPreview.findIndex((p: any) => p.uid === userId);
      if (idx !== -1) {
        const newPreview = [...data.participantsPreview];
        newPreview[idx] = { 
          ...newPreview[idx], 
          displayName: newName, 
          username: newUsername, 
          photoURL: newPhotoURL 
        };
        updates.participantsPreview = newPreview;
        needsUpdate = true;
      }
    }

    if (needsUpdate) targets.push({ ref: doc.ref, updates });
  });

  // 2. Chats suchen
  const chatsSnap = await db.collection('chats')
    .where('participantIds', 'array-contains', userId)
    .get();

  chatsSnap.forEach(doc => {
    const data = doc.data();
    if (data.participantDetails?.[userId]) {
      targets.push({
        ref: doc.ref,
        updates: {
          [`participantDetails.${userId}.displayName`]: newName,
          [`participantDetails.${userId}.username`]: newUsername,
          [`participantDetails.${userId}.photoURL`]: newPhotoURL,
          [`participantDetails.${userId}.isPremium`]: after.isPremium || false,
          [`participantDetails.${userId}.isSupporter`]: after.isSupporter || false,
          [`participantDetails.${userId}.isCreator`]: after.isCreator || false,
        }
      });
    }
  });

  // 3. CHUNKED EXECUTION: Max 400 Writes pro Batch (Sicherheitsmarge)
  if (targets.length > 0) {
    for (let i = 0; i < targets.length; i += 400) {
      const batch = db.batch();
      const chunk = targets.slice(i, i + 400);
      chunk.forEach(t => batch.update(t.ref, t.updates));
      await batch.commit();
    }
    console.log(`Successfully fan-out profile updates for ${userId} to ${targets.length} documents.`);
  }

  return null;
});

/**
 * Backstop function triggered asynchronously when a user is created in Firebase Auth.
 * Specifically handles setting emailVerified: false for Google/Apple users.
 */
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  const db = admin.firestore();
  try {
    // 1. Always generate unique referral code
    const referralCode = await generateUniqueReferralCode(db, user.uid);
    await db.collection('users').doc(user.uid).set({
      referralCode
    }, { merge: true });
    console.log(`Generated unique referral code ${referralCode} for user ${user.uid}`);
  } catch (error) {
    console.error(`Error generating referral code for user ${user.uid}:`, error);
  }

  const providerData = user.providerData || [];
  const isOAuth = providerData.some(p => p.providerId === 'google.com' || p.providerId === 'apple.com');
  const hasEmail = !!user.email;

  if (isOAuth && hasEmail) {
    try {
      // Force emailVerified to false
      await admin.auth().updateUser(user.uid, { emailVerified: false });
      console.log(`Set emailVerified to false for social user via backstop: ${user.uid}`);

      // Set Firestore email verification tracking fields
      const userRef = db.collection('users').doc(user.uid);
      await userRef.set({
        emailVerificationRequired: true,
        emailVerificationProvider: "firebase",
        emailVerificationReason: "social_signup",
        emailVerificationCreatedAt: FieldValue.serverTimestamp(),
        emailVerifiedAt: null
      }, { merge: true });
      console.log(`Set Firestore email verification requirements for social user via backstop: ${user.uid}`);
    } catch (error) {
      console.error(`Error in onUserCreated for social user ${user.uid}:`, error);
    }
  }
});

/**
 * Callable function invoked synchronously from the client immediately after Google/Apple signup.
 * Ensures the user's email is set to unverified and the database states are established before email dispatch.
 */
export const requireSocialEmailVerification = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const uid = request.auth.uid;
  const authUser = await admin.auth().getUser(uid);

  const providerData = authUser.providerData || [];
  const isOAuth = providerData.some(p => p.providerId === 'google.com' || p.providerId === 'apple.com');
  const hasEmail = !!authUser.email;

  if (!isOAuth || !hasEmail) {
    throw new HttpsError('failed-precondition', 'User is not a social sign-up with an email address.');
  }

  try {
    // Set emailVerified to false in Auth
    await admin.auth().updateUser(uid, { emailVerified: false });
    console.log(`Successfully forced emailVerified to false for social user ${uid}`);

    // Set Firestore fields
    const db = admin.firestore();
    const userRef = db.collection('users').doc(uid);
    await userRef.set({
      emailVerificationRequired: true,
      emailVerificationProvider: "firebase",
      emailVerificationReason: "social_signup",
      emailVerificationCreatedAt: FieldValue.serverTimestamp(),
      emailVerifiedAt: null,
      verificationEmailLastSentAt: FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`Set Firestore email verification requirements for social user ${uid}`);
    return { success: true };
  } catch (error: any) {
    console.error(`Error in requireSocialEmailVerification for user ${uid}:`, error);
    throw new HttpsError('internal', error.message || 'Failed to update email verification requirements.');
  }
});

/**
 * Callable function invoked from the client when they have completed Firebase verification
 * and are logging in again. Clears the Firestore emailVerificationRequired flag securely.
 */
export const verifyEmailStatus = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const uid = request.auth.uid;
  const authUser = await admin.auth().getUser(uid);

  if (!authUser.emailVerified) {
    throw new HttpsError('failed-precondition', 'Email is not verified in the authentication system.');
  }

  try {
    const db = admin.firestore();
    const userRef = db.collection('users').doc(uid);
    await userRef.update({
      emailVerificationRequired: false,
      emailVerifiedAt: FieldValue.serverTimestamp()
    });

    console.log(`Successfully cleared email verification requirement for user ${uid}`);
    return { success: true };
  } catch (error: any) {
    console.error(`Error in verifyEmailStatus for user ${uid}:`, error);
    throw new HttpsError('internal', error.message || 'Failed to update email verification status.');
  }
});

/**
 * Callable function invoked from the client to check if they are allowed to resend
 * the verification email (must be at least 5 minutes since verificationEmailLastSentAt).
 * If allowed, updates verificationEmailLastSentAt to serverTimestamp() and returns allowed: true.
 */
export const checkAndRecordVerificationEmail = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);

  try {
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User profile not found.');
    }

    const userData = userSnap.data();
    const lastSent = userData?.verificationEmailLastSentAt;

    if (lastSent) {
      const lastSentTime = lastSent.toDate().getTime();
      const now = Date.now();
      const diffMs = now - lastSentTime;
      const limitMs = 5 * 60 * 1000; // 5 minutes

      if (diffMs < limitMs) {
        const remainingSeconds = Math.ceil((limitMs - diffMs) / 1000);
        console.log(`Verification email throttled for user ${uid}. Remaining: ${remainingSeconds}s`);
        return { allowed: false, remainingSeconds };
      }
    }

    // Update the timestamp to current server time
    await userRef.update({
      verificationEmailLastSentAt: FieldValue.serverTimestamp()
    });

    console.log(`Verification email check passed and timestamp updated for user ${uid}`);
    return { allowed: true };
  } catch (error: any) {
    console.error(`Error in checkAndRecordVerificationEmail for user ${uid}:`, error);
    throw new HttpsError('internal', error.message || 'Failed to check verification email throttle.');
  }
});

/**
 * MODUL 20: Admin-only cleanup task.
 * Deletes empty chats (participantIds == []) and their messages,
 * as well as associated orphaned activities and participants.
 */
export const cleanupEmptyChats = onCall(async (request) => {
  // 1. RBAC Security check
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const callerUid = request.auth.uid;
  const db = admin.firestore();
  const callerDoc = await db.collection('users').doc(callerUid).get();

  if (!callerDoc.exists) {
    throw new HttpsError('permission-denied', 'Caller profile not found.');
  }

  const callerData = callerDoc.data();
  const isAdmin = callerData?.role === 'admin' || callerData?.isAdmin === true;
  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Unauthorized access.');
  }

  let chatsDeleted = 0;
  let messagesDeleted = 0;
  let activitiesDeleted = 0;
  let activityParticipantsDeleted = 0;
  let placeCountersUpdated = 0;
  let skipped = 0;
  let errors = 0;

  let batch = db.batch();
  let batchCount = 0;

  const commitBatchIfNeeded = async (force = false) => {
    if (batchCount >= 400 || (force && batchCount > 0)) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  };

  try {
    // 2. Query empty chats (participantIds == [])
    // We only query chats that are empty arrays. Any missing or null fields are ignored
    // by this query, preventing unnecessary database read charges.
    const emptyChatsSnap = await db.collection('chats').where('participantIds', '==', []).get();

    const docsToProcess = emptyChatsSnap.docs;

    for (const chatDoc of docsToProcess) {
      try {
        const chatData = chatDoc.data();
        const participantIds = chatData?.participantIds;
        const chatId = chatDoc.id;

        // Skip chats with missing or invalid participantIds field (including null)
        if (!participantIds || !Array.isArray(participantIds)) {
          skipped++;
          continue;
        }

        // Additional sanity check: if somehow it has participants, skip it
        if (participantIds.length > 0) {
          skipped++;
          continue;
        }

        // 3. FINAL RE-CHECK: Read the chat document afresh right before deletion
        const freshChatSnap = await chatDoc.ref.get();
        if (!freshChatSnap.exists) {
          skipped++;
          continue;
        }

        const freshChatData = freshChatSnap.data();
        const freshParticipantIds = freshChatData?.participantIds;

        // Verify participantIds is still an empty array []
        if (!freshParticipantIds || !Array.isArray(freshParticipantIds) || freshParticipantIds.length > 0) {
          skipped++;
          continue;
        }

        // 4. Paginated message deletion
        const messagesRef = chatDoc.ref.collection('messages');
        let hasMoreMessages = true;
        while (hasMoreMessages) {
          const messagesSnap = await messagesRef.limit(100).get();
          if (messagesSnap.empty) {
            hasMoreMessages = false;
            break;
          }
          for (const mDoc of messagesSnap.docs) {
            batch.delete(mDoc.ref);
            messagesDeleted++;
            batchCount++;
            await commitBatchIfNeeded();
          }
          if (messagesSnap.size < 100) {
            hasMoreMessages = false;
          }
        }

        // 5. Delete chat document
        batch.delete(chatDoc.ref);
        chatsDeleted++;
        batchCount++;
        await commitBatchIfNeeded();

        // 6. Check associated activity
        const activityId = chatData.activityId;
        // Verify that the activity belongs to this chat.
        // In our data model, it is historically guaranteed that the activity document
        // and its corresponding chat document share the exact same document ID (established
        // in createActivity inside firestore.ts where chatRef = doc(db, 'chats', activityRef.id)).
        // Checking activityId === chatId confirms this direct relationship.
        if (activityId && activityId === chatId) {
          const activityRef = db.collection('activities').doc(activityId);
          const activitySnap = await activityRef.get();

          if (activitySnap.exists) {
            const activityData = activitySnap.data();
            if (activityData) {
              const activityParticipantIds = activityData.participantIds || [];
              const isOrphaned = activityParticipantIds.length === 0;

              if (isOrphaned) {
                // Delete activity participants subcollection paginated
                const participantsRef = activityRef.collection('participants');
                let hasMoreParticipants = true;
                while (hasMoreParticipants) {
                  const participantsSnap = await participantsRef.limit(100).get();
                  if (participantsSnap.empty) {
                    hasMoreParticipants = false;
                    break;
                  }
                  for (const pDoc of participantsSnap.docs) {
                    batch.delete(pDoc.ref);
                    activityParticipantsDeleted++;
                    batchCount++;
                    await commitBatchIfNeeded();
                  }
                  if (participantsSnap.size < 100) {
                    hasMoreParticipants = false;
                  }
                }

                // Delete activity document
                batch.delete(activityRef);
                activitiesDeleted++;
                batchCount++;
                await commitBatchIfNeeded();

                // Decrement place activity count
                if (activityData.placeId && activityData.placeId !== 'custom') {
                  const placeRef = db.collection('places').doc(activityData.placeId);
                  const placeSnap = await placeRef.get();
                  if (placeSnap.exists) {
                    const placeData = placeSnap.data();
                    const currentCount = placeData?.activityCount || 0;
                    const newCount = Math.max(0, currentCount - 1);
                    batch.update(placeRef, { activityCount: newCount });
                    placeCountersUpdated++;
                    batchCount++;
                    await commitBatchIfNeeded();
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.error(`Error cleaning up chat ${chatDoc.id}:`, err);
        errors++;
      }
    }

    // Force commit any remaining writes
    await commitBatchIfNeeded(true);

  } catch (err: any) {
    console.error('cleanupEmptyChats failed:', err);
    throw new HttpsError('internal', err.message || 'Failed to cleanup empty chats.');
  }

  return {
    chatsDeleted,
    messagesDeleted,
    activitiesDeleted,
    activityParticipantsDeleted,
    placeCountersUpdated,
    skipped,
    errors
  };
});

/**
 * Automatically triggered when a user is deleted from Firebase Auth.
 * Performs a cascading delete to clean up the user's document in Firestore
 * and remove their references from activities, chats, friends, and notifications.
 */
export const onUserDeleted = functions.auth.user().onDelete(async (user) => {
  const userId = user.uid;
  const db = admin.firestore();
  
  console.log(`Starting cascading delete for deleted Auth user: ${userId}`);

  // We read the user profile document first to get the friends and request arrays before deleting it.
  let friends: string[] = [];
  let sent: string[] = [];
  let received: string[] = [];
  
  try {
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      const userData = userSnap.data();
      friends = userData?.friends || [];
      sent = userData?.friendRequestsSent || [];
      received = userData?.friendRequestsReceived || [];
    }
  } catch (err) {
    console.error(`Error reading user document for cleanup of user ${userId}:`, err);
  }

  // Helper to commit and reset batch
  let batch = db.batch();
  let batchCount = 0;
  const commitBatch = async () => {
    if (batchCount > 0) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  };

  // 1. Guaranteed deletion of user profile document first
  try {
    const userRef = db.collection('users').doc(userId);
    batch.delete(userRef);
    batchCount++;
    await commitBatch();
    console.log(`Successfully deleted user profile document /users/${userId}`);
  } catch (err) {
    console.error(`Failed to delete user profile document /users/${userId}:`, err);
  }

  // 2. Clean up activities where the user is a participant
  try {
    const activitiesSnap = await db.collection('activities')
      .where('participantIds', 'array-contains', userId)
      .get();

    for (const docSnap of activitiesSnap.docs) {
      const actData = docSnap.data();
      const newPreview = (actData.participantsPreview || []).filter((p: any) => p.uid !== userId);
      batch.update(docSnap.ref, {
        participantIds: FieldValue.arrayRemove(userId),
        participantsPreview: newPreview,
        [`participantDetails.${userId}`]: FieldValue.delete()
      });
      batchCount++;

      // Delete participant subcollection document
      const participantRef = docSnap.ref.collection('participants').doc(userId);
      batch.delete(participantRef);
      batchCount++;

      if (batchCount >= 400) await commitBatch();
    }
    await commitBatch();
    console.log(`Cleaned up user ${userId} from participant activities`);
  } catch (err) {
    console.error(`Error cleaning up participant activities for user ${userId}:`, err);
  }

  // 3. Clean up activities hosted by the user (cancel and anonymize host)
  try {
    const hostedActivitiesSnap = await db.collection('activities')
      .where('hostId', '==', userId)
      .get();

    for (const docSnap of hostedActivitiesSnap.docs) {
      batch.update(docSnap.ref, {
        status: 'cancelled',
        hostName: 'Gelöschter Nutzer',
        hostPhotoURL: null
      });
      batchCount++;

      // Delete participant subcollection document (host is also a participant)
      const participantRef = docSnap.ref.collection('participants').doc(userId);
      batch.delete(participantRef);
      batchCount++;

      if (batchCount >= 400) await commitBatch();
    }
    await commitBatch();
    console.log(`Cleaned up hosted activities for user ${userId}`);
  } catch (err) {
    console.error(`Error cleaning up hosted activities for user ${userId}:`, err);
  }

  // 4. Clean up chats where the user is a participant
  try {
    const chatsSnap = await db.collection('chats')
      .where('participantIds', 'array-contains', userId)
      .get();
    for (const docSnap of chatsSnap.docs) {
      batch.update(docSnap.ref, {
        participants: FieldValue.arrayRemove(userId),
        participantIds: FieldValue.arrayRemove(userId),
        [`participantDetails.${userId}`]: FieldValue.delete(),
        [`unreadCount.${userId}`]: FieldValue.delete()
      });
      batchCount++;
      if (batchCount >= 400) await commitBatch();
    }
    await commitBatch();
    console.log(`Cleaned up chats for user ${userId}`);
  } catch (err) {
    console.error(`Error cleaning up chats for user ${userId}:`, err);
  }

  // 5. Clean up friendships and requests in other user documents
  try {
    // Remove from friends list of others
    for (const friendId of friends) {
      batch.update(db.collection('users').doc(friendId), {
        friends: FieldValue.arrayRemove(userId)
      });
      batchCount++;
      if (batchCount >= 400) await commitBatch();
    }
    // Clean up friend requests for others
    for (const otherId of sent) {
      batch.update(db.collection('users').doc(otherId), {
        friendRequestsReceived: FieldValue.arrayRemove(userId)
      });
      batchCount++;
      if (batchCount >= 400) await commitBatch();
    }
    for (const otherId of received) {
      batch.update(db.collection('users').doc(otherId), {
        friendRequestsSent: FieldValue.arrayRemove(userId)
      });
      batchCount++;
      if (batchCount >= 400) await commitBatch();
    }
    await commitBatch();
    console.log(`Cleaned up friendships for user ${userId}`);
  } catch (err) {
    console.error(`Error cleaning up friendships for user ${userId}:`, err);
  }

  // 6. Delete notifications (sent or received by the user)
  try {
    const receivedNotifsSnap = await db.collection('notifications')
      .where('recipientId', '==', userId)
      .get();
    for (const docSnap of receivedNotifsSnap.docs) {
      batch.delete(docSnap.ref);
      batchCount++;
      if (batchCount >= 400) await commitBatch();
    }

    const sentNotifsSnap = await db.collection('notifications')
      .where('senderId', '==', userId)
      .get();
    for (const docSnap of sentNotifsSnap.docs) {
      batch.delete(docSnap.ref);
      batchCount++;
      if (batchCount >= 400) await commitBatch();
    }
    await commitBatch();
    console.log(`Cleaned up notifications for user ${userId}`);
  } catch (err) {
    console.error(`Error cleaning up notifications for user ${userId}:`, err);
  }

  // 7. Delete reviews written by the user
  try {
    const reviewsSnap = await db.collection('reviews')
      .where('authorId', '==', userId)
      .get();
    for (const docSnap of reviewsSnap.docs) {
      batch.delete(docSnap.ref);
      batchCount++;
      if (batchCount >= 400) await commitBatch();
    }
    await commitBatch();
    console.log(`Cleaned up reviews for user ${userId}`);
  } catch (err) {
    console.error(`Error cleaning up reviews for user ${userId}:`, err);
  }

  // 8. Best-effort Storage cleanup for user's avatar folder (users/{uid}/)
  try {
    const bucket = admin.storage().bucket();
    await bucket.deleteFiles({ prefix: `users/${userId}/` });
    console.log(`Successfully cleaned up Storage files for user ${userId}`);
  } catch (storageErr) {
    console.warn(`Storage cleanup failed for user ${userId} (best-effort):`, storageErr);
  }

  console.log(`Successfully completed cascading delete for user ${userId}`);
});


/**
 * Helper to generate a unique random referral code and lock it in referralCodes collection
 */
async function generateUniqueReferralCode(db: admin.firestore.Firestore, uid: string): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let attempts = 0;
  while (attempts < 10) {
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const codeRef = db.collection('referralCodes').doc(code);
    try {
      const isUnique = await db.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(codeRef);
        if (docSnap.exists) {
          return false;
        }
        transaction.set(codeRef, {
          uid,
          createdAt: FieldValue.serverTimestamp()
        });
        return true;
      });
      if (isUnique) {
        return code;
      }
    } catch (e) {
      console.warn(`Conflict locking referral code ${code}, retrying...`, e);
    }
    attempts++;
  }
  throw new Error('Failed to generate unique referral code after 10 attempts');
}

/**
 * Callable function to securely apply a referral code.
 * Replaces client-side referredBy writes.
 */
export const applyReferralCode = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const code = request.data?.code;
  if (!code || typeof code !== 'string') {
    throw new HttpsError('invalid-argument', 'A valid referral code is required.');
  }

  const normalizedCode = code.trim().toUpperCase();
  const db = admin.firestore();
  const callerUid = request.auth.uid;

  try {
    const result = await db.runTransaction(async (transaction) => {
      // 1. Lookup referral code
      const codeRef = db.collection('referralCodes').doc(normalizedCode);
      const codeSnap = await transaction.get(codeRef);
      if (!codeSnap.exists) {
        throw new HttpsError('not-found', 'Der eingegebene Referral-Code ist ungültig.');
      }

      const referrerUid = codeSnap.data()?.uid;
      if (!referrerUid) {
        throw new HttpsError('internal', 'Referral-Code ist verwaist.');
      }

      // 2. Prevent self-referral
      if (referrerUid === callerUid) {
        throw new HttpsError('failed-precondition', 'Du kannst dich nicht selbst werben.');
      }

      // 3. Check caller profile
      const callerRef = db.collection('users').doc(callerUid);
      const callerSnap = await transaction.get(callerRef);
      if (!callerSnap.exists) {
        throw new HttpsError('not-found', 'Nutzerprofil nicht gefunden.');
      }

      const callerData = callerSnap.data();
      if (callerData?.referredBy) {
        throw new HttpsError('already-exists', 'Du hast bereits einen Referral-Code angewendet.');
      }

      // 4. Write referredBy relationship
      transaction.update(callerRef, {
        referredBy: referrerUid,
        referralCodeUsed: normalizedCode,
        referralStatus: 'pending'
      });

      const referrerRef = db.collection('users').doc(referrerUid);
      transaction.update(referrerRef, {
        pendingReferrals: FieldValue.increment(1)
      });

      return { success: true, referrerUid };
    });

    console.log(`Successfully applied referral code ${normalizedCode} for caller ${callerUid} (referred by ${result.referrerUid})`);
    return { success: true };
  } catch (error: any) {
    console.error(`Error applying referral code for user ${callerUid}:`, error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error.message || 'Fehler beim Anwenden des Referral-Codes.');
  }
});

const LEVEL_THRESHOLDS = [
  0,    // Level 1
  50,   // Level 2
  150,  // Level 3
  300,  // Level 4
  500,  // Level 5
  800,  // Level 6
  1200, // Level 7
  1700, // Level 8
  2300, // Level 9
  3000, // Level 10
];

export function calculateLevel(pointsLifetime: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (pointsLifetime >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return level;
}

/**
 * Triggers referral bonus payouts on email verification + onboarding completion.
 */
export const processReferralOnboardingCompletion = onDocumentUpdated({
  document: 'users/{userId}',
  retry: true
}, async (event) => {
  // Disables the old onboarding completion reward system. Payout is now activation-based.
  return null;
});

/**
 * Helper to activate referral rewards if a referred user does their first action.
 */
export async function maybeActivateReferral(
  referredUserId: string,
  activationReason: 'first_activity_joined' | 'first_activity_created' | 'first_chat_active' | 'first_meeting_completed'
) {
  const db = admin.firestore();

  try {
    await db.runTransaction(async (transaction) => {
      // 1. Retrieve referred user's profile
      const referredRef = db.collection('users').doc(referredUserId);
      const referredSnap = await transaction.get(referredRef);
      if (!referredSnap.exists) {
        console.log(`Referred user profile ${referredUserId} not found.`);
        return;
      }

      const referredData = referredSnap.data()!;
      const referrerId = referredData.referredBy;

      // Check if referred by anyone
      if (!referrerId) {
        console.log(`User ${referredUserId} was not referred by anyone.`);
        return;
      }

      // Check if referral status is already rewarded
      const status = referredData.referralStatus;
      if (status === 'rewarded') {
        console.log(`User ${referredUserId} has already triggered referral reward.`);
        return;
      }

      // 2. Idempotency check: Ledger check for this reward
      const idempotencyKey = `referral_reward_${referredUserId}`;
      const referrerLedgerRef = db.collection('users').doc(referrerId).collection('pointsLedger').doc(idempotencyKey);
      const ledgerSnap = await transaction.get(referrerLedgerRef);
      if (ledgerSnap.exists) {
        console.log(`Referral ledger entry ${idempotencyKey} already exists. Skipping.`);
        return;
      }

      // Retrieve referrer profile
      const referrerRef = db.collection('users').doc(referrerId);
      const referrerSnap = await transaction.get(referrerRef);
      if (!referrerSnap.exists) {
        console.warn(`Referrer ${referrerId} not found.`);
        return;
      }

      const referrerData = referrerSnap.data()!;

      // Update referred user's status to rewarded
      transaction.update(referredRef, {
        referralStatus: 'rewarded',
        referralActivatedAt: FieldValue.serverTimestamp(),
        referralActivationReason: activationReason
      });

      // Calculate referrer points & level
      const referralPoints = 25; // 25 points for referrer
      const referrerLifetime = (referrerData.pointsLifetime || 0) + referralPoints;
      const referrerBalance = (referrerData.pointsBalance || 0) + referralPoints;
      const referrerNewLevel = calculateLevel(referrerLifetime);

      // Referrer metrics updates
      const oldActivated = referrerData.activatedReferrals || 0;
      const newActivated = oldActivated + 1;

      const oldSuccessful = referrerData.successfulReferrals || 0;
      const newSuccessful = oldSuccessful + 1;

      // Decrement pendingReferrals defensively (never below 0)
      const oldPending = referrerData.pendingReferrals || 0;
      const newPending = Math.max(0, oldPending - 1);

      // Write ledger entry for referrer
      transaction.set(referrerLedgerRef, {
        type: 'referral_activation_bonus',
        referrerId: referrerId,
        referredUserId: referredUserId,
        activationReason: activationReason,
        points: referralPoints,
        createdAt: FieldValue.serverTimestamp(),
        idempotencyKey: idempotencyKey,
        metadata: {
          message: `Referral aktiviert: ${referredData.displayName || 'User'}`
        }
      });

      // Update referrer fields
      const referrerUpdates: any = {
        pointsBalance: referrerBalance,
        pointsLifetime: referrerLifetime,
        level: referrerNewLevel,
        activatedReferrals: newActivated,
        successfulReferrals: newSuccessful,
        pendingReferrals: newPending
      };

      // Check milestones based exclusively on activatedReferrals (newActivated)
      const milestones = referrerData.referralMilestonesClaimed || {};
      let milestoneBonus = 0;
      const newMilestones = { ...milestones };

      if (newActivated >= 5 && !milestones.recruiter) {
        newMilestones.recruiter = true;
        milestoneBonus += 50;
        const milestoneLedgerRef = db.collection('users').doc(referrerId).collection('pointsLedger').doc(`milestone_recruiter_${referrerId}_${newActivated}`);
        transaction.set(milestoneLedgerRef, {
          type: 'referral_milestone_bonus',
          points: 50,
          createdAt: FieldValue.serverTimestamp(),
          metadata: {
            message: 'Milestone: Recruiter (5 aktivierte Referrals)'
          }
        });
      }

      if (newActivated >= 25 && !milestones.ambassador) {
        newMilestones.ambassador = true;
        milestoneBonus += 200;
        const milestoneLedgerRef = db.collection('users').doc(referrerId).collection('pointsLedger').doc(`milestone_ambassador_${referrerId}_${newActivated}`);
        transaction.set(milestoneLedgerRef, {
          type: 'referral_milestone_bonus',
          points: 200,
          createdAt: FieldValue.serverTimestamp(),
          metadata: {
            message: 'Milestone: Ambassador (25 aktivierte Referrals)'
          }
        });
      }

      if (newActivated >= 100 && !milestones.communityLegend) {
        newMilestones.communityLegend = true;
        milestoneBonus += 1000;
        const milestoneLedgerRef = db.collection('users').doc(referrerId).collection('pointsLedger').doc(`milestone_community_legend_${referrerId}_${newActivated}`);
        transaction.set(milestoneLedgerRef, {
          type: 'referral_milestone_bonus',
          points: 1000,
          createdAt: FieldValue.serverTimestamp(),
          metadata: {
            message: 'Milestone: Community Legend (100 aktivierte Referrals)'
          }
        });
      }

      if (milestoneBonus > 0) {
        referrerUpdates.pointsBalance = referrerBalance + milestoneBonus;
        referrerUpdates.pointsLifetime = referrerLifetime + milestoneBonus;
        referrerUpdates.level = calculateLevel(referrerUpdates.pointsLifetime);
        referrerUpdates.referralMilestonesClaimed = newMilestones;
      }

      transaction.update(referrerRef, referrerUpdates);

      console.log(`Referral activated for ${referredUserId}. Referrer ${referrerId} awarded 25 points.`);
    });
  } catch (error) {
    console.error(`Error in maybeActivateReferral for user ${referredUserId}:`, error);
  }
}

export const getPublicProfile = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const callerUid = request.auth.uid;
  const targetUserId = request.data.targetUserId;
  if (!targetUserId) {
    throw new HttpsError('invalid-argument', 'Missing targetUserId.');
  }

  const db = admin.firestore();

  const [callerSnap, targetSnap] = await Promise.all([
    db.collection('users').doc(callerUid).get(),
    db.collection('users').doc(targetUserId).get()
  ]);

  // Mask all not-found/banned/blocked cases with the exact same neutral error
  const neutralError = new HttpsError('permission-denied', 'User profile is not available.');

  if (!targetSnap.exists) {
    throw neutralError;
  }

  const targetData = targetSnap.data()!;

  if (targetData.isBanned) {
    throw neutralError;
  }

  const targetBlacklist = targetData.blacklist || {};
  const targetBlockedCaller = (targetBlacklist.hard || []).includes(callerUid) || (targetBlacklist.soft || []).includes(callerUid);
  if (targetBlockedCaller) {
    throw neutralError;
  }

  if (callerSnap.exists) {
    const callerData = callerSnap.data()!;
    const callerBlacklist = callerData.blacklist || {};
    const callerBlockedTarget = (callerBlacklist.hard || []).includes(targetUserId) || (callerBlacklist.soft || []).includes(targetUserId);
    if (callerBlockedTarget) {
      throw neutralError;
    }
  }

  return {
    uid: targetUserId,
    displayName: targetData.displayName || null,
    username: targetData.username || null,
    photoURL: targetData.photoURL || null,
    age: targetData.age || null,
    location: targetData.location || null, // Coarse string only (e.g. city)
    bio: targetData.bio || null,
    interests: targetData.interests || [],
    isPremium: targetData.isPremium || false,
    isSupporter: targetData.isSupporter || false,
    isCreator: targetData.isCreator || false,
    isExplorer: targetData.isExplorer || false,
    isOrganizer: targetData.isOrganizer || false,
    level: targetData.level || 1,
    ratingCount: targetData.ratingCount || 0,
    averageRating: targetData.averageRating || 0
  };
});

export const searchUserByUsername = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const username = request.data.username;
  if (!username || typeof username !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid username.');
  }

  const db = admin.firestore();
  const querySnapshot = await db.collection('users')
    .where('username', '==', username.trim().toLowerCase())
    .limit(1)
    .get();

  const neutralError = new HttpsError('permission-denied', 'User profile is not available.');

  if (querySnapshot.empty) {
    throw neutralError;
  }

  const doc = querySnapshot.docs[0];
  const targetData = doc.data();
  const callerUid = request.auth.uid;

  if (targetData.isBanned) {
    throw neutralError;
  }

  const targetBlacklist = targetData.blacklist || {};
  const targetBlockedCaller = (targetBlacklist.hard || []).includes(callerUid) || (targetBlacklist.soft || []).includes(callerUid);
  if (targetBlockedCaller) {
    throw neutralError;
  }

  const callerSnap = await db.collection('users').doc(callerUid).get();
  if (callerSnap.exists) {
    const callerData = callerSnap.data()!;
    const callerBlacklist = callerData.blacklist || {};
    const callerBlockedTarget = (callerBlacklist.hard || []).includes(doc.id) || (callerBlacklist.soft || []).includes(doc.id);
    if (callerBlockedTarget) {
      throw neutralError;
    }
  }

  return {
    uid: doc.id,
    displayName: targetData.displayName || null,
    username: targetData.username || null,
    photoURL: targetData.photoURL || null,
    age: targetData.age || null,
    location: targetData.location || null,
    bio: targetData.bio || null,
    interests: targetData.interests || [],
    isPremium: targetData.isPremium || false,
    isSupporter: targetData.isSupporter || false,
    isCreator: targetData.isCreator || false,
    isExplorer: targetData.isExplorer || false,
    isOrganizer: targetData.isOrganizer || false,
    level: targetData.level || 1,
    ratingCount: targetData.ratingCount || 0,
    averageRating: targetData.averageRating || 0
  };
});

export const checkUsernameAvailability = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const username = request.data.username;
  if (!username || typeof username !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid username.');
  }

  const trimmed = username.trim().toLowerCase();

  // Check reserved usernames — return unavailable (same as taken)
  if (isReservedUsername(trimmed)) {
    return { available: false };
  }

  const db = admin.firestore();

  // Check the usernames lock collection first
  const lockDoc = await db.collection('usernames').doc(trimmed).get();
  if (lockDoc.exists) {
    const lockData = lockDoc.data();
    const isSelf = lockData?.uid === request.auth.uid;
    return { available: isSelf };
  }

  // Fallback: also check users collection for legacy usernames without lock docs
  const querySnapshot = await db.collection('users')
    .where('username', '==', trimmed)
    .limit(1)
    .get();

  if (querySnapshot.empty) {
    return { available: true };
  }

  const existingUserDoc = querySnapshot.docs[0];
  const isSelf = existingUserDoc.id === request.auth.uid;

  return { available: isSelf };
});

/**
 * claimUsername – Server-side username claiming/updating.
 *
 * Validates the username (length, pattern, moderation, reserved list),
 * ensures uniqueness via a transactional lock in the `usernames` collection,
 * and atomically updates `users/{uid}.username` + `users/{uid}.usernameLowercase`.
 *
 * The `usernames/{usernameLower}` lock document stores { uid, username, claimedAt }
 * and guarantees no two users can hold the same username.
 */
export const claimUsername = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const uid = request.auth.uid;
  const rawUsername = request.data?.username;

  if (!rawUsername || typeof rawUsername !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid username.');
  }

  const cleanUsername = rawUsername.trim().toLowerCase().replace(/\s+/g, '');

  // Full server-side validation: length, pattern, moderation, reserved
  if (!isValidUsername(cleanUsername)) {
    throw new HttpsError('invalid-argument', 'USERNAME_NOT_AVAILABLE');
  }

  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  const newLockRef = db.collection('usernames').doc(cleanUsername);

  await db.runTransaction(async (transaction) => {
    // 1. Read the user document to get the current username (if any)
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User profile not found.');
    }

    const userData = userSnap.data() || {};
    const currentUsername: string | undefined = userData.username;
    const currentUsernameLower: string | undefined = (currentUsername || '').trim().toLowerCase() || undefined;

    // If the username hasn't changed, no-op
    if (currentUsernameLower === cleanUsername) {
      return;
    }

    // 2. Check if the new username lock doc already exists
    const newLockSnap = await transaction.get(newLockRef);
    if (newLockSnap.exists) {
      const lockData = newLockSnap.data();
      if (lockData?.uid !== uid) {
        // Another user owns this username
        throw new HttpsError('already-exists', 'USERNAME_NOT_AVAILABLE');
      }
      // We already own this lock (shouldn't happen given the no-op above, but handle gracefully)
    }

    // 3. Delete the old lock doc if user had a previous username
    if (currentUsernameLower && currentUsernameLower !== cleanUsername) {
      const oldLockRef = db.collection('usernames').doc(currentUsernameLower);
      const oldLockSnap = await transaction.get(oldLockRef);
      if (oldLockSnap.exists && oldLockSnap.data()?.uid === uid) {
        transaction.delete(oldLockRef);
      }
    }

    // 4. Create the new lock doc
    transaction.set(newLockRef, {
      uid: uid,
      username: cleanUsername,
      claimedAt: FieldValue.serverTimestamp(),
    });

    // 5. Update the user document with the new username
    const updateFields: Record<string, any> = {
      username: cleanUsername,
      usernameLowercase: cleanUsername,
    };

    // Track username change history (for rate limiting)
    if (currentUsername) {
      updateFields.usernameLastChangedAt = FieldValue.serverTimestamp();
      // Keep recent change timestamps (last hour) for hourly rate limiting
      const existingHistory: any[] = userData.usernameChangeHistory || [];
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const recentChanges = existingHistory.filter((ts: any) => {
        const millis = ts?.toMillis ? ts.toMillis() : (ts?._seconds ? ts._seconds * 1000 : 0);
        return millis > oneHourAgo;
      });
      recentChanges.push(admin.firestore.Timestamp.now());
      updateFields.usernameChangeHistory = recentChanges;
    }

    transaction.update(userRef, updateFields);
  });

  return { success: true, username: cleanUsername };
});

export const earnToken = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const adWatchId = request.data?.adWatchId;
  if (!adWatchId || typeof adWatchId !== 'string' || adWatchId.trim() === '' || adWatchId.length > 100) {
    throw new HttpsError('invalid-argument', 'Missing or invalid adWatchId. Must be a non-empty string under 100 characters.');
  }

  const trimmedAdWatchId = adWatchId.trim();
  const uid = request.auth.uid;
  const db = admin.firestore();
  
  const txRef = db.collection('users').doc(uid).collection('tokenTransactions').doc(trimmedAdWatchId);
  const userRef = db.collection('users').doc(uid);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  await db.runTransaction(async (transaction) => {
    // 1. Check idempotency
    const txSnap = await transaction.get(txRef);
    if (txSnap.exists) {
      throw new HttpsError('already-exists', 'Reward has already been claimed for this ad watch.');
    }

    // 2. Read user data
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User profile not found.');
    }

    const userData = userSnap.data() || {};
    const lastTokenEarnedAt = userData.lastTokenEarnedAt ? (userData.lastTokenEarnedAt.toDate ? userData.lastTokenEarnedAt.toDate() : new Date(userData.lastTokenEarnedAt)) : null;
    const tokensEarnedToday = userData.tokensEarnedToday || 0;
    const lastTokenEarnedDay = userData.lastTokenEarnedDay || '';

    // 3. Enforce rate limiting: Cooldown of 10 seconds between ad watches
    if (lastTokenEarnedAt && (now.getTime() - lastTokenEarnedAt.getTime() < 10000)) {
      throw new HttpsError('resource-exhausted', 'Please wait before claiming another token (cooldown active).');
    }

    // 4. Enforce rate limiting: Daily limit of 5 tokens per calendar day
    let newTokensEarnedToday = tokensEarnedToday;
    if (lastTokenEarnedDay === todayStr) {
      if (tokensEarnedToday >= 5) {
        throw new HttpsError('resource-exhausted', 'Daily limit of 5 tokens reached.');
      }
      newTokensEarnedToday = tokensEarnedToday + 1;
    } else {
      newTokensEarnedToday = 1;
    }

    // 5. Update user profile balances
    const currentTokens = userData.tokens || 0;
    transaction.update(userRef, {
      tokens: currentTokens + 1,
      lastTokenEarnedAt: admin.firestore.Timestamp.fromDate(now),
      tokensEarnedToday: newTokensEarnedToday,
      lastTokenEarnedDay: todayStr
    });

    // 6. Write transaction ledger (atomically)
    transaction.set(txRef, {
      userId: uid,
      type: "earn_ad_watch",
      amount: 1,
      createdAt: FieldValue.serverTimestamp(),
      sourceEventId: trimmedAdWatchId
    });
  });

  return { success: true };
});

export const resolveLoginIdentifier = onCall(async (request) => {
  const username = request.data?.username;
  if (!username || typeof username !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid username.');
  }

  const trimmedUsername = username.trim().toLowerCase();
  if (trimmedUsername.length < 4 || trimmedUsername.length > 32 || !/^[a-zA-Z0-9._]+$/.test(trimmedUsername)) {
    return { email: null };
  }

  const db = admin.firestore();
  
  // 1. Try querying against usernameLowercase
  let querySnapshot = await db.collection('users')
    .where('usernameLowercase', '==', trimmedUsername)
    .limit(1)
    .get();

  // 2. Fallback to username
  if (querySnapshot.empty) {
    querySnapshot = await db.collection('users')
      .where('username', '==', trimmedUsername)
      .limit(1)
      .get();
  }

  if (querySnapshot.empty) {
    return { email: null };
  }

  const userData = querySnapshot.docs[0].data();
  return { email: userData.email || null };
});

/**
 * Callable function to securely send a friend request.
 * Derives the sender ID exclusively from the auth token.
 */
export const secureSendFriendRequest = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Der Nutzer muss eingeloggt sein.');
  }

  const toUserId = request.data?.toUserId;
  if (!toUserId || typeof toUserId !== 'string' || toUserId.trim() === '') {
    throw new HttpsError('invalid-argument', 'toUserId ist ein Pflichtfeld.');
  }

  const fromUserId = request.auth.uid;
  if (fromUserId === toUserId) {
    throw new HttpsError('failed-precondition', 'Selbst-Freundschaftsanfragen sind nicht erlaubt.');
  }

  const db = admin.firestore();
  const fromUserRef = db.collection('users').doc(fromUserId);
  const toUserRef = db.collection('users').doc(toUserId);
  const notificationRef = db.collection('notifications').doc();

  try {
    await db.runTransaction(async (transaction) => {
      const fromUserSnap = await transaction.get(fromUserRef);
      const toUserSnap = await transaction.get(toUserRef);

      if (!fromUserSnap.exists) {
        throw new HttpsError('not-found', 'Profil des Senders existiert nicht.');
      }
      if (!toUserSnap.exists) {
        throw new HttpsError('not-found', 'Profil des Empfängers existiert nicht.');
      }

      const fromUserProfile = fromUserSnap.data() || {};
      const toUserProfile = toUserSnap.data() || {};

      if (fromUserProfile.isBanned) {
        throw new HttpsError('failed-precondition', 'Dein Account ist gesperrt.');
      }
      if (toUserProfile.isBanned) {
        throw new HttpsError('failed-precondition', 'Der Zielnutzer ist gesperrt.');
      }

      const friends = fromUserProfile.friends || [];
      const sent = fromUserProfile.friendRequestsSent || [];
      const received = fromUserProfile.friendRequestsReceived || [];

      if (friends.includes(toUserId)) {
        throw new HttpsError('already-exists', 'Ihr seid bereits befreundet.');
      }
      if (sent.includes(toUserId)) {
        throw new HttpsError('already-exists', 'Eine Freundschaftsanfrage wurde bereits gesendet.');
      }
      if (received.includes(toUserId)) {
        throw new HttpsError('already-exists', 'Dieser Nutzer hat dir bereits eine Anfrage gesendet.');
      }

      // Blacklist / Block check
      const fromBlacklist = fromUserProfile.blacklist || {};
      const toBlacklist = toUserProfile.blacklist || {};
      const fromHard = fromBlacklist.hard || [];
      const fromSoft = fromBlacklist.soft || [];
      const toHard = toBlacklist.hard || [];
      const toSoft = toBlacklist.soft || [];

      if (fromHard.includes(toUserId) || fromSoft.includes(toUserId)) {
        throw new HttpsError('permission-denied', 'Du hast diesen Nutzer blockiert.');
      }
      if (toHard.includes(fromUserId) || toSoft.includes(fromUserId)) {
        throw new HttpsError('permission-denied', 'Dieser Nutzer hat dich blockiert.');
      }

      // Update profiles
      transaction.update(fromUserRef, {
        friendRequestsSent: FieldValue.arrayUnion(toUserId)
      });
      transaction.update(toUserRef, {
        friendRequestsReceived: FieldValue.arrayUnion(fromUserId)
      });

      const senderUsername = fromUserProfile.username || null;
      const usernameFormatted = senderUsername ? `@${senderUsername.replace(/^@/, '')}` : 'Aktiva-Nutzer';

      // Write notification document with exact schema
      transaction.set(notificationRef, {
        recipientId: toUserId,
        senderId: fromUserId,
        senderProfile: {
          displayName: usernameFormatted,
          username: senderUsername,
          photoURL: fromUserProfile.photoURL || null
        },
        type: 'friend_request',
        isRead: false,
        createdAt: FieldValue.serverTimestamp()
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error(`secureSendFriendRequest failed from ${fromUserId} to ${toUserId}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', error.message || 'Fehler beim Senden der Freundschaftsanfrage.');
  }
});

/**
 * Callable function to securely accept a friend request.
 * Derives the acceptor ID exclusively from the auth token.
 */
export const secureAcceptFriendRequest = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Der Nutzer muss eingeloggt sein.');
  }

  const fromUserId = request.data?.fromUserId; // The user who sent the request
  if (!fromUserId || typeof fromUserId !== 'string' || fromUserId.trim() === '') {
    throw new HttpsError('invalid-argument', 'fromUserId ist ein Pflichtfeld.');
  }

  const currentUserId = request.auth.uid;
  if (currentUserId === fromUserId) {
    throw new HttpsError('failed-precondition', 'Selbst-Operationen sind nicht erlaubt.');
  }

  const db = admin.firestore();
  const currentUserRef = db.collection('users').doc(currentUserId);
  const fromUserRef = db.collection('users').doc(fromUserId);

  try {
    await db.runTransaction(async (transaction) => {
      const currentUserSnap = await transaction.get(currentUserRef);
      const fromUserSnap = await transaction.get(fromUserRef);

      if (!currentUserSnap.exists) {
        throw new HttpsError('not-found', 'Dein Nutzerprofil existiert nicht.');
      }
      if (!fromUserSnap.exists) {
        throw new HttpsError('not-found', 'Profil des Senders existiert nicht.');
      }

      const currentUserProfile = currentUserSnap.data() || {};
      const fromUserProfile = fromUserSnap.data() || {};

      if (currentUserProfile.isBanned) {
        throw new HttpsError('failed-precondition', 'Dein Account ist gesperrt.');
      }
      if (fromUserProfile.isBanned) {
        throw new HttpsError('failed-precondition', 'Der anfragende Nutzer ist gesperrt.');
      }

      const received = currentUserProfile.friendRequestsReceived || [];
      const sent = fromUserProfile.friendRequestsSent || [];

      if (!received.includes(fromUserId)) {
        throw new HttpsError('failed-precondition', 'Keine ausstehende Anfrage von diesem Nutzer gefunden.');
      }
      if (!sent.includes(currentUserId)) {
        throw new HttpsError('failed-precondition', 'Der anfragende Nutzer hat keine ausstehende Anfrage an dich.');
      }

      const friends = currentUserProfile.friends || [];
      if (friends.includes(fromUserId)) {
        throw new HttpsError('already-exists', 'Ihr seid bereits befreundet.');
      }

      // Blacklist / Block check
      const currentBlacklist = currentUserProfile.blacklist || {};
      const fromBlacklist = fromUserProfile.blacklist || {};
      const currentHard = currentBlacklist.hard || [];
      const currentSoft = currentBlacklist.soft || [];
      const fromHard = fromBlacklist.hard || [];
      const fromSoft = fromBlacklist.soft || [];

      if (currentHard.includes(fromUserId) || currentSoft.includes(fromUserId) ||
          fromHard.includes(currentUserId) || fromSoft.includes(currentUserId)) {
        throw new HttpsError('permission-denied', 'Die Aktion ist blockiert.');
      }

      // Update profiles
      transaction.update(currentUserRef, {
        friendRequestsReceived: FieldValue.arrayRemove(fromUserId),
        friends: FieldValue.arrayUnion(fromUserId)
      });
      transaction.update(fromUserRef, {
        friendRequestsSent: FieldValue.arrayRemove(currentUserId),
        friends: FieldValue.arrayUnion(currentUserId)
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error(`secureAcceptFriendRequest failed for ${currentUserId} from ${fromUserId}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', error.message || 'Fehler beim Bestätigen der Freundschaftsanfrage.');
  }
});





