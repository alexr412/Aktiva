import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { z } from 'zod';
import { defineSecret } from 'firebase-functions/params';
import { createNotificationAndDispatch, dispatchNearbyActivityNotifications } from './notifications';
import { calculateLevel, maybeActivateReferral } from './users';
import { getMaxOpenRoomsLimit, getParticipantLimit, isPremiumActive, parseTimestampMillis } from './limits-policy';
import { enforceRateLimit } from './rate-limit';
import { validateUserRequirements } from './activity-requirements-policy';

const GEOAPIFY_API_KEY = defineSecret('GEOAPIFY_API_KEY');

/**
 * Triggers when an activity is created. Awards +10 points to the host (daily cap of 2).
 */
export const onActivityCreated = onDocumentCreated({
  document: 'activities/{activityId}',
  retry: true
}, async (event) => {
  const snapshot = event.data;
  if (!snapshot) return null;
  const activity = snapshot.data();
  const activityId = event.params.activityId;
  const hostId = activity.hostId;

  if (!hostId) {
    console.warn(`Activity ${activityId} has no hostId.`);
    return null;
  }

  const db = admin.firestore();

  try {
    await db.runTransaction(async (transaction) => {
      // 1. Idempotency check
      const ledgerRef = db.collection('users').doc(hostId).collection('pointsLedger').doc(`event_created_${activityId}`);
      const ledgerSnap = await transaction.get(ledgerRef);
      if (ledgerSnap.exists) {
        console.log(`Event created points already awarded for activity ${activityId}`);
        return;
      }

      // 2. Query for event_created entries in the last 24 hours to enforce daily cap (max 2)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const query = db.collection('users').doc(hostId).collection('pointsLedger')
        .where('type', '==', 'event_created')
        .where('createdAt', '>=', oneDayAgo);
      
      const querySnap = await transaction.get(query);
      if (querySnap.size >= 2) {
        console.log(`Host ${hostId} has reached the daily limit of 2 event creation bonuses.`);
        return;
      }

      // 3. Retrieve host profile to update points and level
      const hostRef = db.collection('users').doc(hostId);
      const hostSnap = await transaction.get(hostRef);
      if (!hostSnap.exists) {
        console.warn(`Host profile for ${hostId} not found.`);
        return;
      }

      const hostData = hostSnap.data()!;
      const hostLifetime = (hostData.pointsLifetime || 0) + 10;
      const hostBalance = (hostData.pointsBalance || 0) + 10;
      const hostNewLevel = calculateLevel(hostLifetime);

      // 4. Award +10 points to host ledger
      transaction.set(ledgerRef, {
        type: 'event_created',
        points: 10,
        createdAt: FieldValue.serverTimestamp(),
        sourceId: activityId,
        metadata: {
          message: `Event erstellt: ${activity.title || 'Aktivität'}`
        }
      });

      // 5. Update host user profile
      transaction.update(hostRef, {
        pointsBalance: hostBalance,
        pointsLifetime: hostLifetime,
        level: hostNewLevel
      });

      console.log(`Awarded +10 event creation points to host ${hostId}. New balance: ${hostBalance}, level: ${hostNewLevel}`);
    });

    // Trigger referral activation on successful activity creation
    await maybeActivateReferral(hostId, 'first_activity_created');
  } catch (error) {
    console.error(`Error processing event creation bonus for activity ${activityId}:`, error);
  }

  // Dispatch nearby & friends push notifications for newly created activity
  dispatchNearbyActivityNotifications(activityId).catch((err) => {
    console.error(`Error dispatching nearby notifications for activity ${activityId}:`, err);
  });

  return null;
});

/**
 * Triggers when an activity document is updated. Handles:
 * 1. First participant joining the event (+20 host points).
 * 2. Host and joiner First Activity Bonus (+50 points, once-in-a-lifetime).
 */
export const onActivityUpdated = onDocumentUpdated({
  document: 'activities/{activityId}',
  retry: true
}, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  if (!before || !after) return null;

  const beforeParticipants = before.participantIds || [];
  const afterParticipants = after.participantIds || [];
  const hostId = after.hostId;
  const activityId = event.params.activityId;

  if (!hostId) return null;

  const db = admin.firestore();

  // A. Detect transition of first participant joining (length goes from 1 to 2)
  const justJoinedFirst = (beforeParticipants.length === 1 && afterParticipants.length === 2);

  if (justJoinedFirst) {
    try {
      await db.runTransaction(async (transaction) => {
        // Idempotency check for first join bonus
        const ledgerRef = db.collection('users').doc(hostId).collection('pointsLedger').doc(`event_first_join_${activityId}`);
        const ledgerSnap = await transaction.get(ledgerRef);
        if (ledgerSnap.exists) {
          console.log(`First participant joined bonus already awarded to host ${hostId} for activity ${activityId}`);
          return;
        }

        // Retrieve host profile
        const hostRef = db.collection('users').doc(hostId);
        const hostSnap = await transaction.get(hostRef);
        if (!hostSnap.exists) return;

        const hostData = hostSnap.data()!;
        const hostLifetime = (hostData.pointsLifetime || 0) + 20;
        const hostBalance = (hostData.pointsBalance || 0) + 20;
        const hostNewLevel = calculateLevel(hostLifetime);

        // Award +20 points to host ledger
        transaction.set(ledgerRef, {
          type: 'event_joined_first',
          points: 20,
          createdAt: FieldValue.serverTimestamp(),
          sourceId: activityId,
          metadata: {
            message: `Erster Teilnehmer beigetreten: ${after.title || 'Aktivität'}`
          }
        });

        // Update host user profile
        transaction.update(hostRef, {
          pointsBalance: hostBalance,
          pointsLifetime: hostLifetime,
          level: hostNewLevel
        });

        console.log(`Awarded +20 points to host ${hostId} for first participant joining.`);
      });
    } catch (error) {
      console.error(`Error awarding first join points to host:`, error);
    }
  }

  // B. Detect First Activity Bonus (+50)
  // 1. Host first activity bonus when event gets first joiner
  if (justJoinedFirst) {
    try {
      await db.runTransaction(async (transaction) => {
        const hostLedgerRef = db.collection('users').doc(hostId).collection('pointsLedger').doc(`first_activity_bonus_${hostId}`);
        const hostLedgerSnap = await transaction.get(hostLedgerRef);
        if (hostLedgerSnap.exists) {
          // Already received
          return;
        }

        const hostRef = db.collection('users').doc(hostId);
        const hostSnap = await transaction.get(hostRef);
        if (!hostSnap.exists) return;

        const hostData = hostSnap.data()!;
        const hostLifetime = (hostData.pointsLifetime || 0) + 50;
        const hostBalance = (hostData.pointsBalance || 0) + 50;
        const hostNewLevel = calculateLevel(hostLifetime);

        transaction.set(hostLedgerRef, {
          type: 'first_activity_bonus',
          points: 50,
          createdAt: FieldValue.serverTimestamp(),
          sourceId: activityId,
          metadata: {
            message: 'Erste Aktivität (Erstes eigenes Event mit Teilnehmern)'
          }
        });

        transaction.update(hostRef, {
          pointsBalance: hostBalance,
          pointsLifetime: hostLifetime,
          level: hostNewLevel
        });

        console.log(`First Activity Bonus (+50) awarded to host ${hostId}`);
      });
    } catch (error) {
      console.error(`Error awarding First Activity Bonus to host:`, error);
    }
  }

  // 2. Joiner(s) first activity bonus on joining any event
  const newParticipants = afterParticipants.filter((id: string) => !beforeParticipants.includes(id));
  for (const joinerId of newParticipants) {
    // Don't award to host (already handled by host condition, plus host is in beforeParticipants anyway)
    if (joinerId === hostId) continue;

    try {
      await db.runTransaction(async (transaction) => {
        const joinerLedgerRef = db.collection('users').doc(joinerId).collection('pointsLedger').doc(`first_activity_bonus_${joinerId}`);
        const joinerLedgerSnap = await transaction.get(joinerLedgerRef);
        if (joinerLedgerSnap.exists) {
          // Already received
          return;
        }

        const joinerRef = db.collection('users').doc(joinerId);
        const joinerSnap = await transaction.get(joinerRef);
        if (!joinerSnap.exists) return;

        const joinerData = joinerSnap.data()!;
        const joinerLifetime = (joinerData.pointsLifetime || 0) + 50;
        const joinerBalance = (joinerData.pointsBalance || 0) + 50;
        const joinerNewLevel = calculateLevel(joinerLifetime);

        transaction.set(joinerLedgerRef, {
          type: 'first_activity_bonus',
          points: 50,
          createdAt: FieldValue.serverTimestamp(),
          sourceId: activityId,
          metadata: {
            message: 'Erste Aktivität (Teilnahme an einem Event)'
          }
        });

        transaction.update(joinerRef, {
          pointsBalance: joinerBalance,
          pointsLifetime: joinerLifetime,
          level: joinerNewLevel
        });

        console.log(`First Activity Bonus (+50) awarded to joiner ${joinerId}`);
      });

      // Fallback: Trigger referral activation on join
      await maybeActivateReferral(joinerId, 'first_activity_joined');
    } catch (error) {
      console.error(`Error awarding First Activity Bonus to joiner ${joinerId}:`, error);
    }
  }

  return null;
});

