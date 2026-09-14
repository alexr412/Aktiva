import test from 'node:test';
import assert from 'node:assert';
import {
  mapEntitlementsToTier,
  computePayloadHash,
  verifyRevenueCatHmacSignature,
  handleRevenueCatWebhookRequest
} from './revenuecat';

test('1. RevenueCat Entitlements Mapping Allowlist & Isolation', async (t) => {
  await t.test('maps known Tier 1 ID (basic) to tier1', () => {
    const res = mapEntitlementsToTier(['basic'], null);
    assert.ok(res !== null);
    assert.strictEqual(res?.tier, 'tier1');
    assert.ok(res?.entitlements.includes('premium_badge'));
  });

  await t.test('maps known Tier 2 ID (pro) to tier2', () => {
    const res = mapEntitlementsToTier(['pro'], 'aktiva_pro_monthly');
    assert.ok(res !== null);
    assert.strictEqual(res?.tier, 'tier2');
    assert.ok(res?.entitlements.includes('priority_join'));
  });

  await t.test('maps known Tier 3 ID (organizer) to tier3', () => {
    const res = mapEntitlementsToTier(['organizer'], 'aktiva_organizer_monthly');
    assert.ok(res !== null);
    assert.strictEqual(res?.tier, 'tier3');
    assert.ok(res?.entitlements.includes('organizer_analytics'));
  });

  await t.test('returns null for empty entitlement array and null product', () => {
    const res = mapEntitlementsToTier([], null);
    assert.strictEqual(res, null);
  });

  await t.test('returns null for unknown entitlement ID', () => {
    const res = mapEntitlementsToTier(['unknown_entitlement_123'], null);
    assert.strictEqual(res, null);
  });

  await t.test('returns null for similarly sounding manipulated entitlement ID (e.g. pro_unauthorized)', () => {
    const res = mapEntitlementsToTier(['pro_unauthorized'], null);
    assert.strictEqual(res, null);
  });

  await t.test('returns null for product name with random "pro" substring (e.g. aktiva_product_pro_xyz)', () => {
    const res = mapEntitlementsToTier([], 'aktiva_product_pro_xyz');
    assert.strictEqual(res, null);
  });
});

test('2. Canonical Payload Hashing Determinism', async (t) => {
  await t.test('different key ordering produces identical hash', () => {
    const payload1 = { event: { id: 'evt_1', type: 'INITIAL_PURCHASE', event_timestamp_ms: 100 } };
    const payload2 = { event: { event_timestamp_ms: 100, type: 'INITIAL_PURCHASE', id: 'evt_1' } };
    const hash1 = computePayloadHash(payload1);
    const hash2 = computePayloadHash(payload2);
    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 64);
  });

  await t.test('different array order produces DIFFERENT hash', () => {
    const payload1 = { event: { id: 'evt_1', entitlement_ids: ['a', 'b'] } };
    const payload2 = { event: { id: 'evt_1', entitlement_ids: ['b', 'a'] } };
    const hash1 = computePayloadHash(payload1);
    const hash2 = computePayloadHash(payload2);
    assert.notStrictEqual(hash1, hash2);
  });

  await t.test('altered payload field value produces DIFFERENT hash', () => {
    const payload1 = { event: { id: 'evt_1', type: 'INITIAL_PURCHASE' } };
    const payload2 = { event: { id: 'evt_1', type: 'RENEWAL' } };
    const hash1 = computePayloadHash(payload1);
    const hash2 = computePayloadHash(payload2);
    assert.notStrictEqual(hash1, hash2);
  });

  await t.test('undefined field does not alter hash compared to omitted field', () => {
    const payload1 = { event: { id: 'evt_1', product_id: undefined } };
    const payload2 = { event: { id: 'evt_1' } };
    const hash1 = computePayloadHash(payload1);
    const hash2 = computePayloadHash(payload2);
    assert.strictEqual(hash1, hash2);
  });

  await t.test('null field DOES alter hash compared to omitted/undefined field', () => {
    const payload1 = { event: { id: 'evt_1', product_id: null } };
    const payload2 = { event: { id: 'evt_1' } };
    const hash1 = computePayloadHash(payload1);
    const hash2 = computePayloadHash(payload2);
    assert.notStrictEqual(hash1, hash2);
  });

  await t.test('verifies HMAC-SHA256 signature utility', () => {
    const secret = 'test_webhook_secret_key';
    const timestamp = '1700000000';
    const rawBody = '{"event":{"id":"evt_999"}}';
    const crypto = require('crypto');
    const expectedSig = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
    
    assert.strictEqual(verifyRevenueCatHmacSignature(rawBody, timestamp, expectedSig, secret), true);
    assert.strictEqual(verifyRevenueCatHmacSignature(rawBody, timestamp, 'invalid_sig', secret), false);
  });
});

