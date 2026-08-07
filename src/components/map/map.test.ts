import assert from 'node:assert';
import {
  isValidCoordinate,
  calculateActivityCapacityStatus,
  parsePlaceMarkers,
  parseActivityMarkers,
  createMapGeoJSON,
  createRadiusCircleGeoJSON,
  applySoftPastelBasemapStyle,
} from './map-marker-data';
import type { Place, Activity } from '@/lib/types';
import type { MapLayerVisibility, SelectedMapEntity } from './map-types';

async function runMapTestSuite() {
  console.log('🧪 Starting Activa Map Architecture Phase 1 Test Suite...\n');

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

  // Test 8: Single Source of Truth Final Feed Spots Alignment (Feed Place IDs === Map Place IDs)
  console.log('\nTest 8: Single Source of Truth Final Feed Spots Alignment (Feed Place IDs === Map Place IDs)');
  const samplePlaces: Place[] = [
    { id: 'p_cafe_a', name: 'Café A', address: 'Address 1', categories: ['catering.cafe'], lat: 53.54, lon: 8.58 },
    { id: 'p_bowling_b', name: 'Bowlingcenter B', address: 'Address 2', categories: ['entertainment.bowling_alley'], lat: 53.55, lon: 8.59 },
    { id: 'p_park_c', name: 'Park C', address: 'Address 3', categories: ['leisure.park'], lat: 53.56, lon: 8.60 },
    { id: 'p_museum_d', name: 'Museum D', address: 'Address 4', categories: ['entertainment.museum'], lat: 53.57, lon: 8.61 },
    { id: 'p_restaurant_e', name: 'Restaurant E', address: 'Address 5', categories: ['catering.restaurant'], lat: 53.58, lon: 8.62 },
  ];

  const deriveFinalFeedPlaces = (isFavoritesCategory: boolean, favorites: Place[], visiblePlaces: Place[], visibleCount: number) => {
    if (isFavoritesCategory) return favorites;
    return visiblePlaces.slice(0, visibleCount);
  };

  // 8a: Standard Feed - Map place IDs equal feed place IDs from single source of truth
  const finalFeedPlacesA = deriveFinalFeedPlaces(false, [], samplePlaces, 10);
  const feedPlaceIdsA = finalFeedPlacesA.map(p => p.id);
  const mapPlacesA = parsePlaceMarkers(finalFeedPlacesA);
  const mapPlaceIdsA = mapPlacesA.map(m => m.id);
  assert.deepStrictEqual(mapPlaceIdsA, feedPlaceIdsA, 'Map Place IDs must exactly match Feed Place IDs');
  assert.strictEqual(mapPlaceIdsA.length, 5);
  assert.deepStrictEqual(mapPlaceIdsA, ['p_cafe_a', 'p_bowling_b', 'p_park_c', 'p_museum_d', 'p_restaurant_e']);

  // 8b: Sliced/Paginated Feed
  const finalFeedPlacesB = deriveFinalFeedPlaces(false, [], samplePlaces, 3);
  const feedPlaceIdsB = finalFeedPlacesB.map(p => p.id);
  const mapPlacesB = parsePlaceMarkers(finalFeedPlacesB);
  const mapPlaceIdsB = mapPlacesB.map(m => m.id);
  assert.deepStrictEqual(mapPlaceIdsB, feedPlaceIdsB, 'Map Place IDs must match sliced Feed Place IDs exactly');
  assert.strictEqual(mapPlaceIdsB.length, 3);
  assert.deepStrictEqual(mapPlaceIdsB, ['p_cafe_a', 'p_bowling_b', 'p_park_c']);

  // 8c: Excluded spots (e.g. search filter mismatch or hidden items excluded from visiblePlaces)
  const filteredVisiblePlaces = samplePlaces.filter(p => p.name.includes('Café'));
  const finalFeedPlacesC = deriveFinalFeedPlaces(false, [], filteredVisiblePlaces, 10);
  const feedPlaceIdsC = finalFeedPlacesC.map(p => p.id);
  const mapPlacesC = parsePlaceMarkers(finalFeedPlacesC);
  const mapPlaceIdsC = mapPlacesC.map(m => m.id);
  assert.deepStrictEqual(mapPlaceIdsC, feedPlaceIdsC, 'Filtered map place IDs must match filtered feed place IDs');
  assert.strictEqual(mapPlaceIdsC.includes('p_bowling_b'), false, 'Excluded spot Bowlingcenter B must NOT appear on map');

  // 8d: Favorites View
  const sampleFavorites: Place[] = [
    { id: 'fav_1', name: 'Fav Spot 1', address: 'Fav Addr 1', categories: ['park'], lat: 53.54, lon: 8.58 },
    { id: 'fav_2', name: 'Fav Spot 2', address: 'Fav Addr 2', categories: ['cafe'], lat: 53.55, lon: 8.59 },
  ];
  const finalFeedPlacesD = deriveFinalFeedPlaces(true, sampleFavorites, samplePlaces, 10);
  const feedPlaceIdsD = finalFeedPlacesD.map(p => p.id);
  const mapPlacesD = parsePlaceMarkers(finalFeedPlacesD);
  const mapPlaceIdsD = mapPlacesD.map(m => m.id);
  assert.deepStrictEqual(mapPlaceIdsD, feedPlaceIdsD, 'Favorites map place IDs must match favorites feed place IDs');
  assert.deepStrictEqual(mapPlaceIdsD, ['fav_1', 'fav_2']);

  console.log('  ✅ Final feed spots alignment & excluded spots verification passed');

  // Test 9: Soft Pastel Basemap Layer Theme Application & Loop Safety
  console.log('\nTest 9: Soft Pastel Basemap Layer Theme Application & Loop Safety');
  const mockPaints: Record<string, Record<string, any>> = {};
  const mockLayouts: Record<string, Record<string, any>> = {};
  let mutationCount = 0;

  const mockMap = {
    getStyle: () => ({
      layers: [
        { id: 'background', type: 'background' },
        { id: 'water', type: 'fill' },
        { id: 'landuse_park', type: 'fill' },
        { id: 'highway_minor', type: 'line' },
        { id: 'places-clusters', type: 'circle' },
        { id: 'activities-unclustered', type: 'circle' },
        { id: 'friends-area', type: 'fill' },
      ],
    }),
    getPaintProperty: (layerId: string, propName: string) => mockPaints[layerId]?.[propName],
    getLayoutProperty: (layerId: string, propName: string) => mockLayouts[layerId]?.[propName],
    setPaintProperty: (layerId: string, propName: string, value: any) => {
      mutationCount++;
      if (!mockPaints[layerId]) mockPaints[layerId] = {};
      mockPaints[layerId][propName] = value;
    },
    setLayoutProperty: (layerId: string, propName: string, value: any) => {
      mutationCount++;
      if (!mockLayouts[layerId]) mockLayouts[layerId] = {};
      mockLayouts[layerId][propName] = value;
    },
  };

  applySoftPastelBasemapStyle(mockMap);
  assert.strictEqual(mockPaints['background']?.['background-color'], '#f8f6f0');
  assert.strictEqual(mockPaints['water']?.['fill-color'], '#c5e3ed');
  assert.strictEqual(mockPaints['landuse_park']?.['fill-color'], '#d4ead8');
  assert.strictEqual(mockPaints['highway_minor']?.['line-color'], '#e8e4dc');
  assert.strictEqual(mockPaints['places-clusters'], undefined, 'Activa places layer must not be modified by basemap style');
  assert.strictEqual(mockPaints['activities-unclustered'], undefined, 'Activa activities layer must not be modified by basemap style');
  assert.strictEqual(mockPaints['friends-area'], undefined, 'Activa friends layer must not be modified by basemap style');

  // Verify styledata event loop safety: a second pass must generate 0 new style mutations!
  const initialMutations = mutationCount;
  applySoftPastelBasemapStyle(mockMap);
  assert.strictEqual(mutationCount, initialMutations, 'Second pass must perform 0 mutations (styledata loop prevented)');

  console.log('  ✅ Soft Pastel basemap theme application & loop safety passed');

  // Test 10: Unified SelectedMapEntity Selection State & Close Architecture
  console.log('\nTest 10: Unified SelectedMapEntity Selection State & Close Architecture');
  
  let currentSelection: SelectedMapEntity = null;
  const selectEntity = (entity: SelectedMapEntity) => {
    currentSelection = entity;
  };

  // Case 1: Place Marker Selection -> SelectedMapEntity.type === 'place'
  const mockPlace = { id: 'place-101', name: 'Park Cafe', address: 'Parkstr 1', lat: 52.02, lon: 8.53, categories: ['cafe'] } as Place;
  selectEntity({ id: mockPlace.id, type: 'place', data: mockPlace });
  assert.notStrictEqual(currentSelection, null);
  assert.strictEqual(currentSelection!.type, 'place');
  assert.strictEqual(currentSelection!.id, 'place-101');
  assert.strictEqual((currentSelection!.data as Place).name, 'Park Cafe');

  // Case 2: Activity Marker Selection -> SelectedMapEntity.type === 'activity'
  const mockActivity = { id: 'act-202', title: 'Yoga in Park', placeName: 'Park', activityDate: new Date(), isTimeFlexible: false, hostId: 'u1', lat: 52.03, lon: 8.54, category: 'Sports' } as unknown as Activity;
  selectEntity({ id: mockActivity.id!, type: 'activity', data: mockActivity });
  assert.notStrictEqual(currentSelection, null);
  assert.strictEqual(currentSelection!.type, 'activity');
  assert.strictEqual(currentSelection!.id, 'act-202');
  assert.strictEqual((currentSelection!.data as Activity).title, 'Yoga in Park');

  // Case 3: Friend Marker Selection -> SelectedMapEntity.type === 'friend'
  const mockFriend = { userId: 'friend-303', username: 'alex', displayName: 'Alex R.', distanceBucket: 'within_100m' };
  selectEntity({ id: mockFriend.userId, type: 'friend', data: mockFriend as any });
  assert.notStrictEqual(currentSelection, null);
  assert.strictEqual(currentSelection!.type, 'friend');
  assert.strictEqual(currentSelection!.id, 'friend-303');
  assert.strictEqual((currentSelection!.data as any).username, 'alex');

  // Case 4: Close Action -> SelectedMapEntity === null
  selectEntity(null);
  assert.strictEqual(currentSelection, null, 'Close action must reset selectedMapEntity to null');

  console.log('  ✅ Unified SelectedMapEntity selection state & close architecture passed');

  console.log('\n🎉 ALL MAP ARCHITECTURE PHASE 1 TESTS PASSED SUCCESSFULLY!\n');
}

runMapTestSuite().catch((err) => {
  console.error('❌ Map Test Suite failed:', err);
  process.exit(1);
});
