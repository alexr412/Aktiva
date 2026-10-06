import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ServerResponseCache, responseCacheKey, type CacheStore } from './server-response-cache';
import { placeQueryKey } from './cache/place-query-cache';
import { getFeedCacheKey } from './feed-cache';

test('complete query identity distinguishes categories, radius, centre, language and pagination', () => {
  const params = { categories: 'cinema', filter: 'circle:1,2,5000', limit: '30', offset: '0', lang: 'de' };
  const key = responseCacheKey('places', params);
  assert.equal(responseCacheKey('places', { ...params }), key);
  for (const delta of [{ categories: 'museum' }, { filter: 'circle:1,2,10000' }, { filter: 'circle:1.01,2,5000' }, { limit: '50' }, { offset: '30' }, { lang: 'en' }]) {
    assert.notEqual(responseCacheKey('places', { ...params, ...delta }), key);
  }
  assert.equal(placeQueryKey({ categories: ['zoo', 'cinema'], limit: 30 }), placeQueryKey({ limit: 30, categories: ['cinema', 'zoo'] }));
  const feed = { lat: 1, lng: 2, activeCategory: [], activeTabId: '', debouncedSearchQuery: '' };
  assert.notEqual(getFeedCacheKey({ ...feed, radiusMeters: 5000 }), getFeedCacheKey({ ...feed, radiusMeters: 10000 }));
});
test('shared persistent cache survives instance changes, expires and tolerates storage failure', async () => {
  let now = 0;
  const entries = new Map<string, { data: unknown; expiresAt: number }>();
  const store: CacheStore = { get: async key => entries.get(key) ?? null, set: async (key, entry) => { entries.set(key, entry); } };
  const first = new ServerResponseCache(store, 2, () => now);
  await first.set('a', { features: [] }, 100);
  const second = new ServerResponseCache(store, 2, () => now);
  assert.deepEqual(await second.get('a'), { features: [] });
  now = 101;
  assert.equal(await second.get('a'), null);
  const broken = new ServerResponseCache({ get: async () => { throw Error('offline'); }, set: async () => { throw Error('offline'); } });
  assert.equal(await broken.get('missing'), null);
  await broken.set('a', [], 1000);
  assert.deepEqual(await broken.get('a'), []);
});
test('simultaneous identical requests share one provider call; failures remain retryable', async () => {
  const cache = new ServerResponseCache();
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const run = async () => { calls++; await gate; return 42; };
  const a = cache.coalesce('a', run), b = cache.coalesce('a', run);
  release();
  assert.deepEqual(await a, { value: 42, shared: false });
  assert.deepEqual(await b, { value: 42, shared: true });
  assert.equal(calls, 1);
  await assert.rejects(cache.coalesce('b', async () => { throw Error('timeout'); }));
  assert.equal((await cache.coalesce('b', async () => 7)).value, 7);
});
