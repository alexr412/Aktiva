'use client';
import { openDB, type IDBPDatabase } from 'idb';

// Raw provider pages preserve units and coverage. Old mixed tiles are never complete query hits.
let database: Promise<IDBPDatabase | null> | undefined;
function getDB() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  return database ??= openDB('aktiva_place_queries_v1', 1, { upgrade(db) { db.createObjectStore('queries'); } }).catch(() => null);
}
export function placeQueryKey(params: Record<string, unknown>): string {
  return JSON.stringify(Object.keys(params).sort().map(key => [key, key === 'categories' && Array.isArray(params[key]) ? [...params[key] as string[]].sort() : params[key]]));
}
export async function getCachedPlaceQuery(key: string): Promise<any | null> {
  try {
    const db = await getDB();
    const entry = await db?.get('queries', key);
    return entry && entry.expiresAt > Date.now() ? entry.data : null;
  } catch { return null; }
}
export async function savePlaceQuery(key: string, data: any): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    const empty = Array.isArray(data.features) && data.features.length === 0;
    await db.put('queries', { data, expiresAt: Date.now() + (empty ? 5 * 60 * 1000 : 24 * 60 * 60 * 1000) }, key);
    // Bound storage and evict expired entries. Oldest inserted keys go first.
    const tx = db.transaction('queries', 'readwrite');
    let cursor = await tx.store.openCursor();
    let count = await tx.store.count();
    while (cursor) {
      if (cursor.value.expiresAt <= Date.now() || count > 100) { await cursor.delete(); count--; }
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch { /* Searches also work with storage disabled. */ }
}
