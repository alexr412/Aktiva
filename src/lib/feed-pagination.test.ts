import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getFeedLoadAction } from './feed-pagination';

test('a short or cached final page still reveals every buffered spot', () => {
  const loadedSpots = Array.from({ length: 37 }, (_, id) => ({ id }));
  const shown: number[] = [];
  let visibleCount = 10;
  while (getFeedLoadAction({ loadedCount: loadedSpots.length, visibleCount, hasMorePages: false })) {
    assert.equal(getFeedLoadAction({ loadedCount: loadedSpots.length, visibleCount, hasMorePages: false }), 'reveal');
    shown.push(...loadedSpots.slice(visibleCount, visibleCount + 10).map(spot => spot.id));
    visibleCount += 10;
  }
  assert.deepEqual(shown, loadedSpots.slice(10).map(spot => spot.id));
  assert.equal(getFeedLoadAction({ loadedCount: loadedSpots.length, visibleCount, hasMorePages: false }), null);
});

test('loaded filtered spots are used before another API page is requested', () => {
  assert.equal(getFeedLoadAction({ loadedCount: 60, visibleCount: 10, hasMorePages: true }), 'reveal');
  assert.equal(getFeedLoadAction({ loadedCount: 60, visibleCount: 60, hasMorePages: true }), 'fetch');
  assert.equal(getFeedLoadAction({ loadedCount: 0, visibleCount: 10, hasMorePages: true }), 'fetch');
  assert.equal(getFeedLoadAction({ loadedCount: 0, visibleCount: 10, hasMorePages: false }), null);
});

test('validation or an in-flight page does not start another reveal or request', () => {
  for (const loadedCount of [0, 100]) {
    assert.equal(getFeedLoadAction({ loadedCount, visibleCount: 10, hasMorePages: true, loading: true }), null);
  }
});
