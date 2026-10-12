import { calculateDistanceKm } from './geo-utils';

export interface CatalogSpot {
  id: string;
  name: string;
  address: string;
  categories: string[];
  lat: number;
  lon: number;
  openingHours?: string;
}
export interface CatalogCity {
  cityId: string;
  name: string;
  lat: number;
  lon: number;
  radiusMeters: number;
  version: string;
  pageIds: string[];
}
export interface CatalogManifest { catalogs: CatalogCity[] }
export interface CatalogPage { cityId: string; version: string; places: CatalogSpot[] }
export interface CatalogQuery {
  lat: number;
  lng: number;
  radiusMeters: number;
  categories?: string[] | string;
  offset?: number;
  queryLimit?: number;
  catalogCity?: CatalogCity;
  searchText?: string;
}

/** A catalog may serve a query only when it covers the entire requested circle. */
export function selectCatalog(manifest: CatalogManifest, query: CatalogQuery): CatalogCity | undefined {
  return manifest.catalogs
    .filter(city => {
      const distance = calculateDistanceKm(city.lat, city.lon, query.lat, query.lng);
      return distance !== null && distance * 1000 + query.radiusMeters <= city.radiusMeters;
    })
    .sort((a, b) => a.radiusMeters - b.radiusMeters || a.cityId.localeCompare(b.cityId))[0];
}

export function queryCatalog(places: CatalogSpot[], query: CatalogQuery) {
  const categories = typeof query.categories === 'string' ? query.categories.split(',').map(category => category.trim()).filter(Boolean) : query.categories ?? [];
  const search = query.searchText?.trim().toLocaleLowerCase() ?? '';
  const matching = places.map(place => ({ place, distance: calculateDistanceKm(query.lat, query.lng, place.lat, place.lon) }))
    .filter(({ place, distance }) => distance !== null && distance * 1000 <= query.radiusMeters &&
      (!search || `${place.name} ${place.address}`.toLocaleLowerCase().includes(search)) &&
      (!categories.length || place.categories.some(category => categories.some(wanted => category === wanted || category.startsWith(wanted + '.')))))
    .sort((a, b) => a.distance! - b.distance! || a.place.id.localeCompare(b.place.id));
  const offset = query.offset ?? 0;
  const limit = query.queryLimit ?? 50;
  return {
    features: matching.slice(offset, offset + limit).map(({ place, distance }) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [place.lon, place.lat] },
      properties: { ...place, place_id: place.id, distance: distance! * 1000, opening_hours: place.openingHours },
    })),
    _catalog: true,
    _catalogHasMore: offset + limit < matching.length,
    _catalogNextOffset: offset + limit,
    _catalogQuery: { ...query, type: 'city_catalog' },
  };
}
