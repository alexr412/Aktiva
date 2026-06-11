import assert from 'assert';
import { isDuplicate } from './duplicate-detector';
import type { Place } from './types';

console.log('--- RUNNING DUPLICATE DETECTOR TESTS ---');

function testSameAddressZooEnclosures() {
  console.log('Running testSameAddressZooEnclosures...');
  
  const p1: Place = {
    id: 'place_olderdissen_wisente',
    name: 'Wisente',
    address: 'Dornberger Straße 149a, 33619 Bielefeld',
    categories: ['tourism.attraction'],
    lat: 52.0298,
    lon: 8.5023
  };

  const p2: Place = {
    id: 'place_olderdissen_murmeltiere',
    name: 'Murmeltiere',
    address: 'Dornberger Straße 149a, 33619 Bielefeld',
    categories: ['tourism.attraction'],
    // 80 meters away
    lat: 52.0298,
    lon: 8.5035
  };

  const p3: Place = {
    id: 'place_olderdissen_storch',
    name: 'Storchenhorst',
    address: 'Dornberger Straße 149a, 33619 Bielefeld',
    categories: ['tourism.attraction'],
    // 400 meters away (too far to be considered a duplicate enclosure of the same spot)
    lat: 52.0298,
    lon: 8.5085
  };

  const p4: Place = {
    id: 'place_other_address',
    name: 'Different Attraction',
    address: 'Some Other Address 123, 33619 Bielefeld',
    categories: ['tourism.attraction'],
    // 80 meters away but different address
    lat: 52.0298,
    lon: 8.5035
  };

  // p1 and p2 should be duplicates because they share the exact address, are close, and are attractions.
  assert.strictEqual(isDuplicate(p1, p2), true, 'p1 and p2 must be duplicates');
  
  // p1 and p3 should NOT be duplicates because they are 400m apart.
  assert.strictEqual(isDuplicate(p1, p3), false, 'p1 and p3 must NOT be duplicates (too far)');

  // p1 and p4 should NOT be duplicates because they have different addresses.
  assert.strictEqual(isDuplicate(p1, p4), false, 'p1 and p4 must NOT be duplicates (different address)');
  
  console.log('✅ testSameAddressZooEnclosures passed');
}

function testDifferentRestaurantsSameAddress() {
  console.log('Running testDifferentRestaurantsSameAddress...');
  
  const p1: Place = {
    id: 'restaurant_a',
    name: 'Burger Joint',
    address: 'Food Court Street 1, Berlin',
    categories: ['catering.restaurant'],
    lat: 52.5200,
    lon: 13.4050
  };

  const p2: Place = {
    id: 'restaurant_b',
    name: 'Sushi Bar',
    address: 'Food Court Street 1, Berlin',
    categories: ['catering.restaurant'],
    lat: 52.5200,
    lon: 13.4052
  };

  // They share the address and are close, but neither is a tourism/zoo/attraction/etc., so they should not be deduplicated.
  assert.strictEqual(isDuplicate(p1, p2), false, 'Different restaurants at the same food court address should NOT be duplicates');
  console.log('✅ testDifferentRestaurantsSameAddress passed');
}

try {
  testSameAddressZooEnclosures();
  testDifferentRestaurantsSameAddress();
  console.log('🎉 ALL DUPLICATE DETECTOR TESTS PASSED! 🎉');
} catch (error) {
  console.error('❌ TEST FAILED:', error);
  process.exit(1);
}
