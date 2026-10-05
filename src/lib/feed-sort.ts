export type FeedSortMode = 'recommended' | 'distance';

type SortablePlace = { distance?: number; relevanceScore?: number };

/** Sort the complete filtered list before pagination, without changing cached data. */
export function sortFeedPlaces<T extends SortablePlace>(places: readonly T[], mode: FeedSortMode): T[] {
  return [...places].sort((a, b) => {
    if (mode === 'distance') {
      const distanceA = typeof a.distance === 'number' && Number.isFinite(a.distance) && a.distance >= 0
        ? a.distance : Infinity;
      const distanceB = typeof b.distance === 'number' && Number.isFinite(b.distance) && b.distance >= 0
        ? b.distance : Infinity;
      if (distanceA !== distanceB) return distanceA - distanceB;
    }
    return (b.relevanceScore || 0) - (a.relevanceScore || 0);
  });
}
