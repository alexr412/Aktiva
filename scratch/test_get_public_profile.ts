import * as admin from '../functions/node_modules/firebase-admin';

// Configure admin SDK to connect to Firestore emulator
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'aktiva-rules-test';

admin.initializeApp();

async function runTests() {
  const { getPublicProfile, searchUserByUsername, earnToken } = await import('../functions/src/users');
  const { secureVotePlace, secureVoteActivity } = await import('../functions/src/votes');
  const db = admin.firestore();

  console.log('Clearing Firestore...');
  const collections = ['users', 'places', 'activities', 'reports'];
  for (const colName of collections) {
    const snap = await db.collection(colName).get();
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  console.log('Seeding test users...');
  
  // Alice: standard user
  await db.collection('users').doc('alice').set({
    uid: 'alice',
    displayName: 'Alice Owner',
    username: 'alice_un',
    photoURL: 'https://alice.png',
    age: 25,
    location: 'Munich', // coarse string
    bio: 'Hello, I am Alice.',
    interests: ['sports', 'music'],
    isPremium: true,
    isSupporter: false,
    isCreator: false,
    isExplorer: true,
    isOrganizer: false,
    level: 2,
    ratingCount: 10,
    averageRating: 4.8,
    // Private fields:
    email: 'alice@example.com',
    phone: '+1234567',
    tokens: 10,
    fiatBalance: 100,
    escrowBalance: 0,
    kycStatus: 'verified',
    verification: { status: 'done' },
    blacklist: { soft: [], hard: [] },
    hiddenEntityIds: [],
    fcmToken: 'fcm_token_alice',
    notificationSettings: { push: true },
    proximitySettings: { radiusKm: 10 },
    role: 'user',
    isAdmin: false,
    onboardingCompleted: true,
    lastLocation: { latitude: 48.1351, longitude: 11.582 } // precise lat/lng
  });

  // Bob: standard user
  await db.collection('users').doc('bob').set({
    uid: 'bob',
    displayName: 'Bob User',
    username: 'bob_un',
    photoURL: 'https://bob.png',
    blacklist: { soft: [], hard: [] },
    isBanned: false
  });

  // Charlie: blocks Alice
  await db.collection('users').doc('charlie').set({
    uid: 'charlie',
    displayName: 'Charlie User',
    username: 'charlie_un',
    blacklist: { soft: [], hard: ['alice'] }, // blocks Alice
    isBanned: false
  });

  // Dave: banned user
  await db.collection('users').doc('dave').set({
    uid: 'dave',
    displayName: 'Dave Banned',
    username: 'dave_un',
    isBanned: true
  });

  console.log('Users seeded successfully. Starting test invocations...\n');

  let passed = true;

  // Helper to assert throws neutral error
  async function assertThrowsNeutralError(callerUid: string | null, targetUserId: any, testName: string) {
    try {
      const req: any = {
        auth: callerUid ? { uid: callerUid } : null,
        data: { targetUserId }
      };
      await getPublicProfile.run(req);
      console.log(`❌ ${testName} FAILED: Expected function to throw, but it succeeded.`);
      passed = false;
    } catch (err: any) {
      if (err && err.code === 'permission-denied' && err.message === 'User profile is not available.') {
        console.log(`✅ ${testName} PASSED: Threw neutral permission-denied error.`);
      } else {
        console.log(`❌ ${testName} FAILED: Threw unexpected error:`, err);
        passed = false;
      }
    }
  }

  // 1. Unauthenticated request
  try {
    await getPublicProfile.run({ auth: null, data: { targetUserId: 'alice' } } as any);
    console.log('❌ Test 1: Unauthenticated request FAILED: Succeeded.');
    passed = false;
  } catch (err: any) {
    if (err && err.code === 'unauthenticated') {
      console.log('✅ Test 1: Unauthenticated request PASSED: Threw unauthenticated.');
    } else {
      console.log('❌ Test 1: Unauthenticated request FAILED: Threw unexpected error:', err);
      passed = false;
    }
  }

  // 2. Missing targetUserId
  try {
    await getPublicProfile.run({ auth: { uid: 'bob' }, data: {} } as any);
    console.log('❌ Test 2: Missing targetUserId FAILED: Succeeded.');
    passed = false;
  } catch (err: any) {
    if (err && err.code === 'invalid-argument') {
      console.log('✅ Test 2: Missing targetUserId PASSED: Threw invalid-argument.');
    } else {
      console.log('❌ Test 2: Missing targetUserId FAILED: Threw unexpected error:', err);
      passed = false;
    }
  }

  // 3. Non-existent target user
  await assertThrowsNeutralError('bob', 'nonexistent_user', 'Test 3: Non-existent target user');

  // 4. Banned target user
  await assertThrowsNeutralError('bob', 'dave', 'Test 4: Banned target user');

  // 5. Target user blocks caller (Charlie blocks Alice, Alice calls)
  await assertThrowsNeutralError('alice', 'charlie', 'Test 5: Target user blocks caller');

  // 6. Caller blocks target user (Alice blocks Bob, Alice calls)
  // Let's seed Alice blocking Bob:
  await db.collection('users').doc('alice').update({
    blacklist: { soft: [], hard: ['bob'] }
  });
  await assertThrowsNeutralError('alice', 'bob', 'Test 6: Caller blocks target user');
  // Reset Alice blocks Bob
  await db.collection('users').doc('alice').update({
    blacklist: { soft: [], hard: [] }
  });

  // 7. Valid request (Bob gets Alice's profile)
  try {
    const result = await getPublicProfile.run({
      auth: { uid: 'bob' },
      data: { targetUserId: 'alice' }
    } as any);

    console.log('\n--- Valid Profile DTO Result: ---');
    console.log(JSON.stringify(result, null, 2));
    console.log('---------------------------------\n');

    // Assert only public fields returned
    const expectedKeys = [
      'uid', 'displayName', 'username', 'photoURL', 'age', 'location',
      'bio', 'interests', 'isPremium', 'isSupporter', 'isCreator',
      'isExplorer', 'isOrganizer', 'level', 'ratingCount', 'averageRating'
    ];
    
    const returnedKeys = Object.keys(result);
    const extraKeys = returnedKeys.filter(k => !expectedKeys.includes(k));
    const missingKeys = expectedKeys.filter(k => !returnedKeys.includes(k));

    if (extraKeys.length > 0) {
      console.log(`❌ Test 7: Valid request FAILED. Returned unexpected keys:`, extraKeys);
      passed = false;
    } else if (missingKeys.length > 0) {
      console.log(`❌ Test 7: Valid request FAILED. Missing expected keys:`, missingKeys);
      passed = false;
    } else {
      // Check location is coarse (Munich)
      if (result.location !== 'Munich') {
        console.log(`❌ Test 7: Valid request FAILED. Location should be "Munich", got:`, result.location);
        passed = false;
      } else {
        console.log('✅ Test 7: Valid request PASSED. DTO verified.');
      }
    }
  } catch (err: any) {
    console.log('❌ Test 7: Valid request FAILED with error:', err);
    passed = false;
  }

  console.log('\nStarting searchUserByUsername test invocations...');

  // Helper to assert throws neutral error for search
  async function assertSearchThrowsNeutralError(callerUid: string | null, username: string, testName: string) {
    try {
      const req: any = {
        auth: callerUid ? { uid: callerUid } : null,
        data: { username }
      };
      await searchUserByUsername.run(req);
      console.log(`❌ ${testName} FAILED: Expected function to throw, but it succeeded.`);
      passed = false;
    } catch (err: any) {
      if (err && err.code === 'permission-denied' && err.message === 'User profile is not available.') {
        console.log(`✅ ${testName} PASSED: Threw neutral permission-denied error.`);
      } else {
        console.log(`❌ ${testName} FAILED: Threw unexpected error:`, err);
        passed = false;
      }
    }
  }

  // S1. Unauthenticated request
  try {
    await searchUserByUsername.run({ auth: null, data: { username: 'alice_un' } } as any);
    console.log('❌ Test S1: Unauthenticated request FAILED: Succeeded.');
    passed = false;
  } catch (err: any) {
    if (err && err.code === 'unauthenticated') {
      console.log('✅ Test S1: Unauthenticated request PASSED: Threw unauthenticated.');
    } else {
      console.log('❌ Test S1: Unauthenticated request FAILED: Threw unexpected error:', err);
      passed = false;
    }
  }

  // S2. Missing username
  try {
    await searchUserByUsername.run({ auth: { uid: 'bob' }, data: {} } as any);
    console.log('❌ Test S2: Missing username FAILED: Succeeded.');
    passed = false;
  } catch (err: any) {
    if (err && err.code === 'invalid-argument') {
      console.log('✅ Test S2: Missing username PASSED: Threw invalid-argument.');
    } else {
      console.log('❌ Test S2: Missing username FAILED: Threw unexpected error:', err);
      passed = false;
    }
  }

  // S3. Non-existent target user username
  await assertSearchThrowsNeutralError('bob', 'nonexistent_un', 'Test S3: Non-existent username');

  // S4. Banned target user username
  await assertSearchThrowsNeutralError('bob', 'dave_un', 'Test S4: Banned user username');

  // S5. Target user blocks caller (Charlie blocks Alice, Alice searches Charlie)
  await assertSearchThrowsNeutralError('alice', 'charlie_un', 'Test S5: Target user blocks caller');

  // S6. Caller blocks target user (Alice blocks Bob, Alice searches Bob)
  // Alice blocks Bob:
  await db.collection('users').doc('alice').update({
    blacklist: { soft: [], hard: ['bob'] }
  });
  await assertSearchThrowsNeutralError('alice', 'bob_un', 'Test S6: Caller blocks target user');
  // Reset Alice blocks Bob
  await db.collection('users').doc('alice').update({
    blacklist: { soft: [], hard: [] }
  });

  // S7. Valid request (Bob searches Alice)
  try {
    const result = await searchUserByUsername.run({
      auth: { uid: 'bob' },
      data: { username: 'alice_un' }
    } as any);

    console.log('\n--- Valid Search DTO Result: ---');
    console.log(JSON.stringify(result, null, 2));
    console.log('---------------------------------\n');

    // Assert only public fields returned
    const expectedKeys = [
      'uid', 'displayName', 'username', 'photoURL', 'age', 'location',
      'bio', 'interests', 'isPremium', 'isSupporter', 'isCreator',
      'isExplorer', 'isOrganizer', 'level', 'ratingCount', 'averageRating'
    ];
    
    const returnedKeys = Object.keys(result);
    const extraKeys = returnedKeys.filter(k => !expectedKeys.includes(k));
    const missingKeys = expectedKeys.filter(k => !returnedKeys.includes(k));

    if (extraKeys.length > 0) {
      console.log(`❌ Test S7: Valid search FAILED. Returned unexpected keys:`, extraKeys);
      passed = false;
    } else if (missingKeys.length > 0) {
      console.log(`❌ Test S7: Valid search FAILED. Missing expected keys:`, missingKeys);
      passed = false;
    } else {
      if (result.location !== 'Munich') {
        console.log(`❌ Test S7: Valid search FAILED. Location should be "Munich", got:`, result.location);
        passed = false;
      } else {
        console.log('✅ Test S7: Valid search PASSED. DTO verified.');
      }
    }
  } catch (err: any) {
    console.log('❌ Test S7: Valid search FAILED with error:', err);
    passed = false;
  }

  console.log('\nStarting earnToken test invocations...');

  // ET1. Unauthenticated request
  try {
    await earnToken.run({ auth: null, data: { adWatchId: 'ad1' } } as any);
    console.log('❌ Test ET1: Unauthenticated earnToken request FAILED: Succeeded.');
    passed = false;
  } catch (err: any) {
    if (err && err.code === 'unauthenticated') {
      console.log('✅ Test ET1: Unauthenticated earnToken request PASSED.');
    } else {
      console.log('❌ Test ET1: Unauthenticated earnToken request FAILED:', err);
      passed = false;
    }
  }

  // ET2. Missing adWatchId
  try {
    await earnToken.run({ auth: { uid: 'alice' }, data: {} } as any);
    console.log('❌ Test ET2: Missing adWatchId FAILED: Succeeded.');
    passed = false;
  } catch (err: any) {
    if (err && err.code === 'invalid-argument') {
      console.log('✅ Test ET2: Missing adWatchId PASSED.');
    } else {
      console.log('❌ Test ET2: Missing adWatchId FAILED:', err);
      passed = false;
    }
  }

  // ET3. Valid earnToken call
  await db.collection('users').doc('alice').set({
    uid: 'alice',
    tokens: 10,
    lastTokenEarnedAt: null,
    tokensEarnedToday: 0,
    lastTokenEarnedDay: '',
    onboardingCompleted: true
  });

  try {
    const res = await earnToken.run({
      auth: { uid: 'alice' },
      data: { adWatchId: 'adWatch_1' }
    } as any);

    if (res && res.success) {
      console.log('✅ Test ET3: Valid earnToken call succeeded.');
    } else {
      console.log('❌ Test ET3: Valid earnToken call returned unexpected result:', res);
      passed = false;
    }

    // Verify DB
    const userDoc = await db.collection('users').doc('alice').get();
    const userData = userDoc.data();
    if (userData?.tokens !== 11) {
      console.log('❌ Test ET3: User tokens did not increase to 11, got:', userData?.tokens);
      passed = false;
    } else {
      console.log('✅ Test ET3: User tokens successfully increased to 11.');
    }

    // Verify subcollection doc
    const txDoc = await db.collection('users').doc('alice').collection('tokenTransactions').doc('adWatch_1').get();
    if (!txDoc.exists) {
      console.log('❌ Test ET3: tokenTransactions ledger document not created.');
      passed = false;
    } else {
      const txData = txDoc.data();
      if (txData?.userId !== 'alice' || txData?.type !== 'earn_ad_watch' || txData?.amount !== 1 || txData?.sourceEventId !== 'adWatch_1') {
        console.log('❌ Test ET3: Ledger document data invalid:', txData);
        passed = false;
      } else {
        console.log('✅ Test ET3: Ledger document successfully created with correct data.');
      }
    }
  } catch (err: any) {
    console.log('❌ Test ET3: Valid earnToken call FAILED with error:', err);
    passed = false;
  }

  // ET4. Idempotency test (repeat with same adWatchId)
  try {
    await earnToken.run({
      auth: { uid: 'alice' },
      data: { adWatchId: 'adWatch_1' }
    } as any);
    console.log('❌ Test ET4: Idempotency check FAILED: Allowed duplicate adWatchId claim.');
    passed = false;
  } catch (err: any) {
    if (err && err.code === 'already-exists') {
      console.log('✅ Test ET4: Idempotency check PASSED (already-exists thrown).');
    } else {
      console.log('❌ Test ET4: Idempotency check FAILED with unexpected error:', err);
      passed = false;
    }
  }

  // ET5. Cooldown test (request another token within 10 seconds)
  try {
    await earnToken.run({
      auth: { uid: 'alice' },
      data: { adWatchId: 'adWatch_2' }
    } as any);
    console.log('❌ Test ET5: Cooldown check FAILED: Allowed second token claim immediately.');
    passed = false;
  } catch (err: any) {
    if (err && err.code === 'resource-exhausted') {
      console.log('✅ Test ET5: Cooldown check PASSED (resource-exhausted thrown).');
    } else {
      console.log('❌ Test ET5: Cooldown check FAILED with unexpected error:', err);
      passed = false;
    }
  }

  // ET6. Daily limit test (5 tokens max per day)
  try {
    let limitPassed = true;
    for (let i = 2; i <= 5; i++) {
      // Mock cooldown bypass by backdating lastTokenEarnedAt
      await db.collection('users').doc('alice').update({
        lastTokenEarnedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 11000))
      });

      const res = await earnToken.run({
        auth: { uid: 'alice' },
        data: { adWatchId: `adWatch_${i}` }
      } as any);

      if (!res || !res.success) {
        console.log(`❌ Test ET6: Token claim ${i} failed.`);
        limitPassed = false;
      }
    }

    if (limitPassed) {
      console.log('✅ Test ET6: Successfully claimed 5 tokens today.');
    } else {
      passed = false;
    }

    // Try to claim 6th token today.
    await db.collection('users').doc('alice').update({
      lastTokenEarnedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 11000))
    });

    try {
      await earnToken.run({
        auth: { uid: 'alice' },
        data: { adWatchId: 'adWatch_6' }
      } as any);
      console.log('❌ Test ET6: Daily limit FAILED: Allowed claiming 6th token today.');
      passed = false;
    } catch (err: any) {
      if (err && err.code === 'resource-exhausted') {
        console.log('✅ Test ET6: Daily limit check PASSED (resource-exhausted thrown for 6th claim).');
      } else {
        console.log('❌ Test ET6: Daily limit check FAILED with unexpected error:', err);
        passed = false;
      }
    }
  } catch (err: any) {
    console.log('❌ Test ET6: Daily limit test crashed:', err);
    passed = false;
  }

  // ET7. Double Spend (Concurrent duplicate calls)
  try {
    // Reset Alice's doc
    await db.collection('users').doc('alice').set({
      uid: 'alice',
      tokens: 10,
      lastTokenEarnedAt: null,
      tokensEarnedToday: 0,
      lastTokenEarnedDay: '',
      onboardingCompleted: true
    });

    const results = await Promise.allSettled([
      earnToken.run({ auth: { uid: 'alice' }, data: { adWatchId: 'parallel_ad_1' } } as any),
      earnToken.run({ auth: { uid: 'alice' }, data: { adWatchId: 'parallel_ad_1' } } as any)
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    if (fulfilled.length === 1 && rejected.length === 1) {
      const err = (rejected[0] as PromiseRejectedResult).reason;
      if (err && err.code === 'already-exists') {
        console.log('✅ Test ET7: Double spend concurrent execution check PASSED (1 fulfilled, 1 already-exists rejected).');
      } else {
        console.log('❌ Test ET7: Double spend concurrent execution check FAILED. Wrong error code:', err);
        passed = false;
      }
    } else {
      console.log(`❌ Test ET7: Double spend concurrent execution check FAILED. Fulfilled: ${fulfilled.length}, Rejected: ${rejected.length}`);
      passed = false;
    }
  } catch (err: any) {
    console.log('❌ Test ET7: Double spend test crashed:', err);
    passed = false;
  }

  console.log('\nStarting secureVotePlace test invocations...');

  // VP1. Unauthenticated request
  try {
    await secureVotePlace.run({ auth: null, data: { placeId: 'place1', type: 'up' } } as any);
    console.log('❌ Test VP1: Unauthenticated request FAILED: Succeeded.');
    passed = false;
  } catch (err: any) {
    if (err && err.code === 'unauthenticated') {
      console.log('✅ Test VP1: Unauthenticated request PASSED.');
    } else {
      console.log('❌ Test VP1: Unauthenticated request FAILED:', err);
      passed = false;
    }
  }

  // VP2. Missing placeId
  try {
    await secureVotePlace.run({ auth: { uid: 'alice' }, data: { type: 'up' } } as any);
    console.log('❌ Test VP2: Missing placeId FAILED: Succeeded.');
    passed = false;
  } catch (err: any) {
    if (err && err.code === 'invalid-argument') {
      console.log('✅ Test VP2: Missing placeId PASSED.');
    } else {
      console.log('❌ Test VP2: Missing placeId FAILED:', err);
      passed = false;
    }
  }

  // VP3. Invalid type
  try {
    await secureVotePlace.run({ auth: { uid: 'alice' }, data: { placeId: 'place1', type: 'superboost' } } as any);
    console.log('❌ Test VP3: Invalid type FAILED: Succeeded.');
    passed = false;
  } catch (err: any) {
    if (err && err.code === 'invalid-argument') {
      console.log('✅ Test VP3: Invalid type PASSED.');
    } else {
      console.log('❌ Test VP3: Invalid type FAILED:', err);
      passed = false;
    }
  }

  // VP4. Banned user is blocked
  try {
    await secureVotePlace.run({ auth: { uid: 'dave' }, data: { placeId: 'place1', type: 'up' } } as any);
    console.log('❌ Test VP4: Banned user FAILED: Succeeded.');
    passed = false;
  } catch (err: any) {
    if (err && err.code === 'permission-denied') {
      console.log('✅ Test VP4: Banned user PASSED.');
    } else {
      console.log('❌ Test VP4: Banned user FAILED:', err);
      passed = false;
    }
  }

  // VP5. Valid Upvote (Non-existent place created on-the-fly)
  try {
    const res = await secureVotePlace.run({
      auth: { uid: 'alice' },
      data: { 
        placeId: 'place1', 
        type: 'up', 
        placeData: { name: 'Musterplatz', address: 'Musterstr. 1', categories: ['nature'], lat: 48.1, lon: 11.5 } 
      }
    } as any);

    const placeDoc = await db.collection('places').doc('place1').get();
    const placeData = placeDoc.data();

    if (placeData?.upvotes === 1 && placeData?.weightedUpvotes === 1 && placeData?.voteBoostScore === 1 && placeData?.userVotes?.['alice'] === 'up') {
      console.log('✅ Test VP5: Valid Upvote PASSED.');
    } else {
      console.log('❌ Test VP5: Valid Upvote FAILED. Place Data:', placeData);
      passed = false;
    }
  } catch (err: any) {
    console.log('❌ Test VP5: Valid Upvote FAILED:', err);
    passed = false;
  }

  // VP6. Toggle Off (Clicking upvote again removes it)
  try {
    await secureVotePlace.run({
      auth: { uid: 'alice' },
      data: { placeId: 'place1', type: 'up' }
    } as any);

    const placeDoc = await db.collection('places').doc('place1').get();
    const placeData = placeDoc.data();

    if (placeData?.upvotes === 0 && placeData?.weightedUpvotes === 0 && placeData?.voteBoostScore === 0 && !placeData?.userVotes?.['alice']) {
      console.log('✅ Test VP6: Toggle Off PASSED.');
    } else {
      console.log('❌ Test VP6: Toggle Off FAILED. Place Data:', placeData);
      passed = false;
    }
  } catch (err: any) {
    console.log('❌ Test VP6: Toggle Off FAILED:', err);
    passed = false;
  }

  // VP7. Vote-Wechsel (upvote -> downvote)
  try {
    await secureVotePlace.run({
      auth: { uid: 'alice' },
      data: { placeId: 'place1', type: 'up' }
    } as any);
    await secureVotePlace.run({
      auth: { uid: 'alice' },
      data: { placeId: 'place1', type: 'down' }
    } as any);

    const placeDoc = await db.collection('places').doc('place1').get();
    const placeData = placeDoc.data();

    if (placeData?.upvotes === 0 && placeData?.downvotes === 1 && placeData?.voteBoostScore === -1 && placeData?.userVotes?.['alice'] === 'down') {
      console.log('✅ Test VP7: Vote-Wechsel PASSED.');
    } else {
      console.log('❌ Test VP7: Vote-Wechsel FAILED. Place Data:', placeData);
      passed = false;
    }
  } catch (err: any) {
    console.log('❌ Test VP7: Vote-Wechsel FAILED:', err);
    passed = false;
  }

  // VP8. Payload-Manipulation (Extra fields ignored)
  try {
    await secureVotePlace.run({
      auth: { uid: 'alice' },
      data: { 
        placeId: 'place1', 
        type: 'up', 
        placeData: { name: 'New Name', extra_hack_field: 'hacked' } 
      }
    } as any);

    const placeDoc = await db.collection('places').doc('place1').get();
    const placeData = placeDoc.data();

    if (placeData?.extra_hack_field === undefined && placeData?.name === 'New Name') {
      console.log('✅ Test VP8: Payload-Manipulation ignored fields successfully PASSED.');
    } else {
      console.log('❌ Test VP8: Payload-Manipulation FAILED. Place Data:', placeData);
      passed = false;
    }
  } catch (err: any) {
    console.log('❌ Test VP8: Payload-Manipulation FAILED:', err);
    passed = false;
  }

  // VP9. Concurrent Votes (Race Condition Check)
  try {
    await db.collection('places').doc('place_race').delete();
    
    const results = await Promise.allSettled([
      secureVotePlace.run({ auth: { uid: 'alice' }, data: { placeId: 'place_race', type: 'up' } } as any),
      secureVotePlace.run({ auth: { uid: 'alice' }, data: { placeId: 'place_race', type: 'up' } } as any)
    ]);

    const placeDoc = await db.collection('places').doc('place_race').get();
    const placeData = placeDoc.data();

    if (placeData?.upvotes === 0 || placeData?.upvotes === 1) {
      console.log(`✅ Test VP9: Concurrent votes race condition check PASSED (upvotes is ${placeData?.upvotes || 0}).`);
    } else {
      console.log('❌ Test VP9: Concurrent votes FAILED. upvotes was:', placeData?.upvotes);
      passed = false;
    }
  } catch (err: any) {
    console.log('❌ Test VP9: Concurrent votes test crashed:', err);
    passed = false;
  }

  // VP10. Admin Weight check
  await db.collection('users').doc('adminUser').set({
    uid: 'adminUser',
    role: 'admin',
    onboardingCompleted: true
  });
  try {
    await db.collection('places').doc('place1').delete();
    await secureVotePlace.run({
      auth: { uid: 'adminUser' },
      data: { placeId: 'place1', type: 'up' }
    } as any);

    const placeDoc = await db.collection('places').doc('place1').get();
    const placeData = placeDoc.data();

    if (placeData?.upvotes === 1 && placeData?.weightedUpvotes === 50 && placeData?.voteBoostScore === 50) {
      console.log('✅ Test VP10: Admin Weight check PASSED.');
    } else {
      console.log('❌ Test VP10: Admin Weight check FAILED. Place Data:', placeData);
      passed = false;
    }
  } catch (err: any) {
    console.log('❌ Test VP10: Admin Weight check FAILED:', err);
    passed = false;
  }


  console.log('\nStarting secureVoteActivity test invocations...');

  await db.collection('activities').doc('actActive').set({
    id: 'actActive',
    hostId: 'bob',
    status: 'active',
    communityScore: 0,
    weightedUpvotes: 0,
    weightedDownvotes: 0
  });

  await db.collection('activities').doc('actCompleted').set({
    id: 'actCompleted',
    hostId: 'bob',
    status: 'completed',
    communityScore: 0
  });

  // VA1. Unauthenticated request
  try {
    await secureVoteActivity.run({ auth: null, data: { activityId: 'actActive', type: 'up' } } as any);
    console.log('❌ Test VA1: Unauthenticated request FAILED: Succeeded.');
    passed = false;
  } catch (err: any) {
    if (err && err.code === 'unauthenticated') {
      console.log('✅ Test VA1: Unauthenticated request PASSED.');
    } else {
      console.log('❌ Test VA1: Unauthenticated request FAILED:', err);
      passed = false;
    }
  }

  // VA2. Missing activityId
  try {
    await secureVoteActivity.run({ auth: { uid: 'alice' }, data: { type: 'up' } } as any);
    console.log('❌ Test VA2: Missing activityId FAILED: Succeeded.');
    passed = false;
  } catch (err: any) {
    if (err && err.code === 'invalid-argument') {
      console.log('✅ Test VA2: Missing activityId PASSED.');
    } else {
      console.log('❌ Test VA2: Missing activityId FAILED:', err);
      passed = false;
    }
  }

  // VA3. Invalid type
  try {
    await secureVoteActivity.run({ auth: { uid: 'alice' }, data: { activityId: 'actActive', type: 'superboost' } } as any);
    console.log('❌ Test VA3: Invalid type FAILED: Succeeded.');
    passed = false;
  } catch (err: any) {
    if (err && err.code === 'invalid-argument') {
      console.log('✅ Test VA3: Invalid type PASSED.');
    } else {
      console.log('❌ Test VA3: Invalid type FAILED:', err);
      passed = false;
    }
  }

  // VA4. Banned user is blocked
  try {
    await secureVoteActivity.run({ auth: { uid: 'dave' }, data: { activityId: 'actActive', type: 'up' } } as any);
    console.log('❌ Test VA4: Banned user FAILED: Succeeded.');
    passed = false;
  } catch (err: any) {
    if (err && err.code === 'permission-denied') {
      console.log('✅ Test VA4: Banned user PASSED.');
    } else {
      console.log('❌ Test VA4: Banned user FAILED:', err);
      passed = false;
    }
  }

  // VA5. Non-existent activity
  try {
    await secureVoteActivity.run({ auth: { uid: 'alice' }, data: { activityId: 'nonexistent_act', type: 'up' } } as any);
    console.log('❌ Test VA5: Non-existent activity FAILED: Succeeded.');
    passed = false;
  } catch (err: any) {
    if (err && err.code === 'not-found') {
      console.log('✅ Test VA5: Non-existent activity PASSED.');
    } else {
      console.log('❌ Test VA5: Non-existent activity FAILED:', err);
      passed = false;
    }
  }

  // VA6. Completed activity is blocked
  try {
    await secureVoteActivity.run({ auth: { uid: 'alice' }, data: { activityId: 'actCompleted', type: 'up' } } as any);
    console.log('❌ Test VA6: Completed activity FAILED: Succeeded.');
    passed = false;
  } catch (err: any) {
    if (err && err.code === 'failed-precondition') {
      console.log('✅ Test VA6: Completed activity PASSED (failed-precondition).');
    } else {
      console.log('❌ Test VA6: Completed activity FAILED:', err);
      passed = false;
    }
  }

  // VA7. Valid Upvote
  try {
    await secureVoteActivity.run({
      auth: { uid: 'alice' },
      data: { activityId: 'actActive', type: 'up' }
    } as any);

    const actDoc = await db.collection('activities').doc('actActive').get();
    const actData = actDoc.data();

    if (actData?.communityScore === 1 && actData?.weightedUpvotes === 1 && actData?.userVotes?.['alice'] === 'up') {
      console.log('✅ Test VA7: Valid Upvote PASSED.');
    } else {
      console.log('❌ Test VA7: Valid Upvote FAILED. Activity Data:', actData);
      passed = false;
    }
  } catch (err: any) {
    console.log('❌ Test VA7: Valid Upvote FAILED:', err);
    passed = false;
  }

  // VA8. Toggle Off
  try {
    await secureVoteActivity.run({
      auth: { uid: 'alice' },
      data: { activityId: 'actActive', type: 'up' }
    } as any);

    const actDoc = await db.collection('activities').doc('actActive').get();
    const actData = actDoc.data();

    if (actData?.communityScore === 0 && actData?.weightedUpvotes === 0 && !actData?.userVotes?.['alice']) {
      console.log('✅ Test VA8: Toggle Off PASSED.');
    } else {
      console.log('❌ Test VA8: Toggle Off FAILED. Activity Data:', actData);
      passed = false;
    }
  } catch (err: any) {
    console.log('❌ Test VA8: Toggle Off FAILED:', err);
    passed = false;
  }

  if (passed) {
    console.log('\n🎉 ALL FUNCTIONAL TESTS PASSED SUCCESSFULLY! 🎉');
    process.exit(0);
  } else {
    console.log('\n❌ SOME FUNCTIONAL TESTS FAILED.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
