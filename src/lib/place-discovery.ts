import { calculateDistanceKm } from './geo-utils';

export const DISCOVERY_PAGE_SIZE = 30;
export const DISCOVERY_MAX_OFFSET = 500;
export const DISCOVERY_CATEGORY_BUCKETS = [
  'entertainment.zoo,entertainment.cinema,entertainment.water_park,sport.swimming_pool,entertainment.miniature_golf,entertainment.bowling_alley,entertainment.aquarium,entertainment.escape_game,entertainment.activity_park,entertainment.activity_park.trampoline,entertainment.amusement_arcade',
  'entertainment,leisure,adult.nightclub,sport,tourism',
  'catering,heritage',
];

export type DiscoveryBucketCursor = { categories: string; offset: number; failures?: number };
export type DiscoveryBucketState = DiscoveryBucketCursor & { hasMore: boolean };
export type DiscoveryPage = { features: any[]; _discoveryBuckets: DiscoveryBucketState[]; _partial: boolean };

/** Each category bucket has its own provider offset; their merged count is not an offset. */
export function getDiscoveryBucketCursors(previousPage?: Partial<DiscoveryPage>): DiscoveryBucketCursor[] {
  if (!previousPage?._discoveryBuckets) {
    return DISCOVERY_CATEGORY_BUCKETS.map(categories => ({ categories, offset: 0 }));
  }
  return previousPage._discoveryBuckets
    .filter(bucket => bucket.hasMore && bucket.offset <= DISCOVERY_MAX_OFFSET)
    .map(({ categories, offset, failures }) => ({ categories, offset, ...(failures ? { failures } : {}) }));
}

export async function fetchDiscoveryPage(
  buckets: DiscoveryBucketCursor[],
  request: (bucket: DiscoveryBucketCursor) => Promise<{ features?: any[] }>,
): Promise<DiscoveryPage> {
  if (buckets.length === 0) return { features: [], _discoveryBuckets: [], _partial: false };
  const cursors = new Map(buckets.map(bucket => [bucket.categories, bucket]));
  const states = new Map<string, DiscoveryBucketState>();
  let partial = false;
  const page = await fetchPlaceBuckets(buckets.map(bucket => bucket.categories), async categories => {
    const cursor = cursors.get(categories)!;
    try {
      const result = await request(cursor);
      const offset = cursor.offset + DISCOVERY_PAGE_SIZE;
      states.set(categories, { categories, offset,
        hasMore: (result.features?.length || 0) >= DISCOVERY_PAGE_SIZE && offset <= DISCOVERY_MAX_OFFSET });
      return result;
    } catch (error) {
      partial = true;
      const failures = (cursor.failures || 0) + 1;
      // Retry a partial failure once without skipping its offset or looping indefinitely.
      states.set(categories, { ...cursor, failures, hasMore: failures < 2 });
      throw error;
    }
  });
  return { ...page, _discoveryBuckets: buckets.map(bucket => states.get(bucket.categories)!), _partial: partial };
}

/** Keep available buckets, but let SWR retry when every request failed. */
export async function fetchPlaceBuckets(
  categories: string[],
  request: (categories: string) => Promise<{ features?: any[] }>,
): Promise<{ features: any[] }> {
  const results = await Promise.allSettled(categories.map(request));
  const successful = results.filter(result => result.status === 'fulfilled');
  if (successful.length === 0) {
    const failure = results.find(result => result.status === 'rejected');
    throw failure?.reason || new Error('Place discovery failed');
  }

  const places = new Map<string, any>();
  for (const result of successful) {
    for (const feature of result.value.features || []) {
      const props = feature.properties || feature;
      const id = props.place_id || props.id;
      if (id && !places.has(id)) places.set(id, feature);
    }
  }
  return { features: Array.from(places.values()) };
}

/** API distances are metres; cached Place distances are kilometres. */
export function getDiscoveryDistanceKm(
  feature: any,
  location: { lat: number; lng: number } | null,
  fromCache = false,
): number | undefined {
  const props = feature.properties || feature;
  const lat = feature.geometry?.coordinates?.[1] ?? props.lat;
  const lon = feature.geometry?.coordinates?.[0] ?? props.lon ?? props.lng;
  if (location) {
    const distance = calculateDistanceKm(location.lat, location.lng, lat, lon);
    if (distance !== null) return distance;
  }
  const distance = props.distance;
  return typeof distance === 'number' && Number.isFinite(distance)
    ? (fromCache ? distance : distance / 1000)
    : undefined;
}
