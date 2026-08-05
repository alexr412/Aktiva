import assert from 'assert';
import {
  calculateDistanceKm,
  calculateDistance,
  extractCoordinates,
  formatDistance
} from './geo-utils';

console.log('--- RUNNING AKTIVA GEO UTILS & DISTANCE TESTS ---');

// 1. Correct Haversine calculation in km
function testHaversineCalculation() {
  console.log('Test 1: Haversine calculation in km...');
  // Bielefeld (52.026, 8.522) to Herford (52.133, 8.675) ~15.5 km
  const dist = calculateDistanceKm(52.026, 8.522, 52.133, 8.675);
  assert(dist !== null, 'Distance should not be null for valid coordinates');
  assert(dist > 14 && dist < 17, `Expected dist ~15.5km, got ${dist}`);

  // Same location should be 0km
  const zeroDist = calculateDistanceKm(52.026, 8.522, 52.026, 8.522);
  assert.strictEqual(zeroDist, 0);
  console.log('✅ Test 1 passed');
}

// 2. Invalid coordinates handling
function testInvalidCoordinates() {
  console.log('Test 2: Invalid coordinates...');
  assert.strictEqual(calculateDistanceKm(NaN, 8.522, 52.026, 8.522), null);
  assert.strictEqual(calculateDistanceKm(52.026, Infinity, 52.026, 8.522), null);
  assert.strictEqual(calculateDistanceKm('invalid' as any, 8.522, 52.026, 8.522), null);
  console.log('✅ Test 2 passed');
}

// 3. Missing values handling
function testMissingValues() {
  console.log('Test 3: Missing values...');
  assert.strictEqual(calculateDistanceKm(undefined, 8.522, 52.026, 8.522), null);
  assert.strictEqual(calculateDistanceKm(null, 8.522, 52.026, 8.522), null);
  assert.strictEqual(calculateDistanceKm(52.026, 8.522, null, 8.522), null);
  console.log('✅ Test 3 passed');
}

// 4. Latitude and Longitude bounds check
function testCoordinateBounds() {
  console.log('Test 4: Coordinate bounds...');
  assert.strictEqual(calculateDistanceKm(91, 8.522, 52.026, 8.522), null); // Lat > 90
  assert.strictEqual(calculateDistanceKm(-91, 8.522, 52.026, 8.522), null); // Lat < -90
  assert.strictEqual(calculateDistanceKm(52.026, 181, 52.026, 8.522), null); // Lng > 180
  assert.strictEqual(calculateDistanceKm(52.026, -181, 52.026, 8.522), null); // Lng < -180
  console.log('✅ Test 4 passed');
}

// 5. GeoJSON [longitude, latitude] array order
function testGeoJsonOrder() {
  console.log('Test 5: GeoJSON [longitude, latitude] array format...');
  const geoJsonItem = {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [8.522, 52.026] // [lon, lat]
    }
  };
  const coords = extractCoordinates(geoJsonItem);
  assert(coords !== null, 'Coordinates should be extracted');
  assert.strictEqual(coords.lat, 52.026, 'Latitude should be second element');
  assert.strictEqual(coords.lng, 8.522, 'Longitude should be first element');
  console.log('✅ Test 5 passed');
}

// 6. Supported object formats
function testSupportedObjectFormats() {
  console.log('Test 6: Supported object formats...');
  
  // Format 1: { lat, lng }
  const c1 = extractCoordinates({ lat: 52.026, lng: 8.522 });
  assert.deepStrictEqual(c1, { lat: 52.026, lng: 8.522 });

  // Format 2: { lat, lon }
  const c2 = extractCoordinates({ lat: 52.026, lon: 8.522 });
  assert.deepStrictEqual(c2, { lat: 52.026, lng: 8.522 });

  // Format 3: { latitude, longitude }
  const c3 = extractCoordinates({ latitude: 52.026, longitude: 8.522 });
  assert.deepStrictEqual(c3, { lat: 52.026, lng: 8.522 });

  // Format 4: { location: { lat, lng } }
  const c4 = extractCoordinates({ location: { lat: 52.026, lng: 8.522 } });
  assert.deepStrictEqual(c4, { lat: 52.026, lng: 8.522 });

  // Format 5: { location: { latitude, longitude } }
  const c5 = extractCoordinates({ location: { latitude: 52.026, longitude: 8.522 } });
  assert.deepStrictEqual(c5, { lat: 52.026, lng: 8.522 });

  // Format 6: { coordinates: [8.522, 52.026] }
  const c6 = extractCoordinates({ coordinates: [8.522, 52.026] });
  assert.deepStrictEqual(c6, { lat: 52.026, lng: 8.522 });

  // String coordinates parsing
  const c7 = extractCoordinates({ lat: '52.026', lon: '8.522' });
  assert.deepStrictEqual(c7, { lat: 52.026, lng: 8.522 });

  console.log('✅ Test 6 passed');
}