test('3. Secret Provider Fail-Closed Behavior', async (t) => {
  function createMockRes() {
    let statusCode = 200;
    let jsonBody: any = null;
    return {
      status(code: number) { statusCode = code; return this; },
      json(body: any) { jsonBody = body; return this; },
      send(body: any) { return this; },
      get statusCode() { return statusCode; },
      get jsonBody() { return jsonBody; }
    };
  }

  await t.test('returns 503 when secret provider throws an error', async () => {
    const req = { method: 'POST', headers: { authorization: 'Bearer test' }, body: {} };
    const res = createMockRes();
    await handleRevenueCatWebhookRequest(req, res, {
      secretProvider: () => { throw new Error('Secret vault unreadable'); }
    });
    assert.strictEqual(res.statusCode, 503);
  });

  await t.test('returns 503 when secret provider returns undefined', async () => {
    const req = { method: 'POST', headers: { authorization: 'Bearer test' }, body: {} };
    const res = createMockRes();
    await handleRevenueCatWebhookRequest(req, res, { secretProvider: (() => undefined) as any });
    assert.strictEqual(res.statusCode, 503);
  });

  await t.test('returns 503 when secret provider returns empty string', async () => {
    const req = { method: 'POST', headers: { authorization: 'Bearer test' }, body: {} };
    const res = createMockRes();
    await handleRevenueCatWebhookRequest(req, res, { secretProvider: () => '' });
    assert.strictEqual(res.statusCode, 503);
  });

  await t.test('returns 503 when secret provider returns whitespace string', async () => {
    const req = { method: 'POST', headers: { authorization: 'Bearer test' }, body: {} };
    const res = createMockRes();
    await handleRevenueCatWebhookRequest(req, res, { secretProvider: () => '   ' });
    assert.strictEqual(res.statusCode, 503);
  });
});