/**
 * Berechnet die Haversine-Entfernung in km.
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Extrahiert den Vornamen.
 */
function formatFirstName(displayName: string): string {
  if (!displayName) return "Ein Freund";
  const parts = displayName.trim().split(/\s+/);
  return parts[0];
}

/**
 * Cloud Function: Informiert Nutzer im Umkreis bei geboosteten Aktivitäten oder Aktivitäten von Freunden.
 */
export const notifyNearbyUsers = onDocumentCreated({
  document: 'activities/{activityId}',
  retry: true
}, async (event) => {
  const snapshot = event.data;
  if (!snapshot) return null;
  const activity = snapshot.data();
  const activityId = event.params.activityId;

  const activityLat = activity.lat;
  const activityLon = activity.lon;

  if (activityLat === undefined || activityLat === null || activityLon === undefined || activityLon === null) {
    console.warn(`Activity ${activityId} location coordinates (lat/lon) missing. Skipping notification.`);
    return null;
  }

  const hostId = activity.hostId || activity.creatorId;
  if (!hostId) {
    console.warn(`Activity ${activityId} has no hostId/creatorId. Skipping notification.`);
    return null;
  }

  const db = admin.firestore();

  // --- PATH A: Boosted Activity Notification (Public) ---
  if (activity.isBoosted) {
    const radius = 2; // 2km Radius
    try {
      // Suche alle Nutzer mit FCM Token
      const usersSnap = await db.collection("users")
        .where("fcmToken", "!=", null)
        .get();

      const tokens: string[] = [];
      usersSnap.forEach(doc => {
        const user = doc.data();

        // Check Opt-In: localHighlights muss aktiv sein
        if (!user.notificationSettings?.localHighlights) return;

        if (user.lastLocation && user.lastLocation.lat && user.lastLocation.lng && doc.id !== hostId) {
          const dist = calculateDistance(activityLat, activityLon, user.lastLocation.lat, user.lastLocation.lng);
          if (dist <= radius) {
            tokens.push(user.fcmToken);
          }
        }
      });

      if (tokens.length > 0) {
        const hostUsernameRaw = activity.hostUsername || null;
        const hostUsernameFormatted = hostUsernameRaw ? `@${hostUsernameRaw.replace(/^@/, '')}` : "Ein Nutzer";
        const placeName = activity.placeName || activity.title || "ein Highlight";
        const message = {
          notification: {
            title: "🔥 Hot in deiner Nähe!",
            body: `${hostUsernameFormatted} hat gerade ein Highlight gestartet: "${placeName}".`,
          },
          data: {
            activityId: activityId,
            source: "push",
            click_action: "FLUTTER_NOTIFICATION_CLICK"
          },
          tokens: tokens
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`Successfully sent ${response.successCount} boost notifications.`);
      }
    } catch (error) {
      console.error("Error sending boost notifications:", error);
    }
  }

  // --- PATH B: Friend Proximity Notification ---
  try {
    const hostDoc = await db.collection('users').doc(hostId).get();
    if (!hostDoc.exists) {
      console.warn(`Host profile for ${hostId} not found. Skipping friend notification.`);
      return null;
    }

    const hostProfile = hostDoc.data()!;
    const hostFriends: string[] = hostProfile.friends || [];
    const hostBlacklist = [...(hostProfile.blacklist?.hard || []), ...(hostProfile.blacklist?.soft || [])];

    // Filter out blocklists and self
    const friendsToNotify = hostFriends.filter(id => id !== hostId && !hostBlacklist.includes(id));

    if (friendsToNotify.length > 0) {
      // Load all friend profiles in parallel
      const friendDocs = await Promise.all(
        friendsToNotify.map(friendId => db.collection('users').doc(friendId).get())
      );

      const qualifiedFriends: { friendId: string; friendProfile: any }[] = [];

      for (const doc of friendDocs) {
        if (!doc.exists) continue;
        const friendProfile = doc.data()!;
        const friendId = doc.id;

        // Check if friend has blocked host
        const friendBlacklist = [...(friendProfile.blacklist?.hard || []), ...(friendProfile.blacklist?.soft || [])];
        if (friendBlacklist.includes(hostId)) continue;

        // Check toggle preference (default is true, so nearbyFriendActivityNotifications !== false)
        if (friendProfile.notificationSettings?.nearbyFriendActivityNotifications === false) continue;

        // Check location
        if (!friendProfile.lastLocation || typeof friendProfile.lastLocation.lat !== 'number' || typeof friendProfile.lastLocation.lng !== 'number') continue;

        // Calculate distance
        const dist = calculateDistance(activityLat, activityLon, friendProfile.lastLocation.lat, friendProfile.lastLocation.lng);

        // Determine radius threshold
        let allowedRadius = 10;
        if (friendProfile.proximitySettings && friendProfile.proximitySettings.enabled && typeof friendProfile.proximitySettings.radiusKm === 'number') {
          allowedRadius = friendProfile.proximitySettings.radiusKm;
        }

        if (dist <= allowedRadius) {
          qualifiedFriends.push({ friendId, friendProfile });
        }
      }

      if (qualifiedFriends.length > 0) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Perform async database checks in parallel (rate limits & idempotency)
        const checks = await Promise.all(qualifiedFriends.map(async (f) => {
          const friendId = f.friendId;
          const notifId = `friend_nearby_activity_${activityId}_${friendId}`;
          const notifRef = db.collection('notifications').doc(notifId);

          // Idempotency check
          const notifSnap = await notifRef.get();
          if (notifSnap.exists) return null;

          // Rate limit check
          const notifsSnap = await db.collection('notifications')
            .where('recipientId', '==', friendId)
            .where('type', '==', 'friend_nearby_activity')
            .where('createdAt', '>=', oneDayAgo)
            .get();

          if (notifsSnap.size >= 5) {
            console.log(`User ${friendId} has reached the daily limit of 5 nearby friend activity notifications.`);
            return null;
          }

          return { ...f, notifId, notifRef };
        }));

        const friendsToNotifyFinal = checks.filter((c): c is NonNullable<typeof c> => c !== null);

        if (friendsToNotifyFinal.length > 0) {
          const friendPushTokens: string[] = [];
          const hostUsername = hostProfile.username || null;
          const hostUsernameFormatted = hostUsername ? `@${hostUsername.replace(/^@/, '')}` : "Ein Freund";
          const activityTitle = activity.title || activity.placeName || "eine Aktivität";
          const messageText = `${hostUsernameFormatted} plant gerade "${activityTitle}" in deiner Nähe.`;

          const batch = db.batch();
          for (const f of friendsToNotifyFinal) {
            batch.set(f.notifRef, {
              recipientId: f.friendId,
              senderId: hostId,
              senderName: hostUsernameFormatted,
              senderProfile: {
                displayName: hostUsernameFormatted,
                username: hostUsername,
                photoURL: hostProfile.photoURL || null
              },
              type: 'friend_nearby_activity',
              title: 'Neue Aktivität in deiner Nähe',
              message: messageText,
              isRead: false,
              createdAt: FieldValue.serverTimestamp(),
              activityId: activityId,
              link: `/activities/${activityId}`
            });

            if (f.friendProfile.fcmToken) {
              friendPushTokens.push(f.friendProfile.fcmToken);
            }
          }

          await batch.commit();
          console.log(`Successfully saved ${friendsToNotifyFinal.length} friend notifications.`);

          if (friendPushTokens.length > 0) {
            const pushMessage = {
              notification: {
                title: "Neue Aktivität in deiner Nähe",
                body: messageText,
              },
              data: {
                activityId: activityId,
                source: "push",
                click_action: "FLUTTER_NOTIFICATION_CLICK"
              },
              tokens: friendPushTokens
            };

            const response = await admin.messaging().sendEachForMulticast(pushMessage);
            console.log(`Successfully sent ${response.successCount} friend push notifications.`);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error processing friend nearby notifications:", error);
  }

  return null;
});

export type Gender = 'female' | 'male' | 'diverse';
export const ALLOWED_GENDERS: readonly Gender[] = ['female', 'male', 'diverse'];

export interface ActivityRequirements {
  gender?: Gender[];
  ageRange?: { min?: number; max?: number };
  requireProfilePicture?: boolean;
  requireVerification?: boolean;
  minimumRating?: number;
}

export type EligibilityErrorCode =
  | 'ACCOUNT_NOT_ELIGIBLE'
  | 'GENDER_REQUIREMENT_NOT_MET'
  | 'AGE_REQUIREMENT_NOT_MET'
  | 'PROFILE_PICTURE_REQUIRED'
  | 'VERIFICATION_REQUIRED'
  | 'MINIMUM_RATING_NOT_MET'
  | 'REQUIREMENT_NOT_MET'
  | 'ACTIVITY_FULL'
  | 'ALREADY_PARTICIPANT'
  | 'USER_KICKED'
  | 'BLOCKED_BY_HOST'
  | 'HOST_BLOCKED_BY_USER';

export interface EligibilityResult {
  eligible: boolean;
  errorCode?: EligibilityErrorCode;
  errorMessage?: string;
}

/**
 * Normalizes and validates gender requirements array.
 * Rejects invalid strings, removes duplicates, limits length to 3.
 * Returns normalized array or undefined (for unrestricted).
 */
export function normalizeAndValidateGenderRequirements(genders: any): Gender[] | undefined {
  if (!genders || !Array.isArray(genders) || genders.length === 0) {
    return undefined;
  }
  const uniqueGenders = Array.from(new Set(genders));
  if (uniqueGenders.length > 3) {
    throw new HttpsError('invalid-argument', 'Invalid gender requirements: Too many entries (max 3).');
  }
  for (const g of uniqueGenders) {
    if (typeof g !== 'string' || !ALLOWED_GENDERS.includes(g as Gender)) {
      throw new HttpsError('invalid-argument', `Invalid gender requirement value: "${g}". Must be one of female, male, diverse.`);
    }
  }
  if (uniqueGenders.length === 3) {
    return undefined;
  }
  return uniqueGenders as Gender[];
}

/**
 * Central server-side activity eligibility validator.
 * Validates account status, requirements (gender, age, verification, photo), and participation state.
 */
export function validateActivityEligibility(
  activity: {
    participantIds?: string[];
    kickedUserIds?: string[];
    maxParticipants?: number;
    requirements?: ActivityRequirements;
    hostId?: string;
    status?: string;
  },
  userProfile: {
    uid?: string;
    accountStatus?: string;
    isBanned?: boolean;
    disabled?: boolean;
    suspendedUntil?: any;
    gender?: string;
    age?: number;
    photoURL?: string | null;
    kycStatus?: string;
    averageRating?: number;
    blacklist?: { hard?: string[]; soft?: string[] };
  },
  hostProfile?: {
    blacklist?: { hard?: string[]; soft?: string[] };
  }
): EligibilityResult {
  const uid = userProfile.uid;

  // 1. Account status checks
  const statusStr = typeof userProfile.accountStatus === 'string' ? userProfile.accountStatus.toLowerCase() : '';
  if (
    userProfile.isBanned === true ||
    userProfile.disabled === true ||
    statusStr === 'banned' ||
    statusStr === 'deleted' ||
    statusStr === 'disabled'
  ) {
    return { eligible: false, errorCode: 'ACCOUNT_NOT_ELIGIBLE', errorMessage: 'Dein Konto ist gesperrt oder deaktiviert.' };
  }

  if (statusStr === 'suspended' || userProfile.suspendedUntil) {
    let suspendTime: number | null = null;
    if (userProfile.suspendedUntil) {
      if (typeof userProfile.suspendedUntil.toMillis === 'function') {
        suspendTime = userProfile.suspendedUntil.toMillis();
      } else if (typeof userProfile.suspendedUntil === 'number') {
        suspendTime = userProfile.suspendedUntil;
      } else if (typeof userProfile.suspendedUntil === 'string') {
        const parsed = Date.parse(userProfile.suspendedUntil);
        if (!isNaN(parsed)) suspendTime = parsed;
      }
    }
    // Fail-closed for suspended status: missing, invalid, or future timestamp blocks
    if (statusStr === 'suspended') {
      if (suspendTime === null || isNaN(suspendTime) || suspendTime > Date.now()) {
        return { eligible: false, errorCode: 'ACCOUNT_NOT_ELIGIBLE', errorMessage: 'Dein Konto ist vorübergehend temporär gesperrt.' };
      }
    } else if (suspendTime !== null && !isNaN(suspendTime) && suspendTime > Date.now()) {
      return { eligible: false, errorCode: 'ACCOUNT_NOT_ELIGIBLE', errorMessage: 'Dein Konto ist vorübergehend temporär gesperrt.' };
    }
  }

  // 2. Kicked & Already joined checks
  if (uid && Array.isArray(activity.kickedUserIds) && activity.kickedUserIds.includes(uid)) {
    return { eligible: false, errorCode: 'USER_KICKED', errorMessage: 'Du wurdest aus diesem Event entfernt.' };
  }
  if (uid && Array.isArray(activity.participantIds) && activity.participantIds.includes(uid)) {
    return { eligible: false, errorCode: 'ALREADY_PARTICIPANT', errorMessage: 'Du nimmst bereits an diesem Event teil.' };
  }

  // 3. Blacklist / Block checks
  if (uid && hostProfile?.blacklist) {
    const hard = hostProfile.blacklist.hard || [];
    const soft = hostProfile.blacklist.soft || [];
    if (hard.includes(uid) || soft.includes(uid)) {
      return { eligible: false, errorCode: 'BLOCKED_BY_HOST', errorMessage: 'Du kannst dieser Aktivität nicht beitreten.' };
    }
  }
  if (activity.hostId && userProfile.blacklist) {
    const hard = userProfile.blacklist.hard || [];
    const soft = userProfile.blacklist.soft || [];
    if (hard.includes(activity.hostId) || soft.includes(activity.hostId)) {
      return { eligible: false, errorCode: 'HOST_BLOCKED_BY_USER', errorMessage: 'Du hast den Host dieser Aktivität blockiert.' };
    }
  }

  // 4. Participant limit check
  const participantIds = activity.participantIds || [];
  if (activity.maxParticipants && participantIds.length >= activity.maxParticipants) {
    return { eligible: false, errorCode: 'ACTIVITY_FULL', errorMessage: 'Diese Aktivität hat die maximale Teilnehmerzahl erreicht.' };
  }

  // 5. Requirements validation
  if (activity.requirements) {
    try {
      validateUserRequirements(userProfile, activity.requirements);
    } catch (err: any) {
      const msg = err?.message || '';
      let errorCode: EligibilityErrorCode = 'REQUIREMENT_NOT_MET';
      if (msg.includes('Geschlecht')) {
        errorCode = 'GENDER_REQUIREMENT_NOT_MET';
      } else if (msg.includes('Profilbild')) {
        errorCode = 'PROFILE_PICTURE_REQUIRED';
      } else if (msg.includes('Identität') || msg.includes('verifiziert')) {
        errorCode = 'VERIFICATION_REQUIRED';
      } else if (msg.includes('Bewertung')) {
        errorCode = 'MINIMUM_RATING_NOT_MET';
      } else if (msg.includes('Alter') || msg.includes('Mindestalter') || msg.includes('Maximalalter') || msg.includes('Geburtsdatum')) {
        errorCode = 'AGE_REQUIREMENT_NOT_MET';
      }
      return {
        eligible: false,
        errorCode,
        errorMessage: msg || 'Aktivitätsanforderungen nicht erfüllt.'
      };
    }
  }

  return { eligible: true };
}

/**
 * HTTPS Callable: Beantwortet eine Beitrittsanfrage für eine Aktivität (durch den Host).
 */
export const respondToJoinRequest = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const hostId = request.auth.uid;
  const { notificationId, activityId, userIdToJoin, action, customMessage } = request.data;

  if (typeof notificationId !== 'string' || !notificationId ||
      typeof activityId !== 'string' || !activityId ||
      typeof userIdToJoin !== 'string' || !userIdToJoin ||
      typeof action !== 'string' || !action) {
    throw new HttpsError('invalid-argument', 'Missing or invalid required arguments.');
  }

  if (action !== 'accept' && action !== 'decline') {
    throw new HttpsError('invalid-argument', 'Invalid action. Must be accept or decline.');
  }

  const db = admin.firestore();

  try {
    const result = await db.runTransaction(async (transaction) => {
      // 1. Get and verify the activity
      const activityRef = db.collection('activities').doc(activityId);
      const activitySnap = await transaction.get(activityRef);
      if (!activitySnap.exists) {
        throw new HttpsError('not-found', 'Activity not found.');
      }
      const activity = activitySnap.data()!;

      if (activity.hostId !== hostId) {
        throw new HttpsError('permission-denied', 'Only the activity host can respond to join requests.');
      }

      // Check if activity is joinable
      const status = activity.status || 'active';
      if (status !== 'active' && status !== 'open') {
        throw new HttpsError('failed-precondition', 'Activity is no longer active.');
      }
      if (activity.isCancelled || activity.isDeleted || activity.isBlacklisted) {
        throw new HttpsError('failed-precondition', 'Activity is cancelled, deleted, or blacklisted.');
      }

      // 2. Get and verify the notification
      const notifRef = db.collection('notifications').doc(notificationId);
      const notifSnap = await transaction.get(notifRef);
      if (!notifSnap.exists) {
        throw new HttpsError('not-found', 'Join request notification not found.');
      }
      const notif = notifSnap.data()!;
      const notifActivityId = notif.activityId || notif.entityId;
      if (
        notif.type !== 'join_request' ||
        notifActivityId !== activityId ||
        notif.senderId !== userIdToJoin ||
        notif.recipientId !== hostId
      ) {
        throw new HttpsError('invalid-argument', 'Notification mismatch.');
      }

      // 3. Get and verify the user to join
      const userRef = db.collection('users').doc(userIdToJoin);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new HttpsError('not-found', 'User profile not found.');
      }
      const userProfile = userSnap.data()!;
      if (userProfile.isBanned) {
        throw new HttpsError('failed-precondition', 'User is banned.');
      }

      // 4. Get host notification meta state (Read phase - MUST be before any writes)
      const metaRef = db.collection('users').doc(hostId).collection('notification_meta').doc('state');
      const metaSnap = await transaction.get(metaRef);

      const deleteNotificationAndDecrementUnread = () => {
        if (!notif.isRead) {
          const currentUnread = metaSnap.exists ? (metaSnap.data()?.unreadCount || 0) : 0;
          const nextUnread = Math.max(0, currentUnread - 1);
          transaction.set(metaRef, {
            unreadCount: nextUnread,
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
        }
        transaction.delete(notifRef);
      };

      // 5. Verify if already participant or kicked
      const participantIds = activity.participantIds || [];
      const kickedUserIds = activity.kickedUserIds || [];
      if (kickedUserIds.includes(userIdToJoin)) {
        throw new HttpsError('permission-denied', 'User was removed from this activity and cannot rejoin.');
      }
      if (participantIds.includes(userIdToJoin)) {
        // If already joined, resolve/delete the request and decrement unread counter if unread
        deleteNotificationAndDecrementUnread();
        return { success: true, alreadyParticipant: true };
      }

      if (action === 'accept') {
        const userProfileData = { ...userProfile, uid: userIdToJoin };
        const hostRef = db.collection('users').doc(hostId);
        const hostSnap = await transaction.get(hostRef);
        const hostData = hostSnap.exists ? hostSnap.data() : undefined;

        const eligibility = validateActivityEligibility(activity, userProfileData, hostData);
        if (!eligibility.eligible) {
          throw new HttpsError('failed-precondition', `${eligibility.errorCode}: ${eligibility.errorMessage}`, {
            errorCode: eligibility.errorCode,
            errorMessage: eligibility.errorMessage
          });
        }
        // Enforce capacity/maxParticipants limit
        if (activity.maxParticipants && participantIds.length >= activity.maxParticipants) {
          throw new HttpsError('resource-exhausted', 'This activity has reached its maximum participants limit.');
        }

        const userLanguage = userProfile.language || 'de';
        const userUsername = userProfile.username || null;
        const usernameFormatted = userUsername ? `@${userUsername.replace(/^@/, '')}` : (userLanguage === 'de' ? 'Activa-Nutzer' : 'Activa user');
        const displayNameToUse = usernameFormatted;
        const photoURLToUse = userProfile.photoURL || null;

        // Update activity
        transaction.update(activityRef, {
          participantIds: FieldValue.arrayUnion(userIdToJoin),
          lastInteractionAt: FieldValue.serverTimestamp(),
          [`participantDetails.${userIdToJoin}`]: {
            displayName: displayNameToUse,
            username: userUsername,
            photoURL: photoURLToUse,
            isPremium: userProfile.isPremium || false,
            isSupporter: userProfile.isSupporter || false,
            checkInStatus: 'pending',
            hasReviewed: false
          }
        });

        // Update participantsPreview (max 5)
        const currentPreviews = activity.participantsPreview || [];
        if (currentPreviews.length < 5 && !currentPreviews.some((p: any) => p.uid === userIdToJoin)) {
          transaction.update(activityRef, {
            participantsPreview: FieldValue.arrayUnion({
              uid: userIdToJoin,
              displayName: displayNameToUse,
              username: userUsername,
              photoURL: photoURLToUse
            })
          });
        }

        // Update chat
        const chatRef = db.collection('chats').doc(activityId);
        transaction.update(chatRef, {
          participantIds: FieldValue.arrayUnion(userIdToJoin),
          [`participantDetails.${userIdToJoin}`]: {
            displayName: displayNameToUse,
            username: userUsername,
            photoURL: photoURLToUse,
            isPremium: userProfile.isPremium || false,
            isSupporter: userProfile.isSupporter || false,
            checkInStatus: 'pending'
          },
          [`unreadCount.${userIdToJoin}`]: 0
        });

        // Add to participants subcollection
        const pSubRef = activityRef.collection('participants').doc(userIdToJoin);
        transaction.set(pSubRef, {
          uid: userIdToJoin,
          displayName: displayNameToUse,
          photoURL: photoURLToUse,
          checkInStatus: 'pending',
          joinedAt: FieldValue.serverTimestamp(),
          hasReviewed: false
        });

        // Delete original join request & decrement host unread counter
        deleteNotificationAndDecrementUnread();

      } else {
        // action === 'decline'
        // Delete original join request & decrement host unread counter
        deleteNotificationAndDecrementUnread();
      }

      return { success: true, activityTitle: activity.placeName || activity.title || 'Aktivität' };
    });

    const isAccept = action === 'accept';
    await createNotificationAndDispatch({
      recipientId: userIdToJoin,
      actorId: hostId,
      type: 'join_response',
      title: isAccept ? 'Anfrage akzeptiert!' : 'Anfrage abgelehnt',
      body: isAccept
        ? `Deine Anfrage für "${result.activityTitle}" wurde angenommen. Du bist jetzt dabei!`
        : (customMessage || `Deine Anfrage für "${result.activityTitle}" wurde leider abgelehnt.`),
      targetUrl: isAccept ? `/chat/${activityId}` : `/activities/${activityId}`,
      entityId: activityId,
      eventId: `join_response_${activityId}_${userIdToJoin}_${action}`,
      responseStatus: isAccept ? 'accepted' : 'declined',
      customMessage: customMessage || undefined
    }).catch(err => console.error('[respondToJoinRequest] Dispatch failed:', err));

    if (action === 'accept') {
      await maybeActivateReferral(userIdToJoin, 'first_activity_joined');
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error in respondToJoinRequest transaction:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error.message || 'Internal error responding to join request.');
  }
});

/**
 * HTTPS Callable: Sendet eine Beitrittsanfrage für eine Aktivität (idempotent).
 */
export const secureRequestJoinActivity = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const requesterId = request.auth.uid;
  const { activityId, message } = request.data;

  if (typeof activityId !== 'string' || !activityId) {
    throw new HttpsError('invalid-argument', 'Missing or invalid required arguments.');
  }

  const db = admin.firestore();

  try {
    const result = await db.runTransaction(async (transaction) => {
      const activityRef = db.collection('activities').doc(activityId);
      const requesterRef = db.collection('users').doc(requesterId);
      const notificationRef = db.collection('notifications').doc(`join_request_${activityId}_${requesterId}`);

      const [activitySnap, requesterSnap, notificationSnap] = await Promise.all([
        transaction.get(activityRef),
        transaction.get(requesterRef),
        transaction.get(notificationRef)
      ]);

      if (!activitySnap.exists) {
        throw new HttpsError('not-found', 'Activity does not exist.');
      }

      const activity = activitySnap.data()!;
      if (activity.status !== 'active') {
        throw new HttpsError('failed-precondition', 'Activity is not active.');
      }

      const joinMode = activity.joinMode || 'request';
      if (joinMode === 'direct') {
        throw new HttpsError('failed-precondition', 'Direct join activities cannot use request join.');
      }

      if (requesterId === activity.hostId) {
        throw new HttpsError('failed-precondition', 'You cannot request to join your own activity.');
      }

      const participantIds = activity.participantIds || [];
      const kickedUserIds = activity.kickedUserIds || [];
      if (kickedUserIds.includes(requesterId)) {
        throw new HttpsError('permission-denied', 'You have been removed from this activity and cannot rejoin.');
      }
      if (participantIds.includes(requesterId)) {
        throw new HttpsError('already-exists', 'You are already a participant of this activity.');
      }

      if (!requesterSnap.exists) {
        throw new HttpsError('not-found', 'Requester user profile not found.');
      }

      const requesterData = requesterSnap.data()!;
      requesterData.uid = requesterId;

      const hostId = activity.hostId;
      const hostRef = db.collection('users').doc(hostId);
      const hostSnap = await transaction.get(hostRef);
      if (!hostSnap.exists) {
        throw new HttpsError('not-found', 'Host profile not found.');
      }

      const hostData = hostSnap.data()!;
      if (hostData.isBanned === true) {
        throw new HttpsError('permission-denied', 'Host account is banned.');
      }

      const eligibility = validateActivityEligibility(activity, requesterData, hostData);
      if (!eligibility.eligible) {
        throw new HttpsError('failed-precondition', `${eligibility.errorCode}: ${eligibility.errorMessage}`, {
          errorCode: eligibility.errorCode,
          errorMessage: eligibility.errorMessage
        });
      }

      if (activity.isPaid === true) {
        throw new HttpsError('failed-precondition', 'Paid activities cannot be request-joined directly.');
      }

      if (notificationSnap.exists) {
        const existingNotif = notificationSnap.data()!;
        if (existingNotif.type === 'join_request') {
          return { success: true, status: 'already_requested' };
        }
      }

      const requesterUsername = requesterData.username || null;
      const requesterDisplayName = requesterData.displayName || null;
      const usernameFormatted = requesterUsername ? `@${requesterUsername.replace(/^@/, '')}` : (requesterDisplayName || 'Activa-Nutzer');
      const photoURLToUse = requesterData.photoURL || null;

      const senderProfile = {
        displayName: requesterDisplayName || usernameFormatted,
        username: requesterUsername,
        photoURL: photoURLToUse
      };

      return { success: true, status: 'requested', hostId, requesterId, activityTitle: activity.placeName || activity.title || 'Treffen', senderProfile };
    });

    if (result.status === 'requested' && result.hostId) {
      const rawUsername = result.senderProfile?.username;
      const rawDisplayName = result.senderProfile?.displayName;
      let requesterName = 'Ein Nutzer';
      if (rawUsername && typeof rawUsername === 'string' && rawUsername.trim().length > 0) {
        const cleanUser = rawUsername.trim().replace(/^@+/, '');
        if (cleanUser.length > 0) {
          requesterName = `@${cleanUser}`;
        }
      } else if (rawDisplayName && typeof rawDisplayName === 'string' && rawDisplayName.trim().length > 0) {
        requesterName = rawDisplayName.trim();
      }

      await createNotificationAndDispatch({
        recipientId: result.hostId,
        actorId: result.requesterId,
        type: 'join_request',
        title: 'Neue Beitrittsanfrage',
        body: message || `${requesterName} möchte an deiner Aktivität "${result.activityTitle}" teilnehmen.`,
        targetUrl: `/activities/${activityId}`,
        entityId: activityId,
        eventId: `join_request_${activityId}_${result.requesterId}`,
        customId: `join_request_${activityId}_${result.requesterId}`,
        senderProfile: result.senderProfile
      }).catch(err => console.error('[secureRequestJoinActivity] Dispatch failed:', err));
    }

    return { success: true, status: result.status };
  } catch (error: any) {
    console.error("Error in secureRequestJoinActivity transaction:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error.message || 'Internal error requesting to join activity.');
  }
});

/**
 * HTTPS Callable: Entfernt einen Teilnehmer aus einer Aktivität (durch den Host/Admin).
 */
export const kickParticipant = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const callerId = request.auth.uid;
  const { activityId, targetUserId } = request.data;

  if (typeof activityId !== 'string' || !activityId || typeof targetUserId !== 'string' || !targetUserId) {
    throw new HttpsError('invalid-argument', 'Missing or invalid required arguments.');
  }

  const db = admin.firestore();

  try {
    const result = await db.runTransaction(async (transaction) => {
      // 1. Get activity doc (READ)
      const activityRef = db.collection('activities').doc(activityId);
      const activitySnap = await transaction.get(activityRef);
      if (!activitySnap.exists) {
        throw new HttpsError('not-found', 'Activity not found.');
      }
      const activity = activitySnap.data()!;

      // 2. Get chat doc (READ) - MUST occur before any writes
      const chatRef = db.collection('chats').doc(activityId);
      const chatSnap = await transaction.get(chatRef);

      // 3. Check host authorization
      const isHost = activity.hostId === callerId;
      if (!isHost) {
        throw new HttpsError('permission-denied', 'Only the activity host can remove participants.');
      }

      // 4. Prevent removing host
      if (targetUserId === activity.hostId) {
        throw new HttpsError('failed-precondition', 'The activity host cannot be removed.');
      }

      // 5. Verify target is a participant
      const participantIds: string[] = activity.participantIds || [];
      if (!participantIds.includes(targetUserId)) {
        throw new HttpsError('failed-precondition', 'Target user is not a participant of this activity.');
      }

      // 6. ALL WRITES AFTER ALL READS:
      // Update activity document
      const updatedParticipantIds = participantIds.filter(id => id !== targetUserId);
      const currentPreview = activity.participantsPreview || [];
      const updatedPreview = currentPreview.filter((p: any) => p.uid !== targetUserId);

      transaction.update(activityRef, {
        participantIds: updatedParticipantIds,
        participantsPreview: updatedPreview,
        [`participantDetails.${targetUserId}`]: FieldValue.delete(),
        kickedUserIds: FieldValue.arrayUnion(targetUserId),
        lastInteractionAt: FieldValue.serverTimestamp()
      });

      // Update chat document if present
      if (chatSnap.exists) {
        transaction.update(chatRef, {
          participantIds: FieldValue.arrayRemove(targetUserId),
          [`participantDetails.${targetUserId}`]: FieldValue.delete(),
          [`unreadCount.${targetUserId}`]: FieldValue.delete()
        });
      }

      // Delete subcollection document activities/{activityId}/participants/{targetUserId}
      const pSubRef = activityRef.collection('participants').doc(targetUserId);
      transaction.delete(pSubRef);

      // Create notification for kicked user
      const notifRef = db.collection('notifications').doc();
      transaction.set(notifRef, {
        recipientId: targetUserId,
        senderId: 'system',
        type: 'participant_kicked',
        title: 'Aus Aktivität entfernt',
        message: `Du wurdest aus der Aktivität "${activity.placeName || activity.title || 'Aktivität'}" entfernt.`,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
        activityId: activityId
      });

      return { success: true };
    });

    return result;
  } catch (error: any) {
    console.error('Error in kickParticipant:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error.message || 'Internal error removing participant.');
  }
});

