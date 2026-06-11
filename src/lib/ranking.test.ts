import assert from 'assert';
import {
  computeBasePrior,
  computeDistanceDecay,
  computePersonalizationMultiplier,
  computeCommunityScore,
  applyCategoryDiversityRerank,
  applyDeterministicJitter,
  applyTieBreaker,
  calculateMedianDistanceToNearestK,
  calculateRelevance,
  applyDiversityShift
} from './ranking';

console.log('--- RUNNING AKTIVA RECOMMENDATION PIPELINE TESTS ---');

// 1. Test base prior scoring
function testBasePrior() {
  console.log('Running testBasePrior...');
  assert.strictEqual(computeBasePrior(['entertainment.zoo']), 80);
  assert.strictEqual(computeBasePrior(['entertainment.cinema']), 80);
  assert.strictEqual(computeBasePrior(['entertainment.bowling_alley']), 72);
  assert.strictEqual(computeBasePrior(['leisure.spa']), 72);
  assert.strictEqual(computeBasePrior(['tourism.attraction']), 50);
  assert.strictEqual(computeBasePrior(['unknown.category']), 50);
  console.log('✅ testBasePrior passed');
}

// 2. Test Rational Quadratic tail behavior
function testRationalQuadraticDecay() {
  console.log('Running testRationalQuadraticDecay...');
  const decayClose = computeDistanceDecay(0.5, 5.0); // 500m in 5km density
  const decayFar = computeDistanceDecay(25.0, 5.0); // 25km in 5km density
  
  assert.ok(decayClose > 0.99, 'Decay close to home should be very high');
  assert.ok(decayFar < 0.2, 'Decay far away should be low');
  
  // Rational Quadratic tail: D(x) = 1 / (1 + 0.5 * (x / 5)^2)
  // At 25km, D(25) = 1 / (1 + 0.5 * (5)^2) = 1 / (1 + 12.5) = 1 / 13.5 = ~0.074
  assert.ok(decayFar > 0.05, 'Rational quadratic should have heavy tail (not zero out completely)');
  console.log('✅ testRationalQuadraticDecay passed');
}

// 3. Test Personalization soft limit [0.85, 1.15]
function testPersonalization() {
  console.log('Running testPersonalization...');
  const profile = {
    likedTags: ['zoo', 'theme_park'],
    dislikedTags: ['cinema'],
    tinderInterests: ['Sport']
  };

  const multLikes = computePersonalizationMultiplier(['entertainment.zoo'], profile);
  const multDislikes = computePersonalizationMultiplier(['entertainment.cinema'], profile);
  const multNeutral = computePersonalizationMultiplier(['unknown'], profile);

  assert.ok(multLikes > 1.0, 'Matches likes should boost score');
  assert.ok(multLikes <= 1.15, 'Match likes should not exceed 1.15');
  assert.ok(multDislikes < 1.0, 'Matches dislikes should penalize score');
  assert.ok(multDislikes >= 0.85, 'Matches dislikes should not fall below 0.85');
  assert.strictEqual(multNeutral, 1.0, 'Neutral categories should have multiplier of 1.0');
  console.log('✅ testPersonalization passed');
}

// 4. Test Bayesian Community score
function testCommunityScore() {
  console.log('Running testCommunityScore...');
  const scoreNew = computeCommunityScore(0, 0); // 0 up, 0 down
  const scoreOneUp = computeCommunityScore(1, 0); // 1 up, 0 down
  const scoreManyUp = computeCommunityScore(50, 0); // 50 up, 0 down
  const scoreManyDown = computeCommunityScore(0, 50); // 0 up, 50 down

  assert.strictEqual(scoreNew, 0.75, 'New spot should default to mu = 0.75');
  assert.ok(scoreOneUp > 0.75 && scoreOneUp < 0.8, '1 upvote should only slightly boost score due to regularizer C=5');
  assert.ok(scoreManyUp > 0.9, 'Many upvotes should approach 1.0');
  assert.ok(scoreManyDown < 0.2, 'Many downvotes should approach 0.0');
  console.log('✅ testCommunityScore passed');
}

