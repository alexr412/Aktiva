import * as assert from 'assert';
import * as crypto from 'crypto';
import * as admin from 'firebase-admin';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithCustomToken } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { buildCallableActivityPayload } from '../../src/features/activities/create/activity-payload';
import { createActivitySchema } from './activities';
import { handleRevenueCatWebhookRequest } from './revenuecat';

console.log('Running activity-create.integration.test.ts...');

// Connect Admin SDK to Firestore Emulator
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || 'activa-444220';

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId });
}

const db = admin.firestore();

// Configure Client SDK to connect to emulators
const firebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: `${projectId}.firebaseapp.com`,
  projectId: projectId,
};

const clientApp = initializeApp(firebaseConfig, 'integration-test-app-' + Date.now());
const clientAuth = getAuth(clientApp);
connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });

const clientFunctions = getFunctions(clientApp);
connectFunctionsEmulator(clientFunctions, '127.0.0.1', 5001);

async function createAuthenticatedClient(uid: string, userDoc: Record<string, any>) {
  try {
    await admin.auth().createUser({ uid });
  } catch (e) {
    // User already exists
  }

  const appInstance = initializeApp(firebaseConfig, 'test-app-' + uid + '-' + Date.now());
  const authInstance = getAuth(appInstance);
  connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', { disableWarnings: true });

  const customToken = await admin.auth().createCustomToken(uid);
  await signInWithCustomToken(authInstance, customToken);

  // Wait for background onUserCreated emulator trigger to complete
  await new Promise((resolve) => setTimeout(resolve, 500));

  await db.collection('users').doc(uid).set({
    uid,
    displayName: userDoc.displayName || 'Test User',
    photoURL: userDoc.photoURL !== undefined ? userDoc.photoURL : 'https://example.com/avatar.jpg',
    onboardingCompleted: userDoc.onboardingCompleted !== undefined ? userDoc.onboardingCompleted : true,
    accountStatus: userDoc.accountStatus || 'active',
    isBanned: userDoc.isBanned || false,
    tokens: userDoc.tokens !== undefined ? userDoc.tokens : 5,
    gender: userDoc.gender || 'male',
    kycStatus: userDoc.kycStatus || 'verified',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    isPremium: false,
    premiumTier: null,
    premiumUntil: null,
    ...userDoc,
  });

  const functionsInstance = getFunctions(appInstance);
  connectFunctionsEmulator(functionsInstance, '127.0.0.1', 5001);

  return { appInstance, authInstance, functionsInstance };
}