// 7. Distance formatting under 1km
function testFormatDistanceUnder1Km() {
  console.log('Test 7: Formatting under 1 km...');
  assert.strictEqual(formatDistance(0.4), '400m');
  assert.strictEqual(formatDistance(0.05), '50m');
  assert.strictEqual(formatDistance(0.999), '999m');
  assert.strictEqual(formatDistance(0), '0m');
  console.log('✅ Test 7 passed');
}

// 8. Distance formatting >= 1km
function testFormatDistanceOver1Km() {
  console.log('Test 8: Formatting >= 1 km...');
  assert.strictEqual(formatDistance(1.0), '1.0km');
  assert.strictEqual(formatDistance(2.5), '2.5km');
  assert.strictEqual(formatDistance(12.84), '12.8km');
  console.log('✅ Test 8 passed');
}

// 9. NaN, Infinity, negative distance handling
function testSpecialNumericValues() {
  console.log('Test 9: Special numeric values (NaN, Infinity, negative)...');
  assert.strictEqual(formatDistance(NaN), null);
  assert.strictEqual(formatDistance(Infinity), null);
  assert.strictEqual(formatDistance(-1), null);
  assert.strictEqual(formatDistance(null), null);
  assert.strictEqual(formatDistance(undefined), null);
  console.log('✅ Test 9 passed');
}

// 10. Identical Formatter Output for Feed and Details
function testIdenticalFormatterOutput() {
  console.log('Test 10: Identical Formatter Output...');
  const userLat = 52.026;
  const userLng = 8.522;
  const targetPlace = { lat: 52.050, lon: 8.550 };

  // Simulated Feed Card calculation
  const feedKm = calculateDistanceKm(userLat, userLng, targetPlace.lat, targetPlace.lon);
  const feedText = formatDistance(feedKm);

  // Simulated Details calculation using extractCoordinates & calculateDistanceKm
  const targetCoords = extractCoordinates(targetPlace)!;
  const detailsKm = calculateDistanceKm(userLat, userLng, targetCoords.lat, targetCoords.lng);
  const detailsText = formatDistance(detailsKm);

  assert.strictEqual(feedText, detailsText);
  assert.strictEqual(feedText, '3.3km');
  console.log('✅ Test 10 passed');
}

// ----------------------------------------------------
// PLACE DETAILS COMPONENT DISTANCE RESOLUTION LOGIC TESTS
// ----------------------------------------------------

function simulatePlaceDetailsDistanceResolution(
  position: { latitude: number; longitude: number } | null,
  place: any
): string {
  const targetCoords = extractCoordinates(place);
  let effectiveKm: number | null = null;

  if (position && targetCoords) {
    effectiveKm = calculateDistanceKm(
      position.latitude,
      position.longitude,
      targetCoords.lat,
      targetCoords.lng
    );
  } else if (
    place &&
    place.distance !== undefined &&
    place.distance !== null &&
    typeof place.distance === 'number' &&
    !isNaN(place.distance) &&
    isFinite(place.distance) &&
    place.distance >= 0
  ) {
    effectiveKm = place.distance;
  }

  const formatted = formatDistance(effectiveKm);
  return formatted || '---';
}

