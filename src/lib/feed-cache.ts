export interface FeedCacheEntry {
  data: any[];
  timestamp: number;
}

export interface CacheKeyParams {
  lat: number;
  lng: number;
  activeCategory: string[];
  activeTabId: string;
  debouncedSearchQuery: string;
}

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes default

export function getFeedCacheKey(params: CacheKeyParams): string {
  const roundedLat = params.lat.toFixed(3);
  const roundedLng = params.lng.toFixed(3);
  const sortedCategories = [...params.activeCategory].sort().join(',');
  return `aktiva_feed_cache_${roundedLat}_${roundedLng}_${sortedCategories}_${params.activeTabId}_${params.debouncedSearchQuery}`;
}

export function getFeedCache(key: string, ttlMs: number = DEFAULT_TTL_MS): FeedCacheEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const entry: FeedCacheEntry = JSON.parse(cached);
    if (Date.now() - entry.timestamp > ttlMs) {
      localStorage.removeItem(key); // Evict expired entry
      return null;
    }
    return entry;
  } catch (error) {
    console.error('[FeedCache] Failed to read from localStorage:', error);
    return null;
  }
}

export function setFeedCache(key: string, data: any[]): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: FeedCacheEntry = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    console.error('[FeedCache] Failed to write to localStorage:', error);
  }
}
