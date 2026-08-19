'use client';

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Place } from '@/lib/types';
import { calculateDistanceKm } from '@/lib/geo-utils';

export interface CachedPlaceEntry {
  id: string;
  place: Place;
  fetchedAt: number;
  lat: number;
  lon: number;
  categories: string[];
}

export interface CachedTileEntry {
  tileKey: string;
  placeIds: string[];
  fetchedAt: number;
  lat: number;
  lon: number;
  radiusMeters: number;
}

interface PlacesDB extends DBSchema {
  places: {
    key: string;
    value: CachedPlaceEntry;
    indexes: {
      'by-fetchedAt': number;
    };
  };
  tiles: {
    key: string;
    value: CachedTileEntry;
    indexes: {
      'by-fetchedAt': number;
    };
  };
}

const DB_NAME = 'aktiva_places_cache_v1';
const DB_VERSION = 1;
export const DEFAULT_CACHE_TTL_MS = 5 * 24 * 60 * 60 * 1000; // 5 Tage Gültigkeit

let dbPromise: Promise<IDBPDatabase<PlacesDB> | null> | null = null;

function getDB(): Promise<IDBPDatabase<PlacesDB> | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = openDB<PlacesDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('places')) {
          const placeStore = db.createObjectStore('places', { keyPath: 'id' });
          placeStore.createIndex('by-fetchedAt', 'fetchedAt');
        }
        if (!db.objectStoreNames.contains('tiles')) {
          const tileStore = db.createObjectStore('tiles', { keyPath: 'tileKey' });
          tileStore.createIndex('by-fetchedAt', 'fetchedAt');
        }
      },
    }).catch(err => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[PLACES CACHE] IndexedDB initialization failed or disabled:', err);
      }
      return null;
    });
  }
  return dbPromise;
}

/**
 * Erzeugt einen räumlichen Kachel-Schlüssel auf ca. 1.1 km Raster-Genauigkeit (2 Nachkommastellen).
 */
export function getTileKey(lat: number, lon: number, radiusMeters: number): string {
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLon = Math.round(lon * 100) / 100;
  return `tile_${roundedLat}_${roundedLon}_${radiusMeters}`;
}

/**
 * Liest gecachte Orte für einen gegebenen Standort und Radius aus IndexedDB.
 * Gibt null zurück, wenn kein gültiger Cache vorhanden ist.
 */
export async function getCachedTilePlaces(
  lat: number,
  lon: number,
  radiusMeters: number,
  ttlMs = DEFAULT_CACHE_TTL_MS
): Promise<Place[] | null> {
  try {
    const db = await getDB();
    if (!db) return null;

    const tileKey = getTileKey(lat, lon, radiusMeters);
    const tile = await db.get('tiles', tileKey);

    if (!tile) return null;
    if (Date.now() - tile.fetchedAt > ttlMs) {
      // Abgelaufener Cache
      return null;
    }

    if (!tile.placeIds || tile.placeIds.length === 0) {
      return [];
    }

    const tx = db.transaction('places', 'readonly');
    const placeStore = tx.objectStore('places');

    const placePromises = tile.placeIds.map(id => placeStore.get(id));
    const cachedEntries = await Promise.all(placePromises);

    const validPlaces: Place[] = [];
    for (const entry of cachedEntries) {
      if (entry && entry.place) {
        const placeCopy = { ...entry.place };
        // Dynamische Distanz relativ zum aktuellen Standort berechnen
        const distKm = calculateDistanceKm(lat, lon, placeCopy.lat, placeCopy.lon);
        if (distKm !== null) {
          placeCopy.distance = distKm;
        }
        validPlaces.push(placeCopy);
      }
    }

    return validPlaces;
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[PLACES CACHE] Failed to get cached tile:', err);
    }
    return null;
  }
}

/**
 * Speichert Orte und deren Kachel-Verknüpfung in IndexedDB.
 * Verwendet Promise.all innerhalb der synchronen Transaktion, um Auto-Commit-Fehler zu vermeiden.
 */