// 5. Test sparse region fallback for density
function testSparseRegionFallback() {
  console.log('Running testSparseRegionFallback...');
  const places = [
    { distance: 1.0 },
    { distance: 2.0 }
  ];
  const sigma = calculateMedianDistanceToNearestK(places, { lat: 0, lng: 0 }, 30);
  assert.strictEqual(sigma, 5.0, 'If fewer than 30 spots, fallback should be 5km');
  console.log('✅ testSparseRegionFallback passed');
}

// 6. Test deterministic jitter stability
function testDeterministicJitter() {
  console.log('Running testDeterministicJitter...');
  const userId = 'user_123';
  const placeId = 'place_456';
  const epoch = 1779774620000;

  const jitter1 = applyDeterministicJitter(userId, placeId, epoch);
  const jitter2 = applyDeterministicJitter(userId, placeId, epoch);
  const jitterOtherDay = applyDeterministicJitter(userId, placeId, epoch + 86400000);

  assert.strictEqual(jitter1, jitter2, 'Jitter with same inputs must be absolutely identical');
  assert.notStrictEqual(jitter1, jitterOtherDay, 'Jitter on another day should be different');
  assert.ok(jitter1 >= 0.985 && jitter1 <= 1.015, 'Jitter variance must be within +/- 1.5%');
  console.log('✅ testDeterministicJitter passed');
}

// 7. Test tie-breaker determinism
function testTieBreaker() {
  console.log('Running testTieBreaker...');
  const a = { id: 'place_a', distance: 5.0, scores: { communityQuality: 0.8 } };
  const b = { id: 'place_b', distance: 5.0, scores: { communityQuality: 0.8 } };

  const result = applyTieBreaker(a, b);
  assert.ok(result < 0, 'place_a should lexicographically precede place_b');
  console.log('✅ testTieBreaker passed');
}

// 8. Test category damping correctness & pos-damping
function testCategoryDamping() {
  console.log('Running testCategoryDamping...');
  const candidates = [
    { id: '1', categories: ['entertainment.cinema'], relevanceScore: 80, scores: {} },
    { id: '2', categories: ['entertainment.cinema'], relevanceScore: 78, scores: {} },
    { id: '3', categories: ['entertainment.cinema'], relevanceScore: 76, scores: {} }
  ];

  const reranked = applyCategoryDiversityRerank(candidates, 0.70, 0.15);
  assert.strictEqual(reranked[0].id, '1', 'First selected should be the top-relevance cinema');
  assert.ok(reranked[1].scores.diversityPenalty < 1.0, 'Second cinema should receive a category penalty');
  console.log('✅ testCategoryDamping passed');
}

// 9. Test Category-specific Sigma Scaling
function testCategorySpecificSigma() {
  console.log('Running testCategorySpecificSigma...');
  const userLoc = { lat: 52.5200, lng: 13.4050 };

  const premiumPlace = {
    id: 'premium_zoo',
    categories: ['entertainment.zoo'],
    distance: 3.0,
    lat: 52.5200,
    lon: 13.4500,
    upvotes: 0,
    downvotes: 0
  };

  const localPlace = {
    id: 'local_cafe',
    categories: ['catering.cafe'],
    distance: 3.0,
    lat: 52.5200,
    lon: 13.4500,
    upvotes: 0,
    downvotes: 0
  };

  const scorePremium = calculateRelevance(premiumPlace, null, userLoc);
  const scoreLocal = calculateRelevance(localPlace, null, userLoc);

  assert.ok(scorePremium > 65.0, `Premium zoo at 3km should have a high score (got ${scorePremium})`);
  assert.ok(scoreLocal < 35.0, `Local cafe at 3km should have a low score (got ${scoreLocal})`);
  console.log('✅ testCategorySpecificSigma passed');
}

