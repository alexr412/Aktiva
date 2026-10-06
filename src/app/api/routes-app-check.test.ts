import test from 'node:test';
import assert from 'node:assert';

test('Dedicated Custom API Routes App Check Integration Suite', async (t) => {
  const routes = [
    { name: '/api/geoapify', importPath: './geoapify/route' },
    { name: '/api/geoapify/telemetry', importPath: './geoapify/telemetry/route' },
    { name: '/api/parse-intent', importPath: './parse-intent/route' },
    { name: '/api/admin/usage', importPath: './admin/usage/route' },
  ];

  function createMockRequest(routeName: string, headersMap: Record<string, string> = {}, bodyData: any = {}) {
    return {
      headers: {
        get(name: string) {
          return headersMap[name.toLowerCase()] || null;
        }
      },
      json: async () => bodyData,
      nextUrl: { pathname: routeName },
      url: `http://localhost${routeName}`,
    } as any;
  }

  for (const r of routes) {
    await t.test(`Route ${r.name} enforces or observes App Check verification`, async (sub) => {
      const routeModule = await import(r.importPath);
      assert.strictEqual(typeof routeModule.POST, 'function', `Route ${r.name} must export a POST handler`);

      const oldMode = process.env.APP_CHECK_ENFORCEMENT_MODE;
      process.env.APP_CHECK_ENFORCEMENT_MODE = 'enforce';

      try {
        // 1. Missing App Check Header -> 401 Unauthorized in enforcement mode
        const reqMissing = createMockRequest(r.name, {});
        const resMissing = await routeModule.POST(reqMissing);
        assert.strictEqual(resMissing.status, 401, `Route ${r.name} must return 401 on missing App Check token in enforcement mode`);

        // 2. Invalid App Check Header -> 403 Forbidden in enforcement mode
        const reqInvalid = createMockRequest(r.name, { 'x-firebase-appcheck': 'invalid_token_xyz' });
        const resInvalid = await routeModule.POST(reqInvalid);
        assert.strictEqual(resInvalid.status, 403, `Route ${r.name} must return 403 on invalid App Check token in enforcement mode`);
      } finally {
        if (oldMode === undefined) {
          delete process.env.APP_CHECK_ENFORCEMENT_MODE;
        } else {
          process.env.APP_CHECK_ENFORCEMENT_MODE = oldMode;
        }
      }
    });
  }

  await t.test('Route /api/parse-intent short-circuits on failed App Check before rate limit or body json parsing', async () => {
    const { createParseIntentHandler } = await import('./parse-intent/handler');
    
    let rateLimitCalls = 0;
    let jsonCalls = 0;
    let aiCalls = 0;
    let usageCalls = 0;

    const mockVerifier = async () => ({
      valid: false,
      errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) as any
    });

    const handler = createParseIntentHandler({
      verifyAppCheck: mockVerifier,
      rateLimit: () => { rateLimitCalls++; return { success: true, headers: {} }; },
      aiGenerate: async () => { aiCalls++; return { output: { categories: [], filterByName: false } } as any; },
      recordUserTokenUsage: async () => { usageCalls++; }
    });

    const req = {
      headers: { get: () => null },
      json: async () => { jsonCalls++; return { query: 'test' }; }
    } as any;

    const res = await handler(req);
    assert.strictEqual(res.status, 401);
    assert.strictEqual(rateLimitCalls, 0, 'rateLimit must not be called when App Check fails');
    assert.strictEqual(jsonCalls, 0, 'req.json must not be called when App Check fails');
    assert.strictEqual(aiCalls, 0, 'AI generate must not be called when App Check fails');
    assert.strictEqual(usageCalls, 0, 'usageTracker must not be called when App Check fails');
  });

  await t.test('Route /api/parse-intent auth error matrix & valid token execution', async () => {
    const { createParseIntentHandler } = await import('./parse-intent/handler');

    let aiCalls = 0;
    let usageCalls = 0;
    let loggedUid = '';

    const mockAdminAuth = {
      verifyIdToken: async (token: string) => {
        if (token === 'valid_jwt_user') return { uid: 'user_123' };
        throw new Error('Invalid token');
      }
    };

    const handler = createParseIntentHandler({
      verifyAppCheck: async () => ({ valid: true }),
      adminAuth: mockAdminAuth as any,
      rateLimit: () => ({ success: true, headers: {} }),
      aiGenerate: async () => { aiCalls++; return { output: { categories: ['entertainment.cinema'], filterByName: false }, usage: { inputTokens: 100, outputTokens: 15 } } as any; },
      recordUserTokenUsage: async (data) => { usageCalls++; loggedUid = data.uid; }
    });

    // 1. Malformed Authorization header ("Basic xyz") -> 401
    const reqMalformed = {
      headers: { get: (name: string) => name.toLowerCase() === 'authorization' ? 'Basic xyz' : null },
      json: async () => ({ query: 'Filmabend mit Freunden' })
    } as any;
    const resMalformed = await handler(reqMalformed);
    assert.strictEqual(resMalformed.status, 401);
    assert.strictEqual(aiCalls, 0);

    // 2. Empty Bearer token ("Bearer ") -> 401
    const reqEmptyBearer = {
      headers: { get: (name: string) => name.toLowerCase() === 'authorization' ? 'Bearer ' : null },
      json: async () => ({ query: 'Filmabend mit Freunden' })
    } as any;
    const resEmptyBearer = await handler(reqEmptyBearer);
    assert.strictEqual(resEmptyBearer.status, 401);
    assert.strictEqual(aiCalls, 0);

    // 3. Invalid/revoked token ("Bearer invalid_jwt") -> 401
    const reqInvalid = {
      headers: { get: (name: string) => name.toLowerCase() === 'authorization' ? 'Bearer invalid_jwt' : null },
      json: async () => ({ query: 'Filmabend mit Freunden' })
    } as any;
    const resInvalid = await handler(reqInvalid);
    assert.strictEqual(resInvalid.status, 401);
    assert.strictEqual(aiCalls, 0);

    // 4. Valid token ("Bearer valid_jwt_user") -> 200 OK & usage tracked
    const reqValid = {
      headers: { get: (name: string) => name.toLowerCase() === 'authorization' ? 'Bearer valid_jwt_user' : null },
      json: async () => ({ query: 'Filmabend mit Freunden' })
    } as any;
    const resValid = await handler(reqValid);
    assert.strictEqual(resValid.status, 200);
    assert.strictEqual(aiCalls, 1);
    assert.strictEqual(usageCalls, 1);
    assert.strictEqual(loggedUid, 'user_123');
  });

  await t.test('Route /api/parse-intent default control flow executes injected loadUsageTracker without infinite recursion', async () => {
    const { createParseIntentHandler } = await import('./parse-intent/handler');

    let loaderCalls = 0;
    let trackerCalls = 0;
    let loggedUid = '';

    const mockAdminAuth = {
      verifyIdToken: async () => ({ uid: 'user_loader_test' })
    };

    const mockRecordUserTokenUsage = async (data: any) => {
      trackerCalls++;
      loggedUid = data.uid;
    };

    const mockLoadUsageTracker = async () => {
      loaderCalls++;
      return { recordUserTokenUsage: mockRecordUserTokenUsage };
    };

    const handler = createParseIntentHandler({
      verifyAppCheck: async () => ({ valid: true }),
      adminAuth: mockAdminAuth as any,
      rateLimit: () => ({ success: true, headers: {} }),
      aiGenerate: async () => ({ output: { categories: ['entertainment.cinema'], filterByName: false }, usage: { inputTokens: 100, outputTokens: 15 } } as any),
      loadUsageTracker: mockLoadUsageTracker,
      // deps.recordUserTokenUsage is intentionally left undefined to test default control flow via loader
    });

    const req = {
      headers: { get: (name: string) => name.toLowerCase() === 'authorization' ? 'Bearer valid_jwt' : null },
      json: async () => ({ query: 'Filmabend mit Freunden' })
    } as any;

    const res = await handler(req);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(loaderCalls, 1, 'Loader must be called exactly once');
    assert.strictEqual(trackerCalls, 1, 'Imported recordUserTokenUsage must be called exactly once');
    assert.strictEqual(loggedUid, 'user_loader_test', 'Must log correct UID');
  });
});