/* ============================================================================
 * SECURITY HARDENING PHASE 1.2: SERVER-OWNED ACTIVITY & BOOST CREATION
 * ============================================================================ */

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const createActivitySchema = z.object({
  operationId: z.string().regex(UUID_V4_REGEX, 'Invalid UUID v4 operationId format.'),
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  category: z.enum(['Sport', 'Tech', 'Party', 'Kultur', 'Outdoor', 'Gaming', 'Networking', 'Sonstiges', 'Other']).optional(),
  placeId: z.string().max(200).refine(val => !val.includes('/'), 'placeId cannot contain slashes.').optional(),
  customLocationName: z.string().max(100).optional(),
  place: z.object({
    id: z.string().max(200).optional(),
    name: z.string().max(100).optional(),
    address: z.string().max(200).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    categories: z.array(z.string()).optional(),
    openingHours: z.string().max(200).optional()
  }).strict().optional(),
  startDate: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid startDate ISO format.'),
  endDate: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid endDate ISO format.').optional(),
  isTimeFlexible: z.boolean().optional(),
  maxParticipants: z.number().int().min(2).max(50).optional(),
  requirements: z.object({
    gender: z.array(z.enum(['male', 'female', 'diverse'])).refine(arr => new Set(arr).size === arr.length, 'Duplicates not allowed in gender list.').optional(),
    requireProfilePicture: z.boolean().optional(),
    requireVerification: z.boolean().optional(),
    ageRange: z.object({
      min: z.number().int().min(0).max(200).optional(),
      max: z.number().int().min(0).max(200).optional()
    }).strict().refine(obj => {
      if (obj.min !== undefined && obj.max !== undefined) return obj.min <= obj.max;
      return true;
    }, 'ageRange min must be <= max.').optional(),
    minimumRating: z.number().min(0.0).max(5.0).optional()
  }).strict().optional(),
  joinMode: z.enum(['direct', 'request']).optional(),
  isBoosted: z.boolean().optional()
}).strict();

