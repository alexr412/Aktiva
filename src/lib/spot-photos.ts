import manifest from './spot-photos.json';

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
};

const photos = new Map<string, SpotPhoto>(manifest.photos.map(photo => [photo.placeId, photo as SpotPhoto]));

// Exact IDs only: a same-name venue in another city must not inherit a photo.
export function getSpotPhoto(place: { id: string }): SpotPhoto | undefined {
  return photos.get(place.id);
}
