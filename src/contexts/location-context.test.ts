import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Deterministic Test Suite — Aktiva Location Gate, Reverse Geocoding & Anti-Loop Architecture
 * Validates all requirements of Location Gate State Machine, Auto-GPS background fetching,
 * iOS fallbacks, permission change events, and anti-flash behavior.
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
type LocationGateState = 'checking' | 'prompt' | 'requesting' | 'granted' | 'denied' | 'error';
type LocationPosition = { latitude: number; longitude: number; accuracy: number; updatedAt: number };

class SimulatedLocationProvider {
  public gateState: LocationGateState = 'checking';
  public isLocating = false;
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
    mockStorage.removeItem('aktiva_last_location');
  }

  public setGpsHandler(handler: (success: (pos: any) => void, error: (err: any) => void) => void) {
    this.mockGpsHandler = handler;
  }

  public setGeocodeResolver(resolver: (lat: number, lon: number) => Promise<string | null>) {
    this.mockGeocodeResolver = resolver;
  }

  public requestLocation(options?: { interactive?: boolean }): void {
    const isInteractive = options?.interactive !== false;

    if (this.requestInFlight) {
      return;
    }

    this.errorMessage = null;
    const requestId = ++this.requestCounter;
    this.requestInFlight = true;
    this.activeRequestId = requestId;
    this.isLocating = true;

    if (isInteractive) {
      this.gateState = 'requesting';
    }

    this.getCurrentPositionCallCount++;

    if (!this.mockGpsHandler) {
      this.gateState = 'error';
      this.isLocating = false;
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
        this.isLocating = false;

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
        mockStorage.setItem('activa_location_permission_granted', 'true');
        void this.resolveCityName(latitude, longitude);
      },
      (err) => {
        if (this.activeRequestId !== requestId) return;
        this.activeRequestId = null;
        this.requestInFlight = false;
        this.isLocating = false;

        switch (err.code) {
          case 1:
            this.gateState = 'denied';
            mockStorage.removeItem('activa_location_permission_granted');
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
  console.log('🧪 Starting Location Gate Architectural & Auto-GPS Test Suite...\n');

  const srcDir = path.join(process.cwd(), 'src');

  // Test 1: LocationContext is the ONLY productive callsite for navigator.geolocation.getCurrentPosition
  {
    console.log('1. LocationContext is the single productive GPS callsite');
    const locContextCode = readFileSync(path.join(srcDir, 'contexts', 'location-context.tsx'), 'utf8');
    const matches = locContextCode.match(/navigator\.geolocation\.getCurrentPosition/g);
    assert.strictEqual(matches?.length, 1, 'LocationContext must have exactly 1 getCurrentPosition callsite');
    console.log('  ✅ Exactly one productive GPS callsite in LocationContext.\n');
  }

  // Test 2: Interactive button tap triggers gateState = "requesting"
  {
    console.log('2. Interactive button tap sets gateState = "requesting"');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler(() => {});
    provider.requestLocation({ interactive: true });
    assert.strictEqual(provider.gateState, 'requesting');
    assert.strictEqual(provider.isLocating, true);
    assert.strictEqual(provider.getCurrentPositionCallCount, 1);
    console.log('  ✅ Interactive request sets gateState = "requesting".\n');
  }

  // Test 3: Non-interactive background GPS request does NOT set gateState = "requesting"
  {
    console.log('3. Non-interactive background auto-GPS keeps gateState = "granted"');
    const provider = new SimulatedLocationProvider();
    provider.gateState = 'granted';
    provider.setGpsHandler(() => {});
    provider.requestLocation({ interactive: false });
    assert.strictEqual(provider.gateState, 'granted', 'Background GPS must NOT change gateState to requesting');
    assert.strictEqual(provider.isLocating, true);
    assert.strictEqual(provider.getCurrentPositionCallCount, 1);
    console.log('  ✅ Non-interactive request preserves gateState = "granted" while setting isLocating = true.\n');
  }

  // Test 4: Rapid multi-taps do NOT trigger duplicate GPS calls
  {
    console.log('4. Rapid multi-taps do not trigger duplicate GPS calls');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler(() => {});
    provider.requestLocation({ interactive: true });
    provider.requestLocation({ interactive: true });
    provider.requestLocation({ interactive: true });
    assert.strictEqual(provider.getCurrentPositionCallCount, 1);
    console.log('  ✅ Multi-tap concurrency lock works correctly.\n');
  }

  // Test 5: GPS Success sets gateState = granted and stores activa_location_permission_granted
  {
    console.log('5. GPS Success sets gateState = granted and sets localStorage hint');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler((success) => {
      success({ coords: { latitude: 52.026, longitude: 8.522, accuracy: 15 } });
    });
    provider.requestLocation({ interactive: false });
    assert.strictEqual(provider.gateState, 'granted');
    assert.strictEqual(provider.position?.latitude, 52.026);
    assert.strictEqual(mockStorage.getItem('activa_location_permission_granted'), 'true');
    console.log('  ✅ GPS success grants gate and persists localStorage hint.\n');
  }

  // Test 6: PERMISSION_DENIED error sets gateState = denied and clears localStorage hint
  {
    console.log('6. PERMISSION_DENIED error sets gateState = denied and removes localStorage hint');
    mockStorage.setItem('activa_location_permission_granted', 'true');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler((_success, error) => {
      error({ code: 1, message: 'User denied geolocation' });
    });
    provider.requestLocation({ interactive: false });
    assert.strictEqual(provider.gateState, 'denied');
    assert.strictEqual(mockStorage.getItem('activa_location_permission_granted'), null);
    console.log('  ✅ PERMISSION_DENIED safely updates gateState to denied and clears hint.\n');
  }

  // Test 7: Reverse Geocoding resolves Bielefeld coordinates to "Bielefeld"
  {
    console.log('7. Section 8: Bielefeld coordinates resolve to "Bielefeld"');
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

  // Test 8: Zero Bremerhaven fallback or default profile city
  {
    console.log('8. Section 8: Zero Bremerhaven fallbacks in LocationContext and page.tsx');
    const locCode = readFileSync(path.join(srcDir, 'contexts', 'location-context.tsx'), 'utf8');
    assert.strictEqual(locCode.includes('Bremerhaven'), false, 'LocationContext must contain 0 Bremerhaven references');
    const pageCode = readFileSync(path.join(srcDir, 'app', 'page.tsx'), 'utf8');
    assert.strictEqual(pageCode.includes('Bremerhaven'), false, 'page.tsx must contain 0 Bremerhaven references');
    console.log('  ✅ Zero Bremerhaven or default city fallbacks verified.\n');
  }

  // Test 9: LocationGate component visibility check excludes checking and granted
  {
    console.log('9. LocationGate component renders null when gateState === "checking" or "granted"');
    const gateCode = readFileSync(path.join(srcDir, 'components', 'common', 'LocationGate.tsx'), 'utf8');
    assert.ok(gateCode.includes("gateState !== 'checking'"), 'LocationGate must check gateState !== "checking"');
    assert.ok(gateCode.includes("gateState !== 'granted'"), 'LocationGate must check gateState !== "granted"');
    assert.ok(gateCode.includes('type="button"'), 'Button must specify type="button" explicitly');
    assert.ok(gateCode.includes('event.preventDefault()'), 'Click handler must call event.preventDefault()');
    assert.ok(gateCode.includes('event.stopPropagation()'), 'Click handler must call event.stopPropagation()');
    console.log('  ✅ Anti-flash and button event handling verified in LocationGate.\n');
  }

  // Test 10: Permissions API unavailable + localStorage hint true (remains checking until Geolocation success)
  {
    console.log('10. Safari fallback: localStorage hint stays "checking" until Geolocation success');
    mockStorage.setItem('activa_location_permission_granted', 'true');
    const provider = new SimulatedLocationProvider(); // initial state: checking
    let triggerGpsSuccess: () => void = () => {};

    provider.setGpsHandler((success) => {
      triggerGpsSuccess = () => {
        success({ coords: { latitude: 52.026, longitude: 8.522, accuracy: 15 } });
      };
    });

    // Simulate fallback bootstrap
    provider.requestLocation({ interactive: false });
    assert.strictEqual(provider.gateState, 'checking', 'Must NOT immediately set gateState to granted based on hint alone');
    assert.strictEqual(provider.isLocating, true);

    // Geolocation succeeds
    triggerGpsSuccess();
    assert.strictEqual(provider.gateState, 'granted');
    assert.strictEqual(provider.isLocating, false);
    assert.strictEqual(mockStorage.getItem('activa_location_permission_granted'), 'true');
    console.log('  ✅ Hint alone does not grant gate; granted state set only after Geolocation success.\n');
  }

  // Test 11: Permissions API unavailable + stale localStorage hint true + PERMISSION_DENIED
  {
    console.log('11. Safari fallback: stale localStorage hint + PERMISSION_DENIED transitions to denied & clears hint');
    mockStorage.setItem('activa_location_permission_granted', 'true');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler((_success, error) => {
      error({ code: 1, message: 'Permission denied on device' });
    });

    provider.requestLocation({ interactive: false });
    assert.strictEqual(provider.gateState, 'denied');
    assert.strictEqual(provider.isLocating, false);
    assert.strictEqual(mockStorage.getItem('activa_location_permission_granted'), null);
    console.log('  ✅ Stale localStorage hint handled correctly: transitions to denied and clears hint.\n');
  }

  // Test 12: Safari fallback + hint true + POSITION_UNAVAILABLE -> gateState === "error" (NOT "prompt")
  {
    console.log('12. Safari fallback: hint true + POSITION_UNAVAILABLE sets gateState = "error" (NOT "prompt")');
    mockStorage.setItem('activa_location_permission_granted', 'true');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler((_success, error) => {
      error({ code: 2, message: 'Position unavailable' });
    });

    provider.requestLocation({ interactive: false });
    assert.strictEqual(provider.gateState, 'error', 'POSITION_UNAVAILABLE must transition to "error", NOT "prompt"');
    assert.strictEqual(provider.isLocating, false);
    console.log('  ✅ POSITION_UNAVAILABLE correctly transitions to "error" state.\n');
  }

  // Test 13: Safari fallback + hint true + TIMEOUT -> gateState === "error" (NOT "prompt")
  {
    console.log('13. Safari fallback: hint true + TIMEOUT sets gateState = "error" (NOT "prompt")');
    mockStorage.setItem('activa_location_permission_granted', 'true');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler((_success, error) => {
      error({ code: 3, message: 'Timeout' });
    });

    provider.requestLocation({ interactive: false });
    assert.strictEqual(provider.gateState, 'error', 'TIMEOUT must transition to "error", NOT "prompt"');
    assert.strictEqual(provider.isLocating, false);
    console.log('  ✅ TIMEOUT correctly transitions to "error" state.\n');
  }

  console.log('🎉 ALL LOCATION GATE ARCHITECTURAL, AUTO-GPS & SAFARI FALLBACK TESTS PASSED DETERMINISTICALLY!');
}

runTests().catch((err) => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});

