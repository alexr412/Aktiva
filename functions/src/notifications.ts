import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendPushToUser, NotificationPushPayload } from './push';

export interface CreateNotificationParams {
  recipientId: string;
  actorId?: string;
  type: string;
  title: string;
  body: string;
  targetUrl: string;
  entityId?: string;
  eventId: string;
  customId?: string;
  responseStatus?: string;
  customMessage?: string;
  senderProfile?: {
    displayName?: string | null;
    photoURL?: string | null;
    username?: string | null;
  };
}

export const NEARBY_NOTIFICATION_MAX_RADIUS_KM = 10;
export const NEARBY_PUSH_DAILY_LIMIT = 3;
export const ENGAGEMENT_PUSH_DAILY_LIMIT = 1;

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Returns current date string in Europe/Berlin timezone (YYYY-MM-DD)
 */
export function getBerlinDateString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
}

/**
 * Preference mapping: maps notification type to UserProfile.notificationSettings key
 */
export function getPreferenceKeyForType(type: string): string | null {
  switch (type) {
    case 'friend_request':
      return 'friendRequests';
    case 'friend_accepted':
      return 'friendAccepted';
    case 'chat_message':
    case 'chat_request':
      return 'chatMessages';
    case 'activity_invite':
      return 'activityInvites';
    case 'activity_join_request':
    case 'join_request':
      return 'activityRequests';
    case 'activity_join_response':
    case 'join_response':
      return 'activityParticipants';
    case 'activity_update':
      return 'activityUpdates';
    case 'activity_reminder':
      return 'activityReminders';
    case 'nearby_activity':
    case 'nearby_spot':
      return 'nearbyActivities';
    case 'recommendation':
      return 'recommendations';
    case 'engagement_reminder':
      return 'engagementReminders';
    case 'friend_nearby_activity':
      return 'nearbyFriendActivityNotifications';
    case 'system':
    default:
      return null;
  }
}

/**
 * Creates a canonical notification document in Firestore and dispatches FCM Web Push if enabled.
 * Fully transactional and idempotent based on deterministic notificationId.
 */
