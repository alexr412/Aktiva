import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LocalDataCache, type LocalCacheEntry, type LocalCacheStore } from './local-data-cache';

function persistentStore() {
  const entries = new Map<string, LocalCacheEntry>();
  const store: LocalCacheStore = {
    get: async key => entries.get(key),
    put: async (key, entry) => { entries.set(key, entry); },
    delete: async key => { entries.delete(key); },
  };
  return { entries, store };
}

test('reopening uses persistent data; expiry performs exactly one fresh read', async () => {
  let now = 100, reads = 0;
  const { store } = persistentStore();
  const fetch = async () => { reads++; return ['spot']; };
  await new LocalDataCache(store, () => now).load('city', 100, fetch);
  const reopened = new LocalDataCache(store, () => now);
  assert.deepEqual(await reopened.load('city', 100, fetch), ['spot']);
  assert.equal(reads, 1);
  now = 200;
  await reopened.load('city', 100, fetch);
  assert.equal(reads, 2);
});

test('simultaneous requests share one load and failed requests remain retryable', async () => {
  let release!: () => void, reads = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const cache = new LocalDataCache();
  const fetch = async () => { reads++; await gate; return []; };
  const results = [cache.load('same', 1000, fetch), cache.load('same', 1000, fetch)];
  await new Promise(resolve => setImmediate(resolve));
  release();
  assert.deepEqual(await Promise.all(results), [[], []]);
  assert.equal(reads, 1);
  await assert.rejects(cache.load('failed', 1000, async () => { throw Error('offline'); }));
  assert.equal(await cache.load('failed', 1000, async () => 'recovered'), 'recovered');
});

test('storage failure preserves a memory cache and null results are cacheable', async () => {
  const cache = new LocalDataCache({ get: async () => { throw Error('disabled'); }, put: async () => { throw Error('quota'); }, delete: async () => { throw Error('disabled'); } });
  let reads = 0;
  const fetch = async () => { reads++; return null; };
  await cache.load('missing', 1000, fetch);
  await cache.load('missing', 1000, fetch);
  assert.equal(reads, 1);
  await cache.invalidate('missing');
  await cache.load('missing', 1000, fetch);
  assert.equal(reads, 2);
});

test('invalidation during an old request cannot overwrite newly fetched data', async () => {
  const { store } = persistentStore();
  const cache = new LocalDataCache(store);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const old = cache.load('vote', 1000, async () => { await gate; return 'old'; });
  await new Promise(resolve => setImmediate(resolve));
  await cache.invalidate('vote');
  assert.equal(await cache.load('vote', 1000, async () => 'new'), 'new');
  release(); await old;
  assert.equal(await new LocalDataCache(store).load('vote', 1000, async () => 'unexpected'), 'new');
});

test('account-scoped keys keep personal metadata separate', async () => {
  const cache = new LocalDataCache();
  await cache.load('one:spot', 1000, async () => 'up');
  assert.equal(await cache.load('two:spot', 1000, async () => 'none'), 'none');
});

test('a slow persistent read cannot resurrect data invalidated while it was loading', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let entry: LocalCacheEntry | undefined = { value: 'old', expiresAt: Date.now() + 10000, updatedAt: Date.now() };
  const cache = new LocalDataCache({
    get: async () => { const captured = entry; await gate; return captured; },
    put: async (_, next) => { entry = next; }, delete: async () => { entry = undefined; },
  });
  const oldRead = cache.load('spot', 1000, async () => 'fresh');
  await new Promise(resolve => setImmediate(resolve));
  await cache.invalidate('spot');
  release(); await oldRead;
  assert.equal(await cache.load('spot', 1000, async () => 'fresh'), 'fresh');
});
