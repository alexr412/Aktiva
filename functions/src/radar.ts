import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v1/https';
import {
  CURRENT_RADAR_CONSENT_VERSION,
  hasRadarAccessPermission,
  calculateHaversineDistanceKm,
  calculateDistanceBucket,
  obfuscateMetricGridLocation,
} from './radar-types';

const db = admin.firestore();

/**
 * In-memory / Firestore rate limit helper.
 */
async function enforceRateLimit(
  userId: string,
  action: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<void> {
  const now = Date.now();
  const rateLimitRef = db.collection('rate_limits').doc(`${userId}_${action}`);
  const snap = await rateLimitRef.get();

  if (snap.exists) {
    const data = snap.data();
    const attempts: number[] = (data?.attempts || []).filter(
      (ts: number) => now - ts < windowSeconds * 1000
    );

    if (attempts.length >= maxAttempts) {
      throw new HttpsError(
        'resource-exhausted',
        `Rate limit exceeded for ${action}. Please try again later.`
      );
    }

    attempts.push(now);
    await rateLimitRef.set({ attempts, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  } else {
    await rateLimitRef.set({
      attempts: [now],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

/**
 * 1. setRadarSettings Callable Function
 * Enables or disables radar settings.
 */
export const setRadarSettings = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
  }

  const userId = context.auth.uid;
  await enforceRateLimit(userId, 'setRadarSettings', 10, 600); // Max 10 per 10 min

  // Rejects unknown input properties
  const allowedKeys = new Set(['enabled', 'radiusKm', 'consentVersion']);
  for (const key of Object.keys(data || {})) {
    if (!allowedKeys.has(key)) {
      throw new HttpsError('invalid-argument', `Unbekanntes Eingabefeld: ${key}`);
    }
  }

  const enabled = data?.enabled;
  if (typeof enabled !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Feld "enabled" muss ein Boolean sein.');
  }

  const settingsRef = db.collection('users').doc(userId).collection('private').doc('radarSettings');
  const now = new Date();
  const nowTimestamp = admin.firestore.Timestamp.fromDate(now);

  const existingSnap = await settingsRef.get();
  const existingData = existingSnap.exists ? existingSnap.data() : {};

  // Discriminated handling: Activation vs Deactivation
  if (enabled) {
    // 1. Verify radar access (Premium or Organizer)
    const userDoc = await db.collection('users').doc(userId).get();
    const userProfile = userDoc.exists ? userDoc.data() : null;

    if (!hasRadarAccessPermission(userProfile, now)) {
      throw new HttpsError(
        'permission-denied',
        'Radar-Zugriff erfordert ein aktives Premium-Abonnement oder einen Organizer-Account.'
      );
    }

    // 2. Validate radiusKm
    const radiusKm = data?.radiusKm;
    if (
      typeof radiusKm !== 'number' ||
      !isFinite(radiusKm) ||
      radiusKm < 1 ||
      radiusKm > 25
    ) {
      throw new HttpsError(
        'invalid-argument',
        'Feld "radiusKm" muss eine Zahl zwischen 1 und 25 sein.'
      );
    }

    // 3. Validate consentVersion
    const consentVersion = data?.consentVersion;
    if (consentVersion !== CURRENT_RADAR_CONSENT_VERSION) {
      throw new HttpsError(
        'invalid-argument',
        `Einwilligungs-Version muss exakt "${CURRENT_RADAR_CONSENT_VERSION}" entsprechen.`
      );
    }

    const newSettings = {
      enabled: true,
      radiusKm,
      consentVersion,
      consentedAt: nowTimestamp,
      updatedAt: nowTimestamp,
    };

    await settingsRef.set(newSettings, { merge: true });

    return {
      enabled: true,
      radiusKm,
      updatedAt: nowTimestamp,
      requiresLocationUpdate: true,
    };
  } else {
    // Deactivation allowed without radiusKm, consentVersion, or active Premium!
    const newSettings = {
      enabled: false,
      radiusKm: existingData?.radiusKm || 5,
      consentVersion: existingData?.consentVersion || CURRENT_RADAR_CONSENT_VERSION,
      consentedAt: existingData?.consentedAt || null,
      updatedAt: nowTimestamp,
      lastLocationUpdatedAt: null,
      nextAllowedLocationUpdateAt: null,
      locationExpiresAt: null,
    };

    // Atomic / Idempotent update: write settings + delete location doc
    const batch = db.batch();
    batch.set(settingsRef, newSettings, { merge: true });
    batch.delete(db.collection('radar_locations').doc(userId));
    await batch.commit();

    return {
      enabled: false,
      radiusKm: existingData?.radiusKm || 5,
      updatedAt: nowTimestamp,
      requiresLocationUpdate: false,
    };
  }
});

/**
 * 2. updateRadarLocation Callable Function
 * Updates current temporary location with 5-minute transaction-safe rate limit.
 */
export const updateRadarLocation = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
  }

  const userId = context.auth.uid;

  // Rejects unknown input properties
  const allowedKeys = new Set(['latitude', 'longitude']);
  for (const key of Object.keys(data || {})) {
    if (!allowedKeys.has(key)) {
      throw new HttpsError('invalid-argument', `Unbekanntes Eingabefeld: ${key}`);
    }
  }

  const latitude = data?.latitude;
  const longitude = data?.longitude;

  if (
    typeof latitude !== 'number' ||
    !isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    !isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new HttpsError('invalid-argument', 'Gültige Breitengrad- und Längengradkoordinaten sind erforderlich.');
  }

  const now = new Date();
  const nowTimestamp = admin.firestore.Timestamp.fromDate(now);

  // Read User Profile and Radar Settings first
  const userDoc = await db.collection('users').doc(userId).get();
  const userProfile = userDoc.exists ? userDoc.data() : null;

  if (!hasRadarAccessPermission(userProfile, now)) {
    throw new HttpsError(
      'permission-denied',
      'Radar-Zugriff erfordert ein aktives Premium-Abonnement oder einen Organizer-Account.'
    );
  }

  const settingsRef = db.collection('users').doc(userId).collection('private').doc('radarSettings');
  const settingsSnap = await settingsRef.get();

  if (!settingsSnap.exists || settingsSnap.data()?.enabled !== true) {
    throw new HttpsError('failed-precondition', 'Radar-Einstellungen sind nicht aktiviert.');
  }

  const locationRef = db.collection('radar_locations').doc(userId);
  const fiveMinMs = 5 * 60 * 1000;
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;

  let nextAllowedMs = now.getTime() + fiveMinMs;
  let expiresAtMs = now.getTime() + twentyFourHoursMs;

  // Transaction-safe 5-minute rate limit check & update
  await db.runTransaction(async (transaction) => {
    const locSnap = await transaction.get(locationRef);

    if (locSnap.exists) {
      const locData = locSnap.data();
      const lastUpdateMs = locData?.updatedAt?.toMillis ? locData.updatedAt.toMillis() : 0;

      if (now.getTime() - lastUpdateMs < fiveMinMs) {
        throw new HttpsError(
          'resource-exhausted',
          'Standort-Updates sind nur alle 5 Minuten erlaubt.'
        );
      }
    }

    transaction.set(locationRef, {
      latitude,
      longitude,
      updatedAt: nowTimestamp,
      expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
    });

    transaction.set(settingsRef, {
      lastLocationUpdatedAt: nowTimestamp,
      nextAllowedLocationUpdateAt: admin.firestore.Timestamp.fromMillis(nextAllowedMs),
      locationExpiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
    }, { merge: true });
  });

  return {
    updatedAt: nowTimestamp,
    nextAllowedUpdateAt: admin.firestore.Timestamp.fromMillis(nextAllowedMs),
    expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
  };
});

/**
 * 3. disableRadar Callable Function
 * Explicit idempotent function to disable radar.
 */
export const disableRadar = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
  }

  const userId = context.auth.uid;
  await enforceRateLimit(userId, 'disableRadar', 10, 600);

  const nowTimestamp = admin.firestore.Timestamp.now();
  const settingsRef = db.collection('users').doc(userId).collection('private').doc('radarSettings');

  const batch = db.batch();
  batch.set(settingsRef, {
    enabled: false,
    updatedAt: nowTimestamp,
    lastLocationUpdatedAt: null,
    nextAllowedLocationUpdateAt: null,
    locationExpiresAt: null
  }, { merge: true });
  batch.delete(db.collection('radar_locations').doc(userId));
  await batch.commit();

  return { success: true, enabled: false };
});

