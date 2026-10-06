import { adminDb } from '@/lib/firebase/admin-server';
import { ServerResponseCache, type CacheStore } from './server-response-cache';
const store: CacheStore | undefined = adminDb ? {
  async get(key) {
    const snapshot = await adminDb!.collection('api_response_cache').doc(key).get();
    const entry = snapshot.data();
    return entry && typeof entry.expiresAtMs === 'number' && typeof entry.payload === 'string'
      ? { data: JSON.parse(entry.payload), expiresAt: entry.expiresAtMs } : null;
  },
  async set(key, entry) {
    await adminDb!.collection('api_response_cache').doc(key).set({
      payload: JSON.stringify(entry.data), expiresAtMs: entry.expiresAt,
      expiresAt: new Date(entry.expiresAt),
    });
  },
} : undefined;
// Only provider place data and anonymous intent filters; never live activities or participants.
export const sharedApiCache = new ServerResponseCache(store);