// 10. Test Diversity Shift (consecutive penalty)
function testDiversityShift() {
  console.log('Running testDiversityShift...');
  
  const candidates = [
    { id: 'cinema_a', categories: ['entertainment.cinema'], relevanceScore: 90, scores: {} },
    { id: 'cinema_b', categories: ['entertainment.cinema'], relevanceScore: 88, scores: {} },
    { id: 'zoo_a', categories: ['entertainment.zoo'], relevanceScore: 85, scores: {} }
  ];

  const reranked = applyDiversityShift(candidates, 0.95);
  
  assert.strictEqual(reranked[0].id, 'cinema_a', 'cinema_a should be placed first');
  assert.strictEqual(reranked[1].id, 'zoo_a', 'zoo_a should be shifted to second place to break consecutive category sequence');
  assert.strictEqual(reranked[2].id, 'cinema_b', 'cinema_b should be shifted to third place');
  assert.strictEqual(reranked[2].scores.consecutivePenalty, 0.95, 'cinema_b should record consecutive penalty of 0.95');
  console.log('✅ testDiversityShift passed');
}

// 11. Test city name normalization
function testNormalizeCity() {
  console.log('Running testNormalizeCity...');
  const { normalizeCity } = require('./ranking');
  assert.strictEqual(normalizeCity('Bielefeld'), 'bielefeld');
  assert.strictEqual(normalizeCity('  Bielefeld  '), 'bielefeld');
  assert.strictEqual(normalizeCity('München'), 'munchen');
  assert.strictEqual(normalizeCity('Köln'), 'koln');
  assert.strictEqual(normalizeCity(''), '');
  assert.strictEqual(normalizeCity(null), '');
  console.log('✅ testNormalizeCity passed');
}

// 12. Test category normalization
function testNormalizeCategory() {
  console.log('Running testNormalizeCategory...');
  const { normalizeCategory } = require('./ranking');
  
  assert.deepStrictEqual(normalizeCategory(['entertainment.cinema']), { primaryCategory: 'entertainment', subCategory: 'cinema' });
  assert.deepStrictEqual(normalizeCategory(['sport.swimming_pool']), { primaryCategory: 'sports', subCategory: 'swimming_pool' });
  assert.deepStrictEqual(normalizeCategory(['entertainment.miniature_golf']), { primaryCategory: 'entertainment', subCategory: 'minigolf' });
  assert.deepStrictEqual(normalizeCategory(['entertainment.bowling_alley']), { primaryCategory: 'entertainment', subCategory: 'bowling' });
  assert.deepStrictEqual(normalizeCategory(['entertainment.zoo']), { primaryCategory: 'nature', subCategory: 'zoo' });
  assert.deepStrictEqual(normalizeCategory(['catering.cafe']), { primaryCategory: 'food', subCategory: 'cafe' });
  assert.deepStrictEqual(normalizeCategory(['catering.restaurant']), { primaryCategory: 'food', subCategory: 'restaurant' });
  assert.deepStrictEqual(normalizeCategory(['catering.bar']), { primaryCategory: 'nightlife', subCategory: 'bar' });
  assert.deepStrictEqual(normalizeCategory(['catering.pub']), { primaryCategory: 'nightlife', subCategory: 'bar' });
  assert.deepStrictEqual(normalizeCategory(['adult.nightclub']), { primaryCategory: 'nightlife', subCategory: 'bar' });

  // Fallback tests
  assert.deepStrictEqual(normalizeCategory(['catering.fast_food']), { primaryCategory: 'food', subCategory: 'fast_food' });
  assert.deepStrictEqual(normalizeCategory(['sport.soccer']), { primaryCategory: 'sports', subCategory: 'soccer' });
  console.log('✅ testNormalizeCategory passed');
}

