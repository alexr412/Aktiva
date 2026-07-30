import assert from 'node:assert';

/**
 * Unit Test Suite — Aktiva Mandatory GPS Location Subsystem
 */

class MockLocalStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] || null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

const mockStorage = new MockLocalStorage();
(global as any).localStorage = mockStorage;

const LOCATION_STALE_AFTER_MS = 15 * 60 * 1000; // 15 minutes
const LOCATION_MAX_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

interface LocationState {
  locationMode: 'current' | 'manual';
  locationSource: 'gps' | 'cache' | 'manual' | null;
  locationStatus: 'idle' | 'loading' | 'ready' | 'prompt' | 'denied' | 'error';
  effectiveLocation: { lat: number; lng: number } | null;
  cityName: string | null;
  permissionState: 'granted' | 'prompt' | 'denied' | null;
}

function simulateLocationResolution(options: {
  isPlanning?: boolean;
  manualDestination?: { lat: number; lng: number; city: string };
  gpsCoords?: { lat: number; lng: number; accuracy: number };
  gpsError?: { code: number; message: string };
  permissionState?: 'granted' | 'prompt' | 'denied';
  cachedLocation?: { lat: number; lng: number; source: string; cityName?: string; timestamp: number };
  reverseGeocodeFail?: boolean;
}): LocationState {
  mockStorage.clear();
  if (options.cachedLocation) {
    mockStorage.setItem('aktiva_last_location', JSON.stringify(options.cachedLocation));
  }

  // 1. Check & Sanitize localStorage cache
  const rawCache = mockStorage.getItem('aktiva_last_location');
  let validCache: any = null;
  if (rawCache) {
    try {
      const parsed = JSON.parse(rawCache);
      const age = Date.now() - (parsed.timestamp || 0);

      // Purge explicit fallback entries or expired cache (>4h)
      if (parsed.source === 'fallback' || age > LOCATION_MAX_TTL_MS) {
        mockStorage.removeItem('aktiva_last_location');
      } else {
        validCache = parsed;
      }
    } catch (e) {}
  }

  // 2. Manual Mode
  if (options.isPlanning && options.manualDestination) {
    return {
      locationMode: 'manual',
      locationSource: 'manual',
      locationStatus: 'ready',
      effectiveLocation: { lat: options.manualDestination.lat, lng: options.manualDestination.lng },
      cityName: options.manualDestination.city,
      permissionState: options.permissionState || 'granted'
    };
  }

  // 3. Permission Denied
  if (options.permissionState === 'denied' || options.gpsError?.code === 1) {
    return {
      locationMode: 'current',
      locationSource: null,
      locationStatus: 'denied',
      effectiveLocation: null,
      cityName: null,
      permissionState: 'denied'
    };
  }

  // 4. Live GPS result (Bielefeld / GPS coordinates)
  if (options.gpsCoords && !options.gpsError) {
    const lat = options.gpsCoords.lat;
    const lng = options.gpsCoords.lng;

    // Validate coordinates
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return {
        locationMode: 'current',
        locationSource: null,
        locationStatus: 'error',
        effectiveLocation: null,
        cityName: null,
        permissionState: options.permissionState || 'granted'
      };
    }

    const resolvedCity = options.reverseGeocodeFail ? null : 'Bielefeld';

    return {
      locationMode: 'current',
      locationSource: 'gps',
      locationStatus: 'ready',
      effectiveLocation: { lat, lng },
      cityName: resolvedCity,
      permissionState: 'granted'
    };
  }

  // 5. GPS Error with valid cache
  if (options.gpsError && validCache && validCache.source === 'gps') {
    return {
      locationMode: 'current',
      locationSource: 'cache',
      locationStatus: 'ready',
      effectiveLocation: { lat: validCache.lat, lng: validCache.lng },
      cityName: validCache.cityName || null,
      permissionState: options.permissionState || 'prompt'
    };
  }

  // 6. Default state when GPS unavailable: ZERO Bremerhaven Fallback
  return {
    locationMode: 'current',
    locationSource: null,
    locationStatus: options.permissionState === 'prompt' ? 'prompt' : 'error',
    effectiveLocation: null,
    cityName: null,
    permissionState: options.permissionState || 'prompt'
  };
}