/**
 * 4. getNearbyFriends Callable Function
 * Returns privacy-safe obfuscated locations for confirmed nearby friends.
 */
export const getNearbyFriends = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
  }

  const userId = context.auth.uid;
  await enforceRateLimit(userId, 'getNearbyFriends', 1, 30); // Max 1 call per 30 seconds

  // Rejects unknown input properties
  if (data && Object.keys(data).length > 0) {
    throw new HttpsError('invalid-argument', 'getNearbyFriends akzeptiert keine Parameter.');
  }

  const now = new Date();
  const nowMs = now.getTime();
  const sixtyMinMs = 60 * 60 * 1000;

  // 1. Check caller's profile and radar access
  const callerDoc = await db.collection('users').doc(userId).get();
  const callerProfile = callerDoc.exists ? callerDoc.data() : null;

  if (!hasRadarAccessPermission(callerProfile, now)) {
    throw new HttpsError(
      'permission-denied',
      'Radar-Zugriff erfordert ein aktives Premium-Abonnement oder einen Organizer-Account.'
    );
  }

  // 2. Read caller's radar settings
  const callerSettingsSnap = await db
    .collection('users')
    .doc(userId)
    .collection('private')
    .doc('radarSettings')
    .get();

  if (!callerSettingsSnap.exists || callerSettingsSnap.data()?.enabled !== true) {
    throw new HttpsError('failed-precondition', 'Dein Radar ist nicht aktiviert.');
  }

  const radiusKm = Math.min(Math.max(callerSettingsSnap.data()?.radiusKm || 5, 1), 25);

  // 3. Read caller's location
  const callerLocationSnap = await db.collection('radar_locations').doc(userId).get();
  if (!callerLocationSnap.exists) {
    throw new HttpsError('failed-precondition', 'Kein aktueller Standort für deinen Account vorhanden.');
  }

  const callerLocData = callerLocationSnap.data();
  const callerUpdateMs = callerLocData?.updatedAt?.toMillis ? callerLocData.updatedAt.toMillis() : 0;
  const callerExpiresMs = callerLocData?.expiresAt?.toMillis ? callerLocData.expiresAt.toMillis() : 0;

  if (nowMs - callerUpdateMs > sixtyMinMs || callerExpiresMs <= nowMs) {
    throw new HttpsError('failed-precondition', 'Dein gespeicherter Standort ist veraltet (> 60 Min.).');
  }

  const callerLat = callerLocData?.latitude;
  const callerLon = callerLocData?.longitude;

  // 4. Confirmed friends & blocklist filter
  const allFriends: string[] = callerProfile?.friends || [];
  const hardBlacklist: string[] = callerProfile?.blacklist?.hard || [];
  const softBlacklist: string[] = callerProfile?.blacklist?.soft || [];
  const callerBlockedSet = new Set([...hardBlacklist, ...softBlacklist]);

  const unblockedFriends = allFriends.filter((fId) => !callerBlockedSet.has(fId));
  const candidateScanTruncated = unblockedFriends.length > 100;
  const candidateFriendIds = unblockedFriends.slice(0, 100);

  if (candidateFriendIds.length === 0) {
    return {
      friends: [],
      resultsTruncated: false,
      candidateScanTruncated,
      complete: !candidateScanTruncated,
      generatedAt: admin.firestore.Timestamp.now(),
    };
  }

  // 5. Batch-read candidate friend profiles
  const friendDocRefs = candidateFriendIds.map((fId) => db.collection('users').doc(fId));
  const friendDocs = await db.getAll(...friendDocRefs);

  const validFriendProfiles: Array<{ uid: string; data: any }> = [];
  const validFriendIds: string[] = [];

  for (const fDoc of friendDocs) {
    if (!fDoc.exists) continue;
    const fData = fDoc.data();
    const fUid = fDoc.id;

    // Check mutual friendship: Friend must also have caller in their friends array!
    const friendFriendsList: string[] = fData?.friends || [];
    if (!friendFriendsList.includes(userId)) continue;

    // Bidirectional block check: Friend must NOT block caller!
    const friendHardBlock: string[] = fData?.blacklist?.hard || [];
    const friendSoftBlock: string[] = fData?.blacklist?.soft || [];
    if (friendHardBlock.includes(userId) || friendSoftBlock.includes(userId)) continue;

    // Friend must have radar access
    if (!hasRadarAccessPermission(fData, now)) continue;

    validFriendProfiles.push({ uid: fUid, data: fData });
    validFriendIds.push(fUid);
  }

  if (validFriendIds.length === 0) {
    return { friends: [], generatedAt: admin.firestore.Timestamp.now() };
  }

  // 6. Batch-read valid friends' radar settings & locations
  const settingsRefs = validFriendIds.map((fId) =>
    db.collection('users').doc(fId).collection('private').doc('radarSettings')
  );
  const locationRefs = validFriendIds.map((fId) => db.collection('radar_locations').doc(fId));

  const [settingsSnaps, locationSnaps] = await Promise.all([
    db.getAll(...settingsRefs),
    db.getAll(...locationRefs),
  ]);

  const nearbyResults: Array<{
    userId: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    distanceBucket: any;
    approximateLatitude: number;
    approximateLongitude: number;
    precisionKm: number;
    updatedAt: any;
    exactDistance: number;
  }> = [];

  for (let i = 0; i < validFriendIds.length; i++) {
    const fUid = validFriendIds[i];
    const profileObj = validFriendProfiles[i].data;
    const setSnap = settingsSnaps[i];
    const locSnap = locationSnaps[i];

    if (!setSnap.exists || setSnap.data()?.enabled !== true) continue;
    if (!locSnap.exists) continue;

    const locData = locSnap.data();
    const fUpdateMs = locData?.updatedAt?.toMillis ? locData.updatedAt.toMillis() : 0;
    const fExpiresMs = locData?.expiresAt?.toMillis ? locData.expiresAt.toMillis() : 0;

    // Freshness check: <= 60 minutes and not expired
    if (nowMs - fUpdateMs > sixtyMinMs || fExpiresMs <= nowMs) continue;

    const fLat = locData?.latitude;
    const fLon = locData?.longitude;

    const exactDistance = calculateHaversineDistanceKm(callerLat, callerLon, fLat, fLon);

    if (exactDistance <= radiusKm) {
      const { approximateLatitude, approximateLongitude, precisionKm } =
        obfuscateMetricGridLocation(fLat, fLon);
      const distanceBucket = calculateDistanceBucket(exactDistance);

      nearbyResults.push({
        userId: fUid,
        username: profileObj.username || profileObj.displayName || 'Nutzer',
        displayName: profileObj.displayName || undefined,
        avatarUrl: profileObj.photoURL || undefined,
        distanceBucket,
        approximateLatitude,
        approximateLongitude,
        precisionKm,
        updatedAt: locData.updatedAt,
        exactDistance,
      });
    }
  }

  // 7. Sort by exact distance ascending and take at most 30 friends
  nearbyResults.sort((a, b) => a.exactDistance - b.exactDistance);

  const resultsTruncated = nearbyResults.length > 30;
  const finalFriends = nearbyResults.slice(0, 30).map((item) => ({
    userId: item.userId,
    username: item.username,
    displayName: item.displayName,
    avatarUrl: item.avatarUrl,
    distanceBucket: item.distanceBucket,
    approximateLatitude: item.approximateLatitude,
    approximateLongitude: item.approximateLongitude,
    precisionKm: item.precisionKm,
    updatedAt: item.updatedAt,
  }));

  const complete = !resultsTruncated && !candidateScanTruncated;

  return {
    friends: finalFriends,
    resultsTruncated,
    candidateScanTruncated,
    complete,
    generatedAt: admin.firestore.Timestamp.now(),
  };
});
