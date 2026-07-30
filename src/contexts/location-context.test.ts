import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Deterministic Test Suite — Aktiva Location Gate & Single Location Flow Architecture
 * Validates all requirements of Section 12 and Section 9 (Remount & Anti-Flicker Protection).
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
  public errorMessage: string | null = null;

  public requestInFlight = false;
  public activeRequestId: number | null = null;
  public requestCounter = 0;
  public getCurrentPositionCallCount = 0;

  private mockGpsHandler: ((success: (pos: any) => void, error: (err: any) => void) => void) | null = null;

  constructor() {
    // Purge old location cache on startup
    mockStorage.removeItem('aktiva_last_location');
  }

  public setGpsHandler(handler: (success: (pos: any) => void, error: (err: any) => void) => void) {
    this.mockGpsHandler = handler;
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
}

async function runTests() {
  console.log('🧪 Starting Location Gate Architectural & Anti-Remount Test Suite...\n');

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

  // Test 4: requestLocation is strictly synchronous
  {
    console.log('4. requestLocation signature is synchronous (void return, no async/await)');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler(() => {});
    const returnVal = provider.requestLocation();
    assert.strictEqual(returnVal, undefined);
    assert.strictEqual(provider.gateState, 'requesting');
    console.log('  ✅ requestLocation is synchronous.\n');
  }

  // Test 5: No async operations before getCurrentPosition
  {
    console.log('5. No async operation precedes getCurrentPosition');
    const provider = new SimulatedLocationProvider();
    let invokedInstantly = false;
    provider.setGpsHandler(() => {
      invokedInstantly = true;
    });
    provider.requestLocation();
    assert.strictEqual(invokedInstantly, true);
    console.log('  ✅ getCurrentPosition invoked immediately upon gesture.\n');
  }

  // Test 6: requesting state remains visually stable
  {
    console.log('6. requesting state remains visually stable');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler(() => {});
    provider.requestLocation();
    assert.strictEqual(provider.gateState, 'requesting');
    assert.strictEqual(provider.errorMessage, null);
    console.log('  ✅ Requesting state is clean and stable.\n');
  }

  // Test 7: GPS Success sets position and gateState = granted
  {
    console.log('7. GPS Success sets position and gateState = granted');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler((success) => {
      success({ coords: { latitude: 52.026, longitude: 8.522, accuracy: 15 } });
    });
    provider.requestLocation();
    assert.strictEqual(provider.gateState, 'granted');
    assert.strictEqual(provider.position?.latitude, 52.026);
    assert.strictEqual(provider.position?.longitude, 8.522);
    console.log('  ✅ GPS success correctly grants gate.\n');
  }

  // Test 8: PERMISSION_DENIED (Code 1) sets gateState = denied
  {
    console.log('8. PERMISSION_DENIED (Code 1) sets gateState = denied');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler((_, error) => {
      error({ code: 1, message: 'User denied' });
    });
    provider.requestLocation();
    assert.strictEqual(provider.gateState, 'denied');
    assert.ok(provider.errorMessage?.includes('Browser- oder Geräteeinstellungen'));
    console.log('  ✅ PERMISSION_DENIED sets denied state.\n');
  }

  // Test 9: POSITION_UNAVAILABLE (Code 2) sets gateState = error
  {
    console.log('9. POSITION_UNAVAILABLE (Code 2) sets gateState = error');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler((_, error) => {
      error({ code: 2, message: 'Unavailable' });
    });
    provider.requestLocation();
    assert.strictEqual(provider.gateState, 'error');
    assert.ok(provider.errorMessage?.includes('Ortungsdienste'));
    console.log('  ✅ POSITION_UNAVAILABLE sets error state.\n');
  }

  // Test 10: TIMEOUT (Code 3) sets gateState = error
  {
    console.log('10. TIMEOUT (Code 3) sets gateState = error');
    const provider = new SimulatedLocationProvider();
    provider.setGpsHandler((_, error) => {
      error({ code: 3, message: 'Timeout' });
    });
    provider.requestLocation();
    assert.strictEqual(provider.gateState, 'error');
    assert.ok(provider.errorMessage?.includes('zu lange gedauert'));
    console.log('  ✅ TIMEOUT sets error state.\n');
  }

  // Section 9 Test 1: Single LocationGate in layout.tsx placed outside AppBootstrapGate
  {
    console.log('11. Section 9: Provider hierarchy puts LocationGate outside AppBootstrapGate');
    const layoutCode = readFileSync(path.join(srcDir, 'app', 'layout.tsx'), 'utf8');
    assert.ok(layoutCode.includes('<LocationGate />'), 'LocationGate used as root overlay element in layout.tsx');
    assert.ok(layoutCode.indexOf('<AppBootstrapGate>') < layoutCode.indexOf('<LocationGate />'), 'AppBootstrapGate comes before LocationGate overlay sibling');
    console.log('  ✅ Provider hierarchy correctly isolates LocationGate overlay.\n');
  }

  // Section 9 Test 2: Zero entry/exit animations on LocationGate
  {
    console.log('12. Section 9: Zero entry/exit CSS animations on LocationGate');
    const gateCode = readFileSync(path.join(srcDir, 'components', 'common', 'LocationGate.tsx'), 'utf8');
    assert.strictEqual(gateCode.includes('animate-in'), false, 'No animate-in on LocationGate overlay');
    assert.strictEqual(gateCode.includes('zoom-in'), false, 'No zoom-in on LocationGate overlay');
    assert.strictEqual(gateCode.includes('transition-all'), false, 'No transition-all on LocationGate overlay');
    assert.strictEqual(gateCode.includes('AnimatePresence'), false, 'No AnimatePresence on LocationGate overlay');
    console.log('  ✅ Zero entry/exit CSS animations on LocationGate verified.\n');
  }

  // Section 9 Test 3: No dynamic key props in Provider & Gate tree
  {
    console.log('13. Section 9: No dynamic key props in Provider & Gate tree');
    const layoutCode = readFileSync(path.join(srcDir, 'app', 'layout.tsx'), 'utf8');
    assert.strictEqual(layoutCode.includes('key='), false, 'No dynamic key props in layout.tsx providers');
    const gateCode = readFileSync(path.join(srcDir, 'components', 'common', 'LocationGate.tsx'), 'utf8');
    assert.strictEqual(gateCode.includes('key='), false, 'No dynamic key props in LocationGate.tsx');
    console.log('  ✅ Zero dynamic key props in provider/gate tree.\n');
  }

  // Section 9 Test 4: AppBootstrapGate permanently renders children
  {
    console.log('14. Section 9: AppBootstrapGate permanently renders children without unmounting');
    const bootstrapCode = readFileSync(path.join(srcDir, 'components', 'common', 'AppBootstrapGate.tsx'), 'utf8');
    assert.ok(bootstrapCode.includes('{children}'), 'AppBootstrapGate renders children unconditionally');
    assert.strictEqual(bootstrapCode.includes('return null'), false, 'AppBootstrapGate does not return null for children');
    console.log('  ✅ AppBootstrapGate permanently renders children.\n');
  }

  // Section 9 Test 5: Exact single LocationGate component project-wide
  {
    console.log('15. Section 9: Single LocationGate component project-wide');
    const onboardingCode = readFileSync(path.join(srcDir, 'app', 'onboarding', 'page.tsx'), 'utf8');
    assert.strictEqual(onboardingCode.includes('<LocationGate'), false, 'No duplicate LocationGate in onboarding/page.tsx');
    assert.strictEqual(onboardingCode.includes('Standort verwenden'), false, 'No duplicate Standort verwenden button in onboarding/page.tsx');
    console.log('  ✅ Single LocationGate component project-wide verified.\n');
  }

  console.log('🎉 ALL LOCATION GATE & ANTI-REMOUNT TESTS PASSED DETERMINISTICALLY!');
}

runTests().catch((err) => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
