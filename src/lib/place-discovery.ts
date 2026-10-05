import { calculateDistanceKm } from './geo-utils';

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
