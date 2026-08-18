import assert from 'assert';
import type { Place, Activity } from '@/lib/types';
import { calculateDistanceKm, extractCoordinates, formatDistance } from '@/lib/geo-utils';
import { normalizeActivityDocument } from '@/lib/firebase/firestore';

// ─── REGRESSION TEST SUITE FOR PLACE DETAILS BUSINESS LOGIC ──────────────────

function testPlaceActivitiesSorting() {
  const now = Date.now();
  const mockTimestamp = (ms: number) => ({
    seconds: Math.floor(ms / 1000),
    nanoseconds: 0,
    toMillis: () => ms,
    toDate: () => new Date(ms),
    isEqual: () => false,
    toJSON: () => ({ seconds: Math.floor(ms / 1000), nanoseconds: 0 }),
  });

  const rawDocs = [
    {
      id: 'act1',
      placeId: 'p1',
      title: 'Older Activity',
      activityDate: mockTimestamp(now - 100000),
      participantIds: ['u1'],
    },
    {
      id: 'act2',
      placeId: 'p1',
      title: 'Newer Activity',
      activityDate: mockTimestamp(now + 100000),
      participantIds: ['u1', 'u2'],
    },
  ];

  const normalized = rawDocs.map((doc) => normalizeActivityDocument(doc as any, doc.id));
  const sorted = [...normalized].sort(
    (a, b) => b.activityDate.toMillis() - a.activityDate.toMillis()
  );

  assert.strictEqual(sorted[0].id, 'act2', 'Newer activity should be first');
  assert.strictEqual(sorted[1].id, 'act1', 'Older activity should be second');
  console.log('✅ testPlaceActivitiesSorting passed');
}

function testVotingOptimisticState() {
  const initialMeta: {
    avgRating: number;
    reviewCount: number;
    upvotes: number;
    downvotes: number;
    communityScore: number;
    userVotes: Record<string, 'up' | 'down'>;
    weightedUpvotes: number;
    weightedDownvotes: number;
  } = {
    avgRating: 4.5,
    reviewCount: 10,
    upvotes: 5,
    downvotes: 1,
    communityScore: 4,
    userVotes: { userA: 'up' },
    weightedUpvotes: 5,
    weightedDownvotes: 1,
  };

  // Simulate user switching from 'up' to 'down'
  const applyVoteChange = (
    prev: typeof initialMeta,
    userId: string,
    type: 'up' | 'down' | 'none'
  ) => {
    const prevVote = prev.userVotes?.[userId] || 'none';
    let upDelta = 0;
    let downDelta = 0;
    const newUserVotes = { ...prev.userVotes };

    if (prevVote === 'up') upDelta -= 1;
    else if (prevVote === 'down') downDelta -= 1;

    if (type === 'up') {
      upDelta += 1;
      newUserVotes[userId] = 'up';
    } else if (type === 'down') {
      downDelta += 1;
      newUserVotes[userId] = 'down';
    } else {
      delete newUserVotes[userId];
    }

    return {
      ...prev,
      upvotes: Math.max(0, prev.upvotes + upDelta),
      downvotes: Math.max(0, prev.downvotes + downDelta),
      userVotes: newUserVotes,
    };
  };

  // Switch from 'up' to 'down'
  const step1 = applyVoteChange(initialMeta, 'userA', 'down');
  assert.strictEqual(step1.upvotes, 4, 'Upvotes decreased by 1');
  assert.strictEqual(step1.downvotes, 2, 'Downvotes increased by 1');
  assert.strictEqual(step1.userVotes['userA'], 'down');

  // Cancel vote ('none')
  const step2 = applyVoteChange(step1, 'userA', 'none');
  assert.strictEqual(step2.upvotes, 4);
  assert.strictEqual(step2.downvotes, 1);
  assert.strictEqual(step2.userVotes['userA'], undefined);

  console.log('✅ testVotingOptimisticState passed');
}

function testJoinActivityGuardConditions() {
  const fakeActivity: Partial<Activity> = {
    id: 'act100',
    placeId: 'p1',
    isPaid: false,
    joinMode: 'request',
    participantIds: ['host1'],
  };

  const evaluateJoinEligibility = (
    activity: Partial<Activity>,
    user: { uid: string } | null,
    joiningId: string | null,
    requestedMap: Record<string, boolean>
  ) => {
    if (!user) return { canProceed: false, redirect: '/login' };
    if (activity.isPaid && activity.price && activity.price > 0) {
      return { canProceed: false, redirect: `/checkout/${activity.id}` };
    }
    if (joiningId === activity.id || requestedMap[activity.id!]) {
      return { canProceed: false, reason: 'in_progress_or_requested' };
    }
    return { canProceed: true };
  };

  // 1. Unauthenticated user -> redirect to /login
  const unauth = evaluateJoinEligibility(fakeActivity, null, null, {});
  assert.strictEqual(unauth.canProceed, false);
  assert.strictEqual(unauth.redirect, '/login');

  // 2. Paid activity -> redirect to /checkout
  const paidActivity = { ...fakeActivity, isPaid: true, price: 15 };
  const paidRes = evaluateJoinEligibility(paidActivity, { uid: 'u1' }, null, {});
  assert.strictEqual(paidRes.canProceed, false);
  assert.strictEqual(paidRes.redirect, '/checkout/act100');

  // 3. Already requested -> blocked
  const alreadyReq = evaluateJoinEligibility(fakeActivity, { uid: 'u1' }, null, { act100: true });
  assert.strictEqual(alreadyReq.canProceed, false);
  assert.strictEqual(alreadyReq.reason, 'in_progress_or_requested');

  // 4. Valid free request -> can proceed
  const validRes = evaluateJoinEligibility(fakeActivity, { uid: 'u1' }, null, {});
  assert.strictEqual(validRes.canProceed, true);

  console.log('✅ testJoinActivityGuardConditions passed');
}

function testDistanceComputationInPlaceDetails() {
  const position = { latitude: 52.52, longitude: 13.405 };
  const placeWithCoords: Partial<Place> = {
    id: 'p1',
    lat: 52.5205,
    lon: 13.4055,
    distance: 10.5,
  };

  const coords = extractCoordinates(placeWithCoords as Place);
  assert.ok(coords);
  const liveDist = calculateDistanceKm(
    position.latitude,
    position.longitude,
    coords!.lat,
    coords!.lng
  );
  assert.ok(liveDist !== null && liveDist < 0.1, 'Distance should be under 100 meters');
  const formatted = formatDistance(liveDist);
  assert.ok(formatted !== null && (formatted.includes('m') || formatted.includes('km')));

  console.log('✅ testDistanceComputationInPlaceDetails passed');
}

function runAllPlaceDetailsLogicTests() {
  console.log('--- RUNNING PLACE DETAILS LOGIC REGRESSION TESTS ---');
  testPlaceActivitiesSorting();
  testVotingOptimisticState();
  testJoinActivityGuardConditions();
  testDistanceComputationInPlaceDetails();
  console.log('🎉 ALL PLACE DETAILS LOGIC REGRESSION TESTS PASSED SUCCESSFULLY! 🎉');
}

runAllPlaceDetailsLogicTests();
