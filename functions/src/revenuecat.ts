import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { z } from 'zod';

export const REVENUECAT_WEBHOOK_SECRET = defineSecret('REVENUECAT_WEBHOOK_SECRET');

export type RevenueCatTier = 'tier1' | 'tier2' | 'tier3';

export interface EntitlementMapping {
  tier: RevenueCatTier;
  entitlements: string[];
}

export type SecretProvider = () => string;

const TIER3_CANONICAL_IDS = new Set([
  'organizer', 'aktiva_organizer_monthly', 'aktiva_organizer_yearly', 'tier3'
]);
const TIER2_CANONICAL_IDS = new Set([
  'pro', 'aktiva_pro_monthly', 'aktiva_pro_yearly', 'tier2'
]);
const TIER1_CANONICAL_IDS = new Set([
  'basic', 'starter', 'aktiva_basic_monthly', 'aktiva_starter_monthly', 'tier1'
]);

const revenueCatEventPayloadSchema = z.object({
  id: z.string().min(1, 'Event ID must not be empty').max(128, 'Event ID too long'),
  type: z.string().min(1, 'Event type must not be empty').max(128, 'Event type too long'),
  app_user_id: z.string().min(1).max(128).optional(),
  product_id: z.string().min(1).max(128).nullable().optional(),
  entitlement_ids: z.array(z.string().min(1).max(128)).max(50, 'Too many entitlement IDs').nullable().optional(),
  expiration_at_ms: z.number().int().positive().safe().nullable().optional(),
  event_timestamp_ms: z.number().int().positive().safe().optional(),
}).passthrough();

const revenueCatWebhookBodySchema = z.object({
  api_version: z.string().optional(),
  event: revenueCatEventPayloadSchema,
}).passthrough();

/**
 * Maps RevenueCat entitlement identifiers or product IDs to Activa Premium Tiers & Entitlements using strict exact allowlist matching.
 * Returns null if no canonical entitlement match is found.
 */
export function mapEntitlementsToTier(
  entitlementIds: string[] | null | undefined,
  productId?: string | null
): EntitlementMapping | null {
  const ids: string[] = Array.isArray(entitlementIds) ? [...entitlementIds] : [];
  if (productId && typeof productId === 'string') {
    ids.push(productId);
  }

  if (ids.length === 0) return null;

  for (const id of ids) {
    if (TIER3_CANONICAL_IDS.has(id)) {
      return {
        tier: 'tier3',
        entitlements: [
          'advanced_filters', 'extended_radius', 'collections', 'boost_tokens',
          'premium_badge', 'ai_discovery', 'organizer_analytics', 'profile_visitors',
          'incognito_mode', 'priority_join', 'read_receipts', 'co_hosts',
          'custom_banners', 'passcode_events', 'waitlist_management'
        ]
      };
    }
  }

  for (const id of ids) {
    if (TIER2_CANONICAL_IDS.has(id)) {
      return {
        tier: 'tier2',
        entitlements: [
          'advanced_filters', 'extended_radius', 'collections', 'boost_tokens',
          'premium_badge', 'ai_discovery', 'profile_visitors', 'incognito_mode',
          'priority_join', 'read_receipts', 'co_hosts', 'custom_banners'
        ]
      };
    }
  }

  for (const id of ids) {
    if (TIER1_CANONICAL_IDS.has(id)) {
      return {
        tier: 'tier1',
        entitlements: [
          'advanced_filters', 'extended_radius', 'collections', 'premium_badge',
          'ai_discovery', 'profile_visitors', 'incognito_mode', 'read_receipts'
        ]
      };
    }
  }

  return null;
}

/**
 * Recursively canonicalizes payload objects by alphabetically sorting keys, removing undefined values,
 * retaining null values, and preserving array order.
 */
export function canonicalizePayload(val: any): any {
  if (val === undefined) return undefined;
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    return val.map(item => canonicalizePayload(item));
  }
  const sortedKeys = Object.keys(val).sort();
  const result: Record<string, any> = {};
  for (const key of sortedKeys) {
    const canonicalVal = canonicalizePayload(val[key]);
    if (canonicalVal !== undefined) {
      result[key] = canonicalVal;
    }
  }
  return result;
}

/**
 * Computes canonical SHA-256 hash for raw payload idempotency checks
 */
export function computePayloadHash(rawPayload: any): string {
  const canonicalObj = canonicalizePayload(rawPayload ?? {});
  const jsonStr = JSON.stringify(canonicalObj);
  return crypto.createHash('sha256').update(jsonStr, 'utf8').digest('hex');
}

/**
 * HMAC Signature Verification Helper (Prepared for future X-RevenueCat-Webhook-Signature migration)
 */
