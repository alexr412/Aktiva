import test from 'node:test';
import assert from 'node:assert/strict';
import { getBremerhavenSpotRecommendations, prioritizeSpotRecommendations } from './bremerhaven-spot-recommendations';

const bremerhaven = { lat: 53.5505392, lng: 8.5851945 };

test('local suggestions span the pilot categories and obey the selected radius', () => {
  const recommendations = getBremerhavenSpotRecommendations(bremerhaven, 10);
  assert.equal(recommendations.length, 8);
  assert.deepEqual(recommendations.slice(0, 4).map(place => place.name), [
    'Lieblingsplatz', 'Bürgerpark', 'Beyond Bowling (ehemals Fun Bowling)', 'Klimahaus Bremerhaven',
  ]);
  const nearby = getBremerhavenSpotRecommendations(bremerhaven, 1);
  assert.ok(nearby.length > 0 && nearby.length < recommendations.length);
  assert.ok(nearby.every(place => place.distance! <= 1));
  assert.deepEqual(getBremerhavenSpotRecommendations({ lat: 52.03, lng: 8.53 }, 10), []);
});

test('recommendations preserve a live venue and collapse its old name without removing another location', () => {
  const bowling = getBremerhavenSpotRecommendations(bremerhaven, 10)[2];
  const alias = { ...bowling, id: 'alias', name: 'fun Bowling' };
  const live = { ...bowling, name: 'fun Bowling', activityCount: 2 };
  const otherBowling = { ...alias, id: 'other', lat: bowling.lat + 0.025 };
  const unrelated = { ...bowling, id: 'unrelated', name: 'Stadtpark' };
  assert.deepEqual(prioritizeSpotRecommendations([alias, unrelated, live, otherBowling], [bowling]), [
    { ...live, name: bowling.name }, unrelated, otherBowling,
  ]);
});