export async function saveTilePlaces(
  lat: number,
  lon: number,
  radiusMeters: number,
  places: Place[]
): Promise<void> {
  try {
    const db = await getDB();
    if (!db || !places || places.length === 0) return;

    const tileKey = getTileKey(lat, lon, radiusMeters);
    const now = Date.now();
    const placeIds: string[] = [];

    const tx = db.transaction(['places', 'tiles'], 'readwrite');
    const placeStore = tx.objectStore('places');
    const tileStore = tx.objectStore('tiles');

    for (const p of places) {
      if (!p || !p.id) continue;
      placeIds.push(p.id);

      const entry: CachedPlaceEntry = {
        id: p.id,
        place: p,
        fetchedAt: now,
        lat: p.lat,
        lon: p.lon,
        categories: p.categories || [],
      };
      void placeStore.put(entry);
    }

    const tileEntry: CachedTileEntry = {
      tileKey,
      placeIds,
      fetchedAt: now,
      lat,
      lon,
      radiusMeters,
    };
    void tileStore.put(tileEntry);

    await tx.done;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[PLACES CACHE] Successfully saved ${placeIds.length} places for tile ${tileKey}`);
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[PLACES CACHE] Failed to save tile places:', err);
    }
  }
}

/**
 * Durchsucht alle lokal gespeicherten Orte nach einem Suchbegriff.
 */
export async function searchCachedPlaces(
  query: string,
  userLat?: number,
  userLon?: number,
  maxDistanceKm?: number | null
): Promise<Place[]> {
  try {
    const db = await getDB();
    if (!db || !query.trim()) return [];

    const normalizedQuery = query.trim().toLowerCase();
    const allEntries = await db.getAll('places');

    const matches: Place[] = [];

    for (const entry of allEntries) {
      if (!entry || !entry.place) continue;
      const p = entry.place;
      const name = (p.name || '').toLowerCase();
      const address = (p.address || '').toLowerCase();
      const categories = (p.categories || []).join(' ').toLowerCase();

      if (name.includes(normalizedQuery) || address.includes(normalizedQuery) || categories.includes(normalizedQuery)) {
        const placeCopy = { ...p };
        if (typeof userLat === 'number' && typeof userLon === 'number') {
          const distKm = calculateDistanceKm(userLat, userLon, placeCopy.lat, placeCopy.lon);
          if (distKm !== null) {
            placeCopy.distance = distKm;
          }
        }

        if (
          maxDistanceKm !== undefined &&
          maxDistanceKm !== null &&
          placeCopy.distance !== undefined &&
          placeCopy.distance > maxDistanceKm
        ) {
          continue;
        }

        matches.push(placeCopy);
      }
    }

    matches.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    return matches.slice(0, 50);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[PLACES CACHE] Failed to search cached places:', err);
    }
    return [];
  }
}

/**
 * Löscht veraltete Cache-Einträge (älter als maxAgeMs).
 */
export async function pruneExpiredCache(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;

    const cutoff = Date.now() - maxAgeMs;

    const oldTiles = await db.getAllFromIndex('tiles', 'by-fetchedAt', IDBKeyRange.upperBound(cutoff));
    const oldPlaces = await db.getAllFromIndex('places', 'by-fetchedAt', IDBKeyRange.upperBound(cutoff));

    if (oldTiles.length === 0 && oldPlaces.length === 0) return;

    const tx = db.transaction(['places', 'tiles'], 'readwrite');
    const tileStore = tx.objectStore('tiles');
    const placeStore = tx.objectStore('places');

    const deletePromises: Promise<any>[] = [];
    for (const t of oldTiles) {
      deletePromises.push(tileStore.delete(t.tileKey));
    }
    for (const p of oldPlaces) {
      deletePromises.push(placeStore.delete(p.id));
    }

    await Promise.all(deletePromises);
    await tx.done;
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[PLACES CACHE] Prune error:', err);
    }
  }
}
