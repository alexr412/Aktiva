import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DISCOVERY_CATEGORY_BUCKETS, DISCOVERY_PAGE_SIZE, fetchDiscoveryPage, fetchPlaceBuckets, getDiscoveryBucketCursors, getDiscoveryDistanceKm } from './place-discovery';
import { buildGeoapifyRequestUrl } from '../app/api/geoapify/request-url';

const feature = (id: string) => ({ properties: { place_id: id } });

test('bucket pagination loads every provider result without a merged offset or skipped rows', async () => {
  const datasets = new Map(DISCOVERY_CATEGORY_BUCKETS.map((category, bucket) => [category,
    Array.from({ length: [65, 41, 12][bucket] }, (_, index) => feature(`${bucket}-${index}`))]));
  const calls: Array<{ categories: string; offset: number }> = [];
  const all = new Set<string>();
  let cursors = getDiscoveryBucketCursors();
  while (cursors.length) {
    const page = await fetchDiscoveryPage(cursors, async cursor => {
      calls.push(cursor);
      return { features: datasets.get(cursor.categories)!.slice(cursor.offset, cursor.offset + DISCOVERY_PAGE_SIZE) };
    });
    for (const item of page.features) all.add(item.properties.place_id);
    cursors = getDiscoveryBucketCursors(page);
  }
  assert.equal(all.size, 118);
  assert.deepEqual(calls.map(call => call.offset), [0, 0, 0, 30, 30, 60]);
  for (const dataset of datasets.values()) for (const item of dataset) assert(all.has(item.properties.place_id));
});

test('deduplicating overlapping buckets does not prematurely end their pagination', async () => {
  const shared = Array.from({ length: 30 }, (_, index) => feature(String(index)));
  const page = await fetchDiscoveryPage(getDiscoveryBucketCursors(), async () => ({ features: shared }));
  assert.equal(page.features.length, 30);
  assert.equal(getDiscoveryBucketCursors(page).length, 3);
  assert(getDiscoveryBucketCursors(page).every(cursor => cursor.offset === 30));
});

test('partial failures retry the same offset once and cannot cause infinite automatic requests', async () => {
  const requests = getDiscoveryBucketCursors();
  const failed = requests[0].categories;
  const request = async (cursor: { categories: string }) => {
    if (cursor.categories === failed) throw new Error('provider unavailable');
    return { features: Array.from({ length: 30 }, (_, index) => feature(String(index))) };
  };
  const first = await fetchDiscoveryPage(requests, request);
  assert.equal(first._partial, true);
  const retry = getDiscoveryBucketCursors(first);
  assert.equal(retry.find(cursor => cursor.categories === failed)?.offset, 0);
  const second = await fetchDiscoveryPage(retry, request);
  assert(!getDiscoveryBucketCursors(second).some(cursor => cursor.categories === failed));
  assert.equal(second._discoveryBuckets.find(bucket => bucket.categories === failed)?.failures, 2);
});

test('empty buckets and the configured provider offset boundary finish cleanly', async () => {
  const empty = await fetchDiscoveryPage(getDiscoveryBucketCursors(), async () => ({ features: [] }));
  assert.deepEqual(getDiscoveryBucketCursors(empty), []);
  const last = await fetchDiscoveryPage([{ categories: 'catering', offset: 480 }], async () => ({
    features: Array.from({ length: 30 }, (_, index) => feature(String(index))),
  }));
  assert.deepEqual(getDiscoveryBucketCursors(last), []);
  await assert.rejects(fetchDiscoveryPage(getDiscoveryBucketCursors(), async () => { throw new Error('all failed'); }), /all failed/);
});

test('initial discovery returns one feature collection and deduplicates buckets', async () => {
  const page = await fetchPlaceBuckets(['cinema', 'sport'], async () => ({
    features: [feature('shared'), feature('shared')],
  }));
  assert.equal(Array.isArray(page), false);
  assert.deepEqual(page.features, [feature('shared')]);
});

test('a failed bucket preserves results from the other buckets', async () => {
  const page = await fetchPlaceBuckets(['failed', 'cinema'], async category => {
    if (category === 'failed') throw new Error('timeout');
    return { features: [feature('cinema')] };
  });
  assert.deepEqual(page.features, [feature('cinema')]);
});

test('total failure is propagated instead of cached as an empty feed', async () => {
  const failure = new Error('gateway timeout');
  await assert.rejects(fetchPlaceBuckets(['cinema', 'sport'], async () => {
    throw failure;
  }), error => error === failure);
});

test('successful empty discovery stays empty', async () => {
  assert.deepEqual(await fetchPlaceBuckets(['cinema'], async () => ({ features: [] })), { features: [] });
});

test('a spot 63 metres away is within the 10 km feed radius', () => {
  assert.equal(getDiscoveryDistanceKm({ properties: { distance: 63 } }, null), 0.063);
  assert.equal(getDiscoveryDistanceKm({ properties: { distance: 242 } }, null), 0.242);
});

test('cached distances are already kilometres', () => {
  assert.equal(getDiscoveryDistanceKm({ distance: 0.063 }, null, true), 0.063);
});

test('coordinates determine distance for cached and API features, including zero', () => {
  const place = { properties: { distance: 99 }, geometry: { coordinates: [0, 0] } };
  assert.equal(getDiscoveryDistanceKm(place, { lat: 0, lng: 0 }), 0);
  assert.equal(getDiscoveryDistanceKm({ lat: 0, lon: 0 }, { lat: 0, lng: 0 }, true), 0);
  assert.equal(getDiscoveryDistanceKm({}, null), undefined);
});

test('gateway URL forwards all categories once and retains spatial and paging parameters', () => {
  for (const categories of ['catering,heritage', 'categories=catering&categories=heritage']) {
    const url = buildGeoapifyRequestUrl('https://api.geoapify.com/v2/places', {
      categories, filter: 'circle:13.4,52.52,10000', bias: 'proximity:13.4,52.52',
      limit: '25', offset: '50',
    }, 'test-key');
    assert.deepEqual(url.searchParams.getAll('categories'), ['catering,heritage']);
    assert.equal(url.searchParams.get('filter'), 'circle:13.4,52.52,10000');
    assert.equal(url.searchParams.get('bias'), 'proximity:13.4,52.52');
    assert.equal(url.searchParams.get('limit'), '25');
    assert.equal(url.searchParams.get('offset'), '50');
  }
});