// 13. Test greedy diversification with additive penalties
function testGreedyDiversification() {
  console.log('Running testGreedyDiversification...');
  const { diversifyFeed } = require('./ranking');

  // Let's create candidates where cinema is dominant
  const candidates = [
    { id: 'cinema_1', categories: ['entertainment.cinema'], relevanceScore: 100 },
    { id: 'cinema_2', categories: ['entertainment.cinema'], relevanceScore: 90 },
    { id: 'cinema_3', categories: ['entertainment.cinema'], relevanceScore: 80 },
    { id: 'swimming_1', categories: ['sport.swimming_pool'], relevanceScore: 75 },
    { id: 'cafe_1', categories: ['catering.cafe'], relevanceScore: 70 }
  ];

  const reranked = diversifyFeed(candidates);

  // Position 0: cinema_1 selected first (100 pts)
  assert.strictEqual(reranked[0].id, 'cinema_1');

  // Position 1:
  // cinema_2 gets consecutive penalty (-20) and Top 5 duplicate subcat penalty (-15). Adjusted: 90 - 35 = 55.
  // swimming_1 has no penalties. Score: 75.
  // cafe_1 has no penalties. Score: 70.
  // So swimming_1 should be selected next!
  assert.strictEqual(reranked[1].id, 'swimming_1');
  
  console.log('✅ testGreedyDiversification passed');
}

// 14. Test High Score spot preservation
function testHighScorePreservation() {
  console.log('Running testHighScorePreservation...');
  const { diversifyFeed } = require('./ranking');

  // "The Strike" has over 100 points, even if cinema dominates
  const candidates = [
    { id: 'cinema_1', categories: ['entertainment.cinema'], relevanceScore: 90 },
    { id: 'cinema_2', categories: ['entertainment.cinema'], relevanceScore: 85 },
    { id: 'cinema_3', categories: ['entertainment.cinema'], relevanceScore: 80 },
    { id: 'the_strike', categories: ['entertainment.bowling_alley'], relevanceScore: 120 } // bowling alley (entertainment)
  ];

  const reranked = diversifyFeed(candidates);

  // the_strike has the highest score and is not a subcategory duplicate of cinema
  // It should be placed first!
  assert.strictEqual(reranked[0].id, 'the_strike');

  // What if we place a bowling alley next to it?
  const candidates2 = [
    { id: 'cinema_1', categories: ['entertainment.cinema'], relevanceScore: 50 },
    { id: 'the_strike', categories: ['entertainment.bowling_alley'], relevanceScore: 120 },
    { id: 'bowling_2', categories: ['entertainment.bowling_alley'], relevanceScore: 115 }
  ];

  const reranked2 = diversifyFeed(candidates2);
  // both bowling spots have high scores. Even with duplicate subcategory penalty, they should both rank higher than cinema (50 pts).
  // the_strike: 120 (placed 1st)
  // bowling_2: 115 - 15 (Top 5 penalty) - 20 (consecutive penalty) = 80. Still higher than cinema (50).
  // So we expect: [the_strike, bowling_2, cinema_1]
  assert.strictEqual(reranked2[0].id, 'the_strike');
  assert.strictEqual(reranked2[1].id, 'bowling_2');
  assert.strictEqual(reranked2[2].id, 'cinema_1');
  console.log('✅ testHighScorePreservation passed');
}

// 15. Test City Radius-Bypass logic
function testCityRadiusBypass() {
  console.log('Running testCityRadiusBypass...');
  const { normalizeCity } = require('./ranking');

  const activeCity = 'Bielefeld';
  const activeCityNormalized = normalizeCity(activeCity);

  const spotInCity = { name: 'The Strike', address: 'Bielefeld, Germany', city: 'Bielefeld' };
  const spotOutsideCity = { name: 'Some Lake', address: 'Herford, Germany', city: 'Herford' };

  const checkBypass = (spot: any) => {
    const spotCityNormalized = normalizeCity(spot.city);
    return spotCityNormalized === activeCityNormalized;
  };

  assert.strictEqual(checkBypass(spotInCity), true, 'Spot in Bielefeld should bypass radius');
  assert.strictEqual(checkBypass(spotOutsideCity), false, 'Spot in Herford should NOT bypass radius');
  console.log('✅ testCityRadiusBypass passed');
}

