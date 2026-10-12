'use client';

import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { db } from './client';
import { browserDataCache } from '../cache/browser-data-cache';
import { localDataMetrics } from '../cache/local-data-cache';

export const PLACE_METADATA_TTL_MS = 5 * 60 * 1000;
export type PlaceMetadataRecord = { id: string; data: Record<string, any> };
const fields = ['upvotes', 'downvotes', 'weightedUpvotes', 'weightedDownvotes', 'voteBoostScore',
  'userVotes', 'communityScore', 'avgRating', 'reviewCount', 'activityCount', 'isDeleted', 'isBlacklisted'];
const keyFor = (uid: string, id: string) => JSON.stringify(['place-metadata-v2', uid, id]);
type Waiting = { resolve: (record: PlaceMetadataRecord) => void; reject: (error: unknown) => void };
const queued = new Map<string, Map<string, Waiting[]>>();

function fetchQueuedMetadata(uid: string, id: string): Promise<PlaceMetadataRecord> {
  return new Promise((resolve, reject) => {
    let pending = queued.get(uid);
    if (!pending) {
      pending = new Map(); queued.set(uid, pending);
      queueMicrotask(() => { void flushQueuedMetadata(uid); });
    }
    const waiting = pending.get(id) ?? [];
    waiting.push({ resolve, reject }); pending.set(id, waiting);
  });
}

async function flushQueuedMetadata(uid: string) {
  const pending = queued.get(uid);
  if (!pending) return;
  queued.delete(uid);
  const ids = [...pending.keys()];
  for (let offset = 0; offset < ids.length; offset += 30) {
    const chunk = ids.slice(offset, offset + 30);
    try {
      const snapshot = await getDocs(query(collection(db!, 'places'), where(documentId(), 'in', chunk)));
      localDataMetrics.documentReads += Math.max(1, snapshot.size);
      const found = new Map(snapshot.docs.map(doc => {
        const source = doc.data();
        const data = Object.fromEntries(fields.filter(field => source[field] !== undefined).map(field => [field, source[field]]));
        data.userVotes = source.userVotes?.[uid] ? { [uid]: source.userVotes[uid] } : {};
        return [doc.id, { id: doc.id, data }] as const;
      }));
      for (const id of chunk) for (const waiting of pending.get(id)!) waiting.resolve(found.get(id) ?? { id, data: {} });
    } catch (error) {
      for (const id of chunk) for (const waiting of pending.get(id)!) waiting.reject(error);
    }
  }
}

export async function loadPlaceMetadata(uid: string, ids: string[]): Promise<PlaceMetadataRecord[]> {
  if (!db || !uid || ids.length === 0) return [];
  const uniqueIds = [...new Set(ids)].sort();
  if (uniqueIds.length > 30) throw new Error('Place metadata must be requested in groups of at most 30.');
  return Promise.all(uniqueIds.map(id => browserDataCache.load(keyFor(uid, id), PLACE_METADATA_TTL_MS, () => fetchQueuedMetadata(uid, id))));
}

export async function invalidatePlaceMetadata(uid: string, placeId: string) {
  await browserDataCache.invalidate(keyFor(uid, placeId));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('activa-place-metadata-changed', { detail: { uid, placeId } }));
}

/** Refresh while the feed is visible; no permanent Firestore listener for each spot. */
export function watchCachedPlaceMetadata(
  uid: string, ids: string[], onData: (records: PlaceMetadataRecord[]) => void, onError: (error: unknown) => void,
): () => void {
  let active = true;
  let sequence = 0;
  const refresh = async () => {
    if (!active || document.visibilityState === 'hidden') return;
    const request = ++sequence;
    try {
      const records = await loadPlaceMetadata(uid, ids);
      if (active && request === sequence) onData(records);
    } catch (error) { if (active && request === sequence) onError(error); }
  };
  const onChanged = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail?.uid === uid && ids.includes(detail.placeId)) void refresh();
  };
  void refresh();
  const timer = window.setInterval(() => { void refresh(); }, PLACE_METADATA_TTL_MS);
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('activa-place-metadata-changed', onChanged);
  return () => {
    active = false; sequence++;
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', refresh);
    window.removeEventListener('activa-place-metadata-changed', onChanged);
  };
}
