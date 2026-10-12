import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LocalDataCache, type LocalCacheEntry } from './cache/local-data-cache';
import { SpotCatalogCache, CATALOG_CHECK_INTERVAL_MS } from './cache/spot-catalog-cache';
import { prepareSpotCatalog, publishSpotCatalog } from '../../scripts/spot-catalog-publish';
import { queryCatalog, selectCatalog, type CatalogCity, type CatalogManifest, type CatalogPage } from './spot-catalog';

const spots = [
  { id: 'park', name: 'Park', address: 'A', lat: 52.52, lon: 13.405, categories: ['leisure.park'] },
  { id: 'cafe', name: 'Cafe', address: 'B', lat: 52.521, lon: 13.405, categories: ['catering.cafe'] },
];
const input = { cityId: 'example-city', name: 'Example City', lat: 52.52, lon: 13.405, radiusMeters: 30000, places: spots };
const query = { lat: 52.52, lng: 13.405, radiusMeters: 10000, queryLimit: 1 };

test('publication strips private/live fields, is deterministic and changes version after a deletion', () => {
  const a = prepareSpotCatalog({ ...input, places: [{ ...spots[0], userVotes: { secret: 'up' }, participantIds: ['secret'], upvotes: 999 }, spots[1]] });
  assert.equal(JSON.stringify(a.pages).includes('secret'), false);
  assert.equal(a.city.version, prepareSpotCatalog({ ...input, places: [...spots].reverse() }).city.version);
  assert.notEqual(a.city.version, prepareSpotCatalog({ ...input, places: [spots[0]] }).city.version);
  assert.equal(prepareSpotCatalog({ ...input, places: [{ ...spots[0], isDeleted: true }, spots[1]] }).pages[0].places.length, 1);
  assert.throws(() => prepareSpotCatalog({ ...input, places: [spots[0], spots[0]] }), /unique/);
  assert.throws(() => prepareSpotCatalog({ ...input, places: [{ ...spots[0], lat: 0 }] }), /outside/);
});

test('first download costs index+pages; reopening and local pagination add no reads; unchanged daily check reads only index', async () => {
  let now = 0, indexes = 0, pages = 0;
  const prepared = prepareSpotCatalog(input);
  const entries = new Map<string, LocalCacheEntry>();
  const store = { get: async (key: string) => entries.get(key), put: async (key: string, value: LocalCacheEntry) => { entries.set(key, value); }, delete: async (key: string) => { entries.delete(key); } };
  const source = { manifest: async () => { indexes++; return { catalogs: [prepared.city] }; }, page: async () => { pages++; return prepared.pages[0]; } };
  const first = new SpotCatalogCache(new LocalDataCache(store, () => now), source);
  const page = await first.query('one', query);
  assert.equal(page?.features[0].properties.id, 'park');
  assert.equal(page?._catalogHasMore, true);
  assert.equal((await first.query('one', { ...page!._catalogQuery, offset: page!._catalogNextOffset }))?.features[0].properties.id, 'cafe');
  await new SpotCatalogCache(new LocalDataCache(store, () => now), source).query('one', query);
  assert.deepEqual([indexes, pages], [1, 1]);
  now += CATALOG_CHECK_INTERVAL_MS;
  await first.query('one', query);
  assert.deepEqual([indexes, pages], [2, 1]);
});

test('new version replaces removed places; ongoing pagination stays on its original version', async () => {
  let now = 0;
  const old = prepareSpotCatalog(input);
  const next = prepareSpotCatalog({ ...input, places: [spots[1]] });
  let manifest: CatalogManifest = { catalogs: [old.city] };
  const cache = new SpotCatalogCache(new LocalDataCache(undefined, () => now), {
    manifest: async () => manifest,
    page: async id => id === old.city.pageIds[0] ? old.pages[0] : next.pages[0],
  });
  const first = await cache.query('one', query);
  now += CATALOG_CHECK_INTERVAL_MS;
  manifest = { catalogs: [next.city] };
  const replaced = await cache.query('one', { ...query, queryLimit: 50 });
  assert.deepEqual(replaced?.features.map(f => f.properties.id), ['cafe']);
  assert.equal((await cache.query('one', { ...first!._catalogQuery, offset: 1 }))?.features[0].properties.id, 'cafe');
});

test('catalog covers entire requested circle, filters category prefixes and preserves metre distances', () => {
  const prepared = prepareSpotCatalog(input);
  assert.equal(selectCatalog({ catalogs: [prepared.city] }, { ...query, radiusMeters: 40000 }), undefined);
  assert.equal(selectCatalog({ catalogs: [prepared.city] }, { ...query, lat: 53 }), undefined);
  const result = queryCatalog(spots, { ...query, categories: ['catering'] });
  assert.equal(result.features[0].properties.id, 'cafe');
  assert.ok(result.features[0].properties.distance > 100);
  assert.equal(result._catalogHasMore, false);
  assert.equal(queryCatalog(spots, { ...query, categories: 'catering, sport' }).features[0].properties.id, 'cafe');
  assert.deepEqual(queryCatalog(spots, { ...query, searchText: 'CAFE' }).features.map(f => f.properties.id), ['cafe']);
  assert.deepEqual(queryCatalog(spots, { ...query, searchText: 'unknown' }).features, []);
});

test('offline retains a downloaded city; incomplete versions are not cached', async () => {
  let now = 0, offline = false;
  const prepared = prepareSpotCatalog(input);
  const cache = new SpotCatalogCache(new LocalDataCache(undefined, () => now), {
    manifest: async () => { if (offline) throw Error('offline'); return { catalogs: [prepared.city] }; },
    page: async () => prepared.pages[0],
  });
  await cache.query('one', query);
  now += CATALOG_CHECK_INTERVAL_MS; offline = true;
  assert.equal((await cache.query('one', query))?.features[0].properties.id, 'park');
  let calls = 0;
  const broken = new SpotCatalogCache(new LocalDataCache(), {
    manifest: async () => ({ catalogs: [prepared.city] }),
    page: async () => { calls++; return { ...prepared.pages[0], version: calls === 1 ? 'wrong' : prepared.city.version }; },
  });
  await assert.rejects(broken.query('one', query), /Incomplete/);
  assert.ok(await broken.query('one', query));
  assert.equal(calls, 2);
});

test('oversized catalogs split into bounded pages and unchanged publication performs zero writes', async () => {
  const large = prepareSpotCatalog({ ...input, places: Array.from({ length: 150 }, (_, i) => ({ ...spots[0], id: `spot-${i}`, address: 'x'.repeat(3000) })) });
  assert.equal(large.pages.length, 2);
  for (const page of large.pages) assert.ok(Buffer.byteLength(JSON.stringify(page)) <= 300000);
  let index: CatalogManifest = { catalogs: [] };
  const writes: { ref: string; data: CatalogManifest | CatalogPage }[] = [];
  const db = {
    collection: (name: string) => ({ doc: (id: string) => `${name}/${id}` }),
    runTransaction: async (run: any) => run({ get: async () => ({ data: () => index }), set: (ref: string, data: CatalogManifest | CatalogPage) => { writes.push({ ref, data }); if (ref === 'spot_catalogs/index') index = data as CatalogManifest; } }),
  };
  assert.equal(await publishSpotCatalog(db as any, large), true);
  assert.equal(writes.length, 3);
  writes.length = 0;
  assert.equal(await publishSpotCatalog(db as any, large), false);
  assert.equal(writes.length, 0);
});
