import { orchestrateFeedPipeline } from '../feed-engine';
import { applyPremiumFeedFilters, isOpenNow } from '../feed-filters';
import type { Place, UserProfile } from '@/lib/types';
import type { UserLocation } from '../feed-types';
import assert from 'node:assert';

console.log('--- RUNNING AKTIVA FEED ENGINE GOLDEN MASTER TESTS ---');

const mockUserLocation: UserLocation = {
  lat: 52.5200,
  lng: 13.4050,
};

const mockUserProfile: UserProfile = {
  uid: 'test-user-123',
  displayName: 'Test User',
  email: 'test@example.com',
  photoURL: null,
  likedTags: [],
  dislikedTags: [],
  onboardingCompleted: true,
  isPremium: true,
  role: 'user',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockPlaces: Place[] = [
  {
    id: 'place_zoo',
    name: 'Berlin Zoo',
    address: 'Hardenbergplatz 8, 10787 Berlin',
    categories: ['entertainment.zoo', 'outdoor'],
    lat: 52.5079,
    lon: 13.3377,
    rating: 4.8,
    openingHours: 'Mo-Su 09:00-18:00',
  },
  {
    id: 'place_museum',
    name: 'Deutsches Historisches Museum',
    address: 'Unter den Linden 2, 10117 Berlin',
    categories: ['tourism.sights', 'entertainment.museum'],
    lat: 52.5178,
    lon: 13.3970,
    rating: 4.6,
    openingHours: 'Mo-Su 10:00-18:00',
  },
  {
    id: 'place_park',
    name: 'Tiergarten Park',
    address: 'Str. des 17. Juni, 10557 Berlin',
    categories: ['leisure.park', 'outdoor'],
    lat: 52.5145,
    lon: 13.3501,
    rating: 4.7,
    openingHours: '24/7',
  },
  {
    id: 'place_club',
    name: 'Nightclub Pulse',
    address: 'Friedrichstraße 100',
    categories: ['adult.nightclub', 'entertainment'],
    lat: 52.5200,
    lon: 13.3870,
    rating: 4.1,
    openingHours: 'Fr-Sa 23:00-06:00',
  },
];

const mockVotesMap = {
  place_zoo: { upvotes: 15, downvotes: 1, weightedUpvotes: 15, weightedDownvotes: 1, voteBoostScore: 14 },
  place_museum: { upvotes: 5, downvotes: 0, weightedUpvotes: 5, weightedDownvotes: 0, voteBoostScore: 5 },
  place_park: { upvotes: 20, downvotes: 0, weightedUpvotes: 20, weightedDownvotes: 0, voteBoostScore: 20 },
  place_club: { upvotes: 2, downvotes: 8, weightedUpvotes: 2, weightedDownvotes: 8, voteBoostScore: -6 },
};

function testGoldenMasterFeedRanking() {
  console.log('Running testGoldenMasterFeedRanking (Exact ID Ordering & Score Preservation)...');
  const result = orchestrateFeedPipeline({
    basePlaces: mockPlaces,
    votesMap: mockVotesMap,
    userProfile: mockUserProfile,
    userLocation: mockUserLocation,
    sessionEpoch: 100,
    enableNewRankingPipeline: true,
  });

  assert(Array.isArray(result), 'Result should be an array');
  assert.strictEqual(result.length, 4, 'All 4 mock places should be returned');
  
  const ids = result.map(p => p.id);
  // High-tier category (zoo: tier 1 score 80 + upvotes) ranks first
  const expectedOrder = ['place_zoo', 'place_park', 'place_club', 'place_museum'];
  assert.deepStrictEqual(ids, expectedOrder, `Order must match pre-extraction behavior exact sequence. Expected ${expectedOrder.join(', ')}, got ${ids.join(', ')}`);

  // Verify vote metadata attached correctly
  assert.strictEqual(result[0].upvotes, 15);
  assert.strictEqual(result[0].voteBoostScore, 14);

  console.log('✅ testGoldenMasterFeedRanking passed');
}

function testGoldenMasterLegacyPipelineFallback() {
  console.log('Running testGoldenMasterLegacyPipelineFallback (ENABLE_NEW_RANKING_PIPELINE = false)...');
  const result = orchestrateFeedPipeline({
    basePlaces: mockPlaces,
    votesMap: mockVotesMap,
    userProfile: mockUserProfile,
    userLocation: mockUserLocation,
    sessionEpoch: 100,
    enableNewRankingPipeline: false,
  });

  assert.strictEqual(result.length, 4, 'All 4 places returned under legacy fallback');
  assert(typeof result[0].relevanceScore === 'number', 'relevanceScore must be calculated');
  console.log('✅ testGoldenMasterLegacyPipelineFallback passed');
}

function testGoldenMasterPremiumOutdoorFilter() {
  console.log('Running testGoldenMasterPremiumOutdoorFilter...');
  const result = orchestrateFeedPipeline({
    basePlaces: mockPlaces,
    votesMap: mockVotesMap,
    userProfile: mockUserProfile,
    userLocation: mockUserLocation,
    sessionEpoch: 100,
    activePremiumFilters: ['outdoor_only'],
    enableNewRankingPipeline: true,
  });

  assert.strictEqual(result.length, 2, 'Only outdoor places (zoo and park) should pass outdoor_only filter');
  assert.deepStrictEqual(result.map(p => p.id), ['place_zoo', 'place_park']);
  console.log('✅ testGoldenMasterPremiumOutdoorFilter passed');
}

function testGoldenMasterPremiumQuietPlacesFilter() {
  console.log('Running testGoldenMasterPremiumQuietPlacesFilter...');
  const result = orchestrateFeedPipeline({
    basePlaces: mockPlaces,
    votesMap: mockVotesMap,
    userProfile: mockUserProfile,
    userLocation: mockUserLocation,
    sessionEpoch: 100,
    activePremiumFilters: ['quiet_places'],
    enableNewRankingPipeline: true,
  });

  // Nightclub, Zoo and Museum (entertainment) filtered out by quiet_places -> place_park remains
  assert.strictEqual(result.length, 1);
  assert.deepStrictEqual(result.map(p => p.id), ['place_park']);
  console.log('✅ testGoldenMasterPremiumQuietPlacesFilter passed');
}

function testIsOpenNowHelper() {
  console.log('Running testIsOpenNowHelper...');
  assert.strictEqual(isOpenNow('24/7'), true, '24/7 should return true');
  assert.strictEqual(isOpenNow(null), false, 'null should return false');
  console.log('✅ testIsOpenNowHelper passed');
}

testGoldenMasterFeedRanking();
testGoldenMasterLegacyPipelineFallback();
testGoldenMasterPremiumOutdoorFilter();
testGoldenMasterPremiumQuietPlacesFilter();
testIsOpenNowHelper();

console.log('🎉 ALL FEED ENGINE GOLDEN MASTER TESTS PASSED! 🎉');
