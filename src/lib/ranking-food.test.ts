import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeBasePrior, calculateRelevance, rankPlacesPipeline } from './ranking';

test('food and drinks receive the requested base prior of 35', () => {
  for (const category of ['catering', 'catering.restaurant', 'catering.restaurant.pizza', 'catering.fast_food', 'catering.cafe', 'catering.bar', 'catering.pub', 'catering.bakery']) {
    assert.equal(computeBasePrior([category]), 35, category);
  }
});

test('existing highlight and leisure category tiers remain unchanged', () => {
  for (const [category, score] of [
    ['entertainment.zoo', 80], ['entertainment.cinema', 72], ['adult.nightclub', 72],
    ['entertainment.museum', 40], ['sport.stadium', 62], ['leisure.park', 50], ['tourism.attraction', 50],
  ] as const) assert.equal(computeBasePrior([category]), score, category);
  assert.equal(computeBasePrior(['catering.restaurant', 'entertainment.cinema']), 72);
  assert.equal(computeBasePrior([]), 50);
});

test('nearby restaurants no longer overtake comparable leisure spots in either ranking path', () => {
  const cinema = { id: 'cinema', name: 'City Cinema', categories: ['entertainment.cinema'], distance: 1, lat: 53.5, lon: 8.5 };
  const restaurant = { id: 'food', name: 'Local Restaurant', categories: ['catering.restaurant'], distance: 0.05, lat: 53.55, lon: 8.55 };
  const profile = { uid: 'ranking-test', role: 'user' };
  const location = { lat: 53.5, lng: 8.5 };
  const ranked = rankPlacesPipeline([restaurant, cinema], profile, location, 100);
  assert.deepEqual(ranked.map(spot => spot.id), ['cinema', 'food']);
  assert.equal(ranked.find(spot => spot.id === 'food')?.scores.basePrior, 35);
  assert(calculateRelevance(cinema, profile, location) > calculateRelevance(restaurant, profile, location));
});