async function runIntegrationTests() {
  try {
    const testUid = 'user_integration_test_' + Date.now();
    
    // Seed user in Firestore
    await db.collection('users').doc(testUid).set({
      uid: testUid,
      displayName: 'Integration Test User',
      photoURL: 'https://example.com/avatar.jpg',
      onboardingCompleted: true,
      accountStatus: 'active',
      isBanned: false,
      tokens: 5,
      gender: 'male',
      kycStatus: 'verified',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create custom auth token and sign in with Client SDK
    const customToken = await admin.auth().createCustomToken(testUid);
    await signInWithCustomToken(clientAuth, customToken);

    console.log(`Signed in as emulator test user: ${testUid}`);

    const callCreateActivity = httpsCallable<any, any>(clientFunctions, 'secureCreateActivity');
    const callBoostEntity = httpsCallable<any, any>(clientFunctions, 'secureBoostEntity');

    // ------------------------------------------------------------------------
    // Test 1: Successful Custom Activity Creation
    // ------------------------------------------------------------------------
    const opId1 = '00000000-0000-4000-8000-000000000001';
    const payload1 = {
      operationId: opId1,
      title: 'Integration Test Activity 1',
      description: 'Test Description',
      category: 'Sport',
      startDate: new Date(Date.now() + 3600000).toISOString(),
      maxParticipants: 4,
      joinMode: 'request'
    };

    const res1 = await callCreateActivity(payload1);
    assert.strictEqual(res1.data.success, true, 'Test 1: Create activity must succeed');
    const actId1 = res1.data.activityId;
    assert.ok(actId1, 'Test 1: Should return activityId');

    // Verify Firestore documents written
    const actSnap = await db.collection('activities').doc(actId1).get();
    assert.strictEqual(actSnap.exists, true, 'Test 1: Activity doc must exist in Firestore');
    assert.strictEqual(actSnap.data()?.hostId, testUid);
    assert.strictEqual(actSnap.data()?.creationSource, 'community');
    assert.strictEqual(actSnap.data()?.isCustomActivity, true);

    const chatSnap = await db.collection('chats').doc(actId1).get();
    assert.strictEqual(chatSnap.exists, true, 'Test 1: Chat doc must exist in Firestore');
    assert.deepStrictEqual(chatSnap.data()?.participantDetails, actSnap.data()?.participantDetails, 'Test 1: Chat must contain the host details used by the chat UI');
    assert.strictEqual(chatSnap.data()?.placeName, actSnap.data()?.title, 'Test 1: Chat list must contain the activity name');

    const partSnap = await db.collection('activities').doc(actId1).collection('participants').doc(testUid).get();
    assert.strictEqual(partSnap.exists, true, 'Test 1: Initial host participant doc must exist');

    console.log('✅ Test 1: Custom Activity Creation PASSED');

    // ------------------------------------------------------------------------
    // Test 2: Idempotent Replay with Same Operation ID & Payload
    // ------------------------------------------------------------------------
    const res1Replay = await callCreateActivity(payload1);
    assert.strictEqual(res1Replay.data.success, true);
    assert.strictEqual(res1Replay.data.activityId, actId1);
    assert.strictEqual(res1Replay.data.idempotencyReplayed, true);
    console.log('✅ Test 2: Idempotent Replay PASSED');

    // ------------------------------------------------------------------------
    // Test 3: Idempotency Payload Mismatch
    // ------------------------------------------------------------------------
    const payload1Tampered = {
      ...payload1,
      title: 'TAMPERED TITLE ON REPLAY'
    };
    try {
      await callCreateActivity(payload1Tampered);
      assert.fail('Test 3: Payload mismatch must throw error');
    } catch (err: any) {
      assert.ok(err.message.includes('Idempotency operation ID payload mismatch') || err.code === 'functions/failed-precondition', 'Test 3: Error message must state payload mismatch');
    }
    console.log('✅ Test 3: Idempotency Payload Mismatch PASSED');

    // ------------------------------------------------------------------------
    // Test 4: Place-Based Activity with Verified Geoapify Place
    // ------------------------------------------------------------------------
    const opId2 = '00000000-0000-4000-8000-000000000002';
    const payload2 = {
      operationId: opId2,
      placeId: 'geoapify_valid_123',
      startDate: new Date(Date.now() + 7200000).toISOString()
    };

    const res2 = await callCreateActivity(payload2);
    assert.strictEqual(res2.data.success, true);
    const actId2 = res2.data.activityId;

    const placeSnap = await db.collection('places').doc('geoapify_valid_123').get();
    assert.strictEqual(placeSnap.exists, true, 'Test 4: Verified Place doc must be created in Firestore');
    assert.strictEqual(placeSnap.data()?.activityCount, 1);
    assert.strictEqual(placeSnap.data()?.lastActivityId, actId2);
    const placeChatSnap = await db.collection('chats').doc(actId2).get();
    assert.ok(placeChatSnap.data()?.participantDetails?.[testUid], 'Test 4: Place-based chat must contain the host details');
    assert.strictEqual(placeChatSnap.data()?.placeId, placeSnap.id, 'Test 4: Chat must reference the verified place');
    assert.deepStrictEqual(placeChatSnap.data()?.placeCategories, placeSnap.data()?.categories, 'Test 4: Chat must contain the verified icon categories');

    console.log('✅ Test 4: Verified Provider Place Creation PASSED');

    // ------------------------------------------------------------------------
    // Test 5: Existing Place Uses Canonical Data & Increments ActivityCount
    // ------------------------------------------------------------------------
    const opId3 = '00000000-0000-4000-8000-000000000003';
    const payload3 = {
      operationId: opId3,
      placeId: 'geoapify_valid_123',
      startDate: new Date(Date.now() + 10800000).toISOString()
    };

    const res3 = await callCreateActivity(payload3);
    assert.strictEqual(res3.data.success, true);
    const actId3 = res3.data.activityId;

    const placeSnap2 = await db.collection('places').doc('geoapify_valid_123').get();
    assert.strictEqual(placeSnap2.data()?.activityCount, 2, 'Test 5: activityCount must increment to 2');
    assert.strictEqual(placeSnap2.data()?.lastActivityId, actId3);

    console.log('✅ Test 5: Existing Place Counter Increment PASSED');

    // ------------------------------------------------------------------------
    // Test 6: Fake Place ID Rejection
    // ------------------------------------------------------------------------
    const opIdFake = '00000000-0000-4000-8000-000000000004';
    const payloadFake = {
      operationId: opIdFake,
      placeId: 'geoapify_fake_nonexistent_99999',
      startDate: new Date(Date.now() + 14400000).toISOString()
    };

    try {
      await callCreateActivity(payloadFake);
      assert.fail('Test 6: Non-existent place must fail creation');
    } catch (err: any) {
      assert.ok(
        err.code === 'functions/invalid-argument' || err.code === 'invalid-argument' || err.code === 'functions/not-found' || err.code === 'functions/failed-precondition',
        'Test 6: Fake place ID must be rejected'
      );
    }

    console.log('✅ Test 6: Fake Place ID Rejection PASSED');

    // ------------------------------------------------------------------------
    // Test 7: secureBoostEntity & Idempotency
    // ------------------------------------------------------------------------
    const boostOpId1 = '00000000-0000-4000-8000-000000000010';
    const boostRes = await callBoostEntity({
      operationId: boostOpId1,
      entityType: 'activity',
      entityId: actId1,
      durationHours: 24
    });
    assert.strictEqual(boostRes.data.success, true);

    const userSnapAfterBoost = await db.collection('users').doc(testUid).get();
    assert.strictEqual(userSnapAfterBoost.data()?.tokens, 4, 'Test 7: User tokens must decrease by 1');

    const boostResReplay = await callBoostEntity({
      operationId: boostOpId1,
      entityType: 'activity',
      entityId: actId1,
      durationHours: 24
    });
    assert.strictEqual(boostResReplay.data.idempotencyReplayed, true);
    const userSnapReplay = await db.collection('users').doc(testUid).get();
    assert.strictEqual(userSnapReplay.data()?.tokens, 4, 'Test 7: Tokens must remain 4 after replay');

    console.log('✅ Test 7: secureBoostEntity & Idempotency PASSED');

    // ------------------------------------------------------------------------
    // Test 8: Boost Payload Mismatch
    // ------------------------------------------------------------------------
    try {
      await callBoostEntity({
        operationId: boostOpId1,
        entityType: 'activity',
        entityId: actId1,
        durationHours: 12
      });
      assert.fail('Test 8: Boost payload mismatch must throw error');
    } catch (err: any) {
      assert.ok(err.message.includes('Idempotency operation ID payload mismatch') || err.code === 'functions/failed-precondition', 'Test 8: Must state payload mismatch');
    }
    console.log('✅ Test 8: Boost Payload Mismatch PASSED');

    // ------------------------------------------------------------------------
    // Test 9: Active Boost Rejection
    // ------------------------------------------------------------------------
    const boostOpId2 = '00000000-0000-4000-8000-000000000020';
    try {
      await callBoostEntity({
        operationId: boostOpId2,
        entityType: 'activity',
        entityId: actId1,
        durationHours: 12
      });
      assert.fail('Test 9: Boosting already boosted activity must fail');
    } catch (err: any) {
      assert.ok(err.message.includes('aktiver Boost') || err.code === 'functions/failed-precondition', 'Test 9: Must state active boost exists');
    }
    console.log('✅ Test 9: Active Boost Rejection PASSED');

    // ------------------------------------------------------------------------
    // Test 10: Real Rate Limiter Enforcement (6 real calls within 60s)
    // ------------------------------------------------------------------------
    const rateLimitUid = 'rate_limit_user_' + Date.now();
    const { functionsInstance: rateLimitFunctions } = await createAuthenticatedClient(rateLimitUid, {
      displayName: 'Rate Limit Test User',
      isOrganizer: true,
      premiumTier: 'tier3'
    });

    const callCreateRateLimit = httpsCallable<any, any>(rateLimitFunctions, 'secureCreateActivity');
    
    // Execute 5 real calls sequentially - all 5 must succeed
    for (let i = 1; i <= 5; i++) {
      const res = await callCreateRateLimit({
        operationId: `00000000-0000-4000-8000-00000000110${i}`,
        title: `Rate Limit Activity ${i}`,
        category: 'Sport',
        startDate: new Date(Date.now() + 20000000 + i * 1000).toISOString()
      });
      assert.strictEqual(res.data.success, true, `Test 10: Call ${i} must succeed`);
    }

    // 6th call must fail exclusively due to rate limit (resource-exhausted)
    try {
      await callCreateRateLimit({
        operationId: '00000000-0000-4000-8000-000000001106',
        title: 'Rate Limit Activity 6 (Should Fail)',
        category: 'Sport',
        startDate: new Date(Date.now() + 20000000 + 6000).toISOString()
      });
      assert.fail('Test 10: 6th call within 60s must fail due to rate limit');
    } catch (err: any) {
      assert.ok(
        err.code === 'functions/resource-exhausted' || err.message.includes('Erstellungslimit'),
        'Test 10: Must fail exclusively with resource-exhausted rate limit error'
      );
    }

    // Verify exactly 5 activities created in Firestore for this host
    const rateLimitActsSnap = await db.collection('activities').where('hostId', '==', rateLimitUid).get();
    assert.strictEqual(rateLimitActsSnap.size, 5, 'Test 10: Exactly 5 activities must exist in Firestore');
    console.log('✅ Test 10: Real Rate Limiter Enforcement (6 calls, 5 succeed, 1 rejected) PASSED');

    // ------------------------------------------------------------------------
    // Test 11: Real Concurrency & Open Room Limit Test (Promise.allSettled)
    // ------------------------------------------------------------------------
    const concurrencyUid = 'concurrency_user_' + Date.now();
    const { functionsInstance: concurrencyFunctions } = await createAuthenticatedClient(concurrencyUid, {
      displayName: 'Concurrency Test User',
      isPremium: false,
      premiumTier: 'free'
    });

    // Pre-create 4 active activities directly in Firestore (limit is 5)
    for (let i = 1; i <= 4; i++) {
      const dId = `dummy_concurrency_room_${i}_${Date.now()}`;
      await db.collection('activities').doc(dId).set({
        id: dId,
        hostId: concurrencyUid,
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    const callCreateConcurrency = httpsCallable<any, any>(concurrencyFunctions, 'secureCreateActivity');
    
    // Execute 2 calls concurrently with different operationIds
    const opIdConcA = '00000000-0000-4000-8000-000000001201';
    const opIdConcB = '00000000-0000-4000-8000-000000001202';

    const results = await Promise.allSettled([
      callCreateConcurrency({
        operationId: opIdConcA,
        title: 'Concurrent Room A',
        category: 'Sport',
        startDate: new Date(Date.now() + 25000000).toISOString()
      }),
      callCreateConcurrency({
        operationId: opIdConcB,
        title: 'Concurrent Room B',
        category: 'Sport',
        startDate: new Date(Date.now() + 26000000).toISOString()
      })
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Test 11: Exactly one concurrent creation call must succeed');
    assert.strictEqual(rejected.length, 1, 'Test 11: Exactly one concurrent creation call must be rejected');

    const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
    assert.ok(
      rejectionReason.code === 'functions/resource-exhausted' || rejectionReason.message.includes('Limit von'),
      'Test 11: Rejection must be due to room limit resource-exhausted'
    );

    // Verify in Firestore that host has exactly 5 open/active rooms
    const activeRoomsSnap = await db.collection('activities')
      .where('hostId', '==', concurrencyUid)
      .where('status', 'in', ['active', 'open'])
      .get();
    assert.strictEqual(activeRoomsSnap.size, 5, 'Test 11: Exactly 5 active rooms must exist in Firestore');
    console.log('✅ Test 11: Real Concurrency & Room Limit Test (Promise.allSettled) PASSED');

    // ------------------------------------------------------------------------
    // Test 12: Exhaustive Participant Tier Limits Testing
    // ------------------------------------------------------------------------
    const tiers = [
      { name: 'Free', userDoc: { isPremium: false, premiumTier: 'free' }, limit: 4 },
      { name: 'Tier 1', userDoc: { isPremium: true, premiumTier: 'tier1' }, limit: 8 },
      { name: 'Tier 2', userDoc: { isPremium: true, premiumTier: 'tier2' }, limit: 12 },
      { name: 'Tier 3', userDoc: { isPremium: true, premiumTier: 'tier3' }, limit: 50 },
      { name: 'Organizer', userDoc: { isOrganizer: true }, limit: 50 },
    ];

    for (const tier of tiers) {
      const tierUid = `tier_user_${tier.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
      const { functionsInstance: tierFunctions } = await createAuthenticatedClient(tierUid, tier.userDoc);
      const callCreateTier = httpsCallable<any, any>(tierFunctions, 'secureCreateActivity');

      // 1. Value at limit must succeed
      const resLimit = await callCreateTier({
        operationId: crypto.randomUUID(),
        title: `${tier.name} Limit Test At Limit`,
        category: 'Sport',
        startDate: new Date(Date.now() + 30000000).toISOString(),
        maxParticipants: tier.limit
      });
      assert.strictEqual(resLimit.data.success, true, `Test 12 (${tier.name}): maxParticipants=${tier.limit} must succeed`);

      // 2. Limit + 1 must fail
      try {
        await callCreateTier({
          operationId: crypto.randomUUID(),
          title: `${tier.name} Limit Test Exceeded`,
          category: 'Sport',
          startDate: new Date(Date.now() + 31000000).toISOString(),
          maxParticipants: tier.limit + 1
        });
        assert.fail(`Test 12 (${tier.name}): maxParticipants=${tier.limit + 1} must fail`);
      } catch (err: any) {
        assert.ok(
          err.code === 'functions/failed-precondition' || err.code === 'functions/invalid-argument' || err.message.includes('Tariflimit'),
          `Test 12 (${tier.name}): Exceeding maxParticipants must return failed-precondition or invalid-argument`
        );
      }
    }
    console.log('✅ Test 12: Exhaustive Participant Tier Limits (Free, T1, T2, T3, Organizer) PASSED');

    // ------------------------------------------------------------------------
    // Test 13: Isolated Account Status Gating Tests
    // ------------------------------------------------------------------------
    const accountStatusTestCases = [
      { name: 'isBanned: true', doc: { isBanned: true } },
      { name: 'accountStatus: banned', doc: { accountStatus: 'banned' } },
      { name: 'accountStatus: deleted', doc: { accountStatus: 'deleted' } },
      { name: 'accountStatus: disabled', doc: { accountStatus: 'disabled' } },
      { name: 'users doc disabled: true', doc: { disabled: true } },
      { name: 'suspended (no date)', doc: { accountStatus: 'suspended' } },
      { name: 'suspended (invalid date)', doc: { accountStatus: 'suspended', suspendedUntil: 'invalid-date' } },
      { name: 'suspended (future date)', doc: { accountStatus: 'suspended', suspendedUntil: Date.now() + 86400000 } },
      { name: 'onboardingCompleted: false', doc: { onboardingCompleted: false } },
    ];

    for (let idx = 0; idx < accountStatusTestCases.length; idx++) {
      const tc = accountStatusTestCases[idx];
      const tcUid = `acc_gate_user_${idx}_${Date.now()}`;
      const { functionsInstance: tcFunctions } = await createAuthenticatedClient(tcUid, tc.doc);
      const callCreateStatus = httpsCallable<any, any>(tcFunctions, 'secureCreateActivity');

      try {
        await callCreateStatus({
          operationId: `00000000-0000-4000-8000-00000000140${idx}`,
          title: `Blocked Activity ${tc.name}`,
          category: 'Sport',
          startDate: new Date(Date.now() + 35000000).toISOString()
        });
        assert.fail(`Test 13 (${tc.name}): Creation must fail for blocked status`);
      } catch (err: any) {
        assert.strictEqual(err.code, 'functions/permission-denied', `Test 13 (${tc.name}): Must return permission-denied`);
      }
    }

    // Missing user document test case
    const missingUid = `missing_user_doc_${Date.now()}`;
    const missingApp = initializeApp(firebaseConfig, 'missing-app-' + Date.now());
    const missingAuth = getAuth(missingApp);
    connectAuthEmulator(missingAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
    const missingToken = await admin.auth().createCustomToken(missingUid);
    await signInWithCustomToken(missingAuth, missingToken);
    const missingFunctions = getFunctions(missingApp);
    connectFunctionsEmulator(missingFunctions, '127.0.0.1', 5001);

    try {
      const callCreateMissing = httpsCallable<any, any>(missingFunctions, 'secureCreateActivity');
      await callCreateMissing({
        operationId: '00000000-0000-4000-8000-000000001480',
        title: 'Missing User Doc Activity',
        category: 'Sport',
        startDate: new Date(Date.now() + 36000000).toISOString()
      });
      assert.fail('Test 13 (missing doc): Creation must fail when user doc is missing');
    } catch (err: any) {
      assert.strictEqual(err.code, 'functions/permission-denied', 'Test 13 (missing doc): Must return permission-denied');
    }

    // Firebase Auth disabled user test case
    const authDisabledUid = `auth_disabled_user_${Date.now()}`;
    await admin.auth().createUser({ uid: authDisabledUid, disabled: true });
    await db.collection('users').doc(authDisabledUid).set({
      uid: authDisabledUid,
      displayName: 'Auth Disabled User',
      onboardingCompleted: true
    });
    const authDisabledApp = initializeApp(firebaseConfig, 'disabled-app-' + Date.now());
    const authDisabledAuth = getAuth(authDisabledApp);
    connectAuthEmulator(authDisabledAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
    try {
      const disabledCustomToken = await admin.auth().createCustomToken(authDisabledUid);
      await signInWithCustomToken(authDisabledAuth, disabledCustomToken);
      const authDisabledFunctions = getFunctions(authDisabledApp);
      connectFunctionsEmulator(authDisabledFunctions, '127.0.0.1', 5001);
      const callDisabled = httpsCallable<any, any>(authDisabledFunctions, 'secureCreateActivity');
      await callDisabled({
        operationId: '00000000-0000-4000-8000-000000001510',
        title: 'Auth Disabled Activity',
        category: 'Sport',
        startDate: new Date(Date.now() + 37000000).toISOString()
      });
      assert.fail('Test 13 (auth disabled): Must fail for auth disabled user');
    } catch (err: any) {
      assert.ok(
        err.code === 'functions/unauthenticated' || err.code === 'functions/permission-denied' || err.code === 'auth/user-disabled',
        'Test 13 (auth disabled): Must be rejected'
      );
    }
    console.log('✅ Test 13: Isolated Account Status Gating Tests (11 separate test cases including users.disabled) PASSED');

    // ------------------------------------------------------------------------
    // Test 14: Requirements Across Real Flows & Rejected Paid Join Audit
    // ------------------------------------------------------------------------
    const reqHostUid = 'req_host_user_' + Date.now();
    const { functionsInstance: reqHostFunctions } = await createAuthenticatedClient(reqHostUid, {
      displayName: 'Requirements Host User',
      gender: 'female',
      photoURL: 'https://example.com/female.jpg',
      kycStatus: 'verified',
      isKycVerified: true,
      averageRating: 4.8,
      birthdate: '1995-01-01',
      birthDate: '1995-01-01',
      escrowBalance: 1000
    });

    // Seed Paid Activity Fixture directly via Admin SDK (with isPaid: true, price > 0, active status, chat doc, requirements)
    const paidActId = 'paid_req_activity_' + Date.now();
    const paidDateIso = new Date(Date.now() + 40000000).toISOString();
    await db.collection('activities').doc(paidActId).set({
      id: paidActId,
      hostId: reqHostUid,
      title: 'Strict Requirements Paid Activity',
      description: 'Paid activity for test 14',
      category: 'Sport',
      startDate: paidDateIso,
      activityDate: admin.firestore.Timestamp.fromDate(new Date(paidDateIso)),
      status: 'active',
      isPaid: true,
      price: 15.00,
      maxParticipants: 10,
      participantIds: [reqHostUid],
      participantDetails: {
        [reqHostUid]: { displayName: 'Requirements Host User', photoURL: 'https://example.com/female.jpg', isPremium: true }
      },
      requirements: {
        gender: ['female'],
        requireProfilePicture: true,
        requireVerification: true,
        minimumRating: 4.5,
        ageRange: { min: 25, max: 40 }
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Seed chat document for the activity
    await db.collection('chats').doc(paidActId).set({
      id: paidActId,
      activityId: paidActId,
      participantIds: [reqHostUid],
      participantDetails: {
        [reqHostUid]: { displayName: 'Requirements Host User', photoURL: 'https://example.com/female.jpg' }
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Unqualified Joiner (Male on female-only activity, photo provided, KYC verified, rating 4.8)
    const unqualifiedUid = 'unqualified_joiner_' + Date.now();
    const { functionsInstance: unqualifiedFunctions } = await createAuthenticatedClient(unqualifiedUid, {
      displayName: 'Unqualified Joiner User',
      gender: 'male',
      photoURL: 'https://example.com/unqualified.jpg',
      kycStatus: 'verified',
      isKycVerified: true,
      averageRating: 4.8,
      birthdate: '1995-01-01',
      fiatBalance: 5000,
      escrowBalance: 0,
      tokens: 10
    });

    // Capture initial balances before paid join attempt
    const hostDocBefore = await db.collection('users').doc(reqHostUid).get();
    const hostEscrowBefore = hostDocBefore.data()?.escrowBalance ?? 1000;

    const joinerDocBefore = await db.collection('users').doc(unqualifiedUid).get();
    const joinerFiatBefore = joinerDocBefore.data()?.fiatBalance ?? 5000;
    const joinerEscrowBefore = joinerDocBefore.data()?.escrowBalance ?? 0;
    const joinerTokensBefore = joinerDocBefore.data()?.tokens ?? 10;

    // 1. secureRequestJoinActivity rejection for unqualified user
    const callRequestJoinUnqualified = httpsCallable<any, any>(unqualifiedFunctions, 'secureRequestJoinActivity');
    try {
      await callRequestJoinUnqualified({ activityId: paidActId });
      assert.fail('Test 14: Unqualified user calling secureRequestJoinActivity must fail');
    } catch (err: any) {
      assert.ok(
        err.code === 'functions/permission-denied' || err.code === 'functions/failed-precondition',
        'Test 14: secureRequestJoinActivity must return permission-denied or failed-precondition'
      );
    }

    // 2. Sandbox secureJoinPaidActivity rejection for unqualified user (failing specifically due to requirements)
    const callPaidJoinUnqualified = httpsCallable<any, any>(unqualifiedFunctions, 'secureJoinPaidActivity');
    const sandboxTxnToken = 'txn_sandbox_unqualified_' + Date.now();
    try {
      await callPaidJoinUnqualified({
        activityId: paidActId,
        transactionToken: sandboxTxnToken
      });
      assert.fail('Test 14: Unqualified user calling Sandbox secureJoinPaidActivity must fail');
    } catch (err: any) {
      // Must fail specifically with failed-precondition (due to requirement check in validateActivityEligibility)
      assert.strictEqual(err.code, 'functions/failed-precondition', 'Test 14: Sandbox secureJoinPaidActivity must fail with failed-precondition due to requirements');
      assert.ok(
        err.message.includes('GENDER_REQUIREMENT_NOT_MET') ||
        err.message.includes('gender_requirement_not_met') ||
        (err.details && (err.details.errorCode === 'GENDER_REQUIREMENT_NOT_MET' || err.details.reason === 'validation:gender_requirement_not_met')),
        'Test 14: Error message or details must explicitly specify GENDER_REQUIREMENT_NOT_MET'
      );
    }

    // Audit Side-Effects of Rejected Sandbox Paid Join
    const partSnapUnqualified = await db.collection('activities').doc(paidActId).collection('participants').doc(unqualifiedUid).get();
    assert.strictEqual(partSnapUnqualified.exists, false, 'Test 14 Audit: No participant document created');

    const actSnapAudit = await db.collection('activities').doc(paidActId).get();
    const partIdsAudit: string[] = actSnapAudit.data()?.participantIds || [];
    assert.strictEqual(partIdsAudit.includes(unqualifiedUid), false, 'Test 14 Audit: participantIds array not modified');

    const chatSnapAudit = await db.collection('chats').doc(paidActId).get();
    const chatPartIds: string[] = chatSnapAudit.data()?.participantIds || [];
    assert.strictEqual(chatPartIds.includes(unqualifiedUid), false, 'Test 14 Audit: User not added to chat');

    const paymentSnap = await db.collection('processed_payments').doc(sandboxTxnToken).get();
    assert.strictEqual(paymentSnap.exists, false, 'Test 14 Audit: No processed_payments document created');

    const ledgerSnap = await db.collection('financial_ledger').where('operationId', '==', sandboxTxnToken).get();
    assert.strictEqual(ledgerSnap.empty, true, 'Test 14 Audit: No financial_ledger entry created');

    const hostDocAfter = await db.collection('users').doc(reqHostUid).get();
    assert.strictEqual(hostDocAfter.data()?.escrowBalance ?? 0, hostEscrowBefore, 'Test 14 Audit: Host escrowBalance unchanged');

    const joinerDocAfter = await db.collection('users').doc(unqualifiedUid).get();
    assert.strictEqual(joinerDocAfter.data()?.fiatBalance ?? 0, joinerFiatBefore, 'Test 14 Audit: Joiner fiatBalance unchanged');
    assert.strictEqual(joinerDocAfter.data()?.escrowBalance ?? 0, joinerEscrowBefore, 'Test 14 Audit: Joiner escrowBalance unchanged');
    assert.strictEqual(joinerDocAfter.data()?.tokens ?? 0, joinerTokensBefore, 'Test 14 Audit: Joiner tokens unchanged');

    // DLQ (failed_operations) Audit: Validation rejections in secureJoinPaidActivity intentionally write to DLQ
    const dlqSnap = await db.collection('failed_operations').where('operationId', '==', sandboxTxnToken).get();
    assert.strictEqual(dlqSnap.size, 1, 'Test 14 Audit: Exactly 1 DLQ entry created in failed_operations');
    const dlqDoc = dlqSnap.docs[0].data();
    assert.strictEqual(dlqDoc.operationId, sandboxTxnToken, 'Test 14 Audit: DLQ operationId matches');
    assert.strictEqual(dlqDoc.userId, unqualifiedUid, 'Test 14 Audit: DLQ userId matches');
    assert.strictEqual(dlqDoc.activityId, paidActId, 'Test 14 Audit: DLQ activityId matches');
    assert.strictEqual(dlqDoc.source, 'secureJoinPaidActivity', 'Test 14 Audit: DLQ source matches');
    assert.ok(
      dlqDoc.errorMessage.includes('GENDER_REQUIREMENT_NOT_MET') || dlqDoc.errorMessage.includes('gender_requirement_not_met'),
      'Test 14 Audit: DLQ errorMessage contains gender requirement error'
    );

    console.log('✅ Test 14: Requirements Across Real Flows & Rejected Paid Join Audit PASSED');

    // ------------------------------------------------------------------------
    // Test 15: Existing Place Tampered Client Data Prevention
    // ------------------------------------------------------------------------
    const opIdTampered = '00000000-0000-4000-8000-000000000033';
    const tamperedRes = await callCreateActivity({
      operationId: opIdTampered,
      placeId: 'geoapify_valid_123',
      place: {
        id: 'geoapify_valid_123',
        name: 'TAMPERED CLIENT PLACE NAME',
        address: 'TAMPERED ADDRESS 999',
        lat: 0,
        lon: 0
      },
      startDate: new Date(Date.now() + 45000000).toISOString()
    });
    const tamperedActId = tamperedRes.data.activityId;
    const tamperedActSnap = await db.collection('activities').doc(tamperedActId).get();
    assert.strictEqual(tamperedActSnap.data()?.placeName, 'Verifizierter Geoapify Ort', 'Test 15: Must use canonical place name from DB');
    assert.notStrictEqual(tamperedActSnap.data()?.placeName, 'TAMPERED CLIENT PLACE NAME');
    console.log('✅ Test 15: Existing Place Tampered Client Data Prevention PASSED');

    // ------------------------------------------------------------------------
    // Test 16: Real UI Payload Test with buildCallableActivityPayload & Schema
    // ------------------------------------------------------------------------
    const opIdUiPayload = '00000000-0000-4000-8000-000000000022';
    const uiPayload = buildCallableActivityPayload({
      operationId: opIdUiPayload,
      title: 'UI Generated Payload Activity',
      description: 'Built by real client payload builder',
      category: 'Sport',
      startDate: new Date(Date.now() + 50000000).toISOString(),
      isTimeFlexible: true,
      maxParticipants: 4,
      joinMode: 'request'
    });

    assert.strictEqual('isPaid' in uiPayload, false, 'Test 16: isPaid must NOT be present in client payload');
    assert.strictEqual('price' in uiPayload, false, 'Test 16: price must NOT be present in client payload');

    const parsedSchema = createActivitySchema.safeParse(uiPayload);
    assert.strictEqual(parsedSchema.success, true, 'Test 16: createActivitySchema must accept client payload');

    const uiRes = await callCreateActivity(uiPayload);
    assert.strictEqual(uiRes.data.success, true);

    const uiActSnap = await db.collection('activities').doc(uiRes.data.activityId).get();
    assert.strictEqual(uiActSnap.data()?.isPaid, false, 'Test 16: Server must explicitly set isPaid: false');
    assert.strictEqual(uiActSnap.data()?.price, 0, 'Test 16: Server must explicitly set price: 0');
    console.log('✅ Test 16: Real UI Payload Test with buildCallableActivityPayload & Schema PASSED');

    // ------------------------------------------------------------------------
    // Test 17: Non-Sandbox Paid Join Fail-Closed Rejection
    // ------------------------------------------------------------------------
    const callJoinPaid = httpsCallable<any, any>(clientFunctions, 'secureJoinPaidActivity');
    try {
      await callJoinPaid({
        activityId: actId1,
        transactionToken: 'pi_live_stripe_payment_intent_9999'
      });
      assert.fail('Test 17: Non-sandbox paid join must fail closed');
    } catch (err: any) {
      assert.ok(
        err.code === 'functions/failed-precondition' && err.message.includes('Phase 1.2 vorübergehend deaktiviert'),
        'Test 17: Must reject non-sandbox paid join fail-closed'
      );
    }
    console.log('✅ Test 17: Non-Sandbox Paid Join Fail-Closed Rejection PASSED');

    // ------------------------------------------------------------------------
    // Test 18: Real Emulator RevenueCat Parallel Concurrency Isolation Test
    // ------------------------------------------------------------------------
    const concurrentUid = 'user_rc_concurrent_' + Date.now();
    await db.collection('users').doc(concurrentUid).set({
      uid: concurrentUid,
      displayName: 'RevenueCat Parallel User',
      isPremium: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const secretKey = 'test_emulator_rc_secret';
    const eventId = 'evt_emulator_concurrent_' + Date.now();
    const eventPayload = {
      event: {
        id: eventId,
        type: 'INITIAL_PURCHASE',
        app_user_id: concurrentUid,
        entitlement_ids: ['pro'],
        expiration_at_ms: Date.now() + 86400000,
        event_timestamp_ms: Date.now()
      }
    };

    function createIntegrationMockRes() {
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

    const rcReq1 = { method: 'POST', headers: { authorization: `Bearer ${secretKey}` }, body: eventPayload };
    const rcReq2 = { method: 'POST', headers: { authorization: `Bearer ${secretKey}` }, body: eventPayload };
    const rcRes1 = createIntegrationMockRes();
    const rcRes2 = createIntegrationMockRes();

    await Promise.all([
      handleRevenueCatWebhookRequest(rcReq1, rcRes1, { db, secretProvider: () => secretKey }),
      handleRevenueCatWebhookRequest(rcReq2, rcRes2, { db, secretProvider: () => secretKey })
    ]);

    assert.strictEqual(rcRes1.statusCode, 200, 'Test 18: First concurrent response must be HTTP 200');
    assert.strictEqual(rcRes2.statusCode, 200, 'Test 18: Second concurrent response must be HTTP 200');

    const statuses = [rcRes1.jsonBody?.status, rcRes2.jsonBody?.status].sort();
    assert.deepStrictEqual(statuses, ['already_processed', 'success'], 'Test 18: Exactly one call must succeed and exactly one must report already_processed');

    const safeEventDocId = crypto.createHash('sha256').update(eventId).digest('hex');
    const eventDoc = await db.collection('revenuecat_events').doc(safeEventDocId).get();
    assert.strictEqual(eventDoc.exists, true, 'Test 18: Exactly one event record document must be persisted in revenuecat_events');
    assert.strictEqual(eventDoc.data()?.status, 'completed');

    const userDocAfter = await db.collection('users').doc(concurrentUid).get();
    assert.strictEqual(userDocAfter.data()?.isPremium, true, 'Test 18: User premium state must be mutated to true');
    assert.strictEqual(userDocAfter.data()?.premiumTier, 'tier2', 'Test 18: User premium tier must be tier2');
    console.log('✅ Test 18: Real Emulator RevenueCat Parallel Concurrency Isolation Test PASSED');

    console.log('\n🎉 ALL INTEGRATION TESTS PASSED CLEANLY!\n');
  } catch (err) {
    console.error('❌ Integration Test Failed:', err);
    process.exitCode = 1;
  } finally {
    try {
      await deleteApp(clientApp);
    } catch {}
    try {
      await admin.app().delete();
    } catch {}
  }
}

runIntegrationTests();
