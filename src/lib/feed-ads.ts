import type { Place } from '@/lib/types';

export type FeedItem =
  | { type: 'place'; place: Place }
  | { type: 'ad'; id: string; adIndex: number };

export interface FeedAdsOptions {
  places: Place[];
  isMobile: boolean;
  activeTabId?: string;
  activeCategory?: string[];
  searchQuery?: string;
  activePremiumFilters?: string[];
  isOpenRoomsMode?: boolean;
}

/**
  Checks if ads should be rendered in the main feed based on current filter states.
  Ads are ONLY shown:
  - on Mobile view (isMobile === true)
  - in the main discover feed (activeTabId === '' or undefined)
  - when no category filter is active (activeCategory is empty)
  - when no search query is active
  - when no premium filters or open room modes are active
 */
export function shouldShowAdsInFeed(options: FeedAdsOptions): boolean {
  const {
    isMobile,
    activeTabId,
    activeCategory,
    searchQuery,
    activePremiumFilters = [],
    isOpenRoomsMode = false,
  } = options;

  if (!isMobile) return false;
  if (activeTabId && activeTabId.trim() !== '') return false;
  if (activeCategory && activeCategory.length > 0) return false;
  if (searchQuery && searchQuery.trim().length > 0) return false;
  if (activePremiumFilters && activePremiumFilters.length > 0) return false;
  if (isOpenRoomsMode) return false;

  return true;
}

/**
  Derives display items for the mobile 2-column list feed.
  Places ads to guarantee strict alternating grid column placement:
  - Ad 1 (1st ad): Index 5  (Row 3, Col 2 -> RIGHT)
  - Ad 2 (2nd ad): Index 10 (Row 6, Col 1 -> LEFT)
  - Ad 3 (3rd ad): Index 17 (Row 9, Col 2 -> RIGHT)
  - Ad 4 (4th ad): Index 22 (Row 12, Col 1 -> LEFT)
 */
export function deriveFeedDisplayItems(options: FeedAdsOptions): FeedItem[] {
  const { places } = options;

  if (!shouldShowAdsInFeed(options)) {
    return places.map((place) => ({ type: 'place', place }));
  }

  const items: FeedItem[] = [];
  let placeIdx = 0;
  let adCount = 0;

  while (placeIdx < places.length) {
    const nextAdNumber = adCount + 1;
    // For 2-column mobile grid:
    // Odd ad numbers (1, 3, 5...) land on index 6k - 1 (odd -> Col 2 / RIGHT)
    // Even ad numbers (2, 4, 6...) land on index 6k - 2 (even -> Col 1 / LEFT)
    const adTargetIndex = nextAdNumber % 2 === 1
      ? 6 * (nextAdNumber - 1) + 5
      : 6 * (nextAdNumber - 2) + 10;

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
