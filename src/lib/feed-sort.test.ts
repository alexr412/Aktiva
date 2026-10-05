import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sortFeedPlaces } from './feed-sort';

const spots = [
  { id: 'far', distance: 4, relevanceScore: 90 },
  { id: 'near', distance: 0.2, relevanceScore: 40 },
  { id: 'middle', distance: 1, relevanceScore: 70 },
];

test('recommended keeps the existing descending score order and leaves its input unchanged', () => {
  const input = Object.freeze(spots.map(spot => Object.freeze({ ...spot })));
  assert.deepEqual(sortFeedPlaces(input, 'recommended').map(spot => spot.id), ['far', 'middle', 'near']);
  assert.deepEqual(input.map(spot => spot.id), ['far', 'near', 'middle']);
});

test('distance sorts all loaded spots before slicing a visible page', () => {
  assert.deepEqual(sortFeedPlaces(spots, 'distance').slice(0, 2).map(spot => spot.id), ['near', 'middle']);
  assert.deepEqual(sortFeedPlaces(spots, 'recommended').map(spot => spot.id), ['far', 'middle', 'near']);
});

test('equal distances use recommendation scores, keeping equal scores stable', () => {
  const tied = [
    { id: 'low', distance: 1, relevanceScore: 20 },
    { id: 'first', distance: 1, relevanceScore: 80 },
    { id: 'second', distance: 1, relevanceScore: 80 },
  ];
  assert.deepEqual(sortFeedPlaces(tied, 'distance').map(spot => spot.id), ['first', 'second', 'low']);
});

test('zero is a valid distance; missing and invalid distances sort last', () => {
  const input = [
    { id: 'missing', relevanceScore: 90 },
    { id: 'nan', distance: NaN, relevanceScore: 80 },
    { id: 'negative', distance: -1, relevanceScore: 70 },
    { id: 'infinite', distance: Infinity, relevanceScore: 60 },
    { id: 'near', distance: 0.1 },
    { id: 'here', distance: 0 },
  ];
  assert.deepEqual(sortFeedPlaces(input, 'distance').map(spot => spot.id), ['here', 'near', 'missing', 'nan', 'negative', 'infinite']);
  assert.deepEqual(sortFeedPlaces([], 'distance'), []);
});
