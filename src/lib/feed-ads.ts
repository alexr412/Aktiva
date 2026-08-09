import type { Place } from '@/lib/types';

export type FeedItem =
  | { type: 'place'; place: Place }
  | { type: 'ad'; id: string; adIndex: number };

export interface FeedAdsOptions {
  places: Place[];
  isMobile?: boolean;
  gridColumns?: 2 | 3 | 4 | 5 | null;
  activeTabId?: string;
  activeCategory?: string[];
  searchQuery?: string;
  activePremiumFilters?: string[];
  isOpenRoomsMode?: boolean;
}

/**
  Checks if ads should be rendered in the main feed based on current filter states and measured grid columns.
  Ads are ONLY shown:
  - after client-side viewport measurement has established active grid columns (gridColumns is 2, 3, 4, or 5)
  - in the main discover feed when no search, categories, favorites, premium filters or open room modes are active
 */
export function shouldShowAdsInFeed(options: FeedAdsOptions): boolean {
  const {
    gridColumns,
    activeTabId,
    activeCategory,
    searchQuery,
    activePremiumFilters = [],
    isOpenRoomsMode = false,
  } = options;

  // Do NOT render ads during SSR or before initial client-side viewport measurement
  if (gridColumns === null || typeof gridColumns === 'undefined') return false;

  if (activeTabId && activeTabId.trim() !== '') return false;
  if (activeCategory && activeCategory.length > 0) return false;
  if (searchQuery && searchQuery.trim().length > 0) return false;
  if (activePremiumFilters && activePremiumFilters.length > 0) return false;
  if (isOpenRoomsMode) return false;

  return true;
}

/**
  Calculates the target display index for the k-th ad (1-indexed)
  based on active grid column count (2, 3, 4, or 5 columns).
 */
export function getAdTargetIndex(k: number, columns: 2 | 3 | 4 | 5 = 2): number {
  if (columns === 2) {
    // 2-column mobile layout: Rechts -> Links
    // k = 1 (odd)  -> index 5  (Row 3, Col 2 -> RECHTS)
    // k = 2 (even) -> index 10 (Row 6, Col 1 -> LINKS)
    // k = 3 (odd)  -> index 17 (Row 9, Col 2 -> RECHTS)
    // k = 4 (even) -> index 22 (Row 12, Col 1 -> LINKS)
    return k % 2 === 1
      ? 6 * (k - 1) + 5
      : 6 * (k - 2) + 10;
  }

  if (columns === 3) {
    // 3-column lg layout: Rechts -> Mitte -> Links
    // k = 1 -> index 2  (Row 1, Col 3 -> RECHTS)
    // k = 2 -> index 7  (Row 3, Col 2 -> MITTE)
    // k = 3 -> index 12 (Row 5, Col 1 -> LINKS)
    // k = 4 -> index 20 (Row 7, Col 3 -> RECHTS)
    const block = Math.floor((k - 1) / 3);
    const rem = (k - 1) % 3;
    const offsets = [2, 7, 12];
    return 18 * block + offsets[rem];
  }

  if (columns === 4) {
    // 4-column xl layout: Rechts -> Mitte-Rechts -> Mitte-Links -> Links
    // k = 1 -> index 3  (Row 1, Col 4 -> RECHTS)
    // k = 2 -> index 10 (Row 3, Col 3 -> MITTE-RECHTS)
    // k = 3 -> index 17 (Row 5, Col 2 -> MITTE-LINKS)
    // k = 4 -> index 24 (Row 7, Col 1 -> LINKS)
    const block = Math.floor((k - 1) / 4);
    const rem = (k - 1) % 4;
    const offsets = [3, 10, 17, 24];
    return 32 * block + offsets[rem];
  }

  // 5-column 2xl desktop layout: Rechts -> Mitte -> Links
  // k = 1 -> index 4  (Row 1, Col 5 -> RECHTS)
  // k = 2 -> index 12 (Row 3, Col 3 -> MITTE)
  // k = 3 -> index 20 (Row 5, Col 1 -> LINKS)
  // k = 4 -> index 29 (Row 6, Col 5 -> RECHTS)
  const block = Math.floor((k - 1) / 3);
  const rem = (k - 1) % 3;
  const offsets = [4, 12, 20];
  return 25 * block + offsets[rem];
}

/**
  Derives display items for the list feed across all responsive layouts (2, 3, 4, 5 columns).
  Places ads to guarantee strict rotating grid column placement.
 */
export function deriveFeedDisplayItems(options: FeedAdsOptions): FeedItem[] {
  const { places, gridColumns } = options;

  if (!shouldShowAdsInFeed(options) || !gridColumns) {
    return places.map((place) => ({ type: 'place', place }));
  }

  const cols = gridColumns;

  const items: FeedItem[] = [];
  let placeIdx = 0;
  let adCount = 0;

  while (placeIdx < places.length) {
    const nextAdNumber = adCount + 1;
    const adTargetIndex = getAdTargetIndex(nextAdNumber, cols);

    while (items.length < adTargetIndex && placeIdx < places.length) {
      items.push({ type: 'place', place: places[placeIdx++] });
    }

    if (items.length === adTargetIndex) {
      adCount++;
      items.push({
        type: 'ad',
        id: `feed-ad-${adCount}`,
        adIndex: adCount,
      });
    }
  }

  while (placeIdx < places.length) {
    items.push({ type: 'place', place: places[placeIdx++] });
  }

  return items;
}
