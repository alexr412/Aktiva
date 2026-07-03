import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { calculateLevel } from './users';

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
  } catch (error) {
    console.error(`Error processing event creation bonus for activity ${activityId}:`, error);
  }

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
        const hostName = activity.hostName || activity.creatorName || "Ein Nutzer";
        const placeName = activity.placeName || activity.title || "ein Highlight";
        const message = {
          notification: {
            title: "🔥 Hot in deiner Nähe!",
            body: `${hostName} hat gerade ein Highlight gestartet: "${placeName}".`,
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
          const hostName = hostProfile.displayName || "Ein Freund";
          const hostFirstName = formatFirstName(hostName);
          const activityTitle = activity.title || activity.placeName || "eine Aktivität";
          const messageText = `${hostFirstName} plant gerade "${activityTitle}" in deiner Nähe.`;

          const batch = db.batch();
          for (const f of friendsToNotifyFinal) {
            batch.set(f.notifRef, {
              recipientId: f.friendId,
              senderId: hostId,
              senderName: hostProfile.displayName || "Ein Freund",
              senderProfile: {
                displayName: hostProfile.displayName || "Ein Freund",
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
      if (notif.type !== 'join_request' || notif.activityId !== activityId || notif.senderId !== userIdToJoin || notif.recipientId !== hostId) {
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

      // 4. Verify if already participant
      const participantIds = activity.participantIds || [];
      if (participantIds.includes(userIdToJoin)) {
        // If already joined, we should resolve/delete the request to maintain idempotency
        transaction.delete(notifRef);
        return { success: true, alreadyParticipant: true };
      }

      if (action === 'accept') {
        // Enforce capacity/maxParticipants limit
        if (activity.maxParticipants && participantIds.length >= activity.maxParticipants) {
          throw new HttpsError('resource-exhausted', 'This activity has reached its maximum participants limit.');
        }

        const displayNameToUse = userProfile.displayName || "User";
        const photoURLToUse = userProfile.photoURL || null;

        // Update activity
        transaction.update(activityRef, {
          participantIds: FieldValue.arrayUnion(userIdToJoin),
          lastInteractionAt: FieldValue.serverTimestamp(),
          [`participantDetails.${userIdToJoin}`]: {
            displayName: displayNameToUse,
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

        // Create exactly one join_response notification
        const responseNotifRef = db.collection('notifications').doc();
        transaction.set(responseNotifRef, {
          recipientId: userIdToJoin,
          senderId: 'system',
          type: 'join_response',
          title: 'Anfrage akzeptiert!',
          message: `Deine Anfrage für "${activity.placeName || 'Aktivität'}" wurde angenommen. Du bist jetzt dabei!`,
          isRead: false,
          createdAt: FieldValue.serverTimestamp(),
          activityId: activityId,
          responseStatus: 'accepted',
          link: `/chat/${activityId}`
        });

        // Delete original join request
        transaction.delete(notifRef);

      } else {
        // action === 'decline'
        // Create exactly one join_response notification
        const responseNotifRef = db.collection('notifications').doc();
        transaction.set(responseNotifRef, {
          recipientId: userIdToJoin,
          senderId: 'system',
          type: 'join_response',
          title: 'Anfrage abgelehnt',
          message: `Deine Anfrage für "${activity.placeName || 'Aktivität'}" wurde leider abgelehnt.`,
          customMessage: customMessage || null,
          isRead: false,
          createdAt: FieldValue.serverTimestamp(),
          activityId: activityId,
          responseStatus: 'declined'
        });

        // Delete original join request
        transaction.delete(notifRef);
      }

      return { success: true };
    });

    return result;
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
      if (participantIds.includes(requesterId)) {
        throw new HttpsError('already-exists', 'You are already a participant of this activity.');
      }

      if (!requesterSnap.exists) {
        throw new HttpsError('not-found', 'Requester user profile not found.');
      }

      const requesterData = requesterSnap.data()!;
      if (requesterData.isBanned === true) {
        throw new HttpsError('permission-denied', 'Requester account is banned.');
      }

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

      if (activity.maxParticipants && participantIds.length >= activity.maxParticipants) {
        throw new HttpsError('resource-exhausted', 'This activity has reached its maximum participants limit.');
      }

      // Check if the requester is blocked by the host
      const hostBlacklist = hostData.blacklist || {};
      const softBlocked = hostBlacklist.soft || [];
      const hardBlocked = hostBlacklist.hard || [];
      if (softBlocked.includes(requesterId) || hardBlocked.includes(requesterId)) {
        throw new HttpsError('permission-denied', 'You cannot join this activity because you are blocked by the host.');
      }

      // Check if the host is blocked by the requester
      const requesterBlacklist = requesterData.blacklist || {};
      const requesterSoftBlocked = requesterBlacklist.soft || [];
      const requesterHardBlocked = requesterBlacklist.hard || [];
      if (requesterSoftBlocked.includes(hostId) || requesterHardBlocked.includes(hostId)) {
        throw new HttpsError('permission-denied', 'You cannot join this activity because you have blocked the host.');
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

      const displayNameToUse = requesterData.displayName || 'User';
      const photoURLToUse = requesterData.photoURL || null;

      transaction.set(notificationRef, {
        recipientId: hostId,
        senderId: requesterId,
        senderName: displayNameToUse,
        senderProfile: {
          displayName: displayNameToUse,
          photoURL: photoURLToUse
        },
        type: 'join_request',
        title: 'Neue Beitrittsanfrage',
        message: message || `${displayNameToUse} möchte an deiner Aktivität "${activity.placeName || 'Treffen'}" teilnehmen.`,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
        activityId,
        link: `/activities/${activityId}`
      });

      return { success: true, status: 'requested' };
    });

    return result;
  } catch (error: any) {
    console.error("Error in secureRequestJoinActivity transaction:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error.message || 'Internal error requesting to join activity.');
  }
});
