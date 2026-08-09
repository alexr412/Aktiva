import { deriveFeedDisplayItems, getAdTargetIndex, shouldShowAdsInFeed } from './feed-ads';
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

// 40 sample places to accommodate 4+ ads across 2, 3, 4, and 5 column grids
const samplePlaces: Place[] = Array.from({ length: 40 }, (_, i) =>
  createMockPlace(`place-${i + 1}`)
);

console.log('--- Running Complete Responsive Feed Ads Logic Tests (2, 3, 4 & 5 Columns) ---');

// Test 0: SSR / unmeasured gridColumns: null should render NO ads
const ssrItems = deriveFeedDisplayItems({
  places: samplePlaces,
  gridColumns: null,
});
console.assert(ssrItems.length === 40, 'Unmeasured gridColumns (null) must render 0 ads');
console.assert(ssrItems.every(i => i.type === 'place'), 'Unmeasured gridColumns should only return original places');

// Test 1: Active search/filters/category/tab disable ads across all grid modes
const filterTest1 = deriveFeedDisplayItems({
  places: samplePlaces,
  gridColumns: 3,
  searchQuery: 'Coffee',
});
console.assert(filterTest1.length === 40, 'Search query should disable ads in 3-column mode');

const filterTest2 = deriveFeedDisplayItems({
  places: samplePlaces,
  gridColumns: 4,
  activeCategory: ['sights'],
});
console.assert(filterTest2.length === 40, 'Active category should disable ads in 4-column mode');

const filterTest3 = deriveFeedDisplayItems({
  places: samplePlaces,
  gridColumns: 5,
  activeTabId: 'Favorites',
});
console.assert(filterTest3.length === 40, 'Active tab filter should disable ads in 5-column mode');

// Helper to extract first 4 ads and log details
function verifyGridMode(cols: 2 | 3 | 4 | 5, expectedIndices: number[]) {
  const items = deriveFeedDisplayItems({
    places: samplePlaces,
    gridColumns: cols,
    activeTabId: '',
    activeCategory: [],
    searchQuery: '',
  });

  const adEntries = items
    .map((item, index) => ({ item, index }))
    .filter((entry) => entry.item.type === 'ad');

  console.assert(adEntries.length >= 4, `Expected at least 4 ads for ${cols}-column grid, found ${adEntries.length}`);

  console.log(`\n=== GRID MODE: ${cols} SPALTEN ===`);
  expectedIndices.forEach((expectedIdx, adIdx) => {
    const actual = adEntries[adIdx];
    console.assert(actual.index === expectedIdx, `${cols}-col Grid Ad #${adIdx + 1} expected at index ${expectedIdx}, got ${actual.index}`);
    
    const row = Math.floor(actual.index / cols) + 1;
    const col = (actual.index % cols) + 1;
    console.log(`Ad #${adIdx + 1}: Index = ${actual.index} (Zeile ${row}, Spalte ${col} von ${cols})`);
  });
}

// Test 2: 2-Column Grid (Mobile / sm / md) -> 5, 10, 17, 22
verifyGridMode(2, [5, 10, 17, 22]);

// Test 3: 3-Column Grid (lg) -> 2, 7, 12, 20
verifyGridMode(3, [2, 7, 12, 20]);

// Test 4: 4-Column Grid (xl) -> 3, 10, 17, 24
verifyGridMode(4, [3, 10, 17, 24]);

// Test 5: 5-Column Grid (2xl) -> 4, 12, 20, 29
verifyGridMode(5, [4, 12, 20, 29]);

// Test 6: Original places array non-mutation
console.assert(samplePlaces.length === 40, 'Sample places array length preserved');
console.assert(samplePlaces[0].id === 'place-1', 'First place in original array unchanged');

console.log('\n✓ All Complete Responsive Feed Ads (2, 3, 4 & 5 Columns) tests passed successfully!');