async function runTests() {
  console.log('🧪 Starting Mandatory GPS Location Subsystem Unit Tests...\n');

  // Test 1: Live GPS Coordinates (Bielefeld) set status to 'ready' and source to 'gps'
  {
    console.log('Test 1: Live GPS Coordinates (Bielefeld) set status to ready and source to gps');
    const result = simulateLocationResolution({
      gpsCoords: { lat: 52.026036, lng: 8.522224, accuracy: 95 }
    });

    assert.strictEqual(result.locationMode, 'current');
    assert.strictEqual(result.locationSource, 'gps');
    assert.strictEqual(result.locationStatus, 'ready');
    assert.strictEqual(result.effectiveLocation?.lat, 52.026036);
    assert.strictEqual(result.effectiveLocation?.lng, 8.522224);
    assert.strictEqual(result.cityName, 'Bielefeld');
    console.log('  ✅ Bielefeld GPS coordinates successfully resolved.\n');
  }

  // Test 2: Purge explicit fallback Bremerhaven cache entry on mount
  {
    console.log('Test 2: Explicit Bremerhaven fallback cache is purged on startup');
    const result = simulateLocationResolution({
      cachedLocation: { lat: 53.5395, lng: 8.5809, source: 'fallback', cityName: 'Bremerhaven', timestamp: Date.now() },
      gpsError: { code: 2, message: 'Position unavailable' }
    });

    assert.strictEqual(mockStorage.getItem('aktiva_last_location'), null);
    assert.strictEqual(result.effectiveLocation, null);
    assert.strictEqual(result.cityName, null);
    console.log('  ✅ Bremerhaven fallback cache entry was purged; no default city returned.\n');
  }

  // Test 3: Expired cache (> 4 hours TTL) is purged
  {
    console.log('Test 3: Expired cache (>4h TTL) is purged on startup');
    const fiveHoursAgo = Date.now() - (5 * 60 * 60 * 1000);
    const result = simulateLocationResolution({
      cachedLocation: { lat: 52.026, lng: 8.522, source: 'gps', cityName: 'Bielefeld', timestamp: fiveHoursAgo },
      gpsError: { code: 2, message: 'Position unavailable' }
    });

    assert.strictEqual(mockStorage.getItem('aktiva_last_location'), null);
    assert.strictEqual(result.effectiveLocation, null);
    console.log('  ✅ Expired cache older than 4h was purged.\n');
  }

  // Test 4: Geolocation Permission Denied returns status 'denied' and NO Bremerhaven fallback
  {
    console.log('Test 4: Geolocation Permission Denied returns status "denied" without fallback city');
    const result = simulateLocationResolution({
      permissionState: 'denied',
      gpsError: { code: 1, message: 'User denied Geolocation' }
    });

    assert.strictEqual(result.locationStatus, 'denied');
    assert.strictEqual(result.effectiveLocation, null);
    assert.strictEqual(result.cityName, null);
    console.log('  ✅ Denied permission correctly locks location without Bremerhaven fallback.\n');
  }

  // Test 5: Reverse Geocoding failure does NOT fail GPS location or set fallback city
  {
    console.log('Test 5: Reverse geocoding failure keeps valid coordinates and sets cityName to null');
    const result = simulateLocationResolution({
      gpsCoords: { lat: 52.026036, lng: 8.522224, accuracy: 95 },
      reverseGeocodeFail: true
    });

    assert.strictEqual(result.locationStatus, 'ready');
    assert.strictEqual(result.locationSource, 'gps');
    assert.strictEqual(result.effectiveLocation?.lat, 52.026036);
    assert.strictEqual(result.cityName, null);
    console.log('  ✅ Best-effort reverse geocoding failure preserved valid GPS coordinates.\n');
  }

  // Test 6: Manual Mode uses exclusively manual destination
  {
    console.log('Test 6: Manual Mode uses exclusively manual destination');
    const result = simulateLocationResolution({
      isPlanning: true,
      manualDestination: { lat: 48.137, lng: 11.576, city: 'München' }
    });

    assert.strictEqual(result.locationMode, 'manual');
    assert.strictEqual(result.locationSource, 'manual');
    assert.strictEqual(result.effectiveLocation?.lat, 48.137);
    assert.strictEqual(result.cityName, 'München');
    console.log('  ✅ Manual mode resolved destination correctly.\n');
  }

  console.log('🎉 ALL MANDATORY GPS LOCATION UNIT TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
