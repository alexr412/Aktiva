import manifest from './spot-photos.json';
import { calculateDistanceKm } from './geo-utils';

export type SpotPhoto = {
  placeId: string;
  placeName: string;
  kind: 'venue' | 'example';
  url: string;
  sourceUrl: string;
  author: string;
  license: string;
  licenseUrl: string;
  capturedAt: string | null;
  objectPosition: string;
  provider?: string;
  title?: string;
  alt?: string;
  caption?: string;
  match?: { names: string[]; lat: number; lon: number; radiusMeters: number };
};

const photos = new Map<string, SpotPhoto>(manifest.photos.map(photo => [photo.placeId, photo as SpotPhoto]));

// Source IDs may differ between the pilot catalog and legacy results. An alias
// requires both an explicitly reviewed name and coordinates within 150 metres.
export function getSpotPhoto(place: { id: string; name?: string; lat?: number; lon?: number }): SpotPhoto | undefined {
  const direct = photos.get(place.id);
  if (direct) return direct;
  const name = place.name?.normalize('NFKC').trim().toLocaleLowerCase('de');
  if (!name) return undefined;
  return [...photos.values()].find(photo => {
    const match = photo.match;
    if (!match?.names.some(alias => alias.normalize('NFKC').trim().toLocaleLowerCase('de') === name)) return false;
    const distance = calculateDistanceKm(place.lat, place.lon, match.lat, match.lon);
    return distance !== null && distance * 1000 <= match.radiusMeters;
  });
}
