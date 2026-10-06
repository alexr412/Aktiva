import { createHash } from 'node:crypto';
export interface CacheStore {
  get(key: string): Promise<{ data: unknown; expiresAt: number } | null>;
  set(key: string, entry: { data: unknown; expiresAt: number }): Promise<void>;
}
/** Includes every parameter, including category coverage, centre and pagination. */
export function responseCacheKey(namespace: string, params: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify([namespace, Object.keys(params).sort().map(key => [key, params[key]])])).digest('hex');
}
export class ServerResponseCache {
  private entries = new Map<string, { data: unknown; expiresAt: number }>();
  private pending = new Map<string, Promise<unknown>>();
  constructor(private store?: CacheStore, private maxEntries = 100, private now = Date.now) {}
  async get<T>(key: string): Promise<T | null> {
    let entry = this.entries.get(key);
    if (entry && entry.expiresAt <= this.now()) { this.entries.delete(key); entry = undefined; }
    if (!entry && this.store) {
      try {
        const stored = await this.store.get(key);
        if (stored && stored.expiresAt > this.now()) { entry = stored; this.remember(key, entry); }
      } catch { /* A cache failure must not break normal searches. */ }
    }
    return entry ? entry.data as T : null;
  }
  private remember(key: string, entry: { data: unknown; expiresAt: number }) {
    this.entries.delete(key); this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
  }
  async set(key: string, data: unknown, ttlMs: number) {
    if (Buffer.byteLength(JSON.stringify(data), 'utf8') > 450_000) return;
    const entry = { data, expiresAt: this.now() + ttlMs };
    this.remember(key, entry);
    try { await this.store?.set(key, entry); } catch { /* Memory cache remains available. */ }
  }
  async coalesce<T>(key: string, run: () => Promise<T>): Promise<{ value: T; shared: boolean }> {
    const existing = this.pending.get(key);
    if (existing) return { value: await existing as T, shared: true };
    const promise = run(); this.pending.set(key, promise);
    try { return { value: await promise, shared: false }; }
    finally { if (this.pending.get(key) === promise) this.pending.delete(key); }
  }
}
