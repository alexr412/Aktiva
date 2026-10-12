'use client';

import { doc, getDoc } from 'firebase/firestore';
import { db } from './client';
import { browserDataCache } from '../cache/browser-data-cache';
import { localDataMetrics } from '../cache/local-data-cache';
import { SpotCatalogCache } from '../cache/spot-catalog-cache';
import type { CatalogManifest, CatalogPage, CatalogQuery } from '../spot-catalog';

const catalogs = new SpotCatalogCache(browserDataCache, {
  async manifest() {
    const snapshot = await getDoc(doc(db!, 'spot_catalogs', 'index'));
    localDataMetrics.documentReads++;
    return snapshot.exists() ? snapshot.data() as CatalogManifest : { catalogs: [] };
  },
  async page(id) {
    const snapshot = await getDoc(doc(db!, 'spot_catalog_pages', id));
    localDataMetrics.documentReads++;
    if (!snapshot.exists()) throw new Error('Missing spot catalog page.');
    return snapshot.data() as CatalogPage;
  },
});

let retryAfter = 0;
export async function loadSpotCatalog(uid: string | undefined, query: CatalogQuery) {
  // Enable after publishing the catalog rules and first city. Existing discovery works unchanged until then.
  if (process.env.NEXT_PUBLIC_SPOT_CATALOGS_ENABLED !== 'true' || !db || !uid || Date.now() < retryAfter) return null;
  try { return await catalogs.query(uid, query); }
  catch {
    retryAfter = Date.now() + 60_000;
    return null; // Provider discovery remains available if the catalog cannot be read.
  }
}
