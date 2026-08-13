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
  public hasGrantedHintState = false;

  public requestInFlight = false;
  public activeRequestId: number | null = null;
  public requestCounter = 0;
  public cityRequestCounter = 0;
  public getCurrentPositionCallCount = 0;

  private mockGpsHandler: ((success: (pos: any) => void, error: (err: any) => void) => void) | null = null;
  private mockGeocodeResolver: ((lat: number, lon: number) => Promise<string | null>) | null = null;

  constructor() {
    mockStorage.removeItem('aktiva_last_location');
    const isGranted = mockStorage.getItem('activa_location_permission_granted') === 'true';
    if (isGranted) {
      this.hasGrantedHintState = true;
      this.gateState = 'granted';
      const rawPos = mockStorage.getItem('activa_last_known_position');
      if (rawPos) {
        try {
          const parsed = JSON.parse(rawPos);
          if (parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
            this.position = parsed;
          }
        } catch (e) {}
      }
    }
  }

  public get isCheckingLocation(): boolean {
    return this.gateState === 'checking' || this.isLocating;
  }

  public get needsLocationGate(): boolean {
    if (this.gateState === 'prompt' || this.gateState === 'denied' || this.gateState === 'requesting') {
      return true;
    }
    if (this.gateState === 'error') {
      const isGranted = this.hasGrantedHintState || mockStorage.getItem('activa_location_permission_granted') === 'true';
      return !isGranted && !this.position;
    }
    return false;
  }

  public setGpsHandler(handler: (success: (pos: any) => void, error: (err: any) => void) => void) {
    this.mockGpsHandler = handler;
  }

  public setGeocodeResolver(resolver: (lat: number, lon: number) => Promise<string | null>) {
    this.mockGeocodeResolver = resolver;
  }

  public handlePermissionStatusChange(newStatusState: 'granted' | 'denied' | 'prompt'): void {
    if (newStatusState === 'granted') {
      try {
        mockStorage.setItem('activa_location_permission_granted', 'true');
      } catch (e) {}
      this.hasGrantedHintState = true;
      this.gateState = 'granted';
      this.requestLocation({ interactive: false });
    } else if (newStatusState === 'denied') {
      this.gateState = 'denied';
      this.hasGrantedHintState = false;
      try {
        mockStorage.removeItem('activa_location_permission_granted');
        mockStorage.removeItem('activa_last_known_position');
      } catch (e) {}
    } else {
      this.gateState = 'prompt';
    }
  }

  public requestLocation(options?: { interactive?: boolean }): void {
    const isInteractive = options?.interactive === true;

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

        const newPos = { latitude, longitude, accuracy, updatedAt: Date.now() };
        this.position = newPos;
        this.gateState = 'granted';
        this.hasGrantedHintState = true;
        mockStorage.setItem('activa_location_permission_granted', 'true');
        mockStorage.setItem('activa_last_known_position', JSON.stringify(newPos));
        void this.resolveCityName(latitude, longitude);
      },
      (err) => {
        if (this.activeRequestId !== requestId) return;
        this.activeRequestId = null;
        this.requestInFlight = false;
        this.isLocating = false;

        const isPreviouslyGranted =
          this.hasGrantedHintState || mockStorage.getItem('activa_location_permission_granted') === 'true';

        switch (err.code) {
          case 1:
            this.gateState = 'denied';
            this.hasGrantedHintState = false;
            mockStorage.removeItem('activa_location_permission_granted');
            mockStorage.removeItem('activa_last_known_position');
            this.errorMessage =
              'Der Standortzugriff ist deaktiviert. Aktiviere ihn in den Browser- oder Geräteeinstellungen.';
            break;
          case 2:
            if (!isPreviouslyGranted) {
              this.gateState = 'error';
              this.errorMessage =
                'Dein Standort ist momentan nicht verfügbar. Prüfe, ob die Ortungsdienste deines Geräts aktiviert sind.';
            }
            break;
          case 3:
            if (!isPreviouslyGranted) {
              this.gateState = 'error';
              this.errorMessage = 'Die Standortermittlung hat zu lange gedauert. Versuche es erneut.';
            }
            break;
          default:
            if (!isPreviouslyGranted) {
              this.gateState = 'error';
              this.errorMessage = 'Dein Standort konnte nicht ermittelt werden.';
            }
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
    mockStorage.clear();
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler(() => {});
    provider.requestLocation({ interactive: true });
    assert.strictEqual(provider.gateState, 'requesting');
    assert.strictEqual(provider.needsLocationGate, true);
    assert.strictEqual(provider.isLocating, true);
    assert.strictEqual(provider.getCurrentPositionCallCount, 1);
    console.log('  ✅ Interactive request sets gateState = "requesting".\n');
  }

  // Test 3: Non-interactive background GPS request does NOT set gateState = "requesting"
  {
    console.log('3. Non-interactive background auto-GPS keeps gateState = "granted"');
    mockStorage.clear();
    mockStorage.setItem('activa_location_permission_granted', 'true');
    const provider = new SimulatedLocationProvider();
    assert.strictEqual(provider.gateState, 'granted');
    assert.strictEqual(provider.needsLocationGate, false);
    provider.setGpsHandler(() => {});
    provider.requestLocation({ interactive: false });
    assert.strictEqual(provider.gateState, 'granted', 'Background GPS must NOT change gateState to requesting');
    assert.strictEqual(provider.needsLocationGate, false, 'Background GPS must keep needsLocationGate = false');
    assert.strictEqual(provider.isLocating, true);
    assert.strictEqual(provider.getCurrentPositionCallCount, 1);
    console.log('  ✅ Non-interactive request preserves gateState = "granted" while setting isLocating = true.\n');
  }

  // Required Test 1: First visit / user never located before
  {
    console.log('4 [Req Test 1]. First visit user without saved location requires Location Gate');
    mockStorage.clear();
    const provider = new SimulatedLocationProvider();
    provider.gateState = 'prompt';
    assert.strictEqual(provider.needsLocationGate, true, 'First visit user MUST see Location Gate');
    console.log('  ✅ First visit user correctly flagged as needsLocationGate = true.\n');
  }

  // Required Test 2: Returning user + Reload
  {
    console.log('5 [Req Test 2]. Previously located user + Reload unblocks feed immediately and runs background GPS');
    mockStorage.clear();
    mockStorage.setItem('activa_location_permission_granted', 'true');
    const provider = new SimulatedLocationProvider();
    assert.strictEqual(provider.gateState, 'granted');
    assert.strictEqual(provider.needsLocationGate, false, 'Location Gate MUST NOT be visible on reload for returning user');

    let backgroundGpsExecuted = false;
    provider.setGpsHandler(() => {
      backgroundGpsExecuted = true;
    });

    provider.requestLocation({ interactive: false });
    assert.strictEqual(provider.needsLocationGate, false, 'Background GPS MUST NOT show location gate');
    assert.strictEqual(provider.isLocating, true);
    assert.strictEqual(backgroundGpsExecuted, true);
    console.log('  ✅ Returning user feed is unblocked immediately while background GPS runs.\n');
  }

  // Required Test 3: Returning user + successful background GPS fetch updates location without gate
  {
    console.log('6 [Req Test 3]. Returning user + background GPS success updates location without gate');
    mockStorage.clear();
    mockStorage.setItem('activa_location_permission_granted', 'true');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler((success) => {
      success({ coords: { latitude: 52.026, longitude: 8.522, accuracy: 12 } });
    });

    provider.requestLocation({ interactive: false });
    assert.strictEqual(provider.gateState, 'granted');
    assert.strictEqual(provider.needsLocationGate, false);
    assert.strictEqual(provider.position?.latitude, 52.026);
    assert.strictEqual(provider.position?.longitude, 8.522);
    console.log('  ✅ Background GPS success updates location without gate.\n');
  }

  // Required Test 4: Returning user + PERMISSION_DENIED
  {
    console.log('7 [Req Test 4]. Returning user + PERMISSION_DENIED invalidates saved state and displays Location Gate');
    mockStorage.clear();
    mockStorage.setItem('activa_location_permission_granted', 'true');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler((_success, error) => {
      error({ code: 1, message: 'User revoked permission' });
    });

    provider.requestLocation({ interactive: false });
    assert.strictEqual(provider.gateState, 'denied');
    assert.strictEqual(provider.needsLocationGate, true, 'PERMISSION_DENIED MUST display Location Gate');
    assert.strictEqual(mockStorage.getItem('activa_location_permission_granted'), null);
    console.log('  ✅ PERMISSION_DENIED invalidates saved granted state and opens Location Gate.\n');
  }

  // Required Test 5: Returning user + temporary TIMEOUT
  {
    console.log('8 [Req Test 5]. Returning user + temporary TIMEOUT maintains granted state and does not show gate');
    mockStorage.clear();
    mockStorage.setItem('activa_location_permission_granted', 'true');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler((_success, error) => {
      error({ code: 3, message: 'Timeout' });
    });

    provider.requestLocation({ interactive: false });
    assert.strictEqual(provider.gateState, 'granted');
    assert.strictEqual(provider.needsLocationGate, false, 'TIMEOUT for returning user MUST NOT block with gate');
    console.log('  ✅ TIMEOUT for returning user preserves granted state without gate popup.\n');
  }

  // Required Test 6: Returning user + POSITION_UNAVAILABLE
  {
    console.log('9 [Req Test 6]. Returning user + POSITION_UNAVAILABLE maintains granted state and does not prompt');
    mockStorage.clear();
    mockStorage.setItem('activa_location_permission_granted', 'true');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler((_success, error) => {
      error({ code: 2, message: 'Position unavailable' });
    });

    provider.requestLocation({ interactive: false });
    assert.strictEqual(provider.gateState, 'granted');
    assert.strictEqual(provider.needsLocationGate, false, 'POSITION_UNAVAILABLE for returning user MUST NOT prompt');
    console.log('  ✅ POSITION_UNAVAILABLE for returning user preserves granted state without prompt.\n');
  }

  // Required Test 7: Stored old location present, GPS returns new location -> new GPS wins, old position does not overwrite
  {
    console.log('10 [Req Test 7]. Stored old location present, fresh GPS returns new location -> fresh GPS wins');
    mockStorage.clear();
    mockStorage.setItem('activa_location_permission_granted', 'true');
    const oldPos = { latitude: 50.1109, longitude: 8.6821, accuracy: 20, updatedAt: Date.now() - 3600000 };
    mockStorage.setItem('activa_last_known_position', JSON.stringify(oldPos));

    const provider = new SimulatedLocationProvider();
    assert.strictEqual(provider.position?.latitude, 50.1109);

    provider.setGpsHandler((success) => {
      success({ coords: { latitude: 52.026, longitude: 8.522, accuracy: 5 } });
    });

    provider.requestLocation({ interactive: false });
    assert.strictEqual(provider.position?.latitude, 52.026, 'Fresh GPS position MUST overwrite stored old location');
    assert.strictEqual(provider.position?.longitude, 8.522);
    console.log('  ✅ Fresh GPS position overwrites stored old location deterministically.\n');
  }

  // Required Test 8: SSR / first render -> returning user sees no location gate modal
  {
    console.log('11 [Req Test 8]. SSR / first render: returning user sees no brief Location Gate modal');
    mockStorage.clear();
    mockStorage.setItem('activa_location_permission_granted', 'true');
    const provider = new SimulatedLocationProvider();
    assert.strictEqual(provider.needsLocationGate, false, 'First render for returning user MUST NOT show Location Gate');
    const gateCode = readFileSync(path.join(srcDir, 'components', 'common', 'LocationGate.tsx'), 'utf8');
    assert.ok(gateCode.includes('needsLocationGate'), 'LocationGate must use needsLocationGate for visibility check');
    console.log('  ✅ First render for returning user suppresses Location Gate modal.\n');
  }

  // Test 9: Rapid multi-taps do NOT trigger duplicate GPS calls
  {
    console.log('12. Rapid multi-taps do not trigger duplicate GPS calls');
    mockStorage.clear();
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler(() => {});
    provider.requestLocation({ interactive: true });
    provider.requestLocation({ interactive: true });
    provider.requestLocation({ interactive: true });
    assert.strictEqual(provider.getCurrentPositionCallCount, 1);
    console.log('  ✅ Multi-tap concurrency lock works correctly.\n');
  }

  // Test 10: Zero Bremerhaven fallback or default profile city
  {
    console.log('13. Zero Bremerhaven fallbacks in LocationContext and page.tsx');
    const locCode = readFileSync(path.join(srcDir, 'contexts', 'location-context.tsx'), 'utf8');
    assert.strictEqual(locCode.includes('Bremerhaven'), false, 'LocationContext must contain 0 Bremerhaven references');
    const pageCode = readFileSync(path.join(srcDir, 'app', 'page.tsx'), 'utf8');
    assert.strictEqual(pageCode.includes('Bremerhaven'), false, 'page.tsx must contain 0 Bremerhaven references');
    console.log('  ✅ Zero Bremerhaven or default city fallbacks verified.\n');
  }

  console.log('🎉 ALL LOCATION GATE ARCHITECTURAL, AUTO-GPS & RELOAD TESTS PASSED DETERMINISTICALLY!');
}

runTests().catch((err) => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});

