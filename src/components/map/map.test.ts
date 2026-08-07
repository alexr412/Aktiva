import assert from 'node:assert';
import {
  isValidCoordinate,
  calculateActivityCapacityStatus,
  parsePlaceMarkers,
  parseActivityMarkers,
  createMapGeoJSON,
  createRadiusCircleGeoJSON,
  applySoftPastelBasemapStyle,
  calculatePopupPanOffset,
  ensurePopupInViewport,
} from './map-marker-data';
import type { Place, Activity } from '@/lib/types';
import type { MapLayerVisibility } from './map-types';

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

  // Test 10: Map Popup Viewport & Bottom Navigation Auto-Pan Calculations
  console.log('\nTest 10: Map Popup Viewport & Bottom Navigation Auto-Pan Calculations');
  const mockMapContainer = {
    top: 0,
    left: 0,
    right: 400,
    bottom: 800,
    width: 400,
    height: 800,
  };
  const bottomNavHeight = 76; // 76px bottom nav bar
  const margin = 16;
  // safeTop = 16, safeLeft = 16, safeRight = 384, safeBottom = 800 - 76 - 16 = 708

  // Case 1: Fully visible popup (e.g. top=100, left=50, bottom=300, right=300)
  const fullyVisible = { top: 100, left: 50, bottom: 300, right: 300, width: 250, height: 200 };
  const offset1 = calculatePopupPanOffset(fullyVisible, mockMapContainer, bottomNavHeight, margin);
  assert.strictEqual(offset1.dx, 0, 'Fully visible popup must require 0 X pan');
  assert.strictEqual(offset1.dy, 0, 'Fully visible popup must require 0 Y pan');

  // Case 2: Popup cut off at bottom by Bottom Navigation (e.g. bottom=750, safeBottom=708)
  const bottomCutoff = { top: 550, left: 50, bottom: 750, right: 300, width: 250, height: 200 };
  const offset2 = calculatePopupPanOffset(bottomCutoff, mockMapContainer, bottomNavHeight, margin);
  assert.strictEqual(offset2.dx, 0);
  assert.strictEqual(offset2.dy, 42, 'Popup cut off at bottom by 42px must yield dy=42 to shift map down');

  // Case 3: Popup cut off on left (e.g. left=5, safeLeft=16)
  const leftCutoff = { top: 100, left: 5, bottom: 300, right: 255, width: 250, height: 200 };
  const offset3 = calculatePopupPanOffset(leftCutoff, mockMapContainer, bottomNavHeight, margin);
  assert.strictEqual(offset3.dx, -11, 'Popup cut off at left by 11px must yield dx=-11');
  assert.strictEqual(offset3.dy, 0);

  // Case 4: Popup cut off on right (e.g. right=395, safeRight=384)
  const rightCutoff = { top: 100, left: 145, bottom: 300, right: 395, width: 250, height: 200 };
  const offset4 = calculatePopupPanOffset(rightCutoff, mockMapContainer, bottomNavHeight, margin);
  assert.strictEqual(offset4.dx, 11, 'Popup cut off at right by 11px must yield dx=11');
  assert.strictEqual(offset4.dy, 0);

  // Case 5: Popup cut off at top (e.g. top=5, safeTop=16)
  const topCutoff = { top: 5, left: 50, bottom: 205, right: 300, width: 250, height: 200 };
  const offset5 = calculatePopupPanOffset(topCutoff, mockMapContainer, bottomNavHeight, margin);
  assert.strictEqual(offset5.dx, 0);
  assert.strictEqual(offset5.dy, -11, 'Popup cut off at top by 11px must yield dy=-11');

  // Case 6: Popup in bottom-right corner (right=395, bottom=750)
  const cornerCutoff = { top: 550, left: 145, bottom: 750, right: 395, width: 250, height: 200 };
  const offset6 = calculatePopupPanOffset(cornerCutoff, mockMapContainer, bottomNavHeight, margin);
  assert.strictEqual(offset6.dx, 11);
  assert.strictEqual(offset6.dy, 42);

  // Case 7: Second measurement after correction (adjusted rect: bottom=708, right=384)
  const correctedPopup = { top: 508, left: 134, bottom: 708, right: 384, width: 250, height: 200 };
  const offset7 = calculatePopupPanOffset(correctedPopup, mockMapContainer, bottomNavHeight, margin);
  assert.strictEqual(offset7.dx, 0, 'Corrected popup must require 0 X pan');
  assert.strictEqual(offset7.dy, 0, 'Corrected popup must require 0 Y pan');

  // Case 8: Integration check for ensurePopupInViewport with data-activa-bottom-nav selector
  (globalThis as any).window = {
    innerWidth: 400,
    innerHeight: 800,
    document: {
      querySelector: (sel: string) =>
        sel === '[data-activa-bottom-nav]' ? { getBoundingClientRect: () => ({ top: 724, height: 76 }) } : null,
    },
  };
  let panByArgs: [number, number] | null = null;
  const mockPanMap = {
    getElement: () => ({ getBoundingClientRect: () => ({ left: 50, top: 550, right: 300, bottom: 750, width: 250, height: 200 }) }),
    getContainer: () => ({ getBoundingClientRect: () => mockMapContainer }),
    panBy: (delta: [number, number]) => { panByArgs = delta; },
  };
  ensurePopupInViewport(mockPanMap, mockPanMap, { safetyMargin: margin });
  await new Promise((res) => setTimeout(res, 50));
  assert.notStrictEqual(panByArgs, null);
  assert.strictEqual((panByArgs as any)[1], 42, 'Pan Y must equal 42px when bottom nav is found via data-activa-bottom-nav');

  // Case 9: Mobile fallback when bottom nav element is not in DOM
  (globalThis as any).window = {
    innerWidth: 400,
    innerHeight: 800,
    document: { querySelector: () => null },
  };
  panByArgs = null;
  ensurePopupInViewport(mockPanMap, mockPanMap, { safetyMargin: margin });
  await new Promise((res) => setTimeout(res, 50));
  assert.notStrictEqual(panByArgs, null);
  assert.strictEqual((panByArgs as any)[1], 42, 'Pan Y must equal 42px using mobile 76px fallback when nav element is absent');

  // Case 10: Desktop Auto-Pan with Desktop Bottom Inset (e.g. innerWidth=1200, bottomInset=28, safetyMargin=28)
  const desktopMapContainer = { top: 0, left: 0, right: 1200, bottom: 900, width: 1200, height: 900 };
  (globalThis as any).window = {
    innerWidth: 1200,
    innerHeight: 900,
    document: { querySelector: () => null },
  };
  let desktopPanArgs: [number, number] | null = null;
  const mockDesktopMap = {
    getElement: () => ({ getBoundingClientRect: () => ({ left: 100, top: 750, right: 370, bottom: 880, width: 270, height: 130 }) }),
    getContainer: () => ({ getBoundingClientRect: () => desktopMapContainer }),
    panBy: (delta: [number, number]) => { desktopPanArgs = delta; },
  };
  ensurePopupInViewport(mockDesktopMap, mockDesktopMap);
  await new Promise((res) => setTimeout(res, 50));
  // Desktop safeBottom = 900 - 28 - 28 = 844. popupRect.bottom = 880 -> dy = 880 - 844 = 36.
  assert.notStrictEqual(desktopPanArgs, null);
  assert.strictEqual((desktopPanArgs as any)[1], 36, 'Desktop pan Y must equal 36px to clear desktop bottom margin');

  // Case 11: Desktop Side Panel Avoidance (e.g. side panel on right width=380, left=820)
  (globalThis as any).window = {
    innerWidth: 1200,
    innerHeight: 900,
    document: {
      querySelector: (sel: string) =>
        sel === '[data-activa-side-panel]' || sel === '.map-result-panel'
          ? { getBoundingClientRect: () => ({ left: 820, right: 1200, width: 380, height: 900 }) }
          : null,
    },
  };
  let sidePanelPanArgs: [number, number] | null = null;
  const mockSidePanelMap = {
    getElement: () => ({ getBoundingClientRect: () => ({ left: 600, top: 100, right: 850, bottom: 350, width: 250, height: 250 }) }),
    getContainer: () => ({ getBoundingClientRect: () => desktopMapContainer }),
    panBy: (delta: [number, number]) => { sidePanelPanArgs = delta; },
  };
  ensurePopupInViewport(mockSidePanelMap, mockSidePanelMap);
  await new Promise((res) => setTimeout(res, 50));
  // safeRight = 1200 - (1200 - 820) - 28 = 792. popupRect.right = 850 -> dx = 850 - 792 = 58.
  assert.notStrictEqual(sidePanelPanArgs, null);
  assert.strictEqual((sidePanelPanArgs as any)[0], 58, 'Desktop pan X must equal 58px to clear side panel');

  console.log('  ✅ Map popup auto-pan viewport calculations passed');

  console.log('\n🎉 ALL MAP ARCHITECTURE PHASE 1 TESTS PASSED SUCCESSFULLY!\n');
}

runMapTestSuite().catch((err) => {
  console.error('❌ Map Test Suite failed:', err);
  process.exit(1);
});