// 16. Extended Category Normalization
function testNormalizeCategoryExtended() {
  console.log('Running testNormalizeCategoryExtended...');
  const { normalizeCategory } = require('./ranking');
  
  assert.deepStrictEqual(normalizeCategory(['freibad']), { primaryCategory: 'sports', subCategory: 'swimming_pool' });
  assert.deepStrictEqual(normalizeCategory(['hallenbad']), { primaryCategory: 'sports', subCategory: 'swimming_pool' });
  assert.deepStrictEqual(normalizeCategory(['naturbad']), { primaryCategory: 'sports', subCategory: 'swimming_pool' });
  assert.deepStrictEqual(normalizeCategory(['therme']), { primaryCategory: 'wellness', subCategory: 'spa' });
  assert.deepStrictEqual(normalizeCategory(['sauna']), { primaryCategory: 'wellness', subCategory: 'spa' });
  assert.deepStrictEqual(normalizeCategory(['cinema']), { primaryCategory: 'entertainment', subCategory: 'cinema' });
  assert.deepStrictEqual(normalizeCategory(['bowling']), { primaryCategory: 'entertainment', subCategory: 'bowling' });
  console.log('✅ testNormalizeCategoryExtended passed');
}

// 17. Identity Resolution
function testIsIdentityDuplicate() {
  console.log('Running testIsIdentityDuplicate...');
  const { isIdentityDuplicate } = require('./duplicate-detector');
  
  const p1 = { id: 'geo-1', name: 'The Strike Bielefeld', lat: 52.0303, lon: 8.5317, address: 'Boulevard 3, Bielefeld' };
  const p2 = { id: 'fire-1', name: 'The Strike', lat: 52.0304, lon: 8.5318, address: 'Boulevard 3, Bielefeld' };
  assert.strictEqual(isIdentityDuplicate(p1, p2), true, 'Strike duplicate should match');
  
  const p3 = { id: 'geo-2', name: 'The Strike Herford', lat: 52.1200, lon: 8.6700 };
  assert.strictEqual(isIdentityDuplicate(p1, p3), false, 'Different places far away should not match');
  console.log('✅ testIsIdentityDuplicate passed');
}

// 18. Merge Priority and Mapping
function testFirestoreGeoapifyMerge() {
  console.log('Running testFirestoreGeoapifyMerge...');
  const { isIdentityDuplicate } = require('./duplicate-detector');
  
  const firestorePlaces = [
    { id: 'fire-strike', name: 'The Strike Bielefeld', lat: 52.03036, lon: 8.53177, upvotes: 1, voteBoostScore: 50, categories: ['entertainment.bowling_alley'] }
  ];
  const geoapifyFeatures = [
    { properties: { place_id: 'geo-strike', name: 'The Strike', lat: 52.0303, lon: 8.5317, categories: ['entertainment.bowling_alley'] } }
  ];
  
  const mergedMap = new Map();
  const firestoreFeatures = firestorePlaces.map(p => ({
    properties: {
      place_id: p.id,
      name: p.name,
      lat: p.lat,
      lon: p.lon,
      categories: p.categories,
      upvotes: p.upvotes,
      voteBoostScore: p.voteBoostScore,
      isFromFirestore: true
    }
  }));
  
  for (const feat of firestoreFeatures) {
    mergedMap.set(feat.properties.place_id, feat);
  }
  
  const idMap = new Map();
  for (const f of geoapifyFeatures) {
    const pid = f.properties.place_id;
    let isDup = false;
    let dupTargetId = "";
    
    for (const existing of mergedMap.values()) {
      if (isIdentityDuplicate(f.properties, existing.properties)) {
        isDup = true;
        dupTargetId = existing.properties.place_id;
        break;
      }
    }
    
    if (isDup && dupTargetId) {
      idMap.set(pid, dupTargetId);
    } else {
      mergedMap.set(pid, f);
    }
  }
  
  assert.strictEqual(mergedMap.size, 1, 'Duplicate geoapify place should be discarded');
  assert.ok(mergedMap.has('fire-strike'), 'Firestore version must win');
  assert.strictEqual(idMap.get('geo-strike'), 'fire-strike', 'Geoapify ID should map to Firestore ID');
  
  const mergedFeatures = Array.from(mergedMap.values());
  const finalSpot = mergedFeatures[0].properties;
  assert.strictEqual(finalSpot.voteBoostScore, 50, 'VoteBoost should be preserved');
  console.log('✅ testFirestoreGeoapifyMerge passed');
}