test('4. Full RevenueCat Transaction Matrix & Idempotency', async (t) => {
  const secret = 'valid_secret_key';

  function createTestHarness(initialUser?: any) {
    // NOTE: Map mock simulates synchronous JS in-memory transactions for unit testing logic.
    // For true parallel concurrency isolation proof under real Firestore locks, see emulator integration tests.
    const eventsMap = new Map<string, any>();
    const usersMap = new Map<string, any>();
    if (initialUser && initialUser.uid) {
      usersMap.set(initialUser.uid, { ...initialUser });
    }

    const mockDb: any = {
      collection(colName: string) {
        return {
          doc(docId: string) {
            return { colName, docId };
          }
        };
      },
      runTransaction(fn: any) {
        const transaction: any = {
          get(ref: any) {
            if (ref.colName === 'revenuecat_events') {
              const data = eventsMap.get(ref.docId);
              return { exists: !!data, data: () => data };
            }
            if (ref.colName === 'users') {
              const data = usersMap.get(ref.docId);
              return { exists: !!data, data: () => data };
            }
            return { exists: false, data: () => null };
          },
          set(ref: any, data: any, options?: any) {
            if (ref.colName === 'revenuecat_events') {
              eventsMap.set(ref.docId, data);
            }
            if (ref.colName === 'users') {
              const prev = usersMap.get(ref.docId) || {};
              usersMap.set(ref.docId, options?.merge ? { ...prev, ...data } : data);
            }
          }
        };
        return fn(transaction);
      }
    };

    function createMockRes() {
      let statusCode = 200;
      let jsonBody: any = null;
      let sentBody: any = null;
      return {
        status(code: number) { statusCode = code; return this; },
        json(body: any) { jsonBody = body; return this; },
        send(body: any) { sentBody = body; return this; },
        get statusCode() { return statusCode; },
        get jsonBody() { return jsonBody; },
        get sentBody() { return sentBody; }
      };
    }

    return { mockDb, eventsMap, usersMap, createMockRes };
  }

  await t.test('Rejects HTTP non-POST methods with 405 Method Not Allowed', async () => {
    const { mockDb, createMockRes } = createTestHarness();
    const req = { method: 'GET', headers: {}, body: {} };
    const res = createMockRes();
    await handleRevenueCatWebhookRequest(req, res, { db: mockDb, secretProvider: () => secret });
    assert.strictEqual(res.statusCode, 405);
    assert.strictEqual(res.sentBody, 'Method Not Allowed');
  });

  await t.test('Rejects missing or invalid Authorization Bearer header with 401 Unauthorized', async () => {
    const { mockDb, createMockRes } = createTestHarness();
    const reqMissing = { method: 'POST', headers: {}, body: {} };
    const resMissing = createMockRes();
    await handleRevenueCatWebhookRequest(reqMissing, resMissing, { db: mockDb, secretProvider: () => secret });
    assert.strictEqual(resMissing.statusCode, 401);

    const reqWrong = { method: 'POST', headers: { authorization: 'Bearer wrong_secret' }, body: {} };
    const resWrong = createMockRes();
    await handleRevenueCatWebhookRequest(reqWrong, resWrong, { db: mockDb, secretProvider: () => secret });
    assert.strictEqual(resWrong.statusCode, 401);
  });

  await t.test('INITIAL_PURCHASE Tier 1 updates user to tier1 premium when expiration_at_ms is active', async () => {
    const { mockDb, usersMap } = createTestHarness({ uid: 'user_t1', role: 'user' });
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: {
        event: {
          id: 'evt_init_t1',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'user_t1',
          entitlement_ids: ['basic'],
          expiration_at_ms: 2000000000000,
          event_timestamp_ms: 1700000000000
        }
      }
    };
    const res = createTestHarness().createMockRes();
    await handleRevenueCatWebhookRequest(req, res, { db: mockDb, secretProvider: () => secret, nowMs: () => 1700000000000 });
    assert.strictEqual(res.statusCode, 200);
    const updatedUser = usersMap.get('user_t1');
    assert.strictEqual(updatedUser.isPremium, true);
    assert.strictEqual(updatedUser.premiumTier, 'tier1');
  });

  await t.test('INITIAL_PURCHASE Tier 2 updates user to tier2 premium when expiration_at_ms is active', async () => {
    const { mockDb, usersMap } = createTestHarness({ uid: 'user_t2', role: 'user' });
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: {
        event: {
          id: 'evt_init_t2',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'user_t2',
          entitlement_ids: ['pro'],
          expiration_at_ms: 2000000000000,
          event_timestamp_ms: 1700000000000
        }
      }
    };
    const res = createTestHarness().createMockRes();
    await handleRevenueCatWebhookRequest(req, res, { db: mockDb, secretProvider: () => secret, nowMs: () => 1700000000000 });
    assert.strictEqual(res.statusCode, 200);
    const updatedUser = usersMap.get('user_t2');
    assert.strictEqual(updatedUser.isPremium, true);
    assert.strictEqual(updatedUser.premiumTier, 'tier2');
  });

  await t.test('INITIAL_PURCHASE Tier 3 updates user to tier3 premium when expiration_at_ms is active', async () => {
    const { mockDb, usersMap } = createTestHarness({ uid: 'user_t3', role: 'user' });
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: {
        event: {
          id: 'evt_init_t3',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'user_t3',
          entitlement_ids: ['organizer'],
          expiration_at_ms: 2000000000000,
          event_timestamp_ms: 1700000000000
        }
      }
    };
    const res = createTestHarness().createMockRes();
    await handleRevenueCatWebhookRequest(req, res, { db: mockDb, secretProvider: () => secret, nowMs: () => 1700000000000 });
    assert.strictEqual(res.statusCode, 200);
    const updatedUser = usersMap.get('user_t3');
    assert.strictEqual(updatedUser.isPremium, true);
    assert.strictEqual(updatedUser.premiumTier, 'tier3');
  });

  await t.test('Grant event with missing or expired expiration_at_ms is rejected without granting premium', async () => {
    const { mockDb, usersMap } = createTestHarness({ uid: 'user_exp_grant', role: 'user', isPremium: false });
    
    // 1. Missing expiration_at_ms
    const reqMissing = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: {
        event: {
          id: 'evt_exp_grant_1',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'user_exp_grant',
          entitlement_ids: ['pro'],
          event_timestamp_ms: 1700000000000
        }
      }
    };
    const resMissing = createTestHarness().createMockRes();
    await handleRevenueCatWebhookRequest(reqMissing, resMissing, { db: mockDb, secretProvider: () => secret, nowMs: () => 1700000000000 });
    assert.strictEqual(resMissing.statusCode, 200);
    assert.strictEqual(resMissing.jsonBody?.status, 'ignored_expired_grant');
    assert.strictEqual(usersMap.get('user_exp_grant').isPremium, false);

    // 2. Past expiration_at_ms (expiration_at_ms <= nowMs)
    const reqPast = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: {
        event: {
          id: 'evt_exp_grant_2',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'user_exp_grant',
          entitlement_ids: ['pro'],
          expiration_at_ms: 1600000000000, // past!
          event_timestamp_ms: 1700000000000
        }
      }
    };
    const resPast = createTestHarness().createMockRes();
    await handleRevenueCatWebhookRequest(reqPast, resPast, { db: mockDb, secretProvider: () => secret, nowMs: () => 1700000000000 });
    assert.strictEqual(resPast.statusCode, 200);
    assert.strictEqual(resPast.jsonBody?.status, 'ignored_expired_grant');
    assert.strictEqual(usersMap.get('user_exp_grant').isPremium, false);
  });

  await t.test('Unknown entitlement without mapping does NOT grant premium', async () => {
    const { mockDb, usersMap } = createTestHarness({ uid: 'user_unknown', role: 'user', isPremium: false });
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: {
        event: {
          id: 'evt_unknown_ent',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'user_unknown',
          entitlement_ids: ['random_fake_id'],
          expiration_at_ms: 2000000000000,
          event_timestamp_ms: 1700000000000
        }
      }
    };
    const res = createTestHarness().createMockRes();
    await handleRevenueCatWebhookRequest(req, res, { db: mockDb, secretProvider: () => secret, nowMs: () => 1700000000000 });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonBody?.status, 'ignored_unrecognized_entitlement');
    assert.strictEqual(usersMap.get('user_unknown').isPremium, false);
  });

  await t.test('RENEWAL updates user premium state when expiration_at_ms is active', async () => {
    const { mockDb, usersMap } = createTestHarness({ uid: 'user_renew', role: 'user' });
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: {
        event: {
          id: 'evt_renew',
          type: 'RENEWAL',
          app_user_id: 'user_renew',
          entitlement_ids: ['pro'],
          expiration_at_ms: 2000000000000,
          event_timestamp_ms: 1700000000000
        }
      }
    };
    const res = createTestHarness().createMockRes();
    await handleRevenueCatWebhookRequest(req, res, { db: mockDb, secretProvider: () => secret, nowMs: () => 1700000000000 });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(usersMap.get('user_renew').isPremium, true);
  });

  await t.test('CANCELLATION before expiration retains isPremium: true until expiration date', async () => {
    const { mockDb, usersMap } = createTestHarness({ uid: 'user_cancel_early', role: 'user', isPremium: true });
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: {
        event: {
          id: 'evt_cancel_early',
          type: 'CANCELLATION',
          app_user_id: 'user_cancel_early',
          expiration_at_ms: 2000000000000, // future date
          event_timestamp_ms: 1700000000000
        }
      }
    };
    const res = createTestHarness().createMockRes();
    await handleRevenueCatWebhookRequest(req, res, {
      db: mockDb,
      secretProvider: () => secret,
      nowMs: () => 1700000000000 // now is before exp
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(usersMap.get('user_cancel_early').isPremium, true);
  });

  await t.test('CANCELLATION after expiration sets isPremium: false', async () => {
    const { mockDb, usersMap } = createTestHarness({ uid: 'user_cancel_late', role: 'user', isPremium: true, premiumTier: 'tier1' });
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: {
        event: {
          id: 'evt_cancel_late',
          type: 'CANCELLATION',
          app_user_id: 'user_cancel_late',
          expiration_at_ms: 1600000000000, // past date
          event_timestamp_ms: 1700000000000
        }
      }
    };
    const res = createTestHarness().createMockRes();
    await handleRevenueCatWebhookRequest(req, res, {
      db: mockDb,
      secretProvider: () => secret,
      nowMs: () => 1700000000000
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(usersMap.get('user_cancel_late').isPremium, false);
    assert.strictEqual(usersMap.get('user_cancel_late').premiumTier, null);
  });

  await t.test('EXPIRATION sets isPremium: false and clears tier', async () => {
    const { mockDb, usersMap } = createTestHarness({ uid: 'user_exp', role: 'user', isPremium: true, premiumTier: 'tier2' });
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: {
        event: {
          id: 'evt_exp',
          type: 'EXPIRATION',
          app_user_id: 'user_exp',
          event_timestamp_ms: 1700000000000
        }
      }
    };
    const res = createTestHarness().createMockRes();
    await handleRevenueCatWebhookRequest(req, res, { db: mockDb, secretProvider: () => secret });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(usersMap.get('user_exp').isPremium, false);
    assert.strictEqual(usersMap.get('user_exp').premiumTier, null);
  });

  await t.test('TEST event acknowledges without DB writes', async () => {
    const { mockDb, eventsMap } = createTestHarness();
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: { event: { id: 'evt_test', type: 'TEST' } }
    };
    const res = createTestHarness().createMockRes();
    await handleRevenueCatWebhookRequest(req, res, { db: mockDb, secretProvider: () => secret });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonBody?.status, 'test_event_acknowledged');
    assert.strictEqual(eventsMap.size, 0);
  });

  await t.test('Identical replay returns 200 already_processed', async () => {
    const { mockDb } = createTestHarness({ uid: 'user_replay', role: 'user' });
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: {
        event: {
          id: 'evt_replay',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'user_replay',
          entitlement_ids: ['pro'],
          expiration_at_ms: 2000000000000,
          event_timestamp_ms: 1700000000000
        }
      }
    };
    const res1 = createTestHarness().createMockRes();
    await handleRevenueCatWebhookRequest(req, res1, { db: mockDb, secretProvider: () => secret, nowMs: () => 1700000000000 });
    assert.strictEqual(res1.statusCode, 200);

    const res2 = createTestHarness().createMockRes();
    await handleRevenueCatWebhookRequest(req, res2, { db: mockDb, secretProvider: () => secret, nowMs: () => 1700000000000 });
    assert.strictEqual(res2.statusCode, 200);
    assert.strictEqual(res2.jsonBody?.status, 'already_processed');
  });

  await t.test('Same event ID with DIFFERENT payload hash returns 409 Conflict', async () => {
    const { mockDb } = createTestHarness({ uid: 'user_conflict', role: 'user' });
    const req1 = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: {
        event: {
          id: 'evt_conflict_1',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'user_conflict',
          entitlement_ids: ['pro'],
          expiration_at_ms: 2000000000000,
          event_timestamp_ms: 1700000000000
        }
      }
    };
    const res1 = createTestHarness().createMockRes();
    await handleRevenueCatWebhookRequest(req1, res1, { db: mockDb, secretProvider: () => secret, nowMs: () => 1700000000000 });
    assert.strictEqual(res1.statusCode, 200);

    const req2 = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: {
        event: {
          id: 'evt_conflict_1',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'user_conflict',
          entitlement_ids: ['organizer'], // different entitlement -> different hash
          expiration_at_ms: 2000000000000,
          event_timestamp_ms: 1700000000000
        }
      }
    };
    const res2 = createTestHarness().createMockRes();
    await handleRevenueCatWebhookRequest(req2, res2, { db: mockDb, secretProvider: () => secret, nowMs: () => 1700000000000 });
    assert.strictEqual(res2.statusCode, 409);
  });

  await t.test('Older event timestamp is ignored without overwriting newer state', async () => {
    const { mockDb, usersMap } = createTestHarness({
      uid: 'user_older',
      role: 'user',
      lastRevenueCatEventTimestamp: 2000000000000
    });
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: {
        event: {
          id: 'evt_older',
          type: 'EXPIRATION',
          app_user_id: 'user_older',
          event_timestamp_ms: 1000000000000 // older than existing 2000000000000
        }
      }
    };
    const res = createTestHarness().createMockRes();
    await handleRevenueCatWebhookRequest(req, res, { db: mockDb, secretProvider: () => secret });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonBody?.status, 'ignored_older_event');
    assert.strictEqual(usersMap.get('user_older').lastRevenueCatEventTimestamp, 2000000000000);
  });

  await t.test('Non-existent user doc returns 200 user_not_found without creating user doc', async () => {
    const { mockDb, usersMap } = createTestHarness();
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: {
        event: {
          id: 'evt_missing_user',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'non_existent_uid',
          entitlement_ids: ['pro'],
          expiration_at_ms: 2000000000000,
          event_timestamp_ms: 1700000000000
        }
      }
    };
    const res = createTestHarness().createMockRes();
    await handleRevenueCatWebhookRequest(req, res, { db: mockDb, secretProvider: () => secret, nowMs: () => 1700000000000 });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonBody?.status, 'user_not_found');
    assert.strictEqual(usersMap.has('non_existent_uid'), false);
  });

  await t.test('Rejects invalid app_user_id containing slashes with 400 Bad Request', async () => {
    const { mockDb } = createTestHarness();
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: {
        event: {
          id: 'evt_invalid_uid',
          type: 'INITIAL_PURCHASE',
          app_user_id: '../users/malicious_path',
          entitlement_ids: ['pro'],
          expiration_at_ms: 2000000000000,
          event_timestamp_ms: 1700000000000
        }
      }
    };
    const res = createTestHarness().createMockRes();
    await handleRevenueCatWebhookRequest(req, res, { db: mockDb, secretProvider: () => secret, nowMs: () => 1700000000000 });
    assert.strictEqual(res.statusCode, 400);
  });

  await t.test('Rejects non-TEST event missing event_timestamp_ms with 400 Bad Request', async () => {
    const { mockDb } = createTestHarness({ uid: 'user_no_ts', role: 'user' });
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: {
        event: {
          id: 'evt_no_ts',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'user_no_ts',
          entitlement_ids: ['pro']
          // event_timestamp_ms missing!
        }
      }
    };
    const res = createTestHarness().createMockRes();
    await handleRevenueCatWebhookRequest(req, res, { db: mockDb, secretProvider: () => secret });
    assert.strictEqual(res.statusCode, 400);
  });

  await t.test('Rejects oversized payload (> 50KB) by Buffer.byteLength with 400 Bad Request', async () => {
    const { mockDb } = createTestHarness({ uid: 'user_large', role: 'user' });
    // Multi-byte unicode chars where string length <= 30000 but UTF-8 byte length > 50000
    const multiBytePadding = '🔥'.repeat(20000); // 20000 * 4 bytes = 80000 bytes (> 50KB)
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: {
        event: {
          id: 'evt_large_mb',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'user_large',
          padding: multiBytePadding
        }
      }
    };
    const res = createTestHarness().createMockRes();
    await handleRevenueCatWebhookRequest(req, res, { db: mockDb, secretProvider: () => secret });
    assert.strictEqual(res.statusCode, 400);
  });

  await t.test('Handles parallel requests with identical event ID gracefully in atomic transaction', async () => {
    const req1 = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: {
        event: {
          id: 'evt_parallel_1',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'user_parallel',
          entitlement_ids: ['pro'],
          expiration_at_ms: 2000000000000,
          event_timestamp_ms: 1700000000000
        }
      }
    };
    const req2 = {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: {
        event: {
          id: 'evt_parallel_1',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'user_parallel',
          entitlement_ids: ['pro'],
          expiration_at_ms: 2000000000000,
          event_timestamp_ms: 1700000000000
        }
      }
    };
    const harness = createTestHarness({ uid: 'user_parallel', role: 'user' });
    const res1 = harness.createMockRes();
    const res2 = harness.createMockRes();

    await Promise.all([
      handleRevenueCatWebhookRequest(req1, res1, { db: harness.mockDb, secretProvider: () => secret, nowMs: () => 1700000000000 }),
      handleRevenueCatWebhookRequest(req2, res2, { db: harness.mockDb, secretProvider: () => secret, nowMs: () => 1700000000000 })
    ]);

    const statusCodes = [res1.statusCode, res2.statusCode].sort();
    assert.deepStrictEqual(statusCodes, [200, 200]);
    assert.strictEqual(harness.usersMap.get('user_parallel').isPremium, true);
  });
});