export const boostEntitySchema = z.object({
  operationId: z.string().regex(UUID_V4_REGEX, 'Invalid UUID v4 operationId format.'),
  entityType: z.enum(['activity', 'place']),
  entityId: z.string().min(1).max(200).refine(val => !val.includes('/'), 'entityId cannot contain slashes.'),
  durationHours: z.number().refine(val => [6, 12, 24].includes(val), 'durationHours must be 6, 12, or 24.')
}).strict();

export function computeCanonicalPayloadHash(data: Record<string, any>): string {
  const isRealPlace = !!(data.placeId && data.placeId !== 'custom');
  const cleanAndSort = (obj: any, isTopLevel = false): any => {
    if (obj === null || obj === undefined) return undefined;
    if (typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map((item) => cleanAndSort(item, false));
    const sortedKeys = Object.keys(obj).filter(k => k !== 'operationId' && obj[k] !== undefined).sort();
    const result: Record<string, any> = {};
    for (const key of sortedKeys) {
      if (isTopLevel && isRealPlace && key === 'place') continue;
      const val = cleanAndSort(obj[key], false);
      if (val !== undefined) {
        result[key] = val;
      }
    }
    return result;
  };
  const canonicalObj = cleanAndSort(data, true);
  const jsonString = JSON.stringify(canonicalObj);
  return crypto.createHash('sha256').update(jsonString).digest('hex');
}

export async function resolvePlaceViaGeoapify(placeId: string): Promise<{ name: string; address: string; lat: number; lon: number; categories?: string[]; openingHours?: string }> {
  if (process.env.FUNCTIONS_EMULATOR === 'true' || process.env.FIREBASE_EMULATOR_HUB || process.env.NODE_ENV === 'test') {
    if (placeId.startsWith('geoapify_valid_') || placeId.startsWith('place_geoapify_')) {
      return {
        name: 'Verifizierter Geoapify Ort',
        address: 'Musterstraße 123, 10115 Berlin',
        lat: 52.520008,
        lon: 13.404954,
        categories: ['catering.restaurant'],
      };
    }
    throw new HttpsError('invalid-argument', 'Gefälschte oder unaufgefundene Place-ID.');
  }

  const apiKey = GEOAPIFY_API_KEY.value()?.trim();
  if (!apiKey) {
    throw new HttpsError('unavailable', 'Geoapify API key is not configured on the server.');
  }

  try {
    const url = `https://api.geoapify.com/v2/place-details?id=${encodeURIComponent(placeId)}&apiKey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new HttpsError('failed-precondition', 'Die Ortsprüfung ist aktuell nicht korrekt konfiguriert.');
      }
      if (res.status === 429 || res.status >= 500) {
        throw new HttpsError('unavailable', 'Der Ortsanbieter ist gerade nicht verfügbar. Bitte versuche es später erneut.');
      }
      throw new HttpsError('invalid-argument', 'Dieser Ort konnte beim Ortsanbieter nicht gefunden werden.');
    }
    const data = await res.json();
    const feature = data?.features?.[0];
    if (!feature || !feature.properties) {
      throw new HttpsError('invalid-argument', 'Invalid place data returned by provider.');
    }
    const props = feature.properties;
    const name = props.name || props.address_line1 || 'Ort';
    const address = props.formatted || props.address_line2 || name;
    const lat = typeof props.lat === 'number' ? props.lat : feature.geometry?.coordinates?.[1];
    const lon = typeof props.lon === 'number' ? props.lon : feature.geometry?.coordinates?.[0];

    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new HttpsError('invalid-argument', 'Provider place coordinates out of valid range.');
    }

    return {
      name: String(name).slice(0, 100),
      address: String(address).slice(0, 200),
      lat,
      lon,
      categories: Array.isArray(props.categories) ? props.categories : [],
      openingHours: props.opening_hours ? String(props.opening_hours).slice(0, 200) : undefined
    };
  } catch (err: any) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('unavailable', 'Failed to resolve place details with provider.');
  }
}

export function checkUserEligibilityForActivityCreation(userProfile: any): { eligible: boolean; errorMessage?: string } {
  if (!userProfile) {
    return { eligible: false, errorMessage: 'Nutzerprofil existiert nicht.' };
  }
  if (userProfile.onboardingCompleted !== true) {
    return { eligible: false, errorMessage: 'Bitte schließe zuerst dein Onboarding ab.' };
  }
  if (userProfile.isBanned === true || userProfile.disabled === true) {
    return { eligible: false, errorMessage: 'Dein Konto ist gesperrt oder deaktiviert.' };
  }
  const statusStr = typeof userProfile.accountStatus === 'string' ? userProfile.accountStatus.toLowerCase() : '';
  if (['banned', 'deleted', 'disabled'].includes(statusStr)) {
    return { eligible: false, errorMessage: 'Dein Konto ist gesperrt oder deaktiviert.' };
  }
  if (statusStr === 'suspended' || userProfile.suspendedUntil) {
    const suspendTime = parseTimestampMillis(userProfile.suspendedUntil);
    if (suspendTime === null || isNaN(suspendTime) || suspendTime > Date.now()) {
      return { eligible: false, errorMessage: 'Dein Konto ist vorübergehend gesperrt.' };
    }
  }
  return { eligible: true };
}

export function parseAndNormalizeIso8601Date(dateStr: unknown, fieldName: string): { iso: string; ms: number } {
  if (typeof dateStr !== 'string' || !dateStr.trim()) {
    throw new HttpsError('invalid-argument', `${fieldName} must be a valid non-empty ISO-8601 string.`);
  }

  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/i;
  if (!isoRegex.test(dateStr)) {
    throw new HttpsError('invalid-argument', `${fieldName} must be a valid ISO-8601 string with explicit timezone offset.`);
  }

  const ms = Date.parse(dateStr);
  if (isNaN(ms)) {
    throw new HttpsError('invalid-argument', `${fieldName} is not a valid date.`);
  }

  const datePart = dateStr.split('T')[0];
  const [yearStr, monthStr, dayStr] = datePart.split('-').map(Number);
  const testDate = new Date(Date.UTC(yearStr, monthStr - 1, dayStr));
  if (
    testDate.getUTCFullYear() !== yearStr ||
    testDate.getUTCMonth() !== monthStr - 1 ||
    testDate.getUTCDate() !== dayStr
  ) {
    throw new HttpsError('invalid-argument', `${fieldName} contains an invalid calendar day.`);
  }

  return { iso: new Date(ms).toISOString(), ms };
}

export function validateActivityCreationDates(
  startDateMs: number,
  endDateMs: number | undefined,
  isTimeFlexible: boolean,
  now = Date.now(),
): void {
  if (endDateMs !== undefined) {
    if (endDateMs <= startDateMs) {
      throw new HttpsError('invalid-argument', 'Enddatum muss nach dem Startdatum liegen.');
    }
    if (endDateMs > startDateMs + 30 * 24 * 60 * 60 * 1000) {
      throw new HttpsError('invalid-argument', 'Aktivitätsdauer darf maximal 30 Tage betragen.');
    }
  }

  // A flexible day/range remains available until its explicit local end, even
  // though its midnight start is already past. Fixed times keep the 5-minute grace.
  const isPast = isTimeFlexible && endDateMs !== undefined
    ? endDateMs < now
    : startDateMs < now - 5 * 60 * 1000;
  if (isPast) {
    throw new HttpsError('invalid-argument', 'Startdatum darf nicht in der Vergangenheit liegen.');
  }
}

/**
 * HTTPS Callable: Atomarer, serverseitig geschützter Activity-Erstellungsflow (Phase 1.2).
 */
export const secureCreateActivity = onCall({ secrets: [GEOAPIFY_API_KEY], enforceAppCheck: false }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
  }

  const callerUid = request.auth.uid;
  const rawData = request.data || {};

  // 1. Zod Schema Validation
  const parseResult = createActivitySchema.safeParse(rawData);
  if (!parseResult.success) {
    throw new HttpsError('invalid-argument', `Ungültige Eingabedaten: ${parseResult.error.issues.map(e => e.message).join(', ')}`);
  }
  const input = parseResult.data;

  const isCustom = !input.placeId || input.placeId === 'custom';
  const effectivePlaceId = isCustom ? 'custom' : input.placeId!;

  // Invariants Check
  if (isCustom && (!input.title || !input.title.trim()) && (!input.customLocationName || !input.customLocationName.trim())) {
    throw new HttpsError('invalid-argument', 'Titel oder Ortname erforderlich für benutzerdefinierte Aktivitäten.');
  }
  if (!isCustom && (!input.placeId || !input.placeId.trim())) {
    throw new HttpsError('invalid-argument', 'Place ID erforderlich für ortsbasierte Aktivitäten.');
  }

  // Additional Date Checks
  const normalizedStart = parseAndNormalizeIso8601Date(input.startDate, 'startDate');
  input.startDate = normalizedStart.iso;
  const startDateMs = normalizedStart.ms;
  let endDateMs: number | undefined;
  if (input.endDate) {
    const normalizedEnd = parseAndNormalizeIso8601Date(input.endDate, 'endDate');
    input.endDate = normalizedEnd.iso;
    endDateMs = normalizedEnd.ms;
  }
  validateActivityCreationDates(startDateMs, endDateMs, input.isTimeFlexible === true);

  // 2. Compute Canonical Payload Hash
  const payloadHash = computeCanonicalPayloadHash(input);
  const db = admin.firestore();

  // 3. Fast Pre-Transaction Idempotency Lookup (Optimization)
  const idempotencyRef = db.collection('idempotency_keys').doc(`${callerUid}_create_activity_${input.operationId}`);
  const fastIdempotencySnap = await idempotencyRef.get();
  if (fastIdempotencySnap.exists) {
    const data = fastIdempotencySnap.data();
    if (data?.status === 'completed') {
      if (data.payloadHash === payloadHash) {
        return { success: true, activityId: data.activityId, idempotencyReplayed: true };
      } else {
        throw new HttpsError('failed-precondition', 'Idempotency operation ID payload mismatch.');
      }
    }
  }

  // 4. Fast Pre-check for Cost Avoidance (User Eligibility & Place existence)
  const userRef = db.collection('users').doc(callerUid);
  const fastUserSnap = await userRef.get();
  if (!fastUserSnap.exists) {
    throw new HttpsError('permission-denied', 'Nutzerprofil nicht gefunden.');
  }
  const fastUserData = fastUserSnap.data()!;
  const eligibility = checkUserEligibilityForActivityCreation(fastUserData);
  if (!eligibility.eligible) {
    throw new HttpsError('permission-denied', eligibility.errorMessage || 'Nutzer nicht berechtigt.');
  }

  let fastPlaceSnap: admin.firestore.DocumentSnapshot | null = null;
  if (!isCustom) {
    const placeRef = db.collection('places').doc(effectivePlaceId);
    fastPlaceSnap = await placeRef.get();
  }

  // 5. Provider Lookup if place-based & does NOT exist in Firestore yet
  let resolvedProviderPlace: { name: string; address: string; lat: number; lon: number; categories?: string[]; openingHours?: string } | null = null;
  if (!isCustom && (!fastPlaceSnap || !fastPlaceSnap.exists)) {
    await enforceRateLimit(callerUid, 'provider_lookup', 10, 60);
    resolvedProviderPlace = await resolvePlaceViaGeoapify(effectivePlaceId);
  }

  // 6. Main Firestore Transaction (Read-Before-Write)
  const newActivityRef = db.collection('activities').doc();
  const newActivityId = newActivityRef.id;

  try {
    const result = await db.runTransaction(async (transaction) => {
      // READS (ALL FIRST)
      const txnIdempotencySnap = await transaction.get(idempotencyRef);
      const rateLimitRef = db.collection('rate_limits').doc(`${callerUid}_create_activity`);
      const txnRateLimitSnap = await transaction.get(rateLimitRef);
      const txnUserSnap = await transaction.get(userRef);
      const lockRef = db.collection('activity_creation_locks').doc(callerUid);
      const txnLockSnap = await transaction.get(lockRef);

      let txnPlaceSnap: admin.firestore.DocumentSnapshot | null = null;
      const placeRef = !isCustom ? db.collection('places').doc(effectivePlaceId) : null;
      if (placeRef) {
        txnPlaceSnap = await transaction.get(placeRef);
      }

      const activeRoomsQuery = db.collection('activities')
        .where('hostId', '==', callerUid)
        .where('status', 'in', ['active', 'open']);
      const activeRoomsSnap = await transaction.get(activeRoomsQuery);

      // EVALUATIONS
      if (txnIdempotencySnap.exists) {
        const idData = txnIdempotencySnap.data();
        if (idData?.status === 'completed') {
          if (idData.payloadHash === payloadHash) {
            return { success: true, activityId: idData.activityId, idempotencyReplayed: true };
          } else {
            throw new HttpsError('failed-precondition', 'Idempotency operation ID payload mismatch.');
          }
        }
      }

      const now = Date.now();
      const existingAttempts: number[] = (txnRateLimitSnap.exists ? (txnRateLimitSnap.data()?.attempts || []) : []).filter(
        (ts: number) => now - ts < 60 * 1000
      );
      if (existingAttempts.length >= 5) {
        throw new HttpsError('resource-exhausted', 'Erstellungslimit erreicht. Maximal 5 Aktivitäten pro 60 Sekunden.');
      }

      if (!txnUserSnap.exists) {
        throw new HttpsError('permission-denied', 'Nutzerprofil nicht gefunden.');
      }
      const userData = txnUserSnap.data()!;
      const userElig = checkUserEligibilityForActivityCreation(userData);
      if (!userElig.eligible) {
        throw new HttpsError('permission-denied', userElig.errorMessage || 'Nutzer nicht berechtigt.');
      }

      // Server-Owned Participant Limit Check
      const hostLimit = getParticipantLimit(userData, now);
      const finalMaxParticipants = input.maxParticipants ?? hostLimit;
      if (finalMaxParticipants < 2 || finalMaxParticipants > hostLimit) {
        throw new HttpsError('failed-precondition', `Teilnehmerzahl (${finalMaxParticipants}) liegt außerhalb deines Tariflimits (${hostLimit}).`);
      }

      // Host Requirements Check (via activity-requirements-policy)
      validateUserRequirements(userData, input.requirements, now);

      const maxRoomsLimit = getMaxOpenRoomsLimit(userData, now);
      if (activeRoomsSnap.size >= maxRoomsLimit) {
        throw new HttpsError('resource-exhausted', `Du hast dein Limit von ${maxRoomsLimit} gleichzeitig offenen Räumen erreicht.`);
      }

      const isBoosted = input.isBoosted === true;
      if (isBoosted) {
        const tokens = userData.tokens || 0;
        if (tokens < 1) {
          throw new HttpsError('failed-precondition', 'Unzureichendes Token-Guthaben für den Boost.');
        }
      }

      let finalPlaceName = input.customLocationName || 'Custom Location';
      let finalPlaceAddress = '';
      let finalLat: number | undefined = input.place?.lat;
      let finalLon: number | undefined = input.place?.lon;
      let finalCategories: string[] = [input.category || 'Sonstiges'];
      let isNewPlaceToCreate = false;

      if (!isCustom && placeRef) {
        if (txnPlaceSnap && txnPlaceSnap.exists) {
          const placeData = txnPlaceSnap.data()!;
          if (placeData.isDeleted === true || placeData.isBlacklisted === true) {
            throw new HttpsError('failed-precondition', 'Dieser Ort ist nicht mehr verfügbar.');
          }
          const pTitle = placeData.title || placeData.name;
          const pAddr = placeData.address;
          if (!pTitle || !pAddr || placeData.lat == null || placeData.lon == null) {
            throw new HttpsError('failed-precondition', 'Der ausgewählte Ort ist unvollständig.');
          }
          finalPlaceName = pTitle;
          finalPlaceAddress = pAddr;
          finalLat = placeData.lat;
          finalLon = placeData.lon;
          finalCategories = placeData.categories || finalCategories;
        } else if (resolvedProviderPlace) {
          finalPlaceName = resolvedProviderPlace.name;
          finalPlaceAddress = resolvedProviderPlace.address;
          finalLat = resolvedProviderPlace.lat;
          finalLon = resolvedProviderPlace.lon;
          finalCategories = resolvedProviderPlace.categories && resolvedProviderPlace.categories.length > 0 ? resolvedProviderPlace.categories : finalCategories;
          isNewPlaceToCreate = true;
        } else {
          throw new HttpsError('invalid-argument', 'Ort konnte nicht aufgelöst werden.');
        }
      }

      // WRITES (ALL AFTER ALL READS)
      const creationSource = isCustom ? 'community' : 'place_activity';

      const activityData: Record<string, any> = {
        id: newActivityId,
        title: input.title || (isCustom ? (input.customLocationName || 'Aktivität') : finalPlaceName),
        description: input.description || '',
        category: input.category || 'Sonstiges',
        placeName: finalPlaceName,
        placeAddress: finalPlaceAddress,
        lat: typeof finalLat === 'number' ? finalLat : null,
        lon: typeof finalLon === 'number' ? finalLon : null,
        hostId: callerUid,
        hostName: userData.displayName || 'Gastgeber',
        hostPhotoURL: userData.photoURL || null,
        participantIds: [callerUid],
        participantsPreview: [{
          uid: callerUid,
          displayName: userData.displayName || 'Gastgeber',
          photoURL: userData.photoURL || null
        }],
        participantDetails: {
          [callerUid]: {
            displayName: userData.displayName || 'Gastgeber',
            photoURL: userData.photoURL || null,
            isPremium: isPremiumActive(userData, now),
            isSupporter: userData.isSupporter === true,
            checkInStatus: 'pending',
            hasReviewed: false
          }
        },
        status: 'active',
        completionVotes: [],
        isBoosted: isBoosted,
        boostedAt: isBoosted ? FieldValue.serverTimestamp() : null,
        boostExpiresAt: isBoosted ? Timestamp.fromDate(new Date(now + 24 * 60 * 60 * 1000)) : null,
        isPaid: false,
        price: 0,
        upvotes: 0,
        downvotes: 0,
        userVotes: {},
        globalScore: 0,
        reportCount: 0,
        avgRating: 0,
        reviewCount: 0,
        stats: { impressions: 0, pushJoins: 0, referralJoins: 0 },
        sourceType: 'activity',
        creationSource: creationSource,
        isCustomActivity: isCustom,
        activityDate: Timestamp.fromDate(new Date(startDateMs)),
        activityEndDate: endDateMs ? Timestamp.fromDate(new Date(endDateMs)) : null,
        isTimeFlexible: input.isTimeFlexible ?? true,
        maxParticipants: finalMaxParticipants,
        requirements: input.requirements || {},
        joinMode: input.joinMode || 'request',
        createdAt: FieldValue.serverTimestamp(),
        lastInteractionAt: FieldValue.serverTimestamp()
      };

      if (!isCustom && input.placeId) {
        activityData.placeId = input.placeId;
      }

      transaction.set(newActivityRef, activityData);

      const pSubRef = newActivityRef.collection('participants').doc(callerUid);
      transaction.set(pSubRef, {
        uid: callerUid,
        displayName: userData.displayName || 'Gastgeber',
        photoURL: userData.photoURL || null,
        checkInStatus: 'pending',
        joinedAt: FieldValue.serverTimestamp(),
        hasReviewed: false
      });

      const chatRef = db.collection('chats').doc(newActivityId);
      transaction.set(chatRef, {
        activityId: newActivityId,
        hostId: callerUid,
        participantIds: [callerUid],
        createdAt: FieldValue.serverTimestamp(),
        lastActivityAt: FieldValue.serverTimestamp()
      });

      if (!isCustom && placeRef) {
        if (isNewPlaceToCreate && resolvedProviderPlace) {
          transaction.set(placeRef, {
            id: effectivePlaceId,
            title: resolvedProviderPlace.name,
            name: resolvedProviderPlace.name,
            address: resolvedProviderPlace.address,
            lat: resolvedProviderPlace.lat,
            lon: resolvedProviderPlace.lon,
            categories: resolvedProviderPlace.categories || [],
            activityCount: 1,
            lastActivityId: newActivityId,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
        } else {
          transaction.update(placeRef, {
            activityCount: FieldValue.increment(1),
            lastActivityId: newActivityId,
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      }

      if (isBoosted) {
        transaction.update(userRef, {
          tokens: FieldValue.increment(-1)
        });
      }

      transaction.set(idempotencyRef, {
        uid: callerUid,
        operationId: input.operationId,
        activityId: newActivityId,
        payloadHash: payloadHash,
        status: 'completed',
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromDate(new Date(now + 24 * 60 * 60 * 1000)),
        operationType: 'create_activity'
      });

      existingAttempts.push(now);
      transaction.set(rateLimitRef, {
        attempts: existingAttempts,
        updatedAt: FieldValue.serverTimestamp()
      });

      transaction.set(lockRef, {
        version: FieldValue.increment(1),
        lastCreationAt: FieldValue.serverTimestamp()
      }, { merge: true });

      return { success: true, activityId: newActivityId };
    });

    return result;
  } catch (error: any) {
    if (error instanceof HttpsError) throw error;
    console.error('Error in secureCreateActivity:', error);
    throw new HttpsError('internal', error.message || 'Error creating activity.');
  }
});

/**
 * HTTPS Callable: Atomarer, serverseitig geschützter Boost-Flow für Aktivitäten & Orte.
 */
export const secureBoostEntity = onCall({ enforceAppCheck: false }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
  }

  const callerUid = request.auth.uid;
  const parseResult = boostEntitySchema.safeParse(request.data || {});
  if (!parseResult.success) {
    throw new HttpsError('invalid-argument', `Ungültige Eingabedaten: ${parseResult.error.issues.map(e => e.message).join(', ')}`);
  }
  const { operationId, entityType, entityId, durationHours } = parseResult.data;

  const boostPayloadHash = crypto.createHash('sha256').update(JSON.stringify({ entityType, entityId, durationHours })).digest('hex');

  const db = admin.firestore();
  const idempotencyRef = db.collection('idempotency_keys').doc(`${callerUid}_boost_${operationId}`);

  const fastSnap = await idempotencyRef.get();
  if (fastSnap.exists && fastSnap.data()?.status === 'completed') {
    const data = fastSnap.data()!;
    if (
      !data.payloadHash ||
      !data.entityId ||
      !data.entityType ||
      !data.boostedUntil ||
      data.payloadHash !== boostPayloadHash ||
      data.entityId !== entityId ||
      data.entityType !== entityType
    ) {
      throw new HttpsError('failed-precondition', 'Idempotency operation ID payload mismatch.');
    }
    return {
      success: true,
      entityId: data.entityId,
      boostedUntil: data.boostedUntil,
      idempotencyReplayed: true
    };
  }

  try {
    const result = await db.runTransaction(async (transaction) => {
      // READS (ALL FIRST)
      const txnIdempotencySnap = await transaction.get(idempotencyRef);
      const userRef = db.collection('users').doc(callerUid);
      const userSnap = await transaction.get(userRef);

      const entityCollection = entityType === 'activity' ? 'activities' : 'places';
      const entityRef = db.collection(entityCollection).doc(entityId);
      const entitySnap = await transaction.get(entityRef);

      if (txnIdempotencySnap.exists && txnIdempotencySnap.data()?.status === 'completed') {
        const idData = txnIdempotencySnap.data()!;
        if (
          !idData.payloadHash ||
          !idData.entityId ||
          !idData.entityType ||
          !idData.boostedUntil ||
          idData.payloadHash !== boostPayloadHash ||
          idData.entityId !== entityId ||
          idData.entityType !== entityType
        ) {
          throw new HttpsError('failed-precondition', 'Idempotency operation ID payload mismatch.');
        }
        return {
          success: true,
          entityId: idData.entityId,
          boostedUntil: idData.boostedUntil,
          idempotencyReplayed: true
        };
      }

      if (!userSnap.exists) {
        throw new HttpsError('permission-denied', 'Nutzerprofil nicht gefunden.');
      }
      const userData = userSnap.data()!;
      const userElig = checkUserEligibilityForActivityCreation(userData);
      if (!userElig.eligible) {
        throw new HttpsError('permission-denied', userElig.errorMessage || 'Nutzer nicht berechtigt.');
      }

      if (!entitySnap.exists) {
        throw new HttpsError('not-found', `${entityType === 'activity' ? 'Aktivität' : 'Ort'} nicht gefunden.`);
      }
      const entityData = entitySnap.data()!;
      if (entityData.isDeleted === true || entityData.isBlacklisted === true) {
        throw new HttpsError('failed-precondition', 'Entity ist nicht mehr verfügbar.');
      }

      if (entityType === 'activity') {
        if (entityData.hostId !== callerUid) {
          throw new HttpsError('permission-denied', 'Nur der Gastgeber kann diese Aktivität meisen/boosten.');
        }
        if (!['active', 'open'].includes(entityData.status)) {
          throw new HttpsError('failed-precondition', 'Beendete oder abgesagte Aktivitäten können nicht geboostet werden.');
        }
      }

      const now = Date.now();
      const currentBoostExpiry = parseTimestampMillis(entityData.boostExpiresAt || entityData.boostedUntil);
      if (entityData.isBoosted === true) {
        if (currentBoostExpiry === null || isNaN(currentBoostExpiry) || currentBoostExpiry > now) {
          throw new HttpsError('failed-precondition', 'Ein aktiver Boost ist bereits vorhanden.');
        }
      }

      const tokens = userData.tokens || 0;
      if (tokens < 1) {
        throw new HttpsError('failed-precondition', 'Unzureichendes Token-Guthaben.');
      }

      const durationHoursNum = Number(durationHours);
      const boostedUntilDate = new Date(now + durationHoursNum * 60 * 60 * 1000);
      const boostedUntilIso = boostedUntilDate.toISOString();

      // WRITES (ALL AFTER ALL READS)
      transaction.update(userRef, {
        tokens: FieldValue.increment(-1)
      });

      transaction.update(entityRef, {
        isBoosted: true,
        boostedAt: FieldValue.serverTimestamp(),
        boostExpiresAt: Timestamp.fromDate(boostedUntilDate),
        updatedAt: FieldValue.serverTimestamp()
      });

      transaction.set(idempotencyRef, {
        uid: callerUid,
        operationId,
        entityId,
        entityType,
        durationHours,
        payloadHash: boostPayloadHash,
        boostedUntil: boostedUntilIso,
        status: 'completed',
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromDate(new Date(now + 7 * 24 * 60 * 60 * 1000)),
        operationType: 'boost_entity'
      });

      return {
        success: true,
        entityId,
        boostedUntil: boostedUntilIso
      };
    });

    return result;
  } catch (error: any) {
    if (error instanceof HttpsError) throw error;
    console.error('Error in secureBoostEntity:', error);
    throw new HttpsError('internal', error.message || 'Error boosting entity.');
  }
});
