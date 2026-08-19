import assert from 'node:assert';
import { test } from 'node:test';
import {
  getTileKey,
  getCachedTilePlaces,
  searchCachedPlaces,
  pruneExpiredCache,
} from './places-cache';

test('1. getTileKey generates spatial key with 2 decimal place rounding', () => {
  const key1 = getTileKey(50.94132, 6.95812, 10000);
  assert.strictEqual(key1, 'tile_50.94_6.96_10000');

  const key2 = getTileKey(52.520008, 13.404954, 5000);
  assert.strictEqual(key2, 'tile_52.52_13.4_5000');
});

test('2. getCachedTilePlaces returns null gracefully in Node/SSR environment', async () => {
  const result = await getCachedTilePlaces(50.94, 6.96, 10000);
  assert.strictEqual(result, null);
});

test('3. searchCachedPlaces returns empty array gracefully in Node/SSR environment', async () => {
  const results = await searchCachedPlaces('sushi', 50.94, 6.96, 10);
  assert.deepStrictEqual(results, []);
});

test('4. pruneExpiredCache completes without error in Node/SSR environment', async () => {
  await assert.doesNotReject(async () => {
    await pruneExpiredCache();
  });
});