function testPlaceDetailsLogic() {
  console.log('\n--- RUNNING PLACE DETAILS INTEGRATION TESTS ---');

  // Test Case 1: Identical feed & details text
  console.log('Integration Test 1: Feed and details show identical distance text');
  const userPosition = { latitude: 52.026, longitude: 8.522 };
  const target = { lat: 52.050, lon: 8.550, distance: 3.3 };
  const detailsResult = simulatePlaceDetailsDistanceResolution(userPosition, target);
  const feedResult = formatDistance(calculateDistanceKm(userPosition.latitude, userPosition.longitude, target.lat, target.lon));
  assert.strictEqual(detailsResult, feedResult);
  assert.strictEqual(detailsResult, '3.3km');
  console.log('✅ Integration Test 1 passed');

  // Test Case 2: Effective location update recalculates distance
  console.log('Integration Test 2: effectiveLocation update refreshes detail view distance');
  const posA = { latitude: 52.026, longitude: 8.522 };
  const posB = { latitude: 52.026, longitude: 8.523 }; // User moved ~70m closer
  const placeTarget = { lat: 52.026, lon: 8.528 }; // ~400m away originally
  const distA = simulatePlaceDetailsDistanceResolution(posA, placeTarget);
  const distB = simulatePlaceDetailsDistanceResolution(posB, placeTarget);
  assert.strictEqual(distA, '411m');
  assert.strictEqual(distB, '342m');
  assert.notStrictEqual(distA, distB);
  console.log('✅ Integration Test 2 passed');

  // Test Case 3: Stale place.distance on card object is ignored when live location is present
  console.log('Integration Test 3: Stale card distance is ignored when live location is present');
  const livePos = { latitude: 52.026, longitude: 8.522 };
  const cardWithStaleDist = { lat: 52.050, lon: 8.550, distance: 99.9 }; // Stale distance says 99.9km
  const computedDist = simulatePlaceDetailsDistanceResolution(livePos, cardWithStaleDist);
  assert.strictEqual(computedDist, '3.3km'); // Ignores 99.9, computes real 3.3km
  console.log('✅ Integration Test 3 passed');

  // Test Case 4: Valid kilometer fallback used when live position is null
  console.log('Integration Test 4: Valid kilometer fallback used when live position is null');
  const fallbackResult = simulatePlaceDetailsDistanceResolution(null, { name: 'Test Place', distance: 2.5 });
  assert.strictEqual(fallbackResult, '2.5km');
  console.log('✅ Integration Test 4 passed');

  // Test Case 5: Missing target coordinates leads to '---' fallback
  console.log('Integration Test 5: Missing target coordinates leads to "---"');
  const missingCoordsResult = simulatePlaceDetailsDistanceResolution(userPosition, { name: 'No Coords Place' });
  assert.strictEqual(missingCoordsResult, '---');
  console.log('✅ Integration Test 5 passed');

  // Test Case 6: Invalid/NaN/undefined states never render 'NaN km', 'undefined km', 'null km' or crash
  console.log('Integration Test 6: No "NaN km", "undefined km", or crashes');
  assert.strictEqual(simulatePlaceDetailsDistanceResolution(null, { distance: NaN }), '---');
  assert.strictEqual(simulatePlaceDetailsDistanceResolution(null, { distance: Infinity }), '---');
  assert.strictEqual(simulatePlaceDetailsDistanceResolution(null, { distance: undefined }), '---');
  assert.strictEqual(simulatePlaceDetailsDistanceResolution({ latitude: NaN, longitude: 8.522 }, { lat: 52.026, lon: 8.522 }), '---');
  console.log('✅ Integration Test 6 passed');
}

// Run all test functions
testHaversineCalculation();
testInvalidCoordinates();
testMissingValues();
testCoordinateBounds();
testGeoJsonOrder();
testSupportedObjectFormats();
testFormatDistanceUnder1Km();
testFormatDistanceOver1Km();
testSpecialNumericValues();
testIdenticalFormatterOutput();
testPlaceDetailsLogic();

console.log('\n🎉 ALL GEO UTILS AND DISTANCE TESTS PASSED SUCCESSFULLY!');
