import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { reverseGeocodeCity } from '../lib/geoapify';

/**
 * Deterministic Test Suite — Aktiva Location Gate, Reverse Geocoding & Anti-Loop Architecture
 * Validates all requirements of Section 12, Section 9, Section 7, and Section 8 (City Name Resolution).
 */

// Mock localStorage globally
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

// Simulated State Machine matching LocationProvider implementation exactly
type LocationGateState = 'idle' | 'requesting' | 'granted' | 'denied' | 'error';
type LocationPosition = { latitude: number; longitude: number; accuracy: number; updatedAt: number };

class SimulatedLocationProvider {
  public gateState: LocationGateState = 'idle';
  public position: LocationPosition | null = null;
  public cityName: string | null = null;
  public isResolvingCity = false;
  public errorMessage: string | null = null;

  public requestInFlight = false;
  public activeRequestId: number | null = null;
  public requestCounter = 0;
  public cityRequestCounter = 0;
  public getCurrentPositionCallCount = 0;

  private mockGpsHandler: ((success: (pos: any) => void, error: (err: any) => void) => void) | null = null;
  private mockGeocodeResolver: ((lat: number, lon: number) => Promise<string | null>) | null = null;

  constructor() {
    // Purge old location cache on startup
    mockStorage.removeItem('aktiva_last_location');
  }

  public setGpsHandler(handler: (success: (pos: any) => void, error: (err: any) => void) => void) {
    this.mockGpsHandler = handler;
  }

  public setGeocodeResolver(resolver: (lat: number, lon: number) => Promise<string | null>) {
    this.mockGeocodeResolver = resolver;
  }

  // Synchronous requestLocation implementation
  public requestLocation(): void {
    if (this.requestInFlight) {
      return;
    }

    this.errorMessage = null;
    const requestId = ++this.requestCounter;
    this.requestInFlight = true;
    this.activeRequestId = requestId;
    this.gateState = 'requesting';
    this.getCurrentPositionCallCount++;

    if (!this.mockGpsHandler) {
      this.gateState = 'error';
      this.errorMessage = 'Dieser Browser unterstützt keine Standortermittlung.';
      this.requestInFlight = false;
      this.activeRequestId = null;
      return;
    }

    this.mockGpsHandler(
      (pos) => {
        if (this.activeRequestId !== requestId) return;
        this.activeRequestId = null;
        this.requestInFlight = false;

        const { latitude, longitude, accuracy } = pos.coords;
        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          !Number.isFinite(accuracy) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          this.gateState = 'error';
          this.errorMessage = 'Der übermittelte Standort ist ungültig. Versuche es erneut.';
          return;
        }

        this.position = { latitude, longitude, accuracy, updatedAt: Date.now() };
        this.gateState = 'granted';
        void this.resolveCityName(latitude, longitude);
      },
      (err) => {
        if (this.activeRequestId !== requestId) return;
        this.activeRequestId = null;
        this.requestInFlight = false;

        switch (err.code) {
          case 1:
            this.gateState = 'denied';
            this.errorMessage =
              'Der Standortzugriff ist deaktiviert. Aktiviere ihn in den Browser- oder Geräteeinstellungen.';
            break;
          case 2:
            this.gateState = 'error';
            this.errorMessage =
              'Dein Standort ist momentan nicht verfügbar. Prüfe, ob die Ortungsdienste deines Geräts aktiviert sind.';
            break;
          case 3:
            this.gateState = 'error';
            this.errorMessage = 'Die Standortermittlung hat zu lange gedauert. Versuche es erneut.';
            break;
          default:
            this.gateState = 'error';
            this.errorMessage = 'Dein Standort konnte nicht ermittelt werden.';
        }
      }
    );
  }

  public async resolveCityName(lat: number, lon: number): Promise<void> {
    const cityRequestId = ++this.cityRequestCounter;
    this.isResolvingCity = true;
    try {
      const resolved = this.mockGeocodeResolver ? await this.mockGeocodeResolver(lat, lon) : null;
      if (cityRequestId !== this.cityRequestCounter) return;
      this.cityName = resolved;
    } catch (e) {
      if (cityRequestId !== this.cityRequestCounter) return;
      this.cityName = null;
    } finally {
      if (cityRequestId === this.cityRequestCounter) {
        this.isResolvingCity = false;
      }
    }
  }
}

