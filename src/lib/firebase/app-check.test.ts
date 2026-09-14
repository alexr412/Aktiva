import test from 'node:test';
import assert from 'node:assert';
import { initializeApp, deleteApp } from 'firebase/app';
import 'firebase/app-check';

test('Client App Check Singleton Unit Tests', async (t) => {
  await t.test('returns null when window is undefined (SSR environment)', async () => {
    const { getOrInitAppCheck, initializeAppCheckIfEnabled } = await import('./app-check');
    assert.strictEqual(await getOrInitAppCheck(), null);
    assert.strictEqual(initializeAppCheckIfEnabled({} as any), null);
  });

  await t.test('returns null when NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED is false or unset', async () => {
    const oldEnv = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED;
    process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED = 'false';
    try {
      const mockGlobal: any = global;
      mockGlobal.window = {};
      const { getOrInitAppCheck, initializeAppCheckIfEnabled } = await import('./app-check');
      assert.strictEqual(await getOrInitAppCheck({} as any), null);
      assert.strictEqual(initializeAppCheckIfEnabled({} as any), null);
    } finally {
      process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED = oldEnv;
      delete (global as any).window;
    }
  });

  await t.test('throws hard error when enabled but NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY is missing (non-emulator)', async () => {
    const oldEnabled = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED;
    const oldKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
    const oldEmu = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS;
    process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED = 'true';
    delete process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
    delete process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS;

    try {
      const mockGlobal: any = global;
      mockGlobal.window = {};
      const { getOrInitAppCheck, initializeAppCheckIfEnabled } = await import('./app-check');
      assert.throws(
        () => initializeAppCheckIfEnabled({} as any),
        (err: any) => err.message.includes('NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY is missing')
      );
    } finally {
      process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED = oldEnabled;
      process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY = oldKey;
      process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = oldEmu;
      delete (global as any).window;
    }
  });

  await t.test('uses CustomProvider in emulator mode to prevent external network calls in local dev', async () => {
    const oldEnabled = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED;
    const oldEmu = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS;
    const oldNodeEnv = process.env.NODE_ENV;
    process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED = 'true';
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = 'true';
    (process.env as any).NODE_ENV = 'development';

    let mockApp: any;
    let mockApp2: any;
    try {
      const mockGlobal: any = global;
      mockGlobal.window = { location: { hostname: 'localhost' } };
      mockApp = initializeApp({ apiKey: 'test-api-key', projectId: 'test-project', appId: '1:123:web:123' }, 'emulatorTestApp');
      const { initializeAppCheckIfEnabled } = await import('./app-check');
      const instance = initializeAppCheckIfEnabled(mockApp);
      assert.ok(instance !== null);

      // Verify singleton for same app
      const instance2 = initializeAppCheckIfEnabled(mockApp);
      assert.strictEqual(instance, instance2);

      // Verify separate app gets separate instance
      mockApp2 = initializeApp({ apiKey: 'test-api-key-2', projectId: 'test-project-2', appId: '1:456:web:456' }, 'emulatorTestApp2');
      const instance3 = initializeAppCheckIfEnabled(mockApp2);
      assert.ok(instance3 !== null);
      assert.notStrictEqual(instance, instance3);
    } finally {
      if (mockApp) await deleteApp(mockApp).catch(() => {});
      if (mockApp2) await deleteApp(mockApp2).catch(() => {});
      process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED = oldEnabled;
      process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = oldEmu;
      (process.env as any).NODE_ENV = oldNodeEnv || 'test';
      delete (global as any).window;
    }
  });

  await t.test('blocks CustomProvider fake token activation in development mode when hostname is remote', async () => {
    const oldEnabled = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED;
    const oldEmu = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS;
    const oldNodeEnv = process.env.NODE_ENV;
    process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED = 'true';
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = 'true';
    (process.env as any).NODE_ENV = 'development';

    let mockApp: any;
    try {
      const mockGlobal: any = global;
      mockGlobal.window = { location: { hostname: 'app.aktiva-app.com' } };
      mockApp = initializeApp({ apiKey: 'dev-api-key', projectId: 'dev-project', appId: '1:888:web:888' }, 'devRemoteTestApp');
      const { initializeAppCheckIfEnabled } = await import('./app-check');
      assert.throws(
        () => initializeAppCheckIfEnabled(mockApp),
        (err: any) => err.message.includes('Cannot enable emulator CustomProvider in non-local or production environment')
      );
    } finally {
      if (mockApp) await deleteApp(mockApp).catch(() => {});
      process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED = oldEnabled;
      process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = oldEmu;
      (process.env as any).NODE_ENV = oldNodeEnv || 'test';
      delete (global as any).window;
    }
  });

  await t.test('blocks CustomProvider fake token activation in production environment even if emulator flag is true', async () => {
    const oldEnabled = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED;
    const oldEmu = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS;
    const oldNodeEnv = process.env.NODE_ENV;
    process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED = 'true';
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = 'true';
    (process.env as any).NODE_ENV = 'production';

    let mockApp: any;
    try {
      const mockGlobal: any = global;
      mockGlobal.window = { location: { hostname: 'app.aktiva-app.com' } };
      mockApp = initializeApp({ apiKey: 'prod-api-key', projectId: 'prod-project', appId: '1:999:web:999' }, 'prodTestApp');
      const { initializeAppCheckIfEnabled } = await import('./app-check');
      assert.throws(
        () => initializeAppCheckIfEnabled(mockApp),
        (err: any) => err.message.includes('Cannot enable emulator CustomProvider in non-local or production environment')
      );
    } finally {
      if (mockApp) await deleteApp(mockApp).catch(() => {});
      process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED = oldEnabled;
      process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = oldEmu;
      (process.env as any).NODE_ENV = oldNodeEnv || 'test';
      delete (global as any).window;
    }
  });
});



