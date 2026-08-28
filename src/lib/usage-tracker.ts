import { adminDb } from '@/lib/firebase/admin-server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export type GeoapifyService =
  | 'places'
  | 'geocoding'
  | 'reverse_geocoding'
  | 'autocomplete'
  | 'place_details';

export interface GeoapifyCreditCalcParams {
  service: GeoapifyService;
  params: Record<string, any>;
  responseData?: any;
}

/**
 * Service-Specific Geoapify Credit Calculator
 * - Places API: 1-20 returned features = 1 credit, 21-40 = 2 credits, 41-60 = 3 credits.
 * - Geocoding / Reverse / Autocomplete: 1 credit per request.
 * - Place Details: 1 credit base + add-ons if extra attributes requested.
 */
export function calculateGeoapifyCredits({ service, params, responseData }: GeoapifyCreditCalcParams): number {
  switch (service) {
    case 'places': {
      const returnedCount = Array.isArray(responseData?.features) ? responseData.features.length : 0;
      if (returnedCount === 0) return 1; // Minimum 1 credit for executed query
      return Math.max(1, Math.ceil(returnedCount / 20));
    }

    case 'geocoding':
    case 'reverse_geocoding':
    case 'autocomplete':
      return 1;

    case 'place_details': {
      let credits = 1; // Base credit for Place Details API
      const featStr = String(params?.features || params?.details || '');
      if (featStr) {
        const featureList = featStr.split(',').map(f => f.trim()).filter(Boolean);
        // Each extra feature category (e.g. building, details.names, details.population) adds 1 credit
        credits += featureList.length;
      }
      return credits;
    }

    default:
      return 1;
  }
}

/**
 * Returns current date formatted cleanly in Europe/Berlin timezone (e.g. "2026-08-28")
 */
export function getBerlinDayKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(date);
}