export async function createNotificationAndDispatch(params: CreateNotificationParams): Promise<{
  created: boolean;
  notificationId: string;
  pushSent: boolean;
}> {
  const { recipientId, actorId, type, title, body, targetUrl, entityId, eventId, customId, senderProfile } = params;

  if (!recipientId || !type || !title || !eventId) {
    throw new Error('Invalid notification parameters.');
  }

  // Prevent sending notifications to oneself
  if (actorId && actorId === recipientId) {
    return { created: false, notificationId: '', pushSent: false };
  }

  const db = admin.firestore();
  const sanitizedRecipientId = recipientId.trim();
  const notificationId = customId || `${type}_${eventId}_${sanitizedRecipientId}`;

  const notificationRef = db.collection('notifications').doc(notificationId);
  const metaRef = db.collection('users').doc(sanitizedRecipientId).collection('notification_meta').doc('state');
  const userRef = db.collection('users').doc(sanitizedRecipientId);

  let isPushAllowed = true;
  let isCreated = false;

  await db.runTransaction(async (transaction) => {
    const notifSnap = await transaction.get(notificationRef);

    if (notifSnap.exists) {
      isCreated = false;
      return;
    }

    const userSnap = await transaction.get(userRef);
    const metaSnap = await transaction.get(metaRef);
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const notificationSettings = userData.notificationSettings || {};

    // Check category preference
    const prefKey = getPreferenceKeyForType(type);
    const isDiscovery = ['nearby_activity', 'nearby_spot', 'recommendation', 'engagement_reminder', 'friend_nearby_activity'].includes(type);

    if (prefKey) {
      // Legacy preference fallback for nearbyActivities / nearbySpots
      let prefValue = notificationSettings[prefKey];
      if (prefValue === undefined && prefKey === 'nearbyActivities') {
        prefValue = notificationSettings.nearbySpots;
      }

      if (prefValue === false) {
        if (isDiscovery) {
          // Discovery notifications: if disabled, suppress both Inbox & Push entirely!
          isCreated = false;
          return;
        }
        isPushAllowed = false;
      }
    }

    if (notificationSettings.pushEnabled === false) {
      isPushAllowed = false;
    }

    const newNotifData: any = {
      id: notificationId,
      recipientId: sanitizedRecipientId,
      actorId: actorId || null,
      senderId: actorId || null,
      type,
      title,
      body,
      targetUrl,
      entityId: entityId || null,
      eventId,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      delivery: {
        pushStatus: 'pending'
      }
    };

    if (senderProfile) {
      newNotifData.senderProfile = senderProfile;
    }

    if (params.responseStatus) {
      newNotifData.responseStatus = params.responseStatus;
    }

    if (params.customMessage) {
      newNotifData.customMessage = params.customMessage;
    }

    transaction.set(notificationRef, newNotifData);

    const currentUnread = metaSnap.exists ? (metaSnap.data()?.unreadCount || 0) : 0;
    const nextUnread = Math.max(0, currentUnread + 1);

    transaction.set(metaRef, {
      unreadCount: nextUnread,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    isCreated = true;
  });

  if (!isCreated) {
    return { created: false, notificationId, pushSent: false };
  }

  let pushSent = false;
  if (isPushAllowed) {
    try {
      const pushPayload: NotificationPushPayload = {
        notificationId,
        eventId,
        type,
        title,
        body,
        targetUrl,
        entityId
      };

      const pushRes = await sendPushToUser(sanitizedRecipientId, pushPayload);
      pushSent = pushRes.successCount > 0;

      await notificationRef.update({
        'delivery.pushStatus': pushSent ? 'sent' : 'not-required',
        'delivery.dispatchedAt': admin.firestore.FieldValue.serverTimestamp()
      }).catch(() => {});
    } catch (pushErr) {
      console.error(`[NotificationService] FCM Dispatch failed for ${notificationId}:`, pushErr);
      await notificationRef.update({
        'delivery.pushStatus': 'failed',
        'delivery.error': String(pushErr)
      }).catch(() => {});
    }
  }

  console.log(`[NotificationService] Created notification ${notificationId} for user ${sanitizedRecipientId} (pushSent=${pushSent})`);

  return { created: true, notificationId, pushSent };
}

// ─── DISCOVERY & PROXIMITY NOTIFICATIONS ────────────────────────────────

/**
 * Dispatches nearby activity notifications to users within geographical radius (default max 10km).
 * Enforces rate limiting (max 3/day) and privacy guidelines.
 */
export async function dispatchNearbyActivityNotifications(activityId: string): Promise<{ notifiedCount: number }> {
  if (!activityId) return { notifiedCount: 0 };
  const db = admin.firestore();
  const activitySnap = await db.collection('activities').doc(activityId).get();

  if (!activitySnap.exists) return { notifiedCount: 0 };
  const activity = activitySnap.data() || {};

  if (activity.status && activity.status !== 'active' && activity.status !== 'open') {
    return { notifiedCount: 0 };
  }

  if (activity.isCancelled || activity.isDeleted || activity.isBlacklisted) {
    return { notifiedCount: 0 };
  }

  const hostId = activity.hostId || activity.creatorId;
  const title = activity.placeName || activity.title || 'Aktivität';
  const activityLocation = activity.location || activity.coordinates || {};
  const lat = typeof activityLocation.latitude === 'number' ? activityLocation.latitude : (typeof activityLocation.lat === 'number' ? activityLocation.lat : null);
  const lng = typeof activityLocation.longitude === 'number' ? activityLocation.longitude : (typeof activityLocation.lng === 'number' ? activityLocation.lng : null);
  const city = activityLocation.city || activity.city || null;

  const hostSnap = hostId ? await db.collection('users').doc(hostId).get() : null;
  const hostData = hostSnap?.exists ? hostSnap.data() || {} : {};
  const hostFriends: string[] = hostData.friends || [];
  const hostBlacklist = hostData.blacklist || {};
  const hostBlocked = [...(hostBlacklist.hard || []), ...(hostBlacklist.soft || [])];

  const candidateDocsMap = new Map<string, admin.firestore.DocumentSnapshot>();

  // 1. Fetch candidates in the same city
  if (city && typeof city === 'string') {
    const citySnap = await db.collection('users').where('location.city', '==', city).get();
    citySnap.docs.forEach(doc => candidateDocsMap.set(doc.id, doc));
  }

  // 2. Always fetch host's friends as candidates so no friend is missed regardless of city
  if (hostFriends.length > 0) {
    const friendRefs = hostFriends.slice(0, 100).map(fId => db.collection('users').doc(fId));
    if (friendRefs.length > 0) {
      const friendSnaps = await db.getAll(...friendRefs);
      friendSnaps.forEach(fSnap => {
        if (fSnap.exists) candidateDocsMap.set(fSnap.id, fSnap);
      });
    }
  }

  // 3. Fallback: query up to 100 recent users if candidate map is empty
  if (candidateDocsMap.size === 0) {
    const fallbackSnap = await db.collection('users').limit(100).get();
    fallbackSnap.docs.forEach(doc => candidateDocsMap.set(doc.id, doc));
  }

  const nowMs = Date.now();
  const oneDayAgoMs = nowMs - 24 * 60 * 60 * 1000;
  const todayBerlinStr = getBerlinDateString();
  let notifiedCount = 0;

  for (const [candidateId, docSnap] of candidateDocsMap.entries()) {
    if (candidateId === hostId) continue;
    if (hostBlocked.includes(candidateId)) continue;

    const candData = docSnap.data() || {};
    const candBlacklist = candData.blacklist || {};
    const candBlocked = [...(candBlacklist.hard || []), ...(candBlacklist.soft || [])];
    if (hostId && candBlocked.includes(hostId)) continue;

    // Location Source of Truth & Freshness check (radar_locations primary, user.location fallback)
    let candLat: number | null = null;
    let candLng: number | null = null;
    let locationFresh = false;

    const radarLocSnap = await db.collection('radar_locations').doc(candidateId).get();
    if (radarLocSnap.exists) {
      const radarData = radarLocSnap.data() || {};
      const expiresAtMs = radarData.expiresAt?.toMillis ? radarData.expiresAt.toMillis() : 0;
      const updatedAtMs = radarData.updatedAt?.toMillis ? radarData.updatedAt.toMillis() : 0;

      if (expiresAtMs > nowMs && updatedAtMs >= oneDayAgoMs) {
        candLat = typeof radarData.latitude === 'number' ? radarData.latitude : null;
        candLng = typeof radarData.longitude === 'number' ? radarData.longitude : null;
        locationFresh = true;
      }
    }

    if (!locationFresh) {
      const candLoc = candData.location || {};
      const locUpdatedAtMs = candLoc.updatedAt?.toMillis ? candLoc.updatedAt.toMillis() : (candData.updatedAt?.toMillis ? candData.updatedAt.toMillis() : 0);

      if (locUpdatedAtMs === 0 || locUpdatedAtMs >= oneDayAgoMs) {
        candLat = typeof candLoc.latitude === 'number' ? candLoc.latitude : (typeof candLoc.lat === 'number' ? candLoc.lat : null);
        candLng = typeof candLoc.longitude === 'number' ? candLoc.longitude : (typeof candLoc.lng === 'number' ? candLoc.lng : null);
        if (candLat !== null && candLng !== null) {
          locationFresh = true;
        }
      }
    }

    if (!locationFresh || candLat === null || candLng === null) {
      continue;
    }

    if (lat !== null && lng !== null && typeof candLat === 'number' && typeof candLng === 'number') {
      const distance = calculateDistanceKm(lat, lng, candLat, candLng);
      const userRadius = Number(candData.radarRadius) || Number(candData.notificationSettings?.nearbyRadius) || NEARBY_NOTIFICATION_MAX_RADIUS_KM;
      const maxAllowedRadius = Math.max(NEARBY_NOTIFICATION_MAX_RADIUS_KM, userRadius);

      if (distance > maxAllowedRadius) continue;
    }

    // Transactional Rate Limit Check in users/{candidateId}/notification_rate_limits/{YYYY-MM-DD}
    const rateLimitRef = db.collection('users').doc(candidateId).collection('notification_rate_limits').doc(todayBerlinStr);
    let isLimitReached = false;

    await db.runTransaction(async (transaction) => {
      const rateLimitSnap = await transaction.get(rateLimitRef);
      const currentNearbyCount = rateLimitSnap.exists ? (rateLimitSnap.data()?.nearbyCount || 0) : 0;

      if (currentNearbyCount >= NEARBY_PUSH_DAILY_LIMIT) {
        isLimitReached = true;
        return;
      }

      transaction.set(rateLimitRef, {
        nearbyCount: currentNearbyCount + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    if (isLimitReached) continue;

    const isFriend = hostFriends.includes(candidateId);
    const notifType = isFriend ? 'friend_nearby_activity' : 'nearby_activity';
    const hostDisplayName = hostData.displayName || (hostData.username ? `@${hostData.username.replace(/^@/, '')}` : 'Ein Freund');

    const notifTitle = isFriend ? 'Aktivität in deiner Nähe' : 'Neues Event in deiner Nähe';
    const notifBody = isFriend
      ? `${hostDisplayName} hat "${title}" in deiner Nähe erstellt.`
      : `"${title}" wurde in deiner Nähe erstellt.`;

    const res = await createNotificationAndDispatch({
      recipientId: candidateId,
      actorId: hostId,
      type: notifType,
      title: notifTitle,
      body: notifBody,
      targetUrl: `/activities/${activityId}`,
      entityId: activityId,
      eventId: `nearby_${activityId}_${candidateId}`,
      customId: `nearby_${activityId}_${candidateId}`,
      senderProfile: {
        displayName: hostData.displayName || hostData.username || 'Freund',
        photoURL: hostData.photoURL || null,
        username: hostData.username || null,
      }
    });

    if (res.created) {
      notifiedCount++;
    }
  }

  return { notifiedCount };
}

/**
 * Scheduled Function: Daily Engagement Reminder ("Lust, heute etwas zu machen?") at 18:00 Europe/Berlin
 * Only sends if recipient has engagementReminders enabled AND active nearby options exist.
 */
export const sendScheduledEngagementReminders = onSchedule(
  { schedule: '0 18 * * *', timeZone: 'Europe/Berlin' },
  async (event) => {
    const db = admin.firestore();
    const usersSnap = await db.collection('users').limit(500).get();

    if (usersSnap.empty) return;

    const nowMs = Date.now();
    const oneDayAgoMs = nowMs - 24 * 60 * 60 * 1000;
    const todayBerlinStr = getBerlinDateString();

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const userData = userDoc.data() || {};
      const settings = userData.notificationSettings || {};

      if (settings.engagementReminders === false || settings.pushEnabled === false) {
        continue;
      }

      // Rate Limit Check in users/{uid}/notification_rate_limits/{YYYY-MM-DD}
      const rateLimitRef = db.collection('users').doc(uid).collection('notification_rate_limits').doc(todayBerlinStr);
      let isLimitReached = false;

      await db.runTransaction(async (transaction) => {
        const rateLimitSnap = await transaction.get(rateLimitRef);
        const currentEngagementCount = rateLimitSnap.exists ? (rateLimitSnap.data()?.engagementCount || 0) : 0;

        if (currentEngagementCount >= ENGAGEMENT_PUSH_DAILY_LIMIT) {
          isLimitReached = true;
          return;
        }

        transaction.set(rateLimitRef, {
          engagementCount: currentEngagementCount + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });

      if (isLimitReached) continue;

      // Check if active options exist in user city / area
      const userCity = userData.location?.city || null;
      let activitiesSnap: any;

      if (userCity) {
        activitiesSnap = await db.collection('activities')
          .where('status', '==', 'active')
          .where('location.city', '==', userCity)
          .limit(5)
          .get();
      } else {
        activitiesSnap = await db.collection('activities')
          .where('status', '==', 'active')
          .limit(5)
          .get();
      }

      if (!activitiesSnap || activitiesSnap.empty) continue;

      // Send engagement reminder
      await createNotificationAndDispatch({
        recipientId: uid,
        type: 'engagement_reminder',
        title: 'Lust, heute etwas zu machen?',
        body: 'In deiner Nähe gibt es passende Aktivitäten.',
        targetUrl: '/explore',
        eventId: `engagement_${todayBerlinStr}_${uid}`,
        customId: `engagement_${todayBerlinStr}_${uid}`
      });
    }
  }
);

// ─── CALLABLE CLOUD FUNCTIONS FOR READ STATE ─────────────────────────────

/**
 * Server-authoritative Callable Function to mark a notification as read.
 */
export const markNotificationRead = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const notificationId = request.data?.notificationId;
  if (!notificationId || typeof notificationId !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid notificationId.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const notifRef = db.collection('notifications').doc(notificationId);
  const metaRef = db.collection('users').doc(uid).collection('notification_meta').doc('state');

  let updated = false;

  await db.runTransaction(async (transaction) => {
    const notifSnap = await transaction.get(notifRef);
    if (!notifSnap.exists) {
      throw new HttpsError('not-found', 'Notification document not found.');
    }

    const notifData = notifSnap.data() || {};
    if (notifData.recipientId !== uid) {
      throw new HttpsError('permission-denied', 'Cannot modify notification for another recipient.');
    }

    if (notifData.isRead) {
      updated = false;
      return;
    }

    const metaSnap = await transaction.get(metaRef);

    transaction.update(notifRef, {
      isRead: true,
      readAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const currentUnread = metaSnap.exists ? (metaSnap.data()?.unreadCount || 0) : 0;
    const nextUnread = Math.max(0, currentUnread - 1);

    transaction.set(metaRef, {
      unreadCount: nextUnread,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    updated = true;
  });

  return { success: true, updated };
});

/**
 * Server-authoritative Callable Function to mark all notifications as read for current user.
 */
export const markAllNotificationsRead = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  let totalUpdated = 0;
  const maxBatches = 20;
  let batchCount = 0;

  while (batchCount < maxBatches) {
    const unreadSnap = await db
      .collection('notifications')
      .where('recipientId', '==', uid)
      .where('isRead', '==', false)
      .limit(100)
      .get();

    if (unreadSnap.empty) break;

    const metaRef = db.collection('users').doc(uid).collection('notification_meta').doc('state');

    await db.runTransaction(async (transaction) => {
      const batch = db.batch();
      unreadSnap.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          isRead: true,
          readAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      await batch.commit();

      const metaSnap = await transaction.get(metaRef);
      const currentUnread = metaSnap.exists ? (metaSnap.data()?.unreadCount || 0) : 0;
      const nextUnread = Math.max(0, currentUnread - unreadSnap.size);

      transaction.set(metaRef, {
        unreadCount: nextUnread,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    totalUpdated += unreadSnap.size;
    batchCount++;

    if (unreadSnap.size < 100) break;
  }

  const metaRef = db.collection('users').doc(uid).collection('notification_meta').doc('state');
  await metaRef.set({
    unreadCount: 0,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return { success: true, totalUpdated };
});

/**
 * Secure Callable Function to trigger a test push notification to caller's own device.
 * For development & verification testing only.
 */
export const sendTestNotification = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to trigger test notifications.');
  }

  const uid = request.auth.uid;
  const testId = `test_${Date.now()}`;

  const res = await createNotificationAndDispatch({
    recipientId: uid,
    type: 'system',
    title: 'Activa Test-Benachrichtigung',
    body: 'Dies ist eine Test-Push-Benachrichtigung für dein Konto.',
    targetUrl: '/settings',
    eventId: testId,
    customId: testId
  });

  return { success: res.created, pushSent: res.pushSent, notificationId: res.notificationId };
});

/**
 * Server-authoritative Callable Function to delete a single notification.
 */
export const deleteNotification = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const notificationId = request.data?.notificationId;
  if (!notificationId || typeof notificationId !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid notificationId.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const notifRef = db.collection('notifications').doc(notificationId);
  const metaRef = db.collection('users').doc(uid).collection('notification_meta').doc('state');

  await db.runTransaction(async (transaction) => {
    // 1. All reads first
    const notifSnap = await transaction.get(notifRef);
    if (!notifSnap.exists) {
      throw new HttpsError('not-found', 'Notification document not found.');
    }

    const notifData = notifSnap.data() || {};
    if (notifData.recipientId !== uid) {
      throw new HttpsError('permission-denied', 'Cannot delete notification for another recipient.');
    }

    const metaSnap = await transaction.get(metaRef);

    // 2. All writes after reads
    transaction.delete(notifRef);

    if (!notifData.isRead) {
      const currentUnread = metaSnap.exists ? (metaSnap.data()?.unreadCount || 0) : 0;
      const nextUnread = Math.max(0, currentUnread - 1);

      transaction.set(metaRef, {
        unreadCount: nextUnread,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  });

  return { success: true };
});