export function verifyRevenueCatHmacSignature(rawBody: string, timestamp: string, signature: string, secret: string): boolean {
  if (!rawBody || !timestamp || !signature || !secret) return false;
  const hmac = crypto.createHmac('sha256', secret);
  const expectedSig = hmac.update(`${timestamp}.${rawBody}`).digest('hex');
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSig);
  if (sigBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * Core Request Handler for RevenueCat Webhooks (testable with injected db/secretProvider/nowMs).
 */
export async function handleRevenueCatWebhookRequest(
  req: any,
  res: any,
  options?: {
    db?: any;
    secretProvider?: SecretProvider;
    nowMs?: () => number;
  }
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // Bound overall parsed payload size (50KB max)
  const rawBodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (Buffer.byteLength(rawBodyStr, 'utf8') > 50000) {
    res.status(400).json({ error: 'Bad Request: Payload Too Large' });
    return;
  }

  // 1. Fail-Closed Secret Verification (Strict provider evaluation without process.env fallbacks in production)
  let secretValue = '';
  try {
    const provider = options?.secretProvider || (() => REVENUECAT_WEBHOOK_SECRET.value());
    secretValue = provider() || '';
  } catch {
    secretValue = '';
  }

  if (!secretValue || secretValue.trim() === '') {
    console.error('[RevenueCat Webhook] Fail-Closed: Secret is unconfigured or empty');
    res.status(503).json({ error: 'Service Unavailable' });
    return;
  }

  // 2. Authorization Header Check
  const authHeader = req.headers?.authorization || '';
  if (authHeader !== `Bearer ${secretValue}`) {
    console.warn('[RevenueCat Webhook] Unauthorized request received');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // 3. Payload Validation via Zod
  const parsedBody = revenueCatWebhookBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: 'Bad Request' });
    return;
  }

  const { id: eventId, type, app_user_id, product_id, entitlement_ids, expiration_at_ms, event_timestamp_ms } = parsedBody.data.event;

  // 4. TEST Events (Non-mutating)
  if (type === 'TEST') {
    res.status(200).json({ status: 'test_event_acknowledged', id: eventId });
    return;
  }

  if (!app_user_id || typeof app_user_id !== 'string' || app_user_id.includes('/') || app_user_id.includes('\\')) {
    res.status(400).json({ error: 'Bad Request' });
    return;
  }

  // Strict Event Timestamp Check (No Date.now() fallback for non-TEST events)
  if (typeof event_timestamp_ms !== 'number' || !Number.isInteger(event_timestamp_ms) || event_timestamp_ms <= 0) {
    res.status(400).json({ error: 'Bad Request: Missing or invalid event_timestamp_ms' });
    return;
  }

  const eventTimestampNum = event_timestamp_ms;

  const currentPayloadHash = computePayloadHash(req.body);
  const db = options?.db || admin.firestore();
  
  // Use SHA-256 hex hash of eventId as document key to prevent path traversal/injection attacks
  const safeEventDocId = crypto.createHash('sha256').update(eventId).digest('hex');
  const eventRef = db.collection('revenuecat_events').doc(safeEventDocId);
  const userRef = db.collection('users').doc(app_user_id);

  // 5. Atomic Idempotency Transaction
  let transactionResult: { status: string; httpCode: number; detail?: string; processed?: boolean } = { status: 'success', httpCode: 200, processed: true };

  await db.runTransaction(async (transaction: any) => {
    const eventDoc = await transaction.get(eventRef);
    const userDoc = await transaction.get(userRef);

    // Replay & Conflict Check
    if (eventDoc.exists) {
      const existingData = eventDoc.data();
      if (existingData?.payloadHash === currentPayloadHash) {
        transactionResult = { status: 'already_processed', httpCode: 200, processed: false };
        return;
      } else {
        transactionResult = { status: 'conflict', httpCode: 409, detail: 'Conflict: Event ID reused with different payload' };
        return;
      }
    }

    // User Non-Existence Check (Fail-safe, no orphan creation)
    if (!userDoc.exists) {
      const userHashLog = crypto.createHash('sha256').update(app_user_id).digest('hex').substring(0, 8);
      console.warn(`[RevenueCat Webhook] User document with hash prefix ${userHashLog} does not exist. Marking event user_not_found.`);
      transaction.set(eventRef, {
        eventId,
        type,
        appUserIdHash: userHashLog,
        payloadHash: currentPayloadHash,
        eventTimestampMs: eventTimestampNum,
        status: 'user_not_found',
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      transactionResult = { status: 'user_not_found', httpCode: 200, processed: false };
      return;
    }

    // Out-of-order / Late Event Check (Deterministic composite ordering via timestamp + eventId)
    const existingUser = userDoc.data();
    const lastEventTimestamp = Number(existingUser?.lastRevenueCatEventTimestamp) || 0;
    const lastEventId = existingUser?.lastRevenueCatEventId || '';

    let isOlderEvent = false;
    if (lastEventTimestamp > eventTimestampNum) {
      isOlderEvent = true;
    } else if (lastEventTimestamp === eventTimestampNum && lastEventId && lastEventId > eventId) {
      isOlderEvent = true;
    }

    if (isOlderEvent) {
      transaction.set(eventRef, {
        eventId,
        type,
        appUserIdHash: crypto.createHash('sha256').update(app_user_id).digest('hex').substring(0, 8),
        payloadHash: currentPayloadHash,
        eventTimestampMs: eventTimestampNum,
        status: 'ignored_older_event',
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      transactionResult = { status: 'ignored_older_event', httpCode: 200, processed: false };
      return;
    }

    // Execute State Matrix Mutation
    const updates: Record<string, any> = {
      lastRevenueCatEventTimestamp: eventTimestampNum,
      lastRevenueCatEventId: eventId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    switch (type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION':
      case 'PRODUCT_CHANGE': {
        const getNow = options?.nowMs || Date.now;
        const nowMs = getNow();
        const expMs = Number(expiration_at_ms) || 0;
        if (!expMs || expMs <= nowMs) {
          transaction.set(eventRef, {
            eventId,
            type,
            appUserIdHash: crypto.createHash('sha256').update(app_user_id).digest('hex').substring(0, 8),
            payloadHash: currentPayloadHash,
            eventTimestampMs: eventTimestampNum,
            status: 'ignored_expired_grant',
            processedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          transactionResult = { status: 'ignored_expired_grant', httpCode: 200, processed: false };
          return;
        }

        const mapping = mapEntitlementsToTier(entitlement_ids, product_id);
        if (!mapping) {
          transaction.set(eventRef, {
            eventId,
            type,
            appUserIdHash: crypto.createHash('sha256').update(app_user_id).digest('hex').substring(0, 8),
            payloadHash: currentPayloadHash,
            eventTimestampMs: eventTimestampNum,
            status: 'ignored_unrecognized_entitlement',
            processedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          transactionResult = { status: 'ignored_unrecognized_entitlement', httpCode: 200, processed: false };
          return;
        }

        const expiresAt = admin.firestore.Timestamp.fromMillis(expMs);

        updates.isPremium = true;
        updates.premiumTier = mapping.tier;
        updates.premiumEntitlements = mapping.entitlements;
        updates.premiumSource = 'revenuecat';
        updates.premiumExpiresAt = expiresAt;
        updates.premiumCancellationRequestedAt = null;
        break;
      }

      case 'CANCELLATION': {
        const getNow = options?.nowMs || Date.now;
        const nowMs = getNow();
        const expMs = Number(expiration_at_ms) || 0;
        if (expMs > nowMs) {
          updates.isPremium = true;
          updates.premiumCancellationRequestedAt = admin.firestore.FieldValue.serverTimestamp();
          if (expMs > 0) {
            updates.premiumExpiresAt = admin.firestore.Timestamp.fromMillis(expMs);
          }
        } else {
          updates.isPremium = false;
          updates.premiumTier = null;
          updates.premiumEntitlements = [];
          updates.premiumExpiresAt = null;
          updates.premiumCancellationRequestedAt = admin.firestore.FieldValue.serverTimestamp();
        }
        break;
      }

      case 'EXPIRATION': {
        updates.isPremium = false;
        updates.premiumTier = null;
        updates.premiumEntitlements = [];
        updates.premiumExpiresAt = null;
        break;
      }

      default: {
        transaction.set(eventRef, {
          eventId,
          type,
          appUserIdHash: crypto.createHash('sha256').update(app_user_id).digest('hex').substring(0, 8),
          payloadHash: currentPayloadHash,
          eventTimestampMs: eventTimestampNum,
          status: 'ignored_unknown_type',
          processedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        transactionResult = { status: 'ignored_unknown_type', httpCode: 200, processed: false };
        return;
      }
    }

    // Write User Update & Write Event Record Atomically
    transaction.set(userRef, updates, { merge: true });
    transaction.set(eventRef, {
      eventId,
      type,
      appUserIdHash: crypto.createHash('sha256').update(app_user_id).digest('hex').substring(0, 8),
      payloadHash: currentPayloadHash,
      eventTimestampMs: eventTimestampNum,
      status: 'completed',
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    transactionResult = { status: 'success', httpCode: 200, processed: true };
  });

  if (transactionResult.httpCode !== 200) {
    res.status(transactionResult.httpCode).json({ error: transactionResult.detail || 'Transaction failed' });
    return;
  }

  res.status(200).json({ status: transactionResult.status, type, eventId, processed: transactionResult.processed ?? true });
}

/**
 * HTTPS Function to handle incoming RevenueCat Webhook events.
 * Server-to-Server endpoint: Exempt from Firebase App Check.
 * Secured via Authorization Bearer token + atomic Firestore transaction idempotency.
 */
export const revenueCatWebhook = onRequest({ secrets: [REVENUECAT_WEBHOOK_SECRET], cors: true }, async (req, res) => {
  try {
    await handleRevenueCatWebhookRequest(req, res);
  } catch (error: any) {
    console.error('[RevenueCat Webhook] Exception:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
