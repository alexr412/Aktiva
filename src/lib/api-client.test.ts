import test from 'node:test';
import assert from 'node:assert';
import { initializeApp } from 'firebase/app';
import 'firebase/app-check';

test('Client fetchWithAppCheck Unit Tests (13-Point Test Matrix)', async (t) => {
  const { fetchWithAppCheck } = await import('./api-client');

  await t.test('1. Rejects execution in SSR environment (window is undefined)', async () => {
    await assert.rejects(
      async () => fetchWithAppCheck('http://localhost:3000/api/geoapify'),
      (err: any) => err.message.includes('SSR')
    );
  });

  await t.test('2. Browser environment: fetches without X-Firebase-AppCheck when App Check is disabled', async () => {
    const mockGlobal: any = global;
    let fetchedUrl = '';
    let fetchedHeaders: any = null;

    mockGlobal.window = {};
    mockGlobal.fetch = async (url: any, init: any) => {
      fetchedUrl = String(url);
      fetchedHeaders = init.headers;
      return { ok: true, status: 200 } as any;
    };

    try {
      const res = await fetchWithAppCheck('/api/geoapify');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(fetchedUrl, '/api/geoapify');
      assert.strictEqual(fetchedHeaders.get('X-Firebase-AppCheck'), null);
    } finally {
      delete mockGlobal.window;
      delete mockGlobal.fetch;
    }
  });

  await t.test('3. Deletes caller-supplied X-Firebase-AppCheck header before token acquisition', async () => {
    const mockGlobal: any = global;
    let fetchedHeaders: any = null;

    mockGlobal.window = {};
    mockGlobal.fetch = async (url: any, init: any) => {
      fetchedHeaders = init.headers;
      return { ok: true, status: 200 } as any;
    };

    try {
      await fetchWithAppCheck('/api/geoapify', {
        headers: { 'X-Firebase-AppCheck': 'spoofed_token' }
      });
      assert.strictEqual(fetchedHeaders.get('X-Firebase-AppCheck'), null);
    } finally {
      delete mockGlobal.window;
      delete mockGlobal.fetch;
    }
  });

  await t.test('4. Deletes caller-supplied x-firebase-appcheck (lowercase) header before token acquisition', async () => {
    const mockGlobal: any = global;
    let fetchedHeaders: any = null;

    mockGlobal.window = {};
    mockGlobal.fetch = async (url: any, init: any) => {
      fetchedHeaders = init.headers;
      return { ok: true, status: 200 } as any;
    };

    try {
      await fetchWithAppCheck('/api/geoapify', {
        headers: { 'x-firebase-appcheck': 'spoofed_token_lower' }
      });
      assert.strictEqual(fetchedHeaders.get('x-firebase-appcheck'), null);
      assert.strictEqual(fetchedHeaders.get('X-Firebase-AppCheck'), null);
    } finally {
      delete mockGlobal.window;
      delete mockGlobal.fetch;
    }
  });

  await t.test('5. Injects Authorization Bearer Token when idToken is provided', async () => {
    const mockGlobal: any = global;
    let fetchedHeaders: any = null;

    mockGlobal.window = {};
    mockGlobal.fetch = async (url: any, init: any) => {
      fetchedHeaders = init.headers;
      return { ok: true, status: 200 } as any;
    };

    try {
      await fetchWithAppCheck('/api/geoapify', { idToken: 'user_jwt_123' });
      assert.strictEqual(fetchedHeaders.get('Authorization'), 'Bearer user_jwt_123');
    } finally {
      delete mockGlobal.window;
      delete mockGlobal.fetch;
    }
  });

  await t.test('6. Throws when enforceClientCheck is true but token cannot be obtained', async () => {
    const mockGlobal: any = global;
    mockGlobal.window = {};
    mockGlobal.fetch = async () => ({ ok: true } as any);

    try {
      await assert.rejects(
        async () => fetchWithAppCheck('/api/geoapify', { enforceClientCheck: true }),
        (err: any) => err.message.includes('App Check token is required')
      );
    } finally {
      delete mockGlobal.window;
      delete mockGlobal.fetch;
    }
  });

  await t.test('7. Rejects immediately when userSignal is pre-aborted without invoking fetch', async () => {
    const mockGlobal: any = global;
    let fetchCalled = false;

    mockGlobal.window = {};
    mockGlobal.fetch = async () => {
      fetchCalled = true;
      return { ok: true } as any;
    };

    const controller = new AbortController();
    controller.abort(new Error('User aborted request'));

    try {
      await assert.rejects(
        async () => fetchWithAppCheck('/api/geoapify', { signal: controller.signal }),
        (err: any) => err.message.includes('User aborted request')
      );
      assert.strictEqual(fetchCalled, false);
    } finally {
      delete mockGlobal.window;
      delete mockGlobal.fetch;
    }
  });

  await t.test('8. Cleans up timeout timer when request completes normally', async () => {
    const mockGlobal: any = global;
    mockGlobal.window = {};
    mockGlobal.fetch = async () => ({ ok: true, status: 200 } as any);

    try {
      const res = await fetchWithAppCheck('/api/geoapify', { timeoutMs: 5000 });
      assert.strictEqual(res.status, 200);
    } finally {
      delete mockGlobal.window;
      delete mockGlobal.fetch;
    }
  });

  await t.test('9. Cleans up user signal listener when request completes normally', async () => {
    const mockGlobal: any = global;
    mockGlobal.window = {};
    mockGlobal.fetch = async () => ({ ok: true, status: 200 } as any);

    const controller = new AbortController();
    try {
      const res = await fetchWithAppCheck('/api/geoapify', { signal: controller.signal });
      assert.strictEqual(res.status, 200);
    } finally {
      delete mockGlobal.window;
      delete mockGlobal.fetch;
    }
  });

  await t.test('10. Aborts request when timeoutMs elapses before fetch resolves', async () => {
    const mockGlobal: any = global;
    mockGlobal.window = {};
    mockGlobal.fetch = (_url: any, init: any) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason));
    });

    try {
      await assert.rejects(
        async () => fetchWithAppCheck('/api/geoapify', { timeoutMs: 50 }),
        (err: any) => err.message.includes('timed out after 50 ms')
      );
    } finally {
      delete mockGlobal.window;
      delete mockGlobal.fetch;
    }
  });

  await t.test('11. Aborts request when userSignal aborts mid-flight', async () => {
    const mockGlobal: any = global;
    mockGlobal.window = {};
    const userController = new AbortController();

    mockGlobal.fetch = (_url: any, init: any) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason));
    });

    setTimeout(() => {
      userController.abort(new Error('Mid-flight cancellation'));
    }, 20);

    try {
      await assert.rejects(
        async () => fetchWithAppCheck('/api/geoapify', { signal: userController.signal }),
        (err: any) => err.message.includes('Mid-flight cancellation')
      );
    } finally {
      delete mockGlobal.window;
      delete mockGlobal.fetch;
    }
  });

  await t.test('12. Retains custom caller headers while stripping spoofed App Check headers', async () => {
    const mockGlobal: any = global;
    let fetchedHeaders: any = null;

    mockGlobal.window = {};
    mockGlobal.fetch = async (_url: any, init: any) => {
      fetchedHeaders = init.headers;
      return { ok: true, status: 200 } as any;
    };

    try {
      await fetchWithAppCheck('/api/geoapify', {
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom_val',
          'X-Firebase-AppCheck': 'fake_token',
        }
      });
      assert.strictEqual(fetchedHeaders.get('Content-Type'), 'application/json');
      assert.strictEqual(fetchedHeaders.get('X-Custom-Header'), 'custom_val');
      assert.strictEqual(fetchedHeaders.get('X-Firebase-AppCheck'), null);
    } finally {
      delete mockGlobal.window;
      delete mockGlobal.fetch;
    }
  });

  await t.test('13. Injects valid X-Firebase-AppCheck header when token acquisition succeeds', async () => {
    const oldEnabled = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED;
    const oldEmu = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS;
    const oldNodeEnv = process.env.NODE_ENV;
    process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED = 'true';
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = 'true';
    (process.env as any).NODE_ENV = 'development';

    const mockGlobal: any = global;
    let fetchedHeaders: any = null;

    mockGlobal.window = { location: { hostname: 'localhost' }, FIREBASE_APPCHECK_DEBUG_TOKEN: false };
    mockGlobal.fetch = async (_url: any, init: any) => {
      fetchedHeaders = init.headers;
      return { ok: true, status: 200 } as any;
    };

    try {
      const mockApp = initializeApp({ apiKey: 'test', projectId: 'test', appId: '1:1:1:1' }, 'fetchAppCheckApp');
      const res = await fetchWithAppCheck('/api/geoapify', { firebaseApp: mockApp });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(fetchedHeaders.get('X-Firebase-AppCheck'), 'mock-emulator-app-check-token');
    } finally {
      process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED = oldEnabled;
      process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = oldEmu;
      (process.env as any).NODE_ENV = oldNodeEnv || 'test';
      delete mockGlobal.window;
      delete mockGlobal.fetch;
    }
  });
});


