'use client';

import { openDB, type IDBPDatabase } from 'idb';
import { LocalDataCache, type LocalCacheStore } from './local-data-cache';

let database: Promise<IDBPDatabase | null> | undefined;
function getDB() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  return database ??= openDB('activa-data-cache-v1', 1, {
    upgrade(db) {
      const store = db.createObjectStore('entries');
      store.createIndex('updatedAt', 'updatedAt');
      store.createIndex('expiresAt', 'expiresAt');
    },
  }).catch(() => null);
}

const store: LocalCacheStore = {
  async get(key) { return (await getDB())?.get('entries', key); },
  async delete(key) { await (await getDB())?.delete('entries', key); },
  async put(key, entry) {
    const db = await getDB();
    if (!db) return;
    const tx = db.transaction('entries', 'readwrite');
    await tx.store.put(entry, key);
    // Bound persistent storage without reading all cached payloads into memory.
    let count = await tx.store.count();
    let cursor = await tx.store.index('updatedAt').openCursor();
    while (cursor && count > 500) {
      await cursor.delete(); count--;
      cursor = await cursor.continue();
    }
    await tx.done;
  },
};

export const browserDataCache = new LocalDataCache(store);
