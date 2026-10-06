import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toGeocodingFeatures } from './geocoding-results';
import { applyFilters } from './geoapify';
import { isFeedCategoryHidden } from './feed-category-visibility';

test('singular geocoding categories survive the feed filter without any detail fetches', () => {
  const [feature] = toGeocodingFeatures({ results: [{ place_id: 'zoo', name: 'Zoo am Meer', category: 'entertainment.zoo', lat: 53, lon: 8 }] });
  assert.deepEqual(feature.properties.categories, ['entertainment.zoo']);
  assert.equal(applyFilters([{ properties: feature.properties, tags: feature.properties.categories }], [], [], true).length, 1);
  assert.deepEqual(feature.geometry.coordinates, [8, 53]);
});
test('GeoJSON retains geometry, existing tags and hidden categories; missing categories are never invented', () => {
  const features = toGeocodingFeatures({ features: [
    { properties: { place_id: 'church', category: 'religion.place_of_worship' }, geometry: { coordinates: [8, 53] } },
    { properties: { categories: ['entertainment.cinema'], category: 'other' } },
    { properties: { name: 'Address only' } },
  ] });
  assert.equal(features[0].properties.lat, 53);
  assert.equal(isFeedCategoryHidden(features[0].properties.categories, ['religion']), true);
  assert.deepEqual(features[1].properties.categories, ['entertainment.cinema']);
  assert.deepEqual(features[2].properties.categories, []);
});
