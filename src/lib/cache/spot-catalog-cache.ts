import type { CatalogManifest, CatalogPage, CatalogQuery, CatalogSpot } from '../spot-catalog';
import { queryCatalog, selectCatalog } from '../spot-catalog';
import { LocalDataCache } from './local-data-cache';

export const CATALOG_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
export interface CatalogSource {
  manifest(): Promise<CatalogManifest>;
  page(id: string): Promise<CatalogPage>;
}

/** Published catalog versions are immutable; a new version replaces the complete local list. */
export class SpotCatalogCache {
  constructor(private cache: LocalDataCache, private source: CatalogSource) {}

  async query(uid: string, query: CatalogQuery) {
    const manifestKey = `catalog-manifest:${uid}`;
    let city = query.catalogCity;
    if (!city) {
      let manifest: CatalogManifest;
      try { manifest = await this.cache.load<CatalogManifest>(manifestKey, CATALOG_CHECK_INTERVAL_MS, () => this.source.manifest()); }
      catch (error) {
        const cached = await this.cache.peek<CatalogManifest>(manifestKey);
        if (!cached) throw error;
        manifest = cached.value; // Keep previously downloaded spots available offline.
      }
      city = selectCatalog(manifest, query);
    }
    if (!city) return null;
    const places = await this.cache.load<CatalogSpot[]>(`catalog:${uid}:${city.cityId}:${city.version}`, 365 * CATALOG_CHECK_INTERVAL_MS, async () => {
      const pages = await Promise.all(city.pageIds.map(id => this.source.page(id)));
      if (pages.some(page => page.cityId !== city.cityId || page.version !== city.version)) throw new Error('Incomplete spot catalog version.');
      const unique = new Map<string, CatalogSpot>();
      for (const page of pages) for (const place of page.places) unique.set(place.id, place);
      return [...unique.values()];
    });
    return queryCatalog(places, { ...query, catalogCity: city });
  }
}