export function getCurrentYearMonth(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}_${month}`;
}

export interface RecordServerGeoapifyParams {
  uid: string;
  service: GeoapifyService;
  params: Record<string, any>;
  responseData: any;
  usageEventId: string;
  statusCode?: number;
  isError?: boolean;
}

export class IdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}

/**
 * Server-Side Authoritative Transactional Usage Recorder
 * Uses Admin SDK Firestore Transaction for atomic writes and event idempotency.
 */
export async function recordGeoapifyServerTransaction(params: RecordServerGeoapifyParams): Promise<{ credits: number; duplicate: boolean }> {
  if (!adminDb) {
    console.warn('[Usage Tracker Server] adminDb not initialized.');
    return { credits: 1, duplicate: false };
  }

  const { uid, service, params: reqParams, responseData, usageEventId, isError = false } = params;
  const credits = isError ? 0 : calculateGeoapifyCredits({ service, params: reqParams, responseData });
  const berlinDayKey = getBerlinDayKey();
  const yearMonth = getCurrentYearMonth();

  const eventRef = adminDb.collection('geoapify_events').doc(usageEventId);
  const dailyRef = adminDb.collection('usage_daily').doc(berlinDayKey);
  const monthlyUserRef = adminDb.collection('user_usage').doc(`${yearMonth}_${uid}`);

  const payloadHash = `${uid}_${service}_${JSON.stringify(reqParams || {})}`;

  return await adminDb.runTransaction(async (transaction) => {
    // 1. Idempotency Check
    const eventSnap = await transaction.get(eventRef);
    if (eventSnap.exists) {
      const existingData = eventSnap.data();
      if (existingData?.payloadHash === payloadHash) {
        // Already recorded cleanly, skip duplicate write
        return { credits: existingData.credits || 0, duplicate: true };
      } else {
        throw new IdempotencyConflictError(`usageEventId ${usageEventId} already used with a different request payload.`);
      }
    }

    // 2. Write Event Audit Log
    transaction.set(eventRef, {
      usageEventId,
      uid,
      service,
      payloadHash,
      credits,
      isError,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 60 * 86400 * 1000)), // 60 days Firestore TTL
    });

    // 3. Update Global Daily Aggregates (usage_daily/YYYY-MM-DD)
    const dailySnap = await transaction.get(dailyRef);
    const serviceField = `services.${service}`;

    if (dailySnap.exists) {
      transaction.update(dailyRef, {
        credits: FieldValue.increment(credits),
        requests: FieldValue.increment(1),
        successCount: FieldValue.increment(isError ? 0 : 1),
        errorCount: FieldValue.increment(isError ? 1 : 0),
        [`${serviceField}.requests`]: FieldValue.increment(1),
        [`${serviceField}.credits`]: FieldValue.increment(credits),
        lastActiveAt: FieldValue.serverTimestamp(),
      });
    } else {
      transaction.set(dailyRef, {
        dateKey: berlinDayKey,
        timezone: 'Europe/Berlin',
        credits,
        requests: 1,
        successCount: isError ? 0 : 1,
        errorCount: isError ? 1 : 0,
        cacheHits: 0,
        cacheMisses: 1,
        services: {
          places: { requests: service === 'places' ? 1 : 0, credits: service === 'places' ? credits : 0 },
          geocoding: { requests: service === 'geocoding' ? 1 : 0, credits: service === 'geocoding' ? credits : 0 },
          reverse_geocoding: { requests: service === 'reverse_geocoding' ? 1 : 0, credits: service === 'reverse_geocoding' ? credits : 0 },
          autocomplete: { requests: service === 'autocomplete' ? 1 : 0, credits: service === 'autocomplete' ? credits : 0 },
          place_details: { requests: service === 'place_details' ? 1 : 0, credits: service === 'place_details' ? credits : 0 },
        },
        createdAt: FieldValue.serverTimestamp(),
        lastActiveAt: FieldValue.serverTimestamp(),
      });
    }

    // 4. Update Monthly User Usage (user_usage/YYYY_MM_UID)
    const monthlySnap = await transaction.get(monthlyUserRef);
    if (monthlySnap.exists) {
      transaction.update(monthlyUserRef, {
        geoapifyCredits: FieldValue.increment(credits),
        requestCount: FieldValue.increment(1),
        [`geoapify.${service}.requests`]: FieldValue.increment(1),
        [`geoapify.${service}.credits`]: FieldValue.increment(credits),
        successCount: FieldValue.increment(isError ? 0 : 1),
        errorCount: FieldValue.increment(isError ? 1 : 0),
        lastActiveAt: FieldValue.serverTimestamp(),
      });
    } else {
      transaction.set(monthlyUserRef, {
        uid,
        yearMonth,
        geoapifyCredits: credits,
        requestCount: 1,
        successCount: isError ? 0 : 1,
        errorCount: isError ? 1 : 0,
        cacheHits: 0,
        cacheMisses: 1,
        geoapify: {
          places: { requests: service === 'places' ? 1 : 0, credits: service === 'places' ? credits : 0 },
          geocoding: { requests: service === 'geocoding' ? 1 : 0, credits: service === 'geocoding' ? credits : 0 },
          reverse_geocoding: { requests: service === 'reverse_geocoding' ? 1 : 0, credits: service === 'reverse_geocoding' ? credits : 0 },
          autocomplete: { requests: service === 'autocomplete' ? 1 : 0, credits: service === 'autocomplete' ? credits : 0 },
          place_details: { requests: service === 'place_details' ? 1 : 0, credits: service === 'place_details' ? credits : 0 },
        },
        createdAt: FieldValue.serverTimestamp(),
        lastActiveAt: FieldValue.serverTimestamp(),
      });
    }

    return { credits, duplicate: false };
  });
}

/**
 * Batched Cache Avoidance Telemetry Recorder
 * Increments cacheHits / cacheMisses in Firestore via Admin SDK.
 */
export async function recordCacheTelemetryServer(uid: string, cacheHits: number, cacheMisses: number): Promise<void> {
  if (!adminDb || (!cacheHits && !cacheMisses)) return;

  const berlinDayKey = getBerlinDayKey();
  const yearMonth = getCurrentYearMonth();

  const dailyRef = adminDb.collection('usage_daily').doc(berlinDayKey);
  const monthlyUserRef = adminDb.collection('user_usage').doc(`${yearMonth}_${uid}`);

  try {
    const batch = adminDb.batch();

    batch.set(dailyRef, {
      cacheHits: FieldValue.increment(cacheHits),
      cacheMisses: FieldValue.increment(cacheMisses),
    }, { merge: true });

    batch.set(monthlyUserRef, {
      cacheHits: FieldValue.increment(cacheHits),
      cacheMisses: FieldValue.increment(cacheMisses),
    }, { merge: true });

    await batch.commit();
  } catch (err) {
    console.error('[Cache Telemetry Server] Failed to write batch:', err);
  }
}

export interface RecordTokenUsageParams {
  uid: string;
  promptTokens: number;
  completionTokens: number;
  feature?: string;
}

export async function recordUserTokenUsage({ uid, promptTokens, completionTokens, feature = 'intent_parsing' }: RecordTokenUsageParams): Promise<void> {
  if (!adminDb || !uid) return;

  const berlinDayKey = getBerlinDayKey();
  const yearMonth = getCurrentYearMonth();
  const totalTokens = promptTokens + completionTokens;

  const dailyRef = adminDb.collection('usage_daily').doc(berlinDayKey);
  const monthlyUserRef = adminDb.collection('user_usage').doc(`${yearMonth}_${uid}`);

  try {
    const batch = adminDb.batch();

    batch.set(dailyRef, {
      totalTokens: FieldValue.increment(totalTokens),
      aiRequests: FieldValue.increment(1),
    }, { merge: true });

    batch.set(monthlyUserRef, {
      promptTokens: FieldValue.increment(promptTokens),
      completionTokens: FieldValue.increment(completionTokens),
      totalTokens: FieldValue.increment(totalTokens),
      aiRequests: FieldValue.increment(1),
      lastActiveAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await batch.commit();
  } catch (err) {
    console.error('[Token Usage Server] Failed to record token usage:', err);
  }
}