// 19. Diversity Rules (Top 20 Caps)
function testDiversityCaps() {
  console.log('Running testDiversityCaps...');
  const { diversifyFeed } = require('./ranking');
  
  // Create 25 candidates:
  // - 10 nightlife / bar (relevance 90 down to 81)
  // - 10 sports / swimming_pool (relevance 70 down to 61)
  // - 1 entertainment / bowling (The Strike, relevance 120)
  // - 4 food / cafe (relevance 50 down to 47)
  const candidates = [];
  
  // The Strike
  candidates.push({ id: 'the_strike', categories: ['entertainment.bowling_alley'], relevanceScore: 120 });
  
  // 10 Bars
  for (let i = 0; i < 10; i++) {
    candidates.push({ id: `bar_${i}`, categories: ['catering.bar'], relevanceScore: 90 - i });
  }
  
  // 10 Pools
  for (let i = 0; i < 10; i++) {
    candidates.push({ id: `pool_${i}`, categories: ['sport.swimming_pool'], relevanceScore: 70 - i });
  }
  
  // 15 Cafes
  for (let i = 0; i < 15; i++) {
    candidates.push({ id: `cafe_${i}`, categories: ['catering.cafe'], relevanceScore: 50 - i });
  }
  
  // 15 Restaurants
  for (let i = 0; i < 15; i++) {
    candidates.push({ id: `restaurant_${i}`, categories: ['catering.restaurant'], relevanceScore: 40 - i });
  }
  
  // 10 Cinemas
  for (let i = 0; i < 10; i++) {
    candidates.push({ id: `cinema_${i}`, categories: ['entertainment.cinema'], relevanceScore: 60 - i });
  }

  // 10 Zoos
  for (let i = 0; i < 10; i++) {
    candidates.push({ id: `zoo_${i}`, categories: ['entertainment.zoo'], relevanceScore: 55 - i });
  }
  
  const reranked = diversifyFeed(candidates);
  
  // Take Top 20
  const top20 = reranked.slice(0, 20);
  
  // Count distributions
  let barCount = 0;
  let poolCount = 0;
  let nightlifeCount = 0;
  let sportsCount = 0;
  
  top20.forEach((item: any) => {
    const cats = item.categories || [];
    if (cats.includes('catering.bar')) {
      barCount++;
      nightlifeCount++;
    }
    if (cats.includes('sport.swimming_pool')) {
      poolCount++;
      sportsCount++;
    }
  });
  
  assert.ok(barCount <= 4, `Top 20 should have max 4 bars (got ${barCount})`);
  assert.ok(poolCount <= 4, `Top 20 should have max 4 pools (got ${poolCount})`);
  assert.ok(nightlifeCount <= 5, `Top 20 should have max 5 nightlife (got ${nightlifeCount})`);
  assert.ok(sportsCount <= 5, `Top 20 should have max 5 sports (got ${sportsCount})`);
  assert.strictEqual(top20[0].id, 'the_strike', 'The Strike (high score) must remain ranked high');
  
  console.log('✅ testDiversityCaps passed');
}

