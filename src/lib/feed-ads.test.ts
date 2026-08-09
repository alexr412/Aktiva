import { deriveFeedDisplayItems, shouldShowAdsInFeed } from './feed-ads';
import type { Place } from './types';

function createMockPlace(id: string): Place {
  return {
    id,
    name: `Spot ${id}`,
    address: 'Test Str 1',
    categories: ['sights'],
    lat: 52.52,
    lon: 13.40,
  };
}

// 25 sample places to accommodate at least 4 ads
const samplePlaces: Place[] = Array.from({ length: 25 }, (_, i) =>
  createMockPlace(`place-${i + 1}`)
);

console.log('--- Running Extended Feed Ads Logic Tests ---');

// Test 1: Disabled on desktop
const desktopItems = deriveFeedDisplayItems({
  places: samplePlaces,
  isMobile: false,
});
console.assert(desktopItems.length === 25, 'Desktop should have 25 items without ads');
console.assert(desktopItems.every(i => i.type === 'place'), 'Desktop should only have places');

// Test 2: Disabled on category search or tab filter
const categoryItems = deriveFeedDisplayItems({
  places: samplePlaces,
  isMobile: true,
  activeCategory: ['sights'],
});
console.assert(categoryItems.length === 25, 'Active category should disable ads');

const searchItems = deriveFeedDisplayItems({
  places: samplePlaces,
  isMobile: true,
  searchQuery: 'Coffee',
});
console.assert(searchItems.length === 25, 'Active search query should disable ads');

const tabItems = deriveFeedDisplayItems({
  places: samplePlaces,
  isMobile: true,
  activeTabId: 'Favorites',
});
console.assert(tabItems.length === 25, 'Active tab filter should disable ads');

// Test 3: Mobile unfiltered feed positioning and grid column check
const mobileItems = deriveFeedDisplayItems({
  places: samplePlaces,
  isMobile: true,
  activeTabId: '',
  activeCategory: [],
  searchQuery: '',
});

// Find indices of all Ad items
const adEntries = mobileItems
  .map((item, index) => ({ item, index }))
  .filter((entry) => entry.item.type === 'ad');

console.assert(adEntries.length >= 4, `Expected at least 4 ads, found ${adEntries.length}`);

const ad1 = adEntries[0];
const ad2 = adEntries[1];
const ad3 = adEntries[2];
const ad4 = adEntries[3];

console.log(`Ad #1: Display Index = ${ad1.index}, Column = ${ad1.index % 2 === 1 ? 'RIGHT (Col 2)' : 'LEFT (Col 1)'}`);
console.log(`Ad #2: Display Index = ${ad2.index}, Column = ${ad2.index % 2 === 1 ? 'RIGHT (Col 2)' : 'LEFT (Col 1)'}`);
console.log(`Ad #3: Display Index = ${ad3.index}, Column = ${ad3.index % 2 === 1 ? 'RIGHT (Col 2)' : 'LEFT (Col 1)'}`);
console.log(`Ad #4: Display Index = ${ad4.index}, Column = ${ad4.index % 2 === 1 ? 'RIGHT (Col 2)' : 'LEFT (Col 1)'}`);

// Assert explicit display indices
console.assert(ad1.index === 5, `Ad #1 expected at index 5, got ${ad1.index}`);
console.assert(ad2.index === 10, `Ad #2 expected at index 10, got ${ad2.index}`);
console.assert(ad3.index === 17, `Ad #3 expected at index 17, got ${ad3.index}`);
console.assert(ad4.index === 22, `Ad #4 expected at index 22, got ${ad4.index}`);

// Assert grid column alignment (2-column mobile grid: odd index = Col 2/Right, even index = Col 1/Left)
console.assert(ad1.index % 2 === 1, 'Ad #1 must be in RIGHT column (odd display index)');
console.assert(ad2.index % 2 === 0, 'Ad #2 must be in LEFT column (even display index)');
console.assert(ad3.index % 2 === 1, 'Ad #3 must be in RIGHT column (odd display index)');
console.assert(ad4.index % 2 === 0, 'Ad #4 must be in LEFT column (even display index)');

// Test 4: Original places array non-mutation
console.assert(samplePlaces.length === 25, 'Sample places array length preserved');
console.assert(samplePlaces[0].id === 'place-1', 'First place in original array unchanged');

console.log('✓ All Extended Feed Ads tests passed successfully!');
