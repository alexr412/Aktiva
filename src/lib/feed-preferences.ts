import type { FeedSortMode } from './feed-sort';

export interface FeedPreferences {
  sortBy: FeedSortMode;
  hiddenCategoryIds: string[];
}

export function normalizeFeedPreferences(value: unknown, knownIds: readonly string[]): FeedPreferences {
  const input = value && typeof value === 'object' ? value as Partial<FeedPreferences> : {};
  return {
    sortBy: input.sortBy === 'distance' ? 'distance' : 'recommended',
    hiddenCategoryIds: Array.isArray(input.hiddenCategoryIds)
      ? [...new Set(input.hiddenCategoryIds.filter(id => typeof id === 'string' && knownIds.includes(id)))] : [],
  };
}
