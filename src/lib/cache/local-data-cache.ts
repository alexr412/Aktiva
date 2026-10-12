export interface LocalCacheEntry {
  value: unknown;
  expiresAt: number;
  updatedAt: number;
}

export interface LocalCacheStore {
  get(key: string): Promise<LocalCacheEntry | undefined>;
  put(key: string, entry: LocalCacheEntry): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Counts requests made by the new loaders, not the complete Firebase bill. */
export const localDataMetrics = {
  cacheHits: 0,
  sharedRequests: 0,
  loadRequests: 0,
  documentReads: 0,
};
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  Object.assign(window, { __ACTIVA_DATA_METRICS__: localDataMetrics });
}

export class LocalDataCache {
  private entries = new Map<string, LocalCacheEntry>();
  private pending = new Map<string, Promise<unknown>>();
  private generations = new Map<string, number>();

  constructor(private store?: LocalCacheStore, private now = Date.now, private maxEntries = 500) {}

  private remember(key: string, entry: LocalCacheEntry) {
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
  }

  async peek<T>(key: string): Promise<LocalCacheEntry & { value: T } | undefined> {
    const generation = this.generations.get(key) ?? 0;
    let entry = this.entries.get(key);
    if (!entry) {
      try { entry = await this.store?.get(key); } catch { /* Storage is optional. */ }
      if (generation !== (this.generations.get(key) ?? 0)) return undefined;
      if (entry) this.remember(key, entry);
    }
    return entry as (LocalCacheEntry & { value: T }) | undefined;
  }

  async load<T>(key: string, ttlMs: number, fetchValue: () => Promise<T>): Promise<T> {
    const generation = this.generations.get(key) ?? 0;
    const entry = await this.peek<T>(key);
    if (entry && entry.expiresAt > this.now() && generation === (this.generations.get(key) ?? 0)) {
      localDataMetrics.cacheHits++;
      return entry.value;
    }
    const existing = this.pending.get(key);
    if (existing) {
      localDataMetrics.sharedRequests++;
      return existing as Promise<T>;
    }
    const promise = (async () => {
      localDataMetrics.loadRequests++;
      const value = await fetchValue();
      if (generation === (this.generations.get(key) ?? 0)) {
        const updatedAt = this.now();
        const fresh = { value, updatedAt, expiresAt: updatedAt + ttlMs };
        this.remember(key, fresh);
        try { await this.store?.put(key, fresh); } catch { /* Keep the memory cache. */ }
      }
      return value;
    })();
    this.pending.set(key, promise);
    try { return await promise; }
    finally { if (this.pending.get(key) === promise) this.pending.delete(key); }
  }

  async invalidate(key: string) {
    this.generations.set(key, (this.generations.get(key) ?? 0) + 1);
    this.entries.delete(key);
    this.pending.delete(key);
    try { await this.store?.delete(key); } catch { /* Memory invalidation still works. */ }
  }
}