// 20. Scope Filtering
function testScopeFilter() {
  console.log('Running testScopeFilter...');
  const activeCityNormalized = 'bielefeld';
  const maxDistKm = 10;
  const userLat = 52.0300;
  const userLng = 8.5300;
  
  const { calculateDistance } = require('./geo-utils');
  const { isIdentityDuplicate } = require('./duplicate-detector');
  
  const spot1 = { id: 'spot-1', city: 'Bielefeld', lat: 52.0300, lon: 8.5300, upvotes: 5 };
  const spot2 = { id: 'spot-2', city: 'Herford', lat: 52.0400, lon: 8.5400, upvotes: 5 };
  const spot3 = { id: 'spot-3', city: 'Paderborn', lat: 51.7181, lon: 8.7575, upvotes: 5 };
  const spot4 = { id: 'spot-4', name: 'The Strike Paderborn Duplicate', city: 'Paderborn', lat: 51.7181, lon: 8.7575, upvotes: 5 };
  
  const geoapifyFeatures = [
    { properties: { name: 'The Strike Paderborn Duplicate', lat: 51.7181, lon: 8.7575 } }
  ];
  
  const filterFunction = (p: any) => {
    let distanceKm = Infinity;
    if (typeof p.lat === 'number' && typeof p.lon === 'number') {
      distanceKm = calculateDistance(userLat, userLng, p.lat, p.lon);
    }
    
    const spotCityNormalized = p.city ? p.city.toLowerCase().trim() : "";
    const cityMatch = spotCityNormalized === activeCityNormalized;
    const distanceMatch = distanceKm <= maxDistKm;
    
    let identityMatch = false;
    for (const f of geoapifyFeatures) {
      if (isIdentityDuplicate(f.properties, p)) {
        identityMatch = true;
        break;
      }
    }
    
    const nameContainsCity = p.name ? p.name.toLowerCase().includes(activeCityNormalized) : false;
    
    return Boolean(cityMatch || distanceMatch || identityMatch || nameContainsCity);
  };
  
  assert.strictEqual(filterFunction(spot1), true, 'Spot 1 should be included');
  assert.strictEqual(filterFunction(spot2), true, 'Spot 2 should be included');
  assert.strictEqual(filterFunction(spot3), false, 'Spot 3 should be excluded');
  assert.strictEqual(filterFunction(spot4), true, 'Spot 4 should be included');
  
  console.log('✅ testScopeFilter passed');
}

