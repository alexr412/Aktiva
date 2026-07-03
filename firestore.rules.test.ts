import assert from 'assert';
import * as fs from 'fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, deleteDoc, writeBatch, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, deleteObject, getBytes } from 'firebase/storage';

const PROJECT_ID = 'aktiva-rules-test';

async function runTests() {
  const hostEnv = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [host, portStr] = hostEnv.split(':');
  const port = parseInt(portStr || '8080', 10);

  console.log(`Initializing rules test environment on ${host}:${port}...`);
  
  let testEnv: any;
  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host,
        port,
        rules: fs.readFileSync('firestore.rules', 'utf8'),
      },
      storage: {
        host: '127.0.0.1',
        port: 9199,
        rules: fs.readFileSync('storage.rules', 'utf8'),
      }
    });
  } catch (err: any) {
    console.error('Failed to initialize test environment. Is the emulator running?');
    console.error(err);
    throw err;
  }

  // Helper to write documents bypassing rules (to set up fixtures)
  async function seedDoc(path: string, data: any) {
    await testEnv.withSecurityRulesDisabled(async (context: any) => {
      const db = context.firestore();
      const docRef = doc(db, path);
      await setDoc(docRef, data);
    });
  }

  // Clean the database before running tests
  await testEnv.clearFirestore();

  console.log('--- STARTING FIRESTORE SECURITY RULES TESTS ---');

  // ==========================================
  // A. users/{userId} Create Rules
  // ==========================================
  {
    console.log('Running Suite A: users/{userId} create tests...');
    
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    const guestDb = testEnv.unauthenticatedContext().firestore();

    const validSignupPayload = {
      uid: 'alice',
      displayName: 'Alice Test',
      email: 'alice@example.com',
      photoURL: null,
      onboardingCompleted: false,
      friends: [],
      friendRequestsSent: [],
      friendRequestsReceived: [],
      hiddenEntityIds: [],
      activeTabs: ['Sights', 'Nature', 'Restaurants'],
      likedTags: [],
      dislikedTags: [],
      categoryAffinities: {},
      isPremium: false,
      isSupporter: false,
      isCreator: false,
      tokens: 0,
      successfulFreeHosts: 0,
      fiatBalance: 0,
      escrowBalance: 0,
      balancesInCents: true,
      successfulReferrals: 0,
      averageRating: 0,
      ratingCount: 0,
      kycStatus: 'unverified',
      blacklist: { soft: [], hard: [] },
      proximitySettings: { enabled: false, radiusKm: 5 },
      role: 'user',
      isBanned: false
    };

    // 1. Allow: Owner creates current valid signup payload
    await assertSucceeds(setDoc(doc(aliceDb, 'users/alice'), validSignupPayload));

    // Reset database for isolated checks
    await testEnv.clearFirestore();

    // 2. Deny: Non-owner creates user doc
    await assertFails(setDoc(doc(bobDb, 'users/alice'), validSignupPayload));
    await assertFails(setDoc(doc(guestDb, 'users/alice'), validSignupPayload));

    // 3. Deny: fiatBalance > 0
    await assertFails(setDoc(doc(aliceDb, 'users/alice'), { ...validSignupPayload, fiatBalance: 1 }));

    // 4. Deny: escrowBalance > 0
    await assertFails(setDoc(doc(aliceDb, 'users/alice'), { ...validSignupPayload, escrowBalance: 1 }));

    // 5. Deny: balancesInCents == false
    await assertFails(setDoc(doc(aliceDb, 'users/alice'), { ...validSignupPayload, balancesInCents: false }));

    // 6. Deny: role != "user"
    await assertFails(setDoc(doc(aliceDb, 'users/alice'), { ...validSignupPayload, role: 'admin' }));

    // 7. Deny: isAdmin == true
    await assertFails(setDoc(doc(aliceDb, 'users/alice'), { ...validSignupPayload, isAdmin: true }));

    // 8. Deny: isBanned == true
    await assertFails(setDoc(doc(aliceDb, 'users/alice'), { ...validSignupPayload, isBanned: true }));

    // 9. Deny: kycStatus == "verified"
    await assertFails(setDoc(doc(aliceDb, 'users/alice'), { ...validSignupPayload, kycStatus: 'verified' }));

    // 10. Deny: premium/supporter/creator self-grant
    await assertFails(setDoc(doc(aliceDb, 'users/alice'), { ...validSignupPayload, isPremium: true }));
    await assertFails(setDoc(doc(aliceDb, 'users/alice'), { ...validSignupPayload, isSupporter: true }));
    await assertFails(setDoc(doc(aliceDb, 'users/alice'), { ...validSignupPayload, isCreator: true }));

    // 11. Deny: tokens/successfulFreeHosts/rating counters > 0
    await assertFails(setDoc(doc(aliceDb, 'users/alice'), { ...validSignupPayload, tokens: 1 }));
    await assertFails(setDoc(doc(aliceDb, 'users/alice'), { ...validSignupPayload, successfulFreeHosts: 1 }));
    await assertFails(setDoc(doc(aliceDb, 'users/alice'), { ...validSignupPayload, averageRating: 1 }));
    await assertFails(setDoc(doc(aliceDb, 'users/alice'), { ...validSignupPayload, ratingCount: 1 }));
  }

  // ==========================================
  // B. users/{userId} Update Rules
  // ==========================================
  {
    console.log('Running Suite B: users/{userId} update tests...');
    await testEnv.clearFirestore();

    const initialUser = {
      uid: 'alice',
      displayName: 'Alice Test',
      email: 'alice@example.com',
      photoURL: null,
      onboardingCompleted: false,
      friends: [],
      friendRequestsSent: [],
      friendRequestsReceived: [],
      hiddenEntityIds: [],
      activeTabs: ['Sights', 'Nature', 'Restaurants'],
      likedTags: [],
      dislikedTags: [],
      categoryAffinities: {},
      isPremium: false,
      isSupporter: false,
      isCreator: false,
      tokens: 5,
      successfulFreeHosts: 0,
      fiatBalance: 0,
      escrowBalance: 0,
      balancesInCents: true,
      successfulReferrals: 0,
      averageRating: 0,
      ratingCount: 0,
      kycStatus: 'unverified',
      blacklist: { soft: [], hard: [] },
      proximitySettings: { enabled: false, radiusKm: 5 },
      role: 'user',
      isBanned: false
    };

    // Seed document with rules disabled
    await seedDoc('users/alice', initialUser);
    await seedDoc('users/adminUser', { uid: 'adminUser', role: 'admin', isBanned: false });

    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    const adminDb = testEnv.authenticatedContext('adminUser').firestore();

    // 1. Allow: owner updates safe profile fields only
    await assertSucceeds(updateDoc(doc(aliceDb, 'users/alice'), { displayName: 'Alice Updated' }));
    await assertSucceeds(updateDoc(doc(aliceDb, 'users/alice'), { proximitySettings: { enabled: true, radiusKm: 10 } }));

    // 2. Deny: owner mutation of system fields
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { role: 'admin' }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { isAdmin: true }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { isBanned: true }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { fiatBalance: 100 }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { escrowBalance: 100 }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { balancesInCents: false }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { kycStatus: 'verified' }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { isPremium: true }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { isSupporter: true }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { isCreator: true }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { pointsBalance: 100 }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { pointsLifetime: 100 }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { level: 5 }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { referralCode: 'BADCODE' }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { referredBy: 'someone' }));

    // 2.1 Tokens: Owner token decrement tests
    await assertSucceeds(updateDoc(doc(aliceDb, 'users/alice'), { tokens: 4 })); // decrement by 1 (allowed)
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { tokens: 6 })); // increment by 1 (denied)
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { tokens: 2 })); // decrement by 2 (denied)
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { tokens: -1 })); // negative value (denied)
    await assertFails(updateDoc(doc(bobDb, 'users/alice'), { tokens: 3 })); // non-owner update (denied)

    // 3. Deny: non-owner updates
    await assertFails(updateDoc(doc(bobDb, 'users/alice'), { displayName: 'Bob Hack' }));

    // 4. Allow: admin update (permitted by isAdmin() and rules update condition)
    await assertSucceeds(updateDoc(doc(adminDb, 'users/alice'), { kycStatus: 'verified' }));
  }

  // ==========================================
  // C. telemetry_events Create Rules
  // ==========================================
  {
    console.log('Running Suite C: telemetry_events create tests...');
    await testEnv.clearFirestore();

    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    const guestDb = testEnv.unauthenticatedContext().firestore();

    const validTelemetryEvent = {
      entity_id: 'place123',
      event_type: 'click',
      event_value: 1,
      timestamp: '2026-06-04T12:00:00Z',
      user_id: 'alice',
      
      // legacy compat fields
      placeId: 'place123',
      interactionType: 'click',
      value: 1,
      userId: 'alice'
    };

    // 1. Allow: authenticated user writes valid current dual-schema telemetry payload for own uid
    await assertSucceeds(setDoc(doc(aliceDb, 'telemetry_events/ev1'), validTelemetryEvent));

    // 2. Deny: unauthenticated create
    await assertFails(setDoc(doc(guestDb, 'telemetry_events/ev2'), validTelemetryEvent));

    // 3. Deny: user_id / userId mismatch
    await assertFails(setDoc(doc(aliceDb, 'telemetry_events/ev3'), { ...validTelemetryEvent, user_id: 'bob' }));
    await assertFails(setDoc(doc(aliceDb, 'telemetry_events/ev4'), { ...validTelemetryEvent, userId: 'bob' }));
    await assertFails(setDoc(doc(bobDb, 'telemetry_events/ev5'), validTelemetryEvent));

    // 4. Deny: missing canonical fields
    const missingType = { ...validTelemetryEvent };
    delete (missingType as any).event_type;
    await assertFails(setDoc(doc(aliceDb, 'telemetry_events/ev6'), missingType));

    // 5. Deny: invalid event_type
    await assertFails(setDoc(doc(aliceDb, 'telemetry_events/ev7'), { ...validTelemetryEvent, event_type: 'view' }));

    // 6. Deny: non-numeric event_value
    await assertFails(setDoc(doc(aliceDb, 'telemetry_events/ev8'), { ...validTelemetryEvent, event_value: 'one' }));

    // 7. Deny: extra arbitrary keys outside allowlist
    await assertFails(setDoc(doc(aliceDb, 'telemetry_events/ev9'), { ...validTelemetryEvent, extra_field: 'leak' }));
  }

  // ==========================================
  // D. Paid Activities Write Gating & Free Activities Flow
  // ==========================================
  {
    console.log('Running Suite D: paid activities client write rules...');
    await testEnv.clearFirestore();

    const initialPaidActivity = {
      id: 'actPaid',
      hostId: 'host1',
      isPaid: true,
      price: 1000,
      participantIds: ['host1', 'user1'],
      participantsPreview: [{ uid: 'host1' }, { uid: 'user1' }],
      status: 'active'
    };

    const initialFreeActivity = {
      id: 'actFree',
      hostId: 'host1',
      isPaid: false,
      price: 0,
      participantIds: ['host1', 'user1'],
      participantsPreview: [{ uid: 'host1' }, { uid: 'user1' }],
      status: 'active'
    };

    await seedDoc('activities/actPaid', initialPaidActivity);
    await seedDoc('activities/actFree', initialFreeActivity);
    await seedDoc('chats/actPaid', { activityId: 'actPaid', hostId: 'host1', participantIds: ['host1', 'user1'] });
    await seedDoc('chats/actFree', { activityId: 'actFree', hostId: 'host1', participantIds: ['host1', 'user1'] });
    await seedDoc('users/host1', { uid: 'host1', onboardingCompleted: true, isBanned: false, role: 'user', tokens: 5 });
    await seedDoc('users/user1', { uid: 'user1', onboardingCompleted: true, isBanned: false, role: 'user', tokens: 5 });
    await seedDoc('users/bob', { uid: 'bob', onboardingCompleted: true, isBanned: false, role: 'user', tokens: 5 });

    const hostDb = testEnv.authenticatedContext('host1').firestore();
    const userDb = testEnv.authenticatedContext('user1').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();

    // 1. Paid Activity Direct Mutation Blocked
    // Host attempts direct updates to forbidden financial/participant keys
    await assertFails(updateDoc(doc(hostDb, 'activities/actPaid'), { participantIds: ['host1'] }));
    await assertFails(updateDoc(doc(hostDb, 'activities/actPaid'), { status: 'completed' }));
    
    // Participant attempts direct update to participantIds
    await assertFails(updateDoc(doc(userDb, 'activities/actPaid'), { participantIds: ['host1'] }));

    // Host updates safe metadata (title/desc)
    await assertSucceeds(updateDoc(doc(hostDb, 'activities/actPaid'), { title: 'New Paid Title' }));

    // 2. Free Activity Direct Update Permitted
    // Host cancels free activity directly (allowed by host edit check)
    await assertSucceeds(updateDoc(doc(hostDb, 'activities/actFree'), { status: 'cancelled' }));

    // Participant leaves free activity directly (allowed by participant edit rules)
    await assertSucceeds(updateDoc(doc(userDb, 'activities/actFree'), {
      participantIds: ['host1'],
      participantsPreview: [{ uid: 'host1' }],
      participantDetails: { user1: null }
    }));

    // Non-participant cannot join directly (must be host or already in participantIds to write)
    await assertFails(updateDoc(doc(bobDb, 'activities/actFree'), {
      participantIds: ['host1', 'user1', 'bob'],
      participantsPreview: [{ uid: 'host1' }, { uid: 'user1' }, { uid: 'bob' }]
    }));
  }

  // ==========================================
  // E. Subcollection activities/{activityId}/participants/{participantId}
  // ==========================================
  {
    console.log('Running Suite E: activity participant subcollection tests...');
    await testEnv.clearFirestore();

    const freeActivity = {
      id: 'actFree',
      hostId: 'host1',
      isPaid: false,
      participantIds: ['host1', 'user1']
    };

    const paidActivity = {
      id: 'actPaid',
      hostId: 'host1',
      isPaid: true,
      participantIds: ['host1', 'user1']
    };

    await seedDoc('activities/actFree', freeActivity);
    await seedDoc('activities/actPaid', paidActivity);
    await seedDoc('chats/actFree', { activityId: 'actFree', hostId: 'host1', participantIds: ['host1', 'user1'] });
    await seedDoc('chats/actPaid', { activityId: 'actPaid', hostId: 'host1', participantIds: ['host1', 'user1'] });
    await seedDoc('users/host1', { uid: 'host1', onboardingCompleted: true, isBanned: false, role: 'user' });
    await seedDoc('users/user1', { uid: 'user1', onboardingCompleted: true, isBanned: false, role: 'user' });
    await seedDoc('users/bob', { uid: 'bob', onboardingCompleted: true, isBanned: false, role: 'user' });

    const userDb = testEnv.authenticatedContext('user1').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();

    // 1. Allow: participant owner writes valid participant doc for free activity only if parent participantIds contains participantId
    await assertSucceeds(setDoc(doc(userDb, 'activities/actFree/participants/user1'), { 
      uid: 'user1',
      checkInStatus: 'pending',
      hasReviewed: false,
      joinedAt: '2026-06-04' 
    }));

    // 2. Deny: non-owner write
    await assertFails(setDoc(doc(bobDb, 'activities/actFree/participants/user1'), { 
      uid: 'user1',
      checkInStatus: 'pending',
      hasReviewed: false,
      joinedAt: '2026-06-04' 
    }));

    // 3. Deny: missing parent activity
    await assertFails(setDoc(doc(userDb, 'activities/actMissing/participants/user1'), { 
      uid: 'user1',
      checkInStatus: 'pending',
      hasReviewed: false,
      joinedAt: '2026-06-04' 
    }));

    // 4. Deny: participantId not in parent participantIds
    await assertFails(setDoc(doc(bobDb, 'activities/actFree/participants/bob'), { 
      uid: 'bob',
      checkInStatus: 'pending',
      hasReviewed: false,
      joinedAt: '2026-06-04' 
    }));

    // 5. Deny: paid activity participant subcollection write
    await assertFails(setDoc(doc(userDb, 'activities/actPaid/participants/user1'), { 
      uid: 'user1',
      checkInStatus: 'pending',
      hasReviewed: false,
      joinedAt: '2026-06-04' 
    }));
  }

  // ==========================================
  // F. Backend-owned Collections Gating
  // ==========================================
  {
    console.log('Running Suite F: backend-owned collections gating tests...');
    await testEnv.clearFirestore();

    await seedDoc('users/adminUser', { uid: 'adminUser', role: 'admin', isBanned: false });

    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const adminDb = testEnv.authenticatedContext('adminUser').firestore();

    // 1. refunds
    // Client creation denied
    await assertFails(setDoc(doc(aliceDb, 'refunds/ref1'), { amount: 100 }));
    // Admin update allowed, client update denied (read is allowed for own UID)
    await seedDoc('refunds/ref1', { userId: 'alice', amount: 100 });
    await assertSucceeds(getDoc(doc(aliceDb, 'refunds/ref1')));
    await assertFails(updateDoc(doc(aliceDb, 'refunds/ref1'), { amount: 200 }));
    await assertSucceeds(updateDoc(doc(adminDb, 'refunds/ref1'), { status: 'processed' }));

    // 2. payoutRequests
    // Client creation denied
    await assertFails(setDoc(doc(aliceDb, 'payoutRequests/pay1'), { amount: 50 }));
    // Client read allowed, state update denied. Admin update allowed
    await seedDoc('payoutRequests/pay1', { userId: 'alice', amount: 50, status: 'pending' });
    await assertSucceeds(getDoc(doc(aliceDb, 'payoutRequests/pay1')));
    await assertFails(updateDoc(doc(aliceDb, 'payoutRequests/pay1'), { status: 'approved' }));
    await assertSucceeds(updateDoc(doc(adminDb, 'payoutRequests/pay1'), { status: 'approved' }));

    // 3. financial_ledger
    // All client writes (create/update/delete) denied even for admins
    await assertFails(setDoc(doc(aliceDb, 'financial_ledger/led1'), { amount: 100 }));
    await assertFails(setDoc(doc(adminDb, 'financial_ledger/led1'), { amount: 100 }));

    // 4. processed_operations & failed_operations
    // All client writes denied
    await assertFails(setDoc(doc(aliceDb, 'processed_operations/op1'), { done: true }));
    await assertFails(setDoc(doc(aliceDb, 'failed_operations/fail1'), { error: 'failed' }));
  }

  // ==========================================
  // G. places/{placeId} activityCount Rules
  // ==========================================
  /*
  {
    console.log('Running Suite G: places/{placeId} activityCount tests...');
    await testEnv.clearFirestore();

    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const guestDb = testEnv.unauthenticatedContext().firestore();

    // Seed user profile
    await seedDoc('users/alice', { uid: 'alice', role: 'user', isBanned: false });

    // Seed a place
    await seedDoc('places/place1', { name: 'Musterplatz', activityCount: 2 });

    // 1. Allow: authenticated user increments activityCount by exactly 1
    await assertSucceeds(updateDoc(doc(aliceDb, 'places/place1'), { activityCount: 3 }));

    // 2. Allow: authenticated user decrements activityCount by exactly 1
    await assertSucceeds(updateDoc(doc(aliceDb, 'places/place1'), { activityCount: 1 }));

    // 3. Deny: authenticated user increments/decrements by more than 1
    await assertFails(updateDoc(doc(aliceDb, 'places/place1'), { activityCount: 4 }));
    await assertFails(updateDoc(doc(aliceDb, 'places/place1'), { activityCount: 0 }));

    // 4. Deny: negative activityCount
    await seedDoc('places/placeZero', { name: 'ZeroPlace', activityCount: 0 });
    await assertFails(updateDoc(doc(aliceDb, 'places/placeZero'), { activityCount: -1 }));

    // 5. Deny: change other protected place fields (like communityScore)
    await assertFails(updateDoc(doc(aliceDb, 'places/place1'), { communityScore: 100 }));

    // 6. Deny: unauthenticated update
    await assertFails(updateDoc(doc(guestDb, 'places/place1'), { activityCount: 3 }));
  }
  */

  // ==========================================
  // H. Batch Creation of Activity, Chat and Participant
  // ==========================================
  {
    console.log('Running Suite H: Batch Creation tests...');
    await testEnv.clearFirestore();

    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    // Seed Alice user profile
    await seedDoc('users/alice', { uid: 'alice', onboardingCompleted: true, isBanned: false, role: 'user', tokens: 5 });

    // Helper to generate a valid template activity creation payload for Suite H
    function getValidSuiteHActivity(hostId: string) {
      return {
        title: 'Batch Activity',
        placeName: 'Batch Place',
        activityDate: new Date(Date.now() + 3600 * 1000),
        hostId: hostId,
        hostName: 'Alice Host',
        hostPhotoURL: null,
        participantIds: [hostId],
        participantsPreview: [{ uid: hostId, displayName: 'Alice Host', photoURL: null }],
        createdAt: serverTimestamp(),
        lastInteractionAt: serverTimestamp(),
        isCustomActivity: true,
        isTimeFlexible: false,
        category: 'Sport',
        description: 'Batch event',
        status: 'active',
        completionVotes: [],
        isBoosted: false,
        boostedAt: null,
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
        participantDetails: {
          [hostId]: {
            displayName: 'Alice Host',
            photoURL: null,
            isPremium: false,
            isSupporter: false,
            checkInStatus: 'pending',
            hasReviewed: false
          }
        },
        categories: ['Sport'],
        isUserEvent: true,
        sourceType: 'activity',
        creationSource: 'community'
      };
    }

    // 1. Allow: Valid batch creation of activity, chat and participant for free activity
    {
      const batch = writeBatch(aliceDb);
      const activityRef = doc(aliceDb, 'activities/batchAct1');
      const chatRef = doc(aliceDb, 'chats/batchAct1');
      const pRef = doc(aliceDb, 'activities/batchAct1/participants/alice');

      batch.set(activityRef, getValidSuiteHActivity('alice'));
      batch.set(chatRef, {
        activityId: 'batchAct1',
        hostId: 'alice',
        createdAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
        participantIds: ['alice'],
        lastMessage: null,
        placeName: 'Batch Place',
        categories: ['Sport'],
        participantDetails: {
          alice: { displayName: 'Alice Host', photoURL: null, isPremium: false, isSupporter: false, checkInStatus: 'pending' }
        },
        unreadCount: { alice: 0 }
      });
      batch.set(pRef, {
        uid: 'alice',
        displayName: 'Alice Host',
        photoURL: null,
        checkInStatus: 'pending',
        joinedAt: serverTimestamp(),
        hasReviewed: false
      });

      await assertSucceeds(batch.commit());
    }

    // 2. Deny: Batch creation where participant is a different user
    {
      const batch = writeBatch(aliceDb);
      const activityRef = doc(aliceDb, 'activities/batchAct2');
      const pRef = doc(aliceDb, 'activities/batchAct2/participants/bob');

      const wrongPayload = getValidSuiteHActivity('alice');
      wrongPayload.participantIds = ['bob']; // Violates participantIds == [request.auth.uid]
      batch.set(activityRef, wrongPayload);
      batch.set(pRef, {
        uid: 'bob',
        displayName: 'Bob User',
        photoURL: null,
        checkInStatus: 'pending',
        joinedAt: serverTimestamp(),
        hasReviewed: false
      });

      await assertFails(batch.commit());
    }

    // 3. Deny: Batch creation of chat with wrong hostId/createdBy
    {
      const batch = writeBatch(aliceDb);
      const activityRef = doc(aliceDb, 'activities/batchAct3');
      const chatRef = doc(aliceDb, 'chats/batchAct3');
      const pRef = doc(aliceDb, 'activities/batchAct3/participants/alice');

      batch.set(activityRef, getValidSuiteHActivity('alice'));
      batch.set(chatRef, {
        activityId: 'batchAct3',
        hostId: 'bob', // Violates chat.hostId == request.auth.uid
        createdAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
        participantIds: ['alice'],
        lastMessage: null,
        placeName: 'Batch Place',
        categories: ['Sport'],
        participantDetails: {
          alice: { displayName: 'Alice Host', photoURL: null, isPremium: false, isSupporter: false, checkInStatus: 'pending' }
        },
        unreadCount: { alice: 0 }
      });
      batch.set(pRef, {
        uid: 'alice',
        displayName: 'Alice Host',
        photoURL: null,
        checkInStatus: 'pending',
        joinedAt: serverTimestamp(),
        hasReviewed: false
      });

      await assertFails(batch.commit());
    }
  }

  // ==========================================
  // I. Chat & Message Security Rules
  // ==========================================
  {
    console.log('Running Suite I: chats/{chatId}/messages/{messageId} tests...');
    await testEnv.clearFirestore();

    // Setup: seed user profiles
    await seedDoc('users/alice', { uid: 'alice', displayName: 'Alice Participant', role: 'user', isBanned: false });
    await seedDoc('users/bob', { uid: 'bob', displayName: 'Bob Host', role: 'user', isBanned: false });
    await seedDoc('users/charlie', { uid: 'charlie', displayName: 'Charlie Stranger', role: 'user', isBanned: false });
    await seedDoc('users/adminUser', { uid: 'adminUser', role: 'admin', isBanned: false });

    // Setup: seed activities
    await seedDoc('activities/act1', {
      id: 'act1',
      hostId: 'bob',
      isPaid: false,
      participantIds: ['bob', 'alice'],
      status: 'active'
    });
    await seedDoc('activities/actCompleted', {
      id: 'actCompleted',
      hostId: 'bob',
      isPaid: false,
      participantIds: ['bob', 'alice'],
      status: 'completed'
    });
    await seedDoc('activities/actCancelled', {
      id: 'actCancelled',
      hostId: 'bob',
      isPaid: false,
      participantIds: ['bob', 'alice'],
      status: 'cancelled'
    });
    await seedDoc('activities/actBlacklisted', {
      id: 'actBlacklisted',
      hostId: 'bob',
      isPaid: false,
      participantIds: ['bob', 'alice'],
      status: 'blacklisted'
    });

    // Setup: seed chats
    await seedDoc('chats/act1', {
      id: 'act1',
      activityId: 'act1',
      hostId: 'bob',
      participantIds: ['bob', 'alice']
    });
    await seedDoc('chats/actCompleted', {
      id: 'actCompleted',
      activityId: 'actCompleted',
      hostId: 'bob',
      participantIds: ['bob', 'alice']
    });
    await seedDoc('chats/actCancelled', {
      id: 'actCancelled',
      activityId: 'actCancelled',
      hostId: 'bob',
      participantIds: ['bob', 'alice']
    });
    await seedDoc('chats/actBlacklisted', {
      id: 'actBlacklisted',
      activityId: 'actBlacklisted',
      hostId: 'bob',
      participantIds: ['bob', 'alice']
    });
    await seedDoc('chats/dm1', {
      id: 'dm1',
      participantIds: ['bob', 'alice']
    });
    await seedDoc('chats/missingActChat', {
      id: 'missingActChat',
      activityId: 'missingAct',
      hostId: 'bob',
      participantIds: ['bob', 'alice']
    });

    // Setup: seed messages
    await seedDoc('chats/act1/messages/msgAlice1', {
      text: 'Hello, this is Alice!',
      senderId: 'alice',
      senderName: 'Alice Participant',
      sentAt: new Date(),
      isPremium: false
    });
    await seedDoc('chats/act1/messages/msgAliceToDelete', {
      text: 'To delete by Alice',
      senderId: 'alice',
      senderName: 'Alice Participant',
      sentAt: new Date(),
      isPremium: false
    });
    await seedDoc('chats/act1/messages/msgAliceToHostDelete', {
      text: 'To delete by Host',
      senderId: 'alice',
      senderName: 'Alice Participant',
      sentAt: new Date(),
      isPremium: false
    });
    await seedDoc('chats/act1/messages/msgAliceToAdminDelete', {
      text: 'To delete by Admin',
      senderId: 'alice',
      senderName: 'Alice Participant',
      sentAt: new Date(),
      isPremium: false
    });
    await seedDoc('chats/act1/messages/msgBob1', {
      text: 'Hello, this is Bob!',
      senderId: 'bob',
      senderName: 'Bob Host',
      sentAt: new Date(),
      isPremium: false
    });

    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    const charlieDb = testEnv.authenticatedContext('charlie').firestore();
    const adminDb = testEnv.authenticatedContext('adminUser').firestore();
    const guestDb = testEnv.unauthenticatedContext().firestore();

    // --- POSITIVE TESTS ---

    // 1. Participant reads own chat & messages
    await assertSucceeds(getDoc(doc(aliceDb, 'chats/act1')));
    await assertSucceeds(getDoc(doc(aliceDb, 'chats/act1/messages/msgAlice1')));

    // 2. Participant creates message with serverTimestamp
    await assertSucceeds(setDoc(doc(aliceDb, 'chats/act1/messages/newMsg1'), {
      text: 'Good morning!',
      senderId: 'alice',
      senderName: 'Alice Participant',
      sentAt: serverTimestamp(),
      isPremium: false
    }));

    // 3. Participant edits their own message (changing allowed fields only)
    await assertSucceeds(updateDoc(doc(aliceDb, 'chats/act1/messages/msgAlice1'), {
      text: 'Hello, this is Alice (edited)!',
      isEdited: true,
      editedAt: serverTimestamp()
    }));

    // 4. Participant deletes their own message
    await assertSucceeds(deleteDoc(doc(aliceDb, 'chats/act1/messages/msgAliceToDelete')));

    // 5. Host deletes a message in their activity's chat
    await assertSucceeds(deleteDoc(doc(bobDb, 'chats/act1/messages/msgAliceToHostDelete')));

    // 6. Admin deletes a message without being a participant
    await assertSucceeds(deleteDoc(doc(adminDb, 'chats/act1/messages/msgAliceToAdminDelete')));

    // 7. Direct Message without activityId remains writable for participant
    await assertSucceeds(setDoc(doc(aliceDb, 'chats/dm1/messages/dmMsg1'), {
      text: 'Direct message text',
      senderId: 'alice',
      senderName: 'Alice Participant',
      sentAt: serverTimestamp(),
      isPremium: false
    }));

    // --- NEGATIVE TESTS ---

    // 1. Unauth reads or writes
    await assertFails(getDoc(doc(guestDb, 'chats/act1/messages/msgAlice1')));
    await assertFails(setDoc(doc(guestDb, 'chats/act1/messages/guestMsg'), {
      text: 'Guest text',
      senderId: 'guest',
      sentAt: serverTimestamp()
    }));

    // 2. Non-participant reads
    await assertFails(getDoc(doc(charlieDb, 'chats/act1/messages/msgAlice1')));

    // 3. Non-participant writes
    await assertFails(setDoc(doc(charlieDb, 'chats/act1/messages/charlieMsg'), {
      text: 'Charlie text',
      senderId: 'charlie',
      sentAt: serverTimestamp()
    }));

    // 4. Participant writes with mismatched senderId
    await assertFails(setDoc(doc(aliceDb, 'chats/act1/messages/fakeSender'), {
      text: 'Spoofed sender',
      senderId: 'bob',
      senderName: 'Alice Participant',
      sentAt: serverTimestamp(),
      isPremium: false
    }));

    // 5. Participant manipulates sentAt timestamp
    await assertFails(setDoc(doc(aliceDb, 'chats/act1/messages/fakeTime'), {
      text: 'Spoofed time',
      senderId: 'alice',
      senderName: 'Alice Participant',
      sentAt: new Date(1000000),
      isPremium: false
    }));

    // 6. Participant writes text exceeding 2000 characters
    await assertFails(setDoc(doc(aliceDb, 'chats/act1/messages/tooLong'), {
      text: 'a'.repeat(2001),
      senderId: 'alice',
      senderName: 'Alice Participant',
      sentAt: serverTimestamp(),
      isPremium: false
    }));

    // 7. Participant writes empty / whitespace-only text
    await assertFails(setDoc(doc(aliceDb, 'chats/act1/messages/empty'), {
      text: '',
      senderId: 'alice',
      senderName: 'Alice Participant',
      sentAt: serverTimestamp(),
      isPremium: false
    }));
    await assertFails(setDoc(doc(aliceDb, 'chats/act1/messages/onlyWhitespace'), {
      text: '   \n  \t ',
      senderId: 'alice',
      senderName: 'Alice Participant',
      sentAt: serverTimestamp(),
      isPremium: false
    }));

    // 8. Participant inserts disallowed fields
    await assertFails(setDoc(doc(aliceDb, 'chats/act1/messages/extraField'), {
      text: 'Safe text',
      senderId: 'alice',
      senderName: 'Alice Participant',
      sentAt: serverTimestamp(),
      isPremium: false,
      customAdminFlag: true
    }));

    // 9. Participant edits someone else's message
    await assertFails(updateDoc(doc(aliceDb, 'chats/act1/messages/msgBob1'), {
      text: 'Alice updates Bob\'s text'
    }));

    // 10. Participant edits immutable fields
    await assertFails(updateDoc(doc(aliceDb, 'chats/act1/messages/msgAlice1'), {
      text: 'Valid edit',
      senderId: 'bob'
    }));
    await assertFails(updateDoc(doc(aliceDb, 'chats/act1/messages/msgAlice1'), {
      text: 'Valid edit',
      isPremium: true
    }));
    await assertFails(updateDoc(doc(aliceDb, 'chats/act1/messages/msgAlice1'), {
      text: 'Valid edit',
      sentAt: serverTimestamp()
    }));

    // 11. Non-host participant deletes someone else's message
    await assertFails(deleteDoc(doc(charlieDb, 'chats/act1/messages/msgAlice1')));
    await assertFails(deleteDoc(doc(aliceDb, 'chats/act1/messages/msgBob1')));

    // 12. Removed participant (no longer in participantIds) cannot write
    // Setup: seed a chat with alice removed
    await seedDoc('chats/act1_removedAlice', {
      id: 'act1_removedAlice',
      activityId: 'act1',
      hostId: 'bob',
      participantIds: ['bob']
    });
    await assertFails(setDoc(doc(aliceDb, 'chats/act1_removedAlice/messages/msgAliceRemoved'), {
      text: 'Alice removed text',
      senderId: 'alice',
      senderName: 'Alice Participant',
      sentAt: serverTimestamp(),
      isPremium: false
    }));

    // 13. Completed / Cancelled / Blacklisted activity chats are not writable
    await assertFails(setDoc(doc(aliceDb, 'chats/actCompleted/messages/msgCompleted'), {
      text: 'Completed text',
      senderId: 'alice',
      senderName: 'Alice Participant',
      sentAt: serverTimestamp(),
      isPremium: false
    }));
    await assertFails(setDoc(doc(aliceDb, 'chats/actCancelled/messages/msgCancelled'), {
      text: 'Cancelled text',
      senderId: 'alice',
      senderName: 'Alice Participant',
      sentAt: serverTimestamp(),
      isPremium: false
    }));
    await assertFails(setDoc(doc(aliceDb, 'chats/actBlacklisted/messages/msgBlacklisted'), {
      text: 'Blacklisted text',
      senderId: 'alice',
      senderName: 'Alice Participant',
      sentAt: serverTimestamp(),
      isPremium: false
    }));

    // 14. Missing activity on activity-based chat is not writable
    await assertFails(setDoc(doc(aliceDb, 'chats/missingActChat/messages/msgMissingAct'), {
      text: 'Missing act text',
      senderId: 'alice',
      senderName: 'Alice Participant',
      sentAt: serverTimestamp(),
      isPremium: false
    }));
  }

  // ==========================================
  // J. Profile & Social Actions Security Rules
  // ==========================================
  {
    console.log('Running Suite J: Profile & Social Actions Security Rules...');
    await testEnv.clearFirestore();

    const alicePayload = {
      uid: 'alice',
      displayName: 'Alice User',
      email: 'alice@example.com',
      friends: [],
      friendRequestsSent: [],
      friendRequestsReceived: [],
      isBanned: false,
      blacklist: { soft: [], hard: [] }
    };

    const bobPayload = {
      uid: 'bob',
      displayName: 'Bob User',
      email: 'bob@example.com',
      friends: [],
      friendRequestsSent: [],
      friendRequestsReceived: [],
      isBanned: false,
      blacklist: { soft: [], hard: [] }
    };

    const charliePayload = {
      uid: 'charlie',
      displayName: 'Charlie Stranger',
      email: 'charlie@example.com',
      friends: [],
      friendRequestsSent: [],
      friendRequestsReceived: [],
      isBanned: false,
      blacklist: { soft: [], hard: [] }
    };

    const davePayload = {
      uid: 'dave',
      displayName: 'Dave Banned',
      email: 'dave@example.com',
      friends: [],
      friendRequestsSent: [],
      friendRequestsReceived: [],
      isBanned: true,
      blacklist: { soft: [], hard: [] }
    };

    await seedDoc('users/alice', alicePayload);
    await seedDoc('users/bob', bobPayload);
    await seedDoc('users/charlie', charliePayload);
    await seedDoc('users/dave', davePayload);

    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    const guestDb = testEnv.unauthenticatedContext().firestore();

    // 1. Allow: User reads own profile
    await assertSucceeds(getDoc(doc(aliceDb, 'users/alice')));

    // 2. Deny: User reads another profile directly (blocked by lockdown, must use Cloud Function)
    await assertFails(getDoc(doc(aliceDb, 'users/bob')));

    // 3. Deny: Guest reads profile
    await assertFails(getDoc(doc(guestDb, 'users/alice')));

    // 4. Deny: Read banned user
    await assertFails(getDoc(doc(aliceDb, 'users/dave')));

    // 5. Block: Seed Alice blocking Bob (hard)
    await seedDoc('users/alice', { ...alicePayload, blacklist: { soft: [], hard: ['bob'] } });
    
    // 5.1 Bob reads Alice profile (denied: Bob is blocked by Alice)
    await assertFails(getDoc(doc(bobDb, 'users/alice')));

    // 5.2 Alice reads Bob profile (denied: Alice blocked Bob)
    await assertFails(getDoc(doc(aliceDb, 'users/bob')));

    // Reset block status for social tests
    await seedDoc('users/alice', alicePayload);

    // 6. Allow: Social update (Alice sends friend request to Bob)
    // Alice updates her own doc: adds Bob to friendRequestsSent (allowed: owner)
    await assertSucceeds(updateDoc(doc(aliceDb, 'users/alice'), { friendRequestsSent: ['bob'] }));
    // Alice updates Bob's doc: adds Alice to friendRequestsReceived (allowed: isAllowedSocialUpdate)
    await assertSucceeds(updateDoc(doc(aliceDb, 'users/bob'), { friendRequestsReceived: ['alice'] }));

    // Setup state for Bob accepting Alice request
    await seedDoc('users/alice', { ...alicePayload, friendRequestsSent: ['bob'] });
    await seedDoc('users/bob', { ...bobPayload, friendRequestsReceived: ['alice'] });

    // 7. Allow: Bob accepts Alice friend request
    // Bob updates own doc: removes Alice from received, adds to friends (allowed: owner)
    await assertSucceeds(updateDoc(doc(bobDb, 'users/bob'), { friendRequestsReceived: [], friends: ['alice'] }));
    // Bob updates Alice doc: removes Bob from sent, adds to friends (allowed: isAllowedSocialUpdate)
    await assertSucceeds(updateDoc(doc(bobDb, 'users/alice'), { friendRequestsSent: [], friends: ['bob'] }));

    // 8. Deny: social write to random field (Alice tries to write to Bob's fiatBalance)
    await assertFails(updateDoc(doc(aliceDb, 'users/bob'), { fiatBalance: 100 }));

    // 9. Deny: Social update inserts foreign UID (Alice adds charlie to Bob's friendRequestsReceived)
    await assertFails(updateDoc(doc(aliceDb, 'users/bob'), { friendRequestsReceived: ['charlie'] }));

    // 10. Deny: Social update inserts multiple UIDs (overwriting array)
    await assertFails(updateDoc(doc(aliceDb, 'users/bob'), { friendRequestsReceived: ['alice', 'charlie'] }));

    // 11. Deny: Blocked user Bob cannot send friend request to Alice
    // Alice blocks Bob:
    await seedDoc('users/alice', { ...alicePayload, blacklist: { soft: [], hard: ['bob'] } });
    await assertFails(updateDoc(doc(bobDb, 'users/alice'), { friendRequestsReceived: ['bob'] }));
  }

  // ==========================================
  // K. Wallet & Balance Security Rules
  // ==========================================
  {
    console.log('Running Suite K: Wallet & Balance Security Rules...');
    await testEnv.clearFirestore();

    const alicePayload = {
      uid: 'alice',
      displayName: 'Alice WalletOwner',
      email: 'alice@example.com',
      tokens: 10,
      fiatBalance: 5000,
      escrowBalance: 2000,
      balancesInCents: true,
      pointsBalance: 150,
      role: 'user',
      isBanned: false
    };

    const bobPayload = {
      uid: 'bob',
      displayName: 'Bob User',
      email: 'bob@example.com',
      tokens: 5,
      fiatBalance: 0,
      escrowBalance: 0,
      balancesInCents: true,
      pointsBalance: 0,
      role: 'user',
      isBanned: false
    };

    // Seed base documents
    await seedDoc('users/alice', alicePayload);
    await seedDoc('users/bob', bobPayload);
    
    // Seed subcollections
    await seedDoc('users/alice/tokenTransactions/tx1', { userId: 'alice', amount: 1, type: 'earn_ad_watch' });
    await seedDoc('users/alice/pointsLedger/pt1', { points: 10, type: 'event_created' });
    
    // Seed payout and refund requests
    await seedDoc('payoutRequests/payAlice', { userId: 'alice', amount: 50, status: 'pending' });
    await seedDoc('refunds/refAlice', { userId: 'alice', amount: 20, status: 'pending' });

    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    const guestDb = testEnv.unauthenticatedContext().firestore();

    // 1. Owner can read own wallet/transactions data
    await assertSucceeds(getDoc(doc(aliceDb, 'users/alice')));
    await assertSucceeds(getDoc(doc(aliceDb, 'users/alice/tokenTransactions/tx1')));
    await assertSucceeds(getDoc(doc(aliceDb, 'users/alice/pointsLedger/pt1')));
    await assertSucceeds(getDoc(doc(aliceDb, 'payoutRequests/payAlice')));
    await assertSucceeds(getDoc(doc(aliceDb, 'refunds/refAlice')));

    // 2. Foreign user cannot read wallet/transactions data
    await assertFails(getDoc(doc(bobDb, 'users/alice/tokenTransactions/tx1')));
    await assertFails(getDoc(doc(bobDb, 'users/alice/pointsLedger/pt1')));
    await assertFails(getDoc(doc(bobDb, 'payoutRequests/payAlice')));
    await assertFails(getDoc(doc(bobDb, 'refunds/refAlice')));

    // 3. Guest cannot read wallet/transactions data
    await assertFails(getDoc(doc(guestDb, 'users/alice')));
    await assertFails(getDoc(doc(guestDb, 'users/alice/tokenTransactions/tx1')));
    await assertFails(getDoc(doc(guestDb, 'users/alice/pointsLedger/pt1')));
    await assertFails(getDoc(doc(guestDb, 'payoutRequests/payAlice')));
    await assertFails(getDoc(doc(guestDb, 'refunds/refAlice')));

    // 4. Owner cannot directly increment balance fields
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { tokens: 11 }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { fiatBalance: 5100 }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { escrowBalance: 2100 }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { pointsBalance: 160 }));

    // 5. Owner cannot change other's balances
    await assertFails(updateDoc(doc(aliceDb, 'users/bob'), { tokens: 6 }));
    await assertFails(updateDoc(doc(aliceDb, 'users/bob'), { fiatBalance: 100 }));

    // 6. Owner cannot manipulate payout/refund status
    await assertFails(updateDoc(doc(aliceDb, 'payoutRequests/payAlice'), { status: 'approved' }));
    await assertFails(updateDoc(doc(aliceDb, 'refunds/refAlice'), { status: 'completed' }));

    // 7. Direct client create of payout/refund/ledger docs is blocked
    await assertFails(setDoc(doc(aliceDb, 'payoutRequests/newPay'), { userId: 'alice', amount: 50, status: 'pending' }));
    await assertFails(setDoc(doc(aliceDb, 'refunds/newRef'), { userId: 'alice', amount: 20, status: 'pending' }));
    await assertFails(setDoc(doc(aliceDb, 'users/alice/tokenTransactions/newTx'), { userId: 'alice', amount: 1, type: 'earn_ad_watch' }));
    await assertFails(setDoc(doc(aliceDb, 'users/alice/pointsLedger/newPt'), { points: 10, type: 'event_created' }));

    // 8. Existing safe token decrements remain allowed (e.g. decrementing by 1 for boost)
    await assertSucceeds(updateDoc(doc(aliceDb, 'users/alice'), { tokens: 9 }));
  }

  // ==========================================
  // L. Admin & Moderation Rules
  // ==========================================
  {
    console.log('Running Suite L: Admin & Moderation Rules...');
    await testEnv.clearFirestore();

    await seedDoc('users/alice', { uid: 'alice', role: 'user', isBanned: false });
    await seedDoc('users/bob', { uid: 'bob', role: 'user', isBanned: false });
    await seedDoc('users/adminUser', { uid: 'adminUser', role: 'admin', isBanned: false });

    // Seed a creator application and report
    await seedDoc('creator_applications/appAlice', { userId: 'alice', status: 'pending' });
    await seedDoc('reports/rep1', { reporterId: 'alice', reportedEntityId: 'act1', status: 'pending' });

    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    const adminDb = testEnv.authenticatedContext('adminUser').firestore();

    // 1. Report creation
    // Alice can create report with her own UID as reporterId
    await assertSucceeds(setDoc(doc(aliceDb, 'reports/newRep1'), {
      reporterId: 'alice',
      reportedEntityId: 'act123',
      entityType: 'activity',
      reason: 'inappropriate',
      status: 'pending',
      createdAt: serverTimestamp()
    }));

    // Alice cannot create report with Bob's UID
    await assertFails(setDoc(doc(aliceDb, 'reports/newRep2'), {
      reporterId: 'bob',
      reportedEntityId: 'act123',
      entityType: 'activity',
      reason: 'inappropriate',
      status: 'pending',
      createdAt: serverTimestamp()
    }));

    // Alice cannot create report with invalid status
    await assertFails(setDoc(doc(aliceDb, 'reports/newRep3'), {
      reporterId: 'alice',
      reportedEntityId: 'act123',
      entityType: 'activity',
      reason: 'inappropriate',
      status: 'resolved',
      createdAt: serverTimestamp()
    }));

    // Alice cannot read reports
    await assertFails(getDoc(doc(aliceDb, 'reports/rep1')));

    // Admin can read reports
    await assertSucceeds(getDoc(doc(adminDb, 'reports/rep1')));

    // 2. Creator applications creation
    // Alice can create creator application for herself
    await assertSucceeds(setDoc(doc(aliceDb, 'creator_applications/newApp1'), {
      userId: 'alice',
      userDisplayName: 'Alice',
      averageRating: 4.5,
      activitiesCount: 3,
      status: 'pending',
      createdAt: serverTimestamp()
    }));

    // Alice cannot create creator application for Bob
    await assertFails(setDoc(doc(aliceDb, 'creator_applications/newApp2'), {
      userId: 'bob',
      userDisplayName: 'Bob',
      averageRating: 4.5,
      activitiesCount: 3,
      status: 'pending',
      createdAt: serverTimestamp()
    }));

    // Alice cannot create creator application with status approved
    await assertFails(setDoc(doc(aliceDb, 'creator_applications/newApp3'), {
      userId: 'alice',
      userDisplayName: 'Alice',
      averageRating: 4.5,
      activitiesCount: 3,
      status: 'approved',
      createdAt: serverTimestamp()
    }));

    // Alice can read her own application
    await assertSucceeds(getDoc(doc(aliceDb, 'creator_applications/appAlice')));

    // Bob cannot read Alice's application
    await assertFails(getDoc(doc(bobDb, 'creator_applications/appAlice')));

    // Admin can read and update application
    await assertSucceeds(getDoc(doc(adminDb, 'creator_applications/appAlice')));
    await assertSucceeds(updateDoc(doc(adminDb, 'creator_applications/appAlice'), { status: 'approved' }));
  }

  // ==========================================
  // M. Storage Security Rules
  // ==========================================
  {
    console.log('Running Suite M: Storage Security Rules...');
    await testEnv.clearFirestore();

    // Seed profiles for Admin check (using firestore fallback)
    await seedDoc('users/alice', { uid: 'alice', role: 'user' });
    await seedDoc('users/bob', { uid: 'bob', role: 'user' });
    await seedDoc('users/adminUser', { uid: 'adminUser', role: 'admin' });

    const aliceStorage = testEnv.authenticatedContext('alice').storage();
    const bobStorage = testEnv.authenticatedContext('bob').storage();
    const guestStorage = testEnv.unauthenticatedContext().storage();
    const adminStorage = testEnv.authenticatedContext('adminUser', { role: 'admin', isAdmin: true }).storage();

    const validImgBytes = new Uint8Array([1, 2, 3]);
    const invalidLargeBytes = new Uint8Array(6 * 1024 * 1024); // 6 MB

    // 1. Gast kann keinen Avatar hochladen
    await assertFails(uploadBytes(ref(guestStorage, 'users/alice/avatar/avatar.jpg'), validImgBytes, { contentType: 'image/jpeg' }));

    // 2. Owner kann gültigen Avatar mit festem Dateinamen hochladen (avatar.jpg, avatar.png, avatar.webp)
    await assertSucceeds(uploadBytes(ref(aliceStorage, 'users/alice/avatar/avatar.jpg'), validImgBytes, { contentType: 'image/jpeg' }));
    await assertSucceeds(uploadBytes(ref(aliceStorage, 'users/alice/avatar/avatar.png'), validImgBytes, { contentType: 'image/png' }));
    await assertSucceeds(uploadBytes(ref(aliceStorage, 'users/alice/avatar/avatar.webp'), validImgBytes, { contentType: 'image/webp' }));

    // 3. Fremder Nutzer kann nicht in Alice Avatar-Pfad schreiben
    await assertFails(uploadBytes(ref(bobStorage, 'users/alice/avatar/avatar.jpg'), validImgBytes, { contentType: 'image/jpeg' }));

    // 4. Avatar-Upload mit beliebigem Dateinamen (z.B. profile_123.jpg oder avatar_old.jpg) wird blockiert
    await assertFails(uploadBytes(ref(aliceStorage, 'users/alice/avatar/profile_123.jpg'), validImgBytes, { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(aliceStorage, 'users/alice/avatar/avatar_old.jpg'), validImgBytes, { contentType: 'image/jpeg' }));

    // 5. SVG-Upload als Avatar wird blockiert
    await assertFails(uploadBytes(ref(aliceStorage, 'users/alice/avatar/avatar.jpg'), validImgBytes, { contentType: 'image/svg+xml' }));

    // 6. HTML-Upload als Avatar wird blockiert
    await assertFails(uploadBytes(ref(aliceStorage, 'users/alice/avatar/avatar.jpg'), validImgBytes, { contentType: 'text/html' }));

    // 7. PDF-Upload als Avatar wird blockiert
    await assertFails(uploadBytes(ref(aliceStorage, 'users/alice/avatar/avatar.jpg'), validImgBytes, { contentType: 'application/pdf' }));

    // 8. Datei über 5MB wird blockiert
    await assertFails(uploadBytes(ref(aliceStorage, 'users/alice/avatar/avatar.jpg'), invalidLargeBytes, { contentType: 'image/jpeg' }));

    // 9. Owner kann eigenes Avatar-Bild löschen
    await assertSucceeds(deleteObject(ref(aliceStorage, 'users/alice/avatar/avatar.jpg')));

    // 10. Fremder kann Alice Avatar nicht löschen
    // Seed Alice avatar first using aliceStorage
    await uploadBytes(ref(aliceStorage, 'users/alice/avatar/avatar.jpg'), validImgBytes, { contentType: 'image/jpeg' });
    await assertFails(deleteObject(ref(bobStorage, 'users/alice/avatar/avatar.jpg')));

    // 11. Öffentlicher Lesezugriff auf Alice Avatar (avatar.jpg) funktioniert
    await assertSucceeds(getBytes(ref(guestStorage, 'users/alice/avatar/avatar.jpg')));

    // 12. Öffentlicher Lesezugriff auf unzulässigen Avatar-Dateinamen wird blockiert
    await assertFails(getBytes(ref(guestStorage, 'users/alice/avatar/unauthorized_file.txt')));

    // 13. Gast kann KYC-Dokument nicht hochladen
    await assertFails(uploadBytes(ref(guestStorage, 'kyc/alice/identity_document.pdf'), validImgBytes, { contentType: 'application/pdf' }));

    // 14. Owner kann gültiges KYC-PDF mit festem Dateinamen (identity_document.pdf) hochladen
    await assertSucceeds(uploadBytes(ref(aliceStorage, 'kyc/alice/identity_document.pdf'), validImgBytes, { contentType: 'application/pdf' }));
    // JPEG/PNG/WebP ebenfalls erlaubt für KYC
    await assertSucceeds(uploadBytes(ref(aliceStorage, 'kyc/alice/identity_document.jpg'), validImgBytes, { contentType: 'image/jpeg' }));

    // 15. KYC-Upload mit beliebigem Dateinamen wird blockiert
    await assertFails(uploadBytes(ref(aliceStorage, 'kyc/alice/my_passport.pdf'), validImgBytes, { contentType: 'application/pdf' }));

    // 16. Owner kann KYC-Dokument nicht verändern/updaten (unveränderlich)
    await assertFails(uploadBytes(ref(aliceStorage, 'kyc/alice/identity_document.pdf'), validImgBytes, { contentType: 'application/pdf' }));

    // 17. Owner kann eigenes KYC-Dokument nicht löschen
    await assertFails(deleteObject(ref(aliceStorage, 'kyc/alice/identity_document.pdf')));

    // 18. Fremder kann Alice' KYC nicht lesen
    await assertFails(getBytes(ref(bobStorage, 'kyc/alice/identity_document.pdf')));

    // 19. Fremder kann Alice' KYC nicht löschen
    await assertFails(deleteObject(ref(bobStorage, 'kyc/alice/identity_document.pdf')));

    // 20. Admin kann Alice' KYC lesen und löschen
    // Admin read
    await assertSucceeds(getBytes(ref(adminStorage, 'kyc/alice/identity_document.pdf')));
    // Admin delete
    await assertSucceeds(deleteObject(ref(adminStorage, 'kyc/alice/identity_document.pdf')));

    // 21. Unbekannte/andere Pfade in Storage sind komplett gesperrt
    await assertFails(uploadBytes(ref(aliceStorage, 'unregistered_folder/file.jpg'), validImgBytes, { contentType: 'image/jpeg' }));
  }

  // ==========================================
  // N. Notification Security Rules
  // ==========================================
  {
    console.log('Running Suite N: Notification Security Rules...');
    await testEnv.clearFirestore();

    // Seed profiles
    await seedDoc('users/alice', { uid: 'alice', role: 'user', displayName: 'Alice' });
    await seedDoc('users/bob', { uid: 'bob', role: 'user', displayName: 'Bob' });
    await seedDoc('users/adminUser', { uid: 'adminUser', role: 'admin' });
    await seedDoc('activities/actAlice', { hostId: 'alice', placeName: 'Alice Activity', status: 'active', participantIds: ['alice'] });

    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    const guestDb = testEnv.unauthenticatedContext().firestore();
    const adminDb = testEnv.authenticatedContext('adminUser').firestore();

    const notifAlice = {
      recipientId: 'alice',
      senderId: 'bob',
      type: 'friend_request',
      isRead: false,
      createdAt: serverTimestamp(),
      senderProfile: { displayName: 'Bob', photoURL: null }
    };

    // Seed Alice notification
    await seedDoc('notifications/notif1', notifAlice);

    // 1. Gast kann keine Notification lesen/erstellen
    await assertFails(getDoc(doc(guestDb, 'notifications/notif1')));
    await assertFails(setDoc(doc(guestDb, 'notifications/newNotif'), { ...notifAlice, recipientId: 'bob' }));

    // 2. Empfänger kann eigene Notification lesen
    await assertSucceeds(getDoc(doc(aliceDb, 'notifications/notif1')));

    // 3. Fremder Nutzer kann Alice's Notification nicht lesen
    await assertFails(getDoc(doc(bobDb, 'notifications/notif1')));

    // 4. Empfänger kann nur isRead/readAt updaten
    await assertSucceeds(updateDoc(doc(aliceDb, 'notifications/notif1'), { isRead: true, readAt: serverTimestamp() }));
    // 5. Empfänger kann andere Felder (type, link, recipientId, etc.) nicht updaten
    await assertFails(updateDoc(doc(aliceDb, 'notifications/notif1'), { type: 'join_response' }));
    await assertFails(updateDoc(doc(aliceDb, 'notifications/notif1'), { link: '/wallet' }));
    await assertFails(updateDoc(doc(aliceDb, 'notifications/notif1'), { recipientId: 'bob' }));

    // 6. Empfänger kann isRead nicht auf false zurücksetzen
    await assertFails(updateDoc(doc(aliceDb, 'notifications/notif1'), { isRead: false }));

    // 7. Client-Create: friend_request an sich selbst blockiert
    await assertFails(setDoc(doc(aliceDb, 'notifications/newNotif2'), {
      recipientId: 'alice',
      senderId: 'alice',
      type: 'friend_request',
      isRead: false,
      createdAt: serverTimestamp(),
      senderProfile: { displayName: 'Alice', photoURL: null }
    }));

    // 8. Client-Create: friend_request an Bob funktioniert
    await assertSucceeds(setDoc(doc(aliceDb, 'notifications/newNotif3'), {
      recipientId: 'bob',
      senderId: 'alice',
      type: 'friend_request',
      isRead: false,
      createdAt: serverTimestamp(),
      senderProfile: { displayName: 'Alice', photoURL: null }
    }));

    // 9. Client-Create: friend_request mit gefälschter Sender-UID blockiert
    await assertFails(setDoc(doc(aliceDb, 'notifications/newNotif4'), {
      recipientId: 'bob',
      senderId: 'bob',
      type: 'friend_request',
      isRead: false,
      createdAt: serverTimestamp(),
      senderProfile: { displayName: 'Bob', photoURL: null }
    }));

    // 10. Client-Create: join_request an Host (Alice) funktioniert
    await assertSucceeds(setDoc(doc(bobDb, 'notifications/newNotif5'), {
      recipientId: 'alice',
      senderId: 'bob',
      senderName: 'Bob',
      senderProfile: { displayName: 'Bob', photoURL: null },
      type: 'join_request',
      title: 'Join Request',
      message: 'Bob wants to join',
      isRead: false,
      createdAt: serverTimestamp(),
      activityId: 'actAlice',
      link: '/activities/actAlice'
    }));

    // 11. Client-Create: join_request mit falschem Host blockiert
    await assertFails(setDoc(doc(bobDb, 'notifications/newNotif6'), {
      recipientId: 'bob', // Bob is not the host of actAlice!
      senderId: 'bob',
      senderName: 'Bob',
      senderProfile: { displayName: 'Bob', photoURL: null },
      type: 'join_request',
      title: 'Join Request',
      message: 'Bob wants to join',
      isRead: false,
      createdAt: serverTimestamp(),
      activityId: 'actAlice',
      link: '/activities/actAlice'
    }));

    // 12. Client-Create: join_response blockiert (nur serverseitig via Cloud Function)
    await assertFails(setDoc(doc(aliceDb, 'notifications/newNotif7'), {
      recipientId: 'bob',
      senderId: 'system',
      type: 'join_response',
      title: 'Accepted',
      message: 'You are accepted',
      isRead: false,
      createdAt: serverTimestamp(),
      activityId: 'actAlice',
      responseStatus: 'accepted'
    }));

    // 13. Client-Create: system Notification blockiert
    await assertFails(setDoc(doc(aliceDb, 'notifications/newNotif8'), {
      recipientId: 'bob',
      senderId: 'system',
      type: 'system',
      title: 'Alert',
      message: 'System alert',
      isRead: false,
      createdAt: serverTimestamp()
    }));

    // 14. Client-Create: Extra-/Fake-Systemfelder blockiert
    await assertFails(setDoc(doc(aliceDb, 'notifications/newNotif9'), {
      recipientId: 'bob',
      senderId: 'alice',
      type: 'friend_request',
      isRead: false,
      createdAt: serverTimestamp(),
      senderProfile: { displayName: 'Alice', photoURL: null },
      extraField: 'hack'
    }));

    // 15. Client-Create: Externe Links blockiert
    await assertFails(setDoc(doc(aliceDb, 'notifications/newNotif10'), {
      recipientId: 'bob',
      senderId: 'alice',
      type: 'friend_request',
      isRead: false,
      createdAt: serverTimestamp(),
      senderProfile: { displayName: 'Alice', photoURL: null },
      link: 'https://malicious.com'
    }));

    // 16. FCM Token: Owner kann eigenes Token setzen
    await assertSucceeds(updateDoc(doc(aliceDb, 'users/alice'), { fcmToken: 'valid_token' }));
    // 17. FCM Token: Fremder kann nicht schreiben
    await assertFails(updateDoc(doc(bobDb, 'users/alice'), { fcmToken: 'another_token' }));
    // 18. FCM Token: Zu langes/ungültiges Token blockiert
    const tooLongToken = 'a'.repeat(600);
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { fcmToken: tooLongToken }));

    // 19. Notification Settings: Owner kann valide Settings setzen
    await assertSucceeds(updateDoc(doc(aliceDb, 'users/alice'), {
      notificationSettings: {
        localHighlights: true,
        nearbyFriendActivityNotifications: false,
        friendRequests: true,
        activityInvites: true,
        chatMessages: true
      }
    }));
    // 20. Notification Settings: Zusatzfelder blockiert
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), {
      notificationSettings: {
        localHighlights: true,
        extraField: 'hack'
      }
    }));
    // 21. Notification Settings: Falscher Typ blockiert
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), {
      notificationSettings: {
        localHighlights: 'not_a_bool'
      }
    }));

    // 22. Language: Owner kann language auf 'de' oder 'en' setzen
    await assertSucceeds(updateDoc(doc(aliceDb, 'users/alice'), { language: 'de' }));
    await assertSucceeds(updateDoc(doc(aliceDb, 'users/alice'), { language: 'en' }));
    // 23. Language: Ungültige Sprache blockiert
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { language: 'fr' }));

    // 24. Proximity Settings: Owner kann proximitySettings setzen
    await assertSucceeds(updateDoc(doc(aliceDb, 'users/alice'), {
      proximitySettings: {
        enabled: true,
        radiusKm: 10
      }
    }));
    // 25. Proximity Settings: Falscher Typ für radiusKm blockiert
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), {
      proximitySettings: {
        enabled: true,
        radiusKm: '10' as any
      }
    }));
    // 26. Proximity Settings: radiusKm außerhalb 1-50 blockiert
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), {
      proximitySettings: {
        enabled: true,
        radiusKm: 0
      }
    }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), {
      proximitySettings: {
        enabled: true,
        radiusKm: 51
      }
    }));
    // 27. Proximity Settings: Zusatzfelder blockiert
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), {
      proximitySettings: {
        enabled: true,
        radiusKm: 10,
        extraField: 'hack'
      }
    }));

    // 28. Fremder Nutzer kann Settings nicht ändern
    await assertFails(updateDoc(doc(bobDb, 'users/alice'), { language: 'de' }));
    await assertFails(updateDoc(doc(bobDb, 'users/alice'), {
      proximitySettings: {
        enabled: true,
        radiusKm: 10
      }
    }));

    // 29. Systemfelder über Settings-Update ändern blockiert
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { role: 'admin' }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { isAdmin: true }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { isBanned: true }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { tokens: 100 }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { kycStatus: 'verified' }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { fiatBalance: 100 }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), { escrowBalance: 100 }));
  }

  // ==========================================
  // O. Activity Creation, Hosting and Editing Rules
  // ==========================================
  {
    console.log('Running Suite O: Activity Creation, Hosting & Editing tests...');
    await testEnv.clearFirestore();

    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    const charlieDb = testEnv.authenticatedContext('charlie').firestore();
    const bannedDb = testEnv.authenticatedContext('bannedUser').firestore();
    const adminDb = testEnv.authenticatedContext('adminUser').firestore();
    const guestDb = testEnv.unauthenticatedContext().firestore();

    // Helper to generate a valid template activity creation payload
    function getValidActivity(hostId: string): any {
      return {
        title: 'Football Match',
        placeName: 'Soccer Field',
        activityDate: new Date(Date.now() + 3600 * 1000), // 1 hour in future
        hostId: hostId,
        hostName: 'Host User',
        hostPhotoURL: null,
        participantIds: [hostId],
        participantsPreview: [{ uid: hostId, displayName: 'Host User', photoURL: null }],
        createdAt: serverTimestamp(),
        lastInteractionAt: serverTimestamp(),
        isCustomActivity: true,
        isTimeFlexible: false,
        category: 'Sport',
        description: 'Friendly match',
        status: 'active',
        completionVotes: [],
        isBoosted: false,
        boostedAt: null,
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
        participantDetails: {
          [hostId]: {
            displayName: 'Host User',
            photoURL: null,
            isPremium: false,
            isSupporter: false,
            checkInStatus: 'pending',
            hasReviewed: false
          }
        },
        categories: ['Sport'],
        isUserEvent: true,
        sourceType: 'activity',
        creationSource: 'community'
      };
    }

    // Seed profiles
    await seedDoc('users/alice', { uid: 'alice', onboardingCompleted: true, isBanned: false, role: 'user', tokens: 5 });
    await seedDoc('users/bob', { uid: 'bob', onboardingCompleted: true, isBanned: false, role: 'user', tokens: 0 });
    await seedDoc('users/charlie', { uid: 'charlie', onboardingCompleted: false, isBanned: false, role: 'user', tokens: 1 });
    await seedDoc('users/bannedUser', { uid: 'bannedUser', onboardingCompleted: true, isBanned: true, role: 'user', tokens: 1 });
    await seedDoc('users/adminUser', { uid: 'adminUser', onboardingCompleted: true, isBanned: false, role: 'admin', tokens: 1 });

    // 1. Positive: Valid normal activity creation without boost succeeds
    {
      const batch = writeBatch(aliceDb);
      const actId = 'act_normal';
      const activityRef = doc(aliceDb, `activities/${actId}`);
      const chatRef = doc(aliceDb, `chats/${actId}`);
      const participantRef = doc(aliceDb, `activities/${actId}/participants/alice`);

      batch.set(activityRef, getValidActivity('alice'));
      batch.set(chatRef, {
        activityId: actId,
        hostId: 'alice',
        createdAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
        participantIds: ['alice'],
        lastMessage: null,
        placeName: 'Soccer Field',
        categories: ['Sport'],
        participantDetails: {
          alice: { displayName: 'Host User', photoURL: null, isPremium: false, isSupporter: false, checkInStatus: 'pending' }
        },
        unreadCount: { alice: 0 }
      });
      batch.set(participantRef, {
        uid: 'alice',
        displayName: 'Host User',
        photoURL: null,
        checkInStatus: 'pending',
        joinedAt: serverTimestamp(),
        hasReviewed: false
      });

      await assertSucceeds(batch.commit());
    }

    // 2. Negative: Guest cannot create activity
    {
      const batch = writeBatch(guestDb);
      const actId = 'act_guest';
      batch.set(doc(guestDb, `activities/${actId}`), getValidActivity('alice'));
      await assertFails(batch.commit());
    }

    // 3. Negative: Onboarding-incomplete user cannot create activity
    {
      const batch = writeBatch(charlieDb);
      const actId = 'act_charlie';
      batch.set(doc(charlieDb, `activities/${actId}`), getValidActivity('charlie'));
      await assertFails(batch.commit());
    }

    // 4. Negative: Banned user cannot create activity
    {
      const batch = writeBatch(bannedDb);
      const actId = 'act_banned';
      batch.set(doc(bannedDb, `activities/${actId}`), getValidActivity('bannedUser'));
      await assertFails(batch.commit());
    }

    // 5. Negative: hostId != request.auth.uid blocked
    {
      const batch = writeBatch(aliceDb);
      const actId = 'act_wrong_host';
      const payload = { ...getValidActivity('alice'), hostId: 'bob' };
      batch.set(doc(aliceDb, `activities/${actId}`), payload);
      await assertFails(batch.commit());
    }

    // 6. Negative: Extra fields not in whitelist blocked
    {
      const batch = writeBatch(aliceDb);
      const actId = 'act_extra_fields';
      const payload = { ...getValidActivity('alice'), extraField: 'hacker_val' };
      batch.set(doc(aliceDb, `activities/${actId}`), payload);
      await assertFails(batch.commit());
    }

    // 7. Negative: createdAt != request.time blocked
    {
      const batch = writeBatch(aliceDb);
      const actId = 'act_wrong_created';
      const payload = { ...getValidActivity('alice'), createdAt: new Date(Date.now() - 10000) };
      batch.set(doc(aliceDb, `activities/${actId}`), payload);
      await assertFails(batch.commit());
    }

    // 8. Negative: Startzeit in past blocked
    {
      const batch = writeBatch(aliceDb);
      const actId = 'act_past_start';
      const payload = { ...getValidActivity('alice'), activityDate: new Date(Date.now() - 3600 * 1000) };
      batch.set(doc(aliceDb, `activities/${actId}`), payload);
      await assertFails(batch.commit());
    }

    // 9. Negative: Startzeit / Endzeit duration > 30 days blocked
    {
      const batch = writeBatch(aliceDb);
      const actId = 'act_too_long';
      const payload = { 
        ...getValidActivity('alice'), 
        activityEndDate: new Date(Date.now() + 32 * 24 * 3600 * 1000) 
      };
      batch.set(doc(aliceDb, `activities/${actId}`), payload);
      await assertFails(batch.commit());
    }

    // 10. Negative: Invalid coordinates blocked
    {
      const batch = writeBatch(aliceDb);
      const actId = 'act_invalid_lat';
      const payload = { ...getValidActivity('alice'), lat: 120.0, lon: 10.0 };
      batch.set(doc(aliceDb, `activities/${actId}`), payload);
      await assertFails(batch.commit());
    }

    // 11. Negative: Invalid capacity blocked
    {
      const batch = writeBatch(aliceDb);
      const actId = 'act_invalid_cap';
      const payload = { ...getValidActivity('alice'), maxParticipants: 1 };
      batch.set(doc(aliceDb, `activities/${actId}`), payload);
      await assertFails(batch.commit());
    }

    // 12. Negative: Status completed at creation blocked
    {
      const batch = writeBatch(aliceDb);
      const actId = 'act_invalid_status';
      const payload = { ...getValidActivity('alice'), status: 'completed' };
      batch.set(doc(aliceDb, `activities/${actId}`), payload);
      await assertFails(batch.commit());
    }

    // 13. Negative: Paid activity creation (isPaid: true, price > 0) blocked for all (including admin)
    {
      const batch = writeBatch(aliceDb);
      const actId = 'act_paid_user';
      const payload = { ...getValidActivity('alice'), isPaid: true, price: 500 };
      batch.set(doc(aliceDb, `activities/${actId}`), payload);
      await assertFails(batch.commit());
    }
    {
      const batch = writeBatch(adminDb);
      const actId = 'act_paid_admin';
      const payload = { ...getValidActivity('adminUser'), isPaid: true, price: 500 };
      batch.set(doc(adminDb, `activities/${actId}`), payload);
      await assertFails(batch.commit());
    }

    // 14. Place-related Tests
    // Seed place
    await seedDoc('places/place1', { name: 'Musterplatz', activityCount: 0, isDeleted: false, isBlacklisted: false });
    await seedDoc('places/placeDeleted', { name: 'Deleted Place', activityCount: 0, isDeleted: true, isBlacklisted: false });

    // Positive: Valid place creation with exactly activityCount +1 in batch succeeds
    {
      const batch = writeBatch(aliceDb);
      const actId = 'act_place_ok';
      const payload = { ...getValidActivity('alice'), placeId: 'place1', isCustomActivity: false };
      
      batch.set(doc(aliceDb, `activities/${actId}`), payload);
      batch.set(doc(aliceDb, `chats/${actId}`), {
        activityId: actId,
        hostId: 'alice',
        participantIds: ['alice']
      });
      batch.set(doc(aliceDb, `activities/${actId}/participants/alice`), { uid: 'alice', checkInStatus: 'pending', hasReviewed: false });
      batch.set(doc(aliceDb, 'places/place1'), { 
        activityCount: 1,
        lastActivityId: actId
      }, { merge: true });

      await assertSucceeds(batch.commit());
    }

    // Negative: Creation on deleted place blocked
    {
      const batch = writeBatch(aliceDb);
      const actId = 'act_place_deleted';
      const payload = { ...getValidActivity('alice'), placeId: 'placeDeleted', isCustomActivity: false };
      
      batch.set(doc(aliceDb, `activities/${actId}`), payload);
      batch.set(doc(aliceDb, 'places/placeDeleted'), { 
        activityCount: 1,
        lastActivityId: actId
      }, { merge: true });

      await assertFails(batch.commit());
    }

    // Negative: Place activityCount NOT incremented in batch blocked
    {
      const batch = writeBatch(aliceDb);
      const actId = 'act_place_no_inc';
      const payload = { ...getValidActivity('alice'), placeId: 'place1', isCustomActivity: false };
      
      batch.set(doc(aliceDb, `activities/${actId}`), payload);
      batch.set(doc(aliceDb, `chats/${actId}`), { activityId: actId, hostId: 'alice', participantIds: ['alice'] });
      batch.set(doc(aliceDb, `activities/${actId}/participants/alice`), { uid: 'alice', checkInStatus: 'pending', hasReviewed: false });

      await assertFails(batch.commit());
    }

    // Negative: Place activityCount incremented by +2 blocked
    {
      const batch = writeBatch(aliceDb);
      const actId = 'act_place_wrong_inc';
      const payload = { ...getValidActivity('alice'), placeId: 'place1', isCustomActivity: false };
      
      batch.set(doc(aliceDb, `activities/${actId}`), payload);
      batch.set(doc(aliceDb, `chats/${actId}`), { activityId: actId, hostId: 'alice', participantIds: ['alice'] });
      batch.set(doc(aliceDb, `activities/${actId}/participants/alice`), { uid: 'alice', checkInStatus: 'pending', hasReviewed: false });
      batch.set(doc(aliceDb, 'places/place1'), { 
        activityCount: 3, // Initial was 0, act_place_ok set it to 1. Expected 2, but we write 3.
        lastActivityId: actId
      }, { merge: true });

      await assertFails(batch.commit());
    }

    // 15. Boost & Tokens Tests
    // Positive: Valid creation with boost and exactly 1 token deduction succeeds
    {
      const batch = writeBatch(aliceDb);
      const actId = 'act_boost_ok';
      const payload = { ...getValidActivity('alice'), isBoosted: true, boostedAt: serverTimestamp() };
      
      batch.set(doc(aliceDb, `activities/${actId}`), payload);
      batch.set(doc(aliceDb, `chats/${actId}`), { activityId: actId, hostId: 'alice', participantIds: ['alice'] });
      batch.set(doc(aliceDb, `activities/${actId}/participants/alice`), { uid: 'alice', checkInStatus: 'pending', hasReviewed: false });
      batch.update(doc(aliceDb, 'users/alice'), { tokens: 4 }); // Deduct 1 from 5

      await assertSucceeds(batch.commit());
    }

    // Negative: Boost isBoosted: true without token deduction blocked
    {
      const batch = writeBatch(aliceDb);
      const actId = 'act_boost_no_deduct';
      const payload = { ...getValidActivity('alice'), isBoosted: true, boostedAt: serverTimestamp() };
      
      batch.set(doc(aliceDb, `activities/${actId}`), payload);
      batch.set(doc(aliceDb, `chats/${actId}`), { activityId: actId, hostId: 'alice', participantIds: ['alice'] });
      batch.set(doc(aliceDb, `activities/${actId}/participants/alice`), { uid: 'alice', checkInStatus: 'pending', hasReviewed: false });

      await assertFails(batch.commit());
    }

    // Negative: Boost with wrong token deduction (increment instead of decrement) blocked
    {
      const batch = writeBatch(aliceDb);
      const actId = 'act_boost_wrong_deduct';
      const payload = { ...getValidActivity('alice'), isBoosted: true, boostedAt: serverTimestamp() };
      
      batch.set(doc(aliceDb, `activities/${actId}`), payload);
      batch.set(doc(aliceDb, `chats/${actId}`), { activityId: actId, hostId: 'alice', participantIds: ['alice'] });
      batch.set(doc(aliceDb, `activities/${actId}/participants/alice`), { uid: 'alice', checkInStatus: 'pending', hasReviewed: false });
      batch.update(doc(aliceDb, 'users/alice'), { tokens: 6 }); // Increment instead of decrement

      await assertFails(batch.commit());
    }

    // 16. Boost Match Block /boosts/{boostId} Whitelist
    // Positive: Valid boost document succeeds
    {
      await assertSucceeds(setDoc(doc(aliceDb, 'boosts/boost1'), {
        userId: 'alice',
        entityId: 'act_normal',
        entityType: 'activity',
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 3600 * 1000 * 24),
        boostLevel: 1,
        multiplier: 2.0
      }));
    }
    // Negative: Invalid boost document (extra fields) blocked
    {
      await assertFails(setDoc(doc(aliceDb, 'boosts/boost2'), {
        userId: 'alice',
        entityId: 'act_normal',
        entityType: 'activity',
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 3600 * 1000 * 24),
        boostLevel: 1,
        multiplier: 2.0,
        extraField: 'hack'
      }));
    }

    // 17. Subsequent boost of already created activity
    // Seed unboosted activity
    const seedAct = getValidActivity('alice');
    seedAct.createdAt = new Date() as any;
    seedAct.lastInteractionAt = new Date() as any;
    seedAct.activityDate = new Date(Date.now() + 3600 * 1000) as any;
    await seedDoc('activities/act_to_boost', seedAct);
    await seedDoc('chats/act_to_boost', { activityId: 'act_to_boost', hostId: 'alice', participantIds: ['alice'] });

    // Positive: Host boosts activity subsequently with token deduction succeeds
    {
      const batch = writeBatch(aliceDb);
      batch.update(doc(aliceDb, 'activities/act_to_boost'), {
        isBoosted: true,
        boostedAt: serverTimestamp()
      });
      batch.update(doc(aliceDb, 'users/alice'), { tokens: 3 }); // From 4 to 3
      await assertSucceeds(batch.commit());
    }

    // 18. Host Update Constraints after participants join
    // Seed activity with 2 participants
    const jointAct = getValidActivity('alice');
    jointAct.participantIds = ['alice', 'bob'];
    jointAct.participantsPreview = [{ uid: 'alice' }, { uid: 'bob' }] as any;
    jointAct.maxParticipants = 4;
    jointAct.placeId = 'place1';
    jointAct.placeName = 'Soccer Field';
    jointAct.lat = 48.0;
    jointAct.lon = 11.0;
    await seedDoc('activities/act_joint', jointAct);
    await seedDoc('chats/act_joint', { activityId: 'act_joint', hostId: 'alice', participantIds: ['alice', 'bob'] });

    // Positive: Host updates title (allowed)
    await assertSucceeds(updateDoc(doc(aliceDb, 'activities/act_joint'), { title: 'New title joint' }));

    // Negative: Host updates Ort (blocked)
    await assertFails(updateDoc(doc(aliceDb, 'activities/act_joint'), { placeName: 'New place joint' }));

    // Negative: Host updates Date (blocked)
    await assertFails(updateDoc(doc(aliceDb, 'activities/act_joint'), { activityDate: new Date(Date.now() + 2 * 3600 * 1000) }));

    // Negative: Host lowers maxParticipants below current participant size (blocked)
    await assertFails(updateDoc(doc(aliceDb, 'activities/act_joint'), { maxParticipants: 1 }));

    // Positive: Host cancels activity (allowed status transition)
    await assertSucceeds(updateDoc(doc(aliceDb, 'activities/act_joint'), { status: 'cancelled' }));

    // Negative: Host sets status to completed (blocked)
    await assertFails(updateDoc(doc(aliceDb, 'activities/act_normal'), { status: 'completed' }));

    // Negative: Foreign user bob tries to edit alice's activity (blocked)
    await assertFails(updateDoc(doc(bobDb, 'activities/act_normal'), { title: 'Bob was here' }));
  }

  // ==========================================
  // P. Specific createActivity and joinActivity Flow Tests
  // ==========================================
  {
    console.log('Running Suite P: Specific createActivity and joinActivity Flow Tests...');
    await testEnv.clearFirestore();

    // Seed profiles
    await seedDoc('users/alice', { uid: 'alice', onboardingCompleted: true, isBanned: false, role: 'user' });
    await seedDoc('users/bob', { uid: 'bob', onboardingCompleted: true, isBanned: false, role: 'user' });
    await seedDoc('users/charlie', { uid: 'charlie', onboardingCompleted: false, isBanned: false, role: 'user' });
    await seedDoc('users/banned_user', { uid: 'banned_user', onboardingCompleted: true, isBanned: true, role: 'user' });
    await seedDoc('users/admin_user', { uid: 'admin_user', onboardingCompleted: true, isBanned: false, role: 'admin' });

    const hostId = 'alice';
    const guestId = 'bob';
    const hostDb = testEnv.authenticatedContext(hostId).firestore();
    const guestDb = testEnv.authenticatedContext(guestId).firestore();
    const charlieDb = testEnv.authenticatedContext('charlie').firestore();
    const bannedDb = testEnv.authenticatedContext('banned_user').firestore();
    const adminDb = testEnv.authenticatedContext('admin_user').firestore();

    function getValidActivityPayload(hId: string): any {
      return {
        title: 'Football Match',
        placeName: 'Soccer Field',
        activityDate: new Date(Date.now() + 3600 * 1000), // 1 hour in future
        hostId: hId,
        hostName: 'Host User',
        hostPhotoURL: null,
        participantIds: [hId],
        participantsPreview: [{ uid: hId, displayName: 'Host User', photoURL: null }],
        createdAt: serverTimestamp(),
        lastInteractionAt: serverTimestamp(),
        isCustomActivity: true,
        isTimeFlexible: false,
        category: 'Sport',
        description: 'Friendly match',
        status: 'active',
        completionVotes: [],
        isBoosted: false,
        boostedAt: null,
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
        participantDetails: {
          [hId]: {
            displayName: 'Host User',
            photoURL: null,
            isPremium: false,
            isSupporter: false,
            checkInStatus: 'pending',
            hasReviewed: false
          }
        },
        categories: ['Sport'],
        isUserEvent: true,
        sourceType: 'activity',
        creationSource: 'community',
        joinMode: 'direct'
      };
    }

    // 1. createActivity mit neuem Place success
    console.log('Running test 1: createActivity mit neuem Place success');
    {
      const batch = writeBatch(hostDb);
      const actId = 'act_new_place';
      const activityRef = doc(hostDb, `activities/${actId}`);
      const chatRef = doc(hostDb, `chats/${actId}`);
      const participantRef = doc(hostDb, `activities/${actId}/participants/${hostId}`);
      const placeRef = doc(hostDb, `places/place_new`);

      const actPayload = { ...getValidActivityPayload(hostId), placeId: 'place_new', isCustomActivity: false };
      batch.set(activityRef, actPayload);
      batch.set(chatRef, {
        activityId: actId,
        hostId: hostId,
        createdAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
        participantIds: [hostId],
        lastMessage: null,
        placeName: 'Soccer Field',
        categories: ['Sport'],
        participantDetails: {
          [hostId]: { displayName: 'Host User', photoURL: null, isPremium: false, isSupporter: false, checkInStatus: 'pending' }
        },
        unreadCount: { [hostId]: 0 }
      });
      batch.set(participantRef, {
        uid: hostId,
        displayName: 'Host User',
        photoURL: null,
        checkInStatus: 'pending',
        joinedAt: serverTimestamp(),
        hasReviewed: false
      });
      batch.set(placeRef, {
        name: 'Soccer Field',
        address: 'Bielefeld',
        lat: 52.0,
        lon: 8.5,
        categories: ['Sport'],
        source: 'google',
        sourceType: 'place',
        activityCount: 1,
        lastActivityId: actId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false,
        isBlacklisted: false
      });

      await assertSucceeds(batch.commit());
    }

    // 2. createActivity mit vorhandenem Place success
    console.log('Running test 2: createActivity mit vorhandenem Place success');
    {
      await seedDoc('places/place_exist', {
        name: 'Soccer Field',
        address: 'Bielefeld',
        lat: 52.0,
        lon: 8.5,
        categories: ['Sport'],
        source: 'google',
        sourceType: 'place',
        activityCount: 0,
        lastActivityId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
        isBlacklisted: false
      });

      const batch = writeBatch(hostDb);
      const actId = 'act_exist_place';
      const activityRef = doc(hostDb, `activities/${actId}`);
      const chatRef = doc(hostDb, `chats/${actId}`);
      const participantRef = doc(hostDb, `activities/${actId}/participants/${hostId}`);
      const placeRef = doc(hostDb, `places/place_exist`);

      const actPayload = { ...getValidActivityPayload(hostId), placeId: 'place_exist', isCustomActivity: false };
      batch.set(activityRef, actPayload);
      batch.set(chatRef, {
        activityId: actId,
        hostId: hostId,
        createdAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
        participantIds: [hostId],
        lastMessage: null,
        placeName: 'Soccer Field',
        categories: ['Sport'],
        participantDetails: {
          [hostId]: { displayName: 'Host User', photoURL: null, isPremium: false, isSupporter: false, checkInStatus: 'pending' }
        },
        unreadCount: { [hostId]: 0 }
      });
      batch.set(participantRef, {
        uid: hostId,
        displayName: 'Host User',
        photoURL: null,
        checkInStatus: 'pending',
        joinedAt: serverTimestamp(),
        hasReviewed: false
      });
      batch.update(placeRef, {
        activityCount: 1,
        lastActivityId: actId,
        updatedAt: serverTimestamp()
      });

      await assertSucceeds(batch.commit());
    }

    // 3. createActivity blockiert, wenn Place isDeleted true
    console.log('Running test 3: createActivity blockiert, wenn Place isDeleted true');
    {
      await seedDoc('places/place_deleted', {
        name: 'Soccer Field',
        address: 'Bielefeld',
        lat: 52.0,
        lon: 8.5,
        categories: ['Sport'],
        source: 'google',
        sourceType: 'place',
        activityCount: 0,
        lastActivityId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: true,
        isBlacklisted: false
      });

      const batch = writeBatch(hostDb);
      const actId = 'act_deleted_place';
      const activityRef = doc(hostDb, `activities/${actId}`);
      const chatRef = doc(hostDb, `chats/${actId}`);
      const participantRef = doc(hostDb, `activities/${actId}/participants/${hostId}`);
      const placeRef = doc(hostDb, `places/place_deleted`);

      const actPayload = { ...getValidActivityPayload(hostId), placeId: 'place_deleted', isCustomActivity: false };
      batch.set(activityRef, actPayload);
      batch.set(chatRef, {
        activityId: actId,
        hostId: hostId,
        createdAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
        participantIds: [hostId],
        lastMessage: null,
        placeName: 'Soccer Field',
        categories: ['Sport'],
        participantDetails: {
          [hostId]: { displayName: 'Host User', photoURL: null, isPremium: false, isSupporter: false, checkInStatus: 'pending' }
        },
        unreadCount: { [hostId]: 0 }
      });
      batch.set(participantRef, {
        uid: hostId,
        displayName: 'Host User',
        photoURL: null,
        checkInStatus: 'pending',
        joinedAt: serverTimestamp(),
        hasReviewed: false
      });
      batch.update(placeRef, {
        activityCount: 1,
        lastActivityId: actId,
        updatedAt: serverTimestamp()
      });

      await assertFails(batch.commit());
    }

    // 4. createActivity blockiert, wenn Place isBlacklisted true
    console.log('Running test 4: createActivity blockiert, wenn Place isBlacklisted true');
    {
      await seedDoc('places/place_blacklisted', {
        name: 'Soccer Field',
        address: 'Bielefeld',
        lat: 52.0,
        lon: 8.5,
        categories: ['Sport'],
        source: 'google',
        sourceType: 'place',
        activityCount: 0,
        lastActivityId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
        isBlacklisted: true
      });

      const batch = writeBatch(hostDb);
      const actId = 'act_black_place';
      const activityRef = doc(hostDb, `activities/${actId}`);
      const chatRef = doc(hostDb, `chats/${actId}`);
      const participantRef = doc(hostDb, `activities/${actId}/participants/${hostId}`);
      const placeRef = doc(hostDb, `places/place_blacklisted`);

      const actPayload = { ...getValidActivityPayload(hostId), placeId: 'place_blacklisted', isCustomActivity: false };
      batch.set(activityRef, actPayload);
      batch.set(chatRef, {
        activityId: actId,
        hostId: hostId,
        createdAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
        participantIds: [hostId],
        lastMessage: null,
        placeName: 'Soccer Field',
        categories: ['Sport'],
        participantDetails: {
          [hostId]: { displayName: 'Host User', photoURL: null, isPremium: false, isSupporter: false, checkInStatus: 'pending' }
        },
        unreadCount: { [hostId]: 0 }
      });
      batch.set(participantRef, {
        uid: hostId,
        displayName: 'Host User',
        photoURL: null,
        checkInStatus: 'pending',
        joinedAt: serverTimestamp(),
        hasReviewed: false
      });
      batch.update(placeRef, {
        activityCount: 1,
        lastActivityId: actId,
        updatedAt: serverTimestamp()
      });

      await assertFails(batch.commit());
    }

    // 5. joinActivity success
    console.log('Running test 5: joinActivity success');
    {
      await seedDoc('activities/act_joinable', getValidActivityPayload(hostId));
      await seedDoc('chats/act_joinable', {
        activityId: 'act_joinable',
        hostId: hostId,
        createdAt: new Date(),
        lastActivityAt: new Date(),
        participantIds: [hostId],
        participantDetails: {
          [hostId]: { displayName: 'Host User', photoURL: null, isPremium: false, isSupporter: false, checkInStatus: 'pending' }
        },
        unreadCount: { [hostId]: 0 }
      });
      await seedDoc(`activities/act_joinable/participants/${hostId}`, {
        uid: hostId,
        displayName: 'Host User',
        photoURL: null,
        checkInStatus: 'pending',
        joinedAt: new Date(),
        hasReviewed: false
      });

      const batch = writeBatch(guestDb);
      const activityRef = doc(guestDb, 'activities/act_joinable');
      const chatRef = doc(guestDb, 'chats/act_joinable');
      const participantRef = doc(guestDb, 'activities/act_joinable/participants/bob');

      batch.update(activityRef, {
        participantIds: arrayUnion(guestId),
        lastInteractionAt: serverTimestamp(),
        [`participantDetails.${guestId}`]: {
          displayName: 'Bob User',
          photoURL: null,
          isPremium: false,
          isSupporter: false,
          checkInStatus: 'pending',
          hasReviewed: false
        }
      });
      batch.set(participantRef, {
        uid: guestId,
        displayName: 'Bob User',
        photoURL: null,
        checkInStatus: 'pending',
        joinedAt: serverTimestamp(),
        hasReviewed: false
      });
      batch.update(chatRef, {
        participantIds: arrayUnion(guestId),
        [`participantDetails.${guestId}`]: {
          displayName: 'Bob User',
          photoURL: null,
          isPremium: false,
          isSupporter: false,
          checkInStatus: 'pending'
        },
        [`unreadCount.${guestId}`]: 0
      });

      await assertSucceeds(batch.commit());
    }

    // 6. joinActivity blockiert, wenn User nicht onboarded
    console.log('Running test 6: joinActivity blockiert, wenn User nicht onboarded');
    {
      const batch = writeBatch(charlieDb);
      const activityRef = doc(charlieDb, 'activities/act_joinable');
      const chatRef = doc(charlieDb, 'chats/act_joinable');
      const participantRef = doc(charlieDb, 'activities/act_joinable/participants/charlie');

      batch.update(activityRef, {
        participantIds: arrayUnion('charlie'),
        lastInteractionAt: serverTimestamp(),
        [`participantDetails.charlie`]: {
          displayName: 'Charlie User',
          photoURL: null,
          isPremium: false,
          isSupporter: false,
          checkInStatus: 'pending',
          hasReviewed: false
        }
      });
      batch.set(participantRef, {
        uid: 'charlie',
        displayName: 'Charlie User',
        photoURL: null,
        checkInStatus: 'pending',
        joinedAt: serverTimestamp(),
        hasReviewed: false
      });
      batch.update(chatRef, {
        participantIds: arrayUnion('charlie'),
        [`participantDetails.charlie`]: {
          displayName: 'Charlie User',
          photoURL: null,
          isPremium: false,
          isSupporter: false,
          checkInStatus: 'pending'
        },
        [`unreadCount.charlie`]: 0
      });

      await assertFails(batch.commit());
    }

    // 7. joinActivity blockiert, wenn banned
    console.log('Running test 7: joinActivity blockiert, wenn banned');
    {
      const batch = writeBatch(bannedDb);
      const activityRef = doc(bannedDb, 'activities/act_joinable');
      const chatRef = doc(bannedDb, 'chats/act_joinable');
      const participantRef = doc(bannedDb, 'activities/act_joinable/participants/banned_user');

      batch.update(activityRef, {
        participantIds: arrayUnion('banned_user'),
        lastInteractionAt: serverTimestamp(),
        [`participantDetails.banned_user`]: {
          displayName: 'Banned User',
          photoURL: null,
          isPremium: false,
          isSupporter: false,
          checkInStatus: 'pending',
          hasReviewed: false
        }
      });
      batch.set(participantRef, {
        uid: 'banned_user',
        displayName: 'Banned User',
        photoURL: null,
        checkInStatus: 'pending',
        joinedAt: serverTimestamp(),
        hasReviewed: false
      });
      batch.update(chatRef, {
        participantIds: arrayUnion('banned_user'),
        [`participantDetails.banned_user`]: {
          displayName: 'Banned User',
          photoURL: null,
          isPremium: false,
          isSupporter: false,
          checkInStatus: 'pending'
        },
        [`unreadCount.banned_user`]: 0
      });

      await assertFails(batch.commit());
    }

    // 8. joinActivity blockiert, wenn joinMode request
    console.log('Running test 8: joinActivity blockiert, wenn joinMode request');
    {
      const reqAct = { ...getValidActivityPayload(hostId), joinMode: 'request' };
      await seedDoc('activities/act_request_only', reqAct);
      await seedDoc('chats/act_request_only', {
        activityId: 'act_request_only',
        hostId: hostId,
        createdAt: new Date(),
        lastActivityAt: new Date(),
        participantIds: [hostId],
        participantDetails: {
          [hostId]: { displayName: 'Host User', photoURL: null, isPremium: false, isSupporter: false, checkInStatus: 'pending' }
        },
        unreadCount: { [hostId]: 0 }
      });
      await seedDoc(`activities/act_request_only/participants/${hostId}`, {
        uid: hostId,
        displayName: 'Host User',
        photoURL: null,
        checkInStatus: 'pending',
        joinedAt: new Date(),
        hasReviewed: false
      });

      const batch = writeBatch(guestDb);
      const activityRef = doc(guestDb, 'activities/act_request_only');
      const chatRef = doc(guestDb, 'chats/act_request_only');
      const participantRef = doc(guestDb, 'activities/act_request_only/participants/bob');

      batch.update(activityRef, {
        participantIds: arrayUnion(guestId),
        lastInteractionAt: serverTimestamp(),
        [`participantDetails.${guestId}`]: {
          displayName: 'Bob User',
          photoURL: null,
          isPremium: false,
          isSupporter: false,
          checkInStatus: 'pending',
          hasReviewed: false
        }
      });
      batch.set(participantRef, {
        uid: guestId,
        displayName: 'Bob User',
        photoURL: null,
        checkInStatus: 'pending',
        joinedAt: serverTimestamp(),
        hasReviewed: false
      });
      batch.update(chatRef, {
        participantIds: arrayUnion(guestId),
        [`participantDetails.${guestId}`]: {
          displayName: 'Bob User',
          photoURL: null,
          isPremium: false,
          isSupporter: false,
          checkInStatus: 'pending'
        },
        [`unreadCount.${guestId}`]: 0
      });

      await assertFails(batch.commit());
    }

    // 9. joinActivity blockiert, wenn full
    console.log('Running test 9: joinActivity blockiert, wenn full');
    {
      const fullAct = { ...getValidActivityPayload(hostId), maxParticipants: 1 };
      await seedDoc('activities/act_full_only', fullAct);
      await seedDoc('chats/act_full_only', {
        activityId: 'act_full_only',
        hostId: hostId,
        createdAt: new Date(),
        lastActivityAt: new Date(),
        participantIds: [hostId],
        participantDetails: {
          [hostId]: { displayName: 'Host User', photoURL: null, isPremium: false, isSupporter: false, checkInStatus: 'pending' }
        },
        unreadCount: { [hostId]: 0 }
      });
      await seedDoc(`activities/act_full_only/participants/${hostId}`, {
        uid: hostId,
        displayName: 'Host User',
        photoURL: null,
        checkInStatus: 'pending',
        joinedAt: new Date(),
        hasReviewed: false
      });

      const batch = writeBatch(guestDb);
      const activityRef = doc(guestDb, 'activities/act_full_only');
      const chatRef = doc(guestDb, 'chats/act_full_only');
      const participantRef = doc(guestDb, 'activities/act_full_only/participants/bob');

      batch.update(activityRef, {
        participantIds: arrayUnion(guestId),
        lastInteractionAt: serverTimestamp(),
        [`participantDetails.${guestId}`]: {
          displayName: 'Bob User',
          photoURL: null,
          isPremium: false,
          isSupporter: false,
          checkInStatus: 'pending',
          hasReviewed: false
        }
      });
      batch.set(participantRef, {
        uid: guestId,
        displayName: 'Bob User',
        photoURL: null,
        checkInStatus: 'pending',
        joinedAt: serverTimestamp(),
        hasReviewed: false
      });
      batch.update(chatRef, {
        participantIds: arrayUnion(guestId),
        [`participantDetails.${guestId}`]: {
          displayName: 'Bob User',
          photoURL: null,
          isPremium: false,
          isSupporter: false,
          checkInStatus: 'pending'
        },
        [`unreadCount.${guestId}`]: 0
      });

      await assertFails(batch.commit());
    }

    // 10. host cancel success
    console.log('Running test 10: host cancel success');
    {
      await seedDoc('activities/act_cancelable', getValidActivityPayload(hostId));

      const activityRef = doc(hostDb, 'activities/act_cancelable');
      await assertSucceeds(updateDoc(activityRef, {
        status: 'cancelled',
        cancelledBy: hostId,
        cancelledAt: serverTimestamp()
      }));
    }

    // 11. host hard delete denied
    console.log('Running test 11: host hard delete denied');
    {
      const activityRef = doc(hostDb, 'activities/act_cancelable');
      await assertFails(deleteDoc(activityRef));
    }

    // 12. admin hard delete success
    console.log('Running test 12: admin hard delete success');
    {
      const activityRef = doc(adminDb, 'activities/act_cancelable');
      await assertSucceeds(deleteDoc(activityRef));
    }
  }

  console.log('🎉 ALL SECURITY RULES TESTS PASSED SUCCESSFULLY! 🎉');
  
  // Cleanup
  await testEnv.cleanup();
}

runTests().catch(err => {
  console.error('Security rules tests failed execution:', err);
  process.exit(1);
});
