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
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
} catch (error) {
  console.error('❌ TEST FAILED:', error);
  process.exit(1);
}