function testFeedQualityFix() {
  console.log('Running testFeedQualityFix...');
  const { normalizeCategory, computeAdjustments, isGenericPlaceName, diversifyFeed } = require('./ranking');

  // 1. Landmark-Mapping
  assert.deepStrictEqual(normalizeCategory(['fountain']), { primaryCategory: 'tourism', subCategory: 'landmark' });
  assert.deepStrictEqual(normalizeCategory(['artwork']), { primaryCategory: 'tourism', subCategory: 'landmark' });
  assert.deepStrictEqual(normalizeCategory(['monument']), { primaryCategory: 'tourism', subCategory: 'landmark' });

  // 2. Swimming-/Spa-Priorität
  assert.deepStrictEqual(normalizeCategory(['sport.swimming_pool', 'artwork']), { primaryCategory: 'sports', subCategory: 'swimming_pool' });
  assert.deepStrictEqual(normalizeCategory(['sauna', 'monument']), { primaryCategory: 'wellness', subCategory: 'spa' });

  // 3. Quality-Penalty
  const adjTourismOther = computeAdjustments(['tourism.other'], 'Some Spot', 0, 50, false);
  assert.strictEqual(adjTourismOther.qualityPenalty, 25);

  const adjGenericLandmark = computeAdjustments(['tourism.monument'], 'Stapenhorststraße', 0, 50, false);
  assert.strictEqual(adjGenericLandmark.qualityPenalty, 25);

  const adjFirestoreSingleWord = computeAdjustments(['tourism.monument'], 'Kamera', 0, 80, true);
  assert.strictEqual(adjFirestoreSingleWord.qualityPenalty, 0);

  // 4. Activity-Boost
  assert.strictEqual(computeAdjustments(['entertainment.cinema'], 'Cinema', 0, 50, false).activityBoost, 8);
  assert.strictEqual(computeAdjustments(['entertainment.minigolf'], 'Golf', 0, 50, false).activityBoost, 8);
  assert.strictEqual(computeAdjustments(['entertainment.bowling'], 'Bowling', 0, 50, false).activityBoost, 8);
  assert.strictEqual(computeAdjustments(['sport.swimming_pool'], 'Pool', 0, 50, false).activityBoost, 16);
  assert.strictEqual(computeAdjustments(['entertainment.zoo'], 'Zoo', 0, 50, false).activityBoost, 8);
  assert.strictEqual(computeAdjustments(['tourism.museum'], 'Museum', 0, 50, false).activityBoost, 8);
  assert.strictEqual(computeAdjustments(['leisure.park'], 'Park', 0, 50, false).activityBoost, 8);
  assert.strictEqual(computeAdjustments(['catering.restaurant'], 'Resto', 0, 50, false).activityBoost, 5);
  assert.strictEqual(computeAdjustments(['catering.cafe'], 'Cafe', 0, 50, false).activityBoost, 5);
  assert.strictEqual(computeAdjustments(['catering.bar'], 'Bar', 0, 50, false).activityBoost, 3);

  // 5. Caps for other and landmark
  const candidates = [];
  for (let i = 0; i < 10; i++) {
    candidates.push({ id: `other_${i}`, categories: ['other'], relevanceScore: 100 - i });
  }
  for (let i = 0; i < 10; i++) {
    candidates.push({ id: `landmark_${i}`, categories: ['tourism.monument'], relevanceScore: 90 - i });
  }
  for (let i = 0; i < 5; i++) {
    candidates.push({ id: `cinema_${i}`, categories: ['entertainment.cinema'], relevanceScore: 80 - i });
    candidates.push({ id: `pool_${i}`, categories: ['sport.swimming_pool'], relevanceScore: 75 - i });
    candidates.push({ id: `park_${i}`, categories: ['leisure.park'], relevanceScore: 70 - i });
    candidates.push({ id: `cafe_${i}`, categories: ['catering.cafe'], relevanceScore: 65 - i });
    candidates.push({ id: `spa_${i}`, categories: ['wellness.spa'], relevanceScore: 60 - i });
  }

  const reranked = diversifyFeed(candidates);
  const top20 = reranked.slice(0, 20);

  let otherCount = 0;
  let landmarkCount = 0;
  top20.forEach((item: any) => {
    const { subCategory } = normalizeCategory(item.categories);
    if (subCategory === 'other') otherCount++;
    if (subCategory === 'landmark') landmarkCount++;
  });

  assert.ok(otherCount <= 3, `other count in top 20 should be <= 3 (got ${otherCount})`);
  assert.ok(landmarkCount <= 3, `landmark count in top 20 should be <= 3 (got ${landmarkCount})`);

  console.log('✅ testFeedQualityFix passed');
}

// Run all test groups
try {
  testBasePrior();
  testRationalQuadraticDecay();
  testPersonalization();
  testCommunityScore();
  testSparseRegionFallback();
  testDeterministicJitter();
  testTieBreaker();
  testCategoryDamping();
  testCategorySpecificSigma();
  testDiversityShift();
  testNormalizeCity();
  testNormalizeCategory();
  testGreedyDiversification();
  testHighScorePreservation();
  testCityRadiusBypass();
  testNormalizeCategoryExtended();
  testIsIdentityDuplicate();
  testFirestoreGeoapifyMerge();
  testDiversityCaps();
  testScopeFilter();
  testFeedQualityFix();
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
} catch (error) {
  console.error('❌ TEST FAILED:', error);
  process.exit(1);
}