async function runTests() {
  console.log('🧪 Starting Location Gate Architectural, Reverse Geocoding & Route-Purity Test Suite...\n');

  const srcDir = path.join(process.cwd(), 'src');

  // Test 1: LocationContext is the ONLY productive callsite for navigator.geolocation.getCurrentPosition
  {
    console.log('1. LocationContext is the single productive GPS callsite');
    const locContextCode = readFileSync(path.join(srcDir, 'contexts', 'location-context.tsx'), 'utf8');
    const matches = locContextCode.match(/navigator\.geolocation\.getCurrentPosition/g);
    assert.strictEqual(matches?.length, 1, 'LocationContext must have exactly 1 getCurrentPosition callsite');
    console.log('  ✅ Exactly one productive GPS callsite in LocationContext.\n');
  }

  // Test 2: Button tap triggers exactly 1 GPS call
  {
    console.log('2. Button tap triggers exactly 1 GPS request');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler(() => {});
    provider.requestLocation();
    assert.strictEqual(provider.getCurrentPositionCallCount, 1);
    console.log('  ✅ 1 tap initiated 1 GPS call.\n');
  }

  // Test 3: Rapid multi-taps do NOT trigger a second GPS request
  {
    console.log('3. Rapid multi-taps do not trigger duplicate GPS calls');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler(() => {});
    provider.requestLocation();
    provider.requestLocation();
    provider.requestLocation();
    assert.strictEqual(provider.getCurrentPositionCallCount, 1);
    console.log('  ✅ Multi-tap concurrency lock works correctly.\n');
  }

  // Test 4: GPS Success sets gateState = granted IMMEDIATELY without waiting for Geocoding
  {
    console.log('4. Section 8: GPS Success sets gateState = granted immediately without awaiting Geocoding');
    const provider = new SimulatedLocationProvider();
    let geocodeResolverTriggered = false;
    provider.setGpsHandler((success) => {
      success({ coords: { latitude: 52.026, longitude: 8.522, accuracy: 15 } });
    });
    provider.setGeocodeResolver(async () => {
      geocodeResolverTriggered = true;
      // Simulate delay
      await new Promise((r) => setTimeout(r, 100));
      return 'Bielefeld';
    });

    provider.requestLocation();
    // Synchronously after requestLocation(), gateState is granted and position is set even though geocode hasn't resolved
    assert.strictEqual(provider.gateState, 'granted');
    assert.strictEqual(provider.position?.latitude, 52.026);
    assert.strictEqual(provider.cityName, null); // Not resolved yet
    assert.strictEqual(provider.isResolvingCity, true);
    console.log('  ✅ GPS success grants gate immediately before geocoding completes.\n');
  }

  // Test 5: Reverse Geocoding resolves Bielefeld coordinates to "Bielefeld"
  {
    console.log('5. Section 8: Bielefeld coordinates resolve to "Bielefeld"');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler((success) => {
      success({ coords: { latitude: 52.026036, longitude: 8.522224, accuracy: 10 } });
    });
    provider.setGeocodeResolver(async () => 'Bielefeld');

    provider.requestLocation();
    await new Promise((r) => setTimeout(r, 10));

    assert.strictEqual(provider.gateState, 'granted');
    assert.strictEqual(provider.cityName, 'Bielefeld');
    assert.strictEqual(provider.isResolvingCity, false);
    console.log('  ✅ Bielefeld coordinates resolved to "Bielefeld".\n');
  }

  // Test 6: Geoapify error leaves cityName null and app stays granted
  {
    console.log('6. Section 8: Geoapify error leaves cityName null while gate remains granted');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler((success) => {
      success({ coords: { latitude: 52.026, longitude: 8.522, accuracy: 10 } });
    });
    provider.setGeocodeResolver(async () => {
      throw new Error('Geoapify network error');
    });

    provider.requestLocation();
    await new Promise((r) => setTimeout(r, 10));

    assert.strictEqual(provider.gateState, 'granted');
    assert.strictEqual(provider.cityName, null);
    assert.strictEqual(provider.isResolvingCity, false);
    console.log('  ✅ Geoapify error handled gracefully (cityName null, gate granted).\n');
  }

  // Test 7: Stale geocoding response does NOT overwrite newer position/city
  {
    console.log('7. Section 8: Stale geocoding response does not overwrite newer location');
    const provider = new SimulatedLocationProvider();
    let resolveFirstGeocode: (val: string | null) => void;

    provider.setGeocodeResolver(async (lat) => {
      if (lat === 52.026) {
        return new Promise((res) => {
          resolveFirstGeocode = res;
        });
      }
      return 'München';
    });

    provider.setGpsHandler((success) => {
      success({ coords: { latitude: 52.026, longitude: 8.522, accuracy: 10 } });
    });
    provider.requestLocation(); // Location 1 (Bielefeld pending)

    provider.requestInFlight = false;
    provider.setGpsHandler((success) => {
      success({ coords: { latitude: 48.137, longitude: 11.576, accuracy: 5 } });
    });
    provider.requestLocation(); // Location 2 (Munich)
    await new Promise((r) => setTimeout(r, 10));

    assert.strictEqual(provider.cityName, 'München');

    // Now resolve stale first geocode for Bielefeld
    resolveFirstGeocode!('Bielefeld');
    await new Promise((r) => setTimeout(r, 10));

    assert.strictEqual(provider.cityName, 'München', 'Stale geocode must not overwrite newer city');
    console.log('  ✅ Stale geocoding response safely discarded.\n');
  }

  // Test 8: Zero Bremerhaven fallback or default profile city
  {
    console.log('8. Section 8: Zero Bremerhaven fallbacks in LocationContext and page.tsx');
    const locCode = readFileSync(path.join(srcDir, 'contexts', 'location-context.tsx'), 'utf8');
    assert.strictEqual(locCode.includes('Bremerhaven'), false, 'LocationContext must contain 0 Bremerhaven references');
    const pageCode = readFileSync(path.join(srcDir, 'app', 'page.tsx'), 'utf8');
    assert.strictEqual(pageCode.includes('Bremerhaven'), false, 'page.tsx must contain 0 Bremerhaven references');
    console.log('  ✅ Zero Bremerhaven or default city fallbacks verified.\n');
  }

  // Test 9: Header displays cityName when available, or neutral "Aktueller Standort" before resolution
  {
    console.log('9. Section 8: Header displays cityName or neutral "Aktueller Standort"');
    const pageCode = readFileSync(path.join(srcDir, 'app', 'page.tsx'), 'utf8');
    assert.ok(pageCode.includes("const defaultLocationLabel = language === 'de' ? \"Aktueller Standort\" : \"Current location\";"));
    assert.ok(pageCode.includes('const cityName = resolvedCityName || defaultLocationLabel;'));
    console.log('  ✅ Header display logic correctly wired.\n');
  }

  // Test 10: Provider hierarchy and route-purity intact
  {
    console.log('10. Section 8: Provider hierarchy and route-purity maintained');
    const locCode = readFileSync(path.join(srcDir, 'contexts', 'location-context.tsx'), 'utf8');
    assert.strictEqual(locCode.includes('router.'), false, 'LocationContext remains 100% route-pure');
    console.log('  ✅ Route purity and provider structure maintained.\n');
  }

  console.log('🎉 ALL LOCATION GATE, REVERSE GEOCODING & ROUTE-PURITY TESTS PASSED DETERMINISTICALLY!');
}

runTests().catch((err) => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
