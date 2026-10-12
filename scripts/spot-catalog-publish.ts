import { createHash } from 'node:crypto';
import { calculateDistanceKm } from '../src/lib/geo-utils';
import type { CatalogCity, CatalogManifest, CatalogPage, CatalogSpot } from '../src/lib/spot-catalog';
import type { Firestore } from 'firebase-admin/firestore';

const MAX_PAGE_BYTES = 300_000;
export function prepareSpotCatalog(input: any): { city: CatalogCity; pages: CatalogPage[] } {
  if (!input || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(input.cityId ?? '')) throw new Error('cityId must contain lowercase letters, numbers and hyphens.');
  if (typeof input.name !== 'string' || !input.name.trim()) throw new Error('A city name is required.');
  if (!Number.isFinite(input.lat) || Math.abs(input.lat) > 90 || !Number.isFinite(input.lon) || Math.abs(input.lon) > 180) throw new Error('Invalid city coordinates.');
  if (!Number.isFinite(input.radiusMeters) || input.radiusMeters <= 0 || input.radiusMeters > 200_000) throw new Error('Invalid catalog radius.');
  if (!Array.isArray(input.places)) throw new Error('places must be an array.');
  const ids = new Set<string>();
  const places: CatalogSpot[] = [];
  for (const source of input.places) {
    if (source.isDeleted === true || source.isBlacklisted === true) continue;
    if (typeof source.id !== 'string' || !source.id.trim() || ids.has(source.id)) throw new Error('Every spot needs a unique stable id.');
    ids.add(source.id);
    if (typeof source.name !== 'string' || !source.name.trim() || typeof source.address !== 'string') throw new Error(`Invalid spot name/address: ${source.id}`);
    if (!Number.isFinite(source.lat) || Math.abs(source.lat) > 90 || !Number.isFinite(source.lon) || Math.abs(source.lon) > 180) throw new Error(`Invalid spot coordinates: ${source.id}`);
    if (!Array.isArray(source.categories) || !source.categories.length || source.categories.some((category: unknown) => typeof category !== 'string' || !category)) throw new Error(`Invalid spot categories: ${source.id}`);
    const distance = calculateDistanceKm(input.lat, input.lon, source.lat, source.lon);
    if (distance === null || distance * 1000 > input.radiusMeters) throw new Error(`Spot outside catalog coverage: ${source.id}`);
    const place: CatalogSpot = {
      id: source.id, name: source.name.trim(), address: source.address,
      lat: source.lat, lon: source.lon, categories: [...new Set<string>(source.categories)].sort(),
    };
    if (typeof source.openingHours === 'string') place.openingHours = source.openingHours;
    // Explicit whitelist: votes, user IDs, participants and private fields never enter a catalog.
    if (Buffer.byteLength(JSON.stringify(place), 'utf8') > MAX_PAGE_BYTES - 1024) throw new Error(`Spot too large: ${source.id}`);
    places.push(place);
  }
  places.sort((a, b) => a.id.localeCompare(b.id));
  const core = { cityId: input.cityId, name: input.name.trim(), lat: input.lat, lon: input.lon, radiusMeters: input.radiusMeters, places };
  const version = createHash('sha256').update(JSON.stringify(core)).digest('hex');
  const pages: CatalogPage[] = [];
  let page: CatalogPage = { cityId: core.cityId, version, places: [] };
  for (const place of places) {
    if (Buffer.byteLength(JSON.stringify({ ...page, places: [...page.places, place] }), 'utf8') > MAX_PAGE_BYTES) {
      pages.push(page); page = { cityId: core.cityId, version, places: [] };
    }
    page.places.push(place);
  }
  pages.push(page);
  if (pages.length > 24) throw new Error('City catalog exceeds the atomic publication limit (24 pages). Split its coverage.');
  const city: CatalogCity = {
    cityId: core.cityId, name: core.name, lat: core.lat, lon: core.lon, radiusMeters: core.radiusMeters,
    version, pageIds: pages.map((_, i) => `${core.cityId}-${version}-${i}`),
  };
  return { city, pages };
}

export async function publishSpotCatalog(db: Firestore, prepared: ReturnType<typeof prepareSpotCatalog>): Promise<boolean> {
  return db.runTransaction(async transaction => {
    const indexRef = db.collection('spot_catalogs').doc('index');
    const index = await transaction.get(indexRef);
    const manifest = (index.data() ?? { catalogs: [] }) as CatalogManifest;
    if (manifest.catalogs.some(city => city.cityId === prepared.city.cityId && city.version === prepared.city.version)) return false;
    const catalogs = [...manifest.catalogs.filter(city => city.cityId !== prepared.city.cityId), prepared.city].sort((a, b) => a.cityId.localeCompare(b.cityId));
    if (Buffer.byteLength(JSON.stringify({ catalogs }), 'utf8') > MAX_PAGE_BYTES) throw new Error('Catalog manifest is too large.');
    prepared.pages.forEach((page, i) => transaction.set(db.collection('spot_catalog_pages').doc(prepared.city.pageIds[i]), page));
    transaction.set(indexRef, { catalogs });
    return true;
  });
}
