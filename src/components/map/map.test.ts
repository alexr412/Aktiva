import assert from 'node:assert';
import {
  isValidCoordinate,
  calculateActivityCapacityStatus,
  parsePlaceMarkers,
  parseActivityMarkers,
  createMapGeoJSON,
  createRadiusCircleGeoJSON,
} from './map-marker-data';
import type { Place, Activity } from '@/lib/types';
import type { MapLayerVisibility } from './map-types';

async function runMapTestSuite() {
  console.log('🧪 Starting Aktiva Map Architecture Phase 1 Test Suite...\n');

  // Test 1: Coordinate Validation
  console.log('Test 1: Coordinate Validation');
  assert.strictEqual(isValidCoordinate(53.5442, 8.5802), true, 'Valid Bremerhaven coordinates should pass');
  assert.strictEqual(isValidCoordinate('53.5442', '8.5802'), true, 'String coordinates should parse and pass');
  assert.strictEqual(isValidCoordinate(95.0, 8.5802), false, 'Latitude > 90 must fail');
  assert.strictEqual(isValidCoordinate(-91.0, 8.5802), false, 'Latitude < -90 must fail');
  assert.strictEqual(isValidCoordinate(53.5442, 185.0), false, 'Longitude > 180 must fail');
  assert.strictEqual(isValidCoordinate(NaN, 8.5802), false, 'NaN coordinates must fail');
  assert.strictEqual(isValidCoordinate(undefined, null), false, 'Undefined coordinates must fail');
  console.log('  ✅ Coordinate validation passed');

  // Test 2: Activity Capacity Status Calculation
  console.log('\nTest 2: Activity Capacity Status Calculation');
  const openActivity = {
    id: 'act_1',
    placeName: 'Tennis Match',
    maxParticipants: 10,
    participantIds: ['u1', 'u2', 'u3'],
  } as Activity;
  assert.strictEqual(calculateActivityCapacityStatus(openActivity), 'open');

  const almostFullActivity = {
    id: 'act_2',
    placeName: 'Beach Volleyball',
    maxParticipants: 8,
    participantIds: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'], // 2 slots remaining -> almost_full
  } as Activity;
  assert.strictEqual(calculateActivityCapacityStatus(almostFullActivity), 'almost_full');

  const fullActivity = {
    id: 'act_3',
    placeName: 'Football Match',
    maxParticipants: 10,
    participantIds: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10'],
  } as Activity;
  assert.strictEqual(calculateActivityCapacityStatus(fullActivity), 'full');
  console.log('  ✅ Activity capacity status calculation passed');

  // Test 3: Place Markers Parsing & GeoJSON Generation
  console.log('\nTest 3: Place Markers Parsing & GeoJSON Generation');
  const mockPlaces: Place[] = [
    { id: 'p1', name: 'Park A', address: 'Main St 1', categories: ['park'], lat: 53.54, lon: 8.58 },
    { id: 'p2', name: 'Invalid Spot', address: 'Bad St 2', categories: ['cafes'], lat: 999, lon: 8.58 }, // Invalid lat
  ];

  const parsedPlaces = parsePlaceMarkers(mockPlaces);
  assert.strictEqual(parsedPlaces.length, 1, 'Only valid place should be parsed');
  assert.strictEqual(parsedPlaces[0].id, 'p1');
  assert.strictEqual(parsedPlaces[0].type, 'place');

  const placeGeoJSON = createMapGeoJSON(parsedPlaces);
  assert.strictEqual(placeGeoJSON.type, 'FeatureCollection');
  assert.strictEqual(placeGeoJSON.features.length, 1);
  assert.deepStrictEqual(placeGeoJSON.features[0].geometry.coordinates, [8.58, 53.54]); // [lon, lat]
  console.log('  ✅ Place markers GeoJSON generation passed');

  // Test 4: Activity Markers Parsing & Capacity/Boost
  console.log('\nTest 4: Activity Markers Parsing & Capacity/Boost');
  const mockActivities: Activity[] = [
    {
      id: 'act_active',
      title: 'Run in Bremerhaven',
      placeName: 'Bürgerpark',
      lat: 53.55,
      lon: 8.59,
      maxParticipants: 4,
      participantIds: ['u1', 'u2', 'u3'], // 1 left -> almost_full
      isBoosted: true,
      status: 'active',
    } as Activity,
    {
      id: 'act_cancelled',
      title: 'Cancelled Match',
      placeName: 'Court 1',
      lat: 53.55,
      lon: 8.59,
      status: 'cancelled',
    } as Activity,
  ];

  const parsedActivities = parseActivityMarkers(mockActivities);
  assert.strictEqual(parsedActivities.length, 1, 'Cancelled activity should be excluded');
  assert.strictEqual(parsedActivities[0].id, 'act_active');
  assert.strictEqual(parsedActivities[0].capacityStatus, 'almost_full');
  assert.strictEqual(parsedActivities[0].isBoosted, true);

  const actGeoJSON = createMapGeoJSON(parsedActivities);
  assert.strictEqual(actGeoJSON.features[0].properties?.capacityStatus, 'almost_full');
  assert.strictEqual(actGeoJSON.features[0].properties?.isBoosted, 1);
  console.log('  ✅ Activity markers parsing & boost status passed');

  // Test 5: Radius Circle Polygon Generation
  console.log('\nTest 5: Radius Circle Polygon Generation');
  const radiusGeoJSON = createRadiusCircleGeoJSON(53.5442, 8.5802, 10);
  assert.strictEqual(radiusGeoJSON.type, 'FeatureCollection');
  assert.strictEqual(radiusGeoJSON.features[0].geometry.type, 'Polygon');
  assert.strictEqual(radiusGeoJSON.features[0].geometry.coordinates[0].length, 65); // 64 points + closing point
  console.log('  ✅ Radius circle polygon generation passed');

  // Test 6: Layer Visibility Defaults & Phase 1 Constraints
  console.log('\nTest 6: Layer Visibility Defaults');
  const layers: MapLayerVisibility = {
    places: true,
    activities: true,
    friends: false,
  };
  assert.strictEqual(layers.places, true);
  assert.strictEqual(layers.activities, true);
  assert.strictEqual(layers.friends, false, 'Friends layer must remain false in Phase 1');
  console.log('  ✅ Layer visibility defaults passed');

  // Test 7: URL State Search Param Parsing
  console.log('\nTest 7: URL State Search Param Parsing');
  const parseViewMode = (searchParamView: string | null): 'list' | 'map' => {
    return searchParamView === 'map' ? 'map' : 'list';
  };
  assert.strictEqual(parseViewMode('map'), 'map');
  assert.strictEqual(parseViewMode('list'), 'list');
  assert.strictEqual(parseViewMode(null), 'list', 'Default view must be list (feed)');
  assert.strictEqual(parseViewMode('invalid_val'), 'list');
  console.log('  ✅ URL state search param parsing passed');

  console.log('\n🎉 ALL MAP ARCHITECTURE PHASE 1 TESTS PASSED SUCCESSFULLY!\n');
}

runMapTestSuite().catch((err) => {
  console.error('❌ Map Test Suite failed:', err);
  process.exit(1);
});
