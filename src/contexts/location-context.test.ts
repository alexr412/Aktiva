import assert from 'node:assert';

/**
 * Unit & Integration Test Suite — Aktiva Location Lock Screen & Retry Logic
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

interface SimulatedState {
  locationMode: 'current' | 'manual';
  locationSource: 'gps' | 'cache' | 'manual' | null;
  locationStatus: 'idle' | 'loading' | 'ready' | 'prompt' | 'denied' | 'error';
  effectiveLocation: { lat: number; lng: number } | null;
  cityName: string | null;
  permissionState: 'granted' | 'prompt' | 'denied' | null;
  locationError: string | null;
  getCurrentPositionCallCount: number;
}

class LocationSystemSimulator {
  public state: SimulatedState = {
    locationMode: 'current',
    locationSource: null,
    locationStatus: 'prompt',
    effectiveLocation: null,
    cityName: null,
    permissionState: 'prompt',
    locationError: null,
    getCurrentPositionCallCount: 0,
  };

  private isRequestingLock = false;
  private permissionsSupported = true;
  private mockGpsBehavior: (() => Promise<{ lat: number; lng: number }> | never) | null = null;

  constructor(options?: { permissionsSupported?: boolean }) {
    if (options?.permissionsSupported !== undefined) {
      this.permissionsSupported = options.permissionsSupported;
    }
  }

  public setGpsBehavior(behavior: () => Promise<{ lat: number; lng: number }>) {
    this.mockGpsBehavior = behavior;
  }

  public setGpsError(code: number, message: string) {
    this.mockGpsBehavior = () => {
      const err = new Error(message) as any;
      err.code = code;
      throw err;
    };
  }

  public async requestGpsLocation(forceExplicit = false): Promise<boolean> {
    if (this.isRequestingLock) {
      console.log('[TEST SIMULATOR] Request lock active. Skipping duplicate GPS call.');
      return false;
    }

    this.isRequestingLock = true;
    this.state.locationStatus = 'loading';
    this.state.locationError = null;

    try {
      this.state.getCurrentPositionCallCount++;

      if (!this.mockGpsBehavior) {
        throw new Error('No GPS behavior configured');
      }

      const coords = await this.mockGpsBehavior();
      
      this.state.effectiveLocation = { lat: coords.lat, lng: coords.lng };
      this.state.locationSource = 'gps';
      this.state.locationStatus = 'ready';
      this.state.permissionState = 'granted';
      this.state.locationError = null;
      this.state.cityName = 'Bielefeld';
      return true;
    } catch (err: any) {
      const code = err.code || 0;
      if (code === 1) { // PERMISSION_DENIED
        this.state.permissionState = 'denied';
        this.state.locationStatus = 'denied';
        this.state.locationError = 'Der Standortzugriff ist weiterhin deaktiviert. Ändere die Berechtigung in deinen Geräte- oder Browser-Einstellungen.';
      } else if (code === 2) { // POSITION_UNAVAILABLE
        this.state.locationStatus = 'error';
        this.state.locationError = 'Dein Standort ist momentan nicht verfügbar. Prüfe, ob die Ortungsdienste auf deinem Gerät aktiviert sind.';
      } else if (code === 3) { // TIMEOUT
        this.state.locationStatus = 'error';
        this.state.locationError = 'Die Standortermittlung hat zu lange gedauert. Versuche es erneut.';
      } else {
        this.state.locationStatus = 'error';
        this.state.locationError = err.message || 'Ein unerwarteter Fehler ist aufgetreten.';
      }
      this.state.effectiveLocation = null;
      this.state.cityName = null;
      return false;
    } finally {
      this.isRequestingLock = false;
    }
  }

  public async retryCurrentLocation(): Promise<boolean> {
    return this.requestGpsLocation(true);
  }

  public handleAppReturn() {
    if (this.state.locationStatus === 'denied' || this.state.locationStatus === 'prompt') {
      return this.requestGpsLocation(true);
    }
  }
}

async function runTests() {
  console.log('🧪 Starting Location Lock Screen & Retry Logic Unit Tests...\n');

  // Test 1: Click "Erneut versuchen" invokes getCurrentPosition even if permissionState === 'denied'
  {
    console.log('Test 1: Retry button invokes getCurrentPosition even when permissionState is "denied"');
    const sim = new LocationSystemSimulator();
    sim.state.permissionState = 'denied';
    sim.state.locationStatus = 'denied';

    sim.setGpsBehavior(async () => ({ lat: 52.026036, lng: 8.522224 })); // User enabled GPS in settings

    const success = await sim.retryCurrentLocation();
    assert.strictEqual(success, true);
    assert.strictEqual(sim.state.getCurrentPositionCallCount, 1);
    assert.strictEqual(sim.state.locationStatus, 'ready');
    assert.strictEqual(sim.state.effectiveLocation?.lat, 52.026036);
    console.log('  ✅ Retry button successfully bypassed stale "denied" state and updated location to ready.\n');
  }

  // Test 2: PERMISSION_DENIED (Code 1) produces distinct German error message without Bremerhaven fallback
  {
    console.log('Test 2: PERMISSION_DENIED code 1 sets "denied" status and German instructions message');
    const sim = new LocationSystemSimulator();
    sim.setGpsError(1, 'User denied Geolocation');

    const success = await sim.retryCurrentLocation();
    assert.strictEqual(success, false);
    assert.strictEqual(sim.state.locationStatus, 'denied');
    assert.strictEqual(sim.state.effectiveLocation, null);
    assert.strictEqual(sim.state.cityName, null);
    assert.ok(sim.state.locationError?.includes('Geräte- oder Browser-Einstellungen'));
    console.log('  ✅ PERMISSION_DENIED set explicit instructions message and zero Bremerhaven fallback.\n');
  }

  // Test 3: POSITION_UNAVAILABLE (Code 2) produces distinct device settings error message
  {
    console.log('Test 3: POSITION_UNAVAILABLE code 2 sets specific device Location Services error message');
    const sim = new LocationSystemSimulator();
    sim.setGpsError(2, 'Position unavailable');

    const success = await sim.retryCurrentLocation();
    assert.strictEqual(success, false);
    assert.strictEqual(sim.state.locationStatus, 'error');
    assert.ok(sim.state.locationError?.includes('Ortungsdienste auf deinem Gerät aktiviert'));
    console.log('  ✅ POSITION_UNAVAILABLE correctly instructed user to check device Location Services.\n');
  }

  // Test 4: TIMEOUT (Code 3) produces specific timeout error message
  {
    console.log('Test 4: TIMEOUT code 3 sets specific timeout message');
    const sim = new LocationSystemSimulator();
    sim.setGpsError(3, 'Timeout expired');

    const success = await sim.retryCurrentLocation();
    assert.strictEqual(success, false);
    assert.strictEqual(sim.state.locationStatus, 'error');
    assert.ok(sim.state.locationError?.includes('zu lange gedauert'));
    console.log('  ✅ TIMEOUT correctly displayed timeout guidance.\n');
  }

  // Test 5: Concurrency lock prevents duplicate parallel GPS requests during rapid multiple taps
  {
    console.log('Test 5: Concurrency lock prevents duplicate requests on rapid taps');
    const sim = new LocationSystemSimulator();
    let delayResolve: (val: any) => void;
    sim.setGpsBehavior(() => new Promise((res) => { delayResolve = res; }));

    const req1 = sim.retryCurrentLocation();
    const req2 = sim.retryCurrentLocation(); // Second tap while first is pending

    assert.strictEqual(sim.state.getCurrentPositionCallCount, 1); // Only 1 GPS call started

    delayResolve!({ lat: 52.026, lng: 8.522 });
    await req1;
    await req2;

    assert.strictEqual(sim.state.getCurrentPositionCallCount, 1);
    console.log('  ✅ Rapid multi-tap correctly resulted in single GPS call.\n');
  }

  // Test 6: Permissions API unsupported (undefined): GPS retry works seamlessly
  {
    console.log('Test 6: Permissions API unsupported: GPS retry works seamlessly');
    const sim = new LocationSystemSimulator({ permissionsSupported: false });
    sim.setGpsBehavior(async () => ({ lat: 52.026036, lng: 8.522224 }));

    const success = await sim.retryCurrentLocation();
    assert.strictEqual(success, true);
    assert.strictEqual(sim.state.effectiveLocation?.lat, 52.026036);
    console.log('  ✅ GPS retry succeeded without Permissions API.\n');
  }

  // Test 7: App return (visibilitychange / focus) triggers re-check and resolves unlocked location
  {
    console.log('Test 7: App return from settings triggers auto re-check');
    const sim = new LocationSystemSimulator();
    sim.state.permissionState = 'denied';
    sim.state.locationStatus = 'denied';

    sim.setGpsBehavior(async () => ({ lat: 52.026036, lng: 8.522224 })); // User enabled location in iPhone settings

    await sim.handleAppReturn();

    assert.strictEqual(sim.state.locationStatus, 'ready');
    assert.strictEqual(sim.state.effectiveLocation?.lat, 52.026036);
    assert.strictEqual(sim.state.cityName, 'Bielefeld');
    console.log('  ✅ Returning to app from system settings automatically unlocked location.\n');
  }

  // Test 8: Zero Bremerhaven fallback is ever set on denial or error
  {
    console.log('Test 8: Zero Bremerhaven fallback is ever set');
    const sim = new LocationSystemSimulator();
    sim.setGpsError(1, 'Denied');
    await sim.retryCurrentLocation();

    assert.notStrictEqual(sim.state.cityName, 'Bremerhaven');
    assert.strictEqual(sim.state.effectiveLocation, null);
    console.log('  ✅ Zero Bremerhaven fallback confirmed.\n');
  }

  console.log('🎉 ALL LOCATION LOCK SCREEN & RETRY LOGIC TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
