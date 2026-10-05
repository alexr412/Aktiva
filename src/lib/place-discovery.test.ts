import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchPlaceBuckets, getDiscoveryDistanceKm } from './place-discovery';
import { buildGeoapifyRequestUrl } from '../app/api/geoapify/request-url';

const feature = (id: string) => ({ properties: { place_id: id } });

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
