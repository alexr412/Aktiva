import test from 'node:test';
import assert from 'node:assert';

test('Server-side verifyNextRequestAppCheck Unit Tests', async (t) => {
  const { verifyNextRequestAppCheck } = await import('./admin-app-check');

  function createMockRequest(headersMap: Record<string, string> = {}) {
    return {
      headers: {
        get(name: string) {
          return headersMap[name.toLowerCase()] || null;
        }
      }
    } as any;
  }

  const mockAdminAppCheckSuccess = {
    async verifyToken(token: string) {
      if (token === 'valid_token') return { app_id: 'app_123' };
      throw new Error('Invalid token');
    }
  };

  const restoreEnv = (oldMode: string | undefined) => {
    if (oldMode === undefined) {
      delete process.env.APP_CHECK_ENFORCEMENT_MODE;
    } else {
      process.env.APP_CHECK_ENFORCEMENT_MODE = oldMode;
    }
  };

  await t.test('Observation Mode: missing token returns valid: false without errorResponse', async () => {
    const oldMode = process.env.APP_CHECK_ENFORCEMENT_MODE;
    process.env.APP_CHECK_ENFORCEMENT_MODE = 'observe';
    try {
      const req = createMockRequest({});
      const res = await verifyNextRequestAppCheck(req, { adminAppCheckOverride: mockAdminAppCheckSuccess });
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.reason, 'missing');
      assert.strictEqual(res.errorResponse, undefined);
    } finally {
      restoreEnv(oldMode);
    }
  });

  await t.test('Observation Mode: valid token returns valid: true', async () => {
    const oldMode = process.env.APP_CHECK_ENFORCEMENT_MODE;
    process.env.APP_CHECK_ENFORCEMENT_MODE = 'observe';
    try {
      const req = createMockRequest({ 'x-firebase-appcheck': 'valid_token' });
      const res = await verifyNextRequestAppCheck(req, { adminAppCheckOverride: mockAdminAppCheckSuccess });
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.errorResponse, undefined);
    } finally {
      restoreEnv(oldMode);
    }
  });

  await t.test('Enforcement Mode: missing token returns valid: false with 401 errorResponse', async () => {
    const oldMode = process.env.APP_CHECK_ENFORCEMENT_MODE;
    process.env.APP_CHECK_ENFORCEMENT_MODE = 'enforce';
    try {
      const req = createMockRequest({});
      const res = await verifyNextRequestAppCheck(req, { adminAppCheckOverride: mockAdminAppCheckSuccess });
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.reason, 'missing');
      assert.strictEqual(res.errorResponse?.status, 401);
    } finally {
      restoreEnv(oldMode);
    }
  });

  await t.test('Enforcement Mode: invalid token returns valid: false with 403 errorResponse', async () => {
    const oldMode = process.env.APP_CHECK_ENFORCEMENT_MODE;
    process.env.APP_CHECK_ENFORCEMENT_MODE = 'enforce';
    try {
      const req = createMockRequest({ 'x-firebase-appcheck': 'invalid_token' });
      const res = await verifyNextRequestAppCheck(req, { adminAppCheckOverride: mockAdminAppCheckSuccess });
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.reason, 'invalid');
      assert.strictEqual(res.errorResponse?.status, 403);
    } finally {
      restoreEnv(oldMode);
    }
  });

  await t.test('Uninitialized adminAppCheck returns 503 errorResponse in both modes', async () => {
    const oldMode = process.env.APP_CHECK_ENFORCEMENT_MODE;
    process.env.APP_CHECK_ENFORCEMENT_MODE = 'observe';
    try {
      const req = createMockRequest({ 'x-firebase-appcheck': 'valid_token' });
      const res = await verifyNextRequestAppCheck(req, { adminAppCheckOverride: null });
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.reason, 'uninitialized');
      assert.strictEqual(res.errorResponse?.status, 503);
    } finally {
      restoreEnv(oldMode);
    }
  });

  await t.test('Emits structured low-cardinality metric object for valid, missing, and invalid status without sensitive data or timestamp', async () => {
    const sensitiveHeaders = {
      'x-firebase-appcheck': 'raw_app_check_token_123',
      'authorization': 'Bearer secret_user_jwt_token_999',
      'x-forwarded-for': '192.168.1.100',
    };

    const FORBIDDEN_FIELDS = ['timestamp', 'token', 'uid', 'ip', 'authorization', 'error', 'stack', 'rawBody'];

    // 1. Valid Status Metric Test
    {
      const logs: any[] = [];
      const mockLogger = { info: (obj: any) => logs.push(obj), warn: () => {}, error: () => {} };
      const req = createMockRequest({ ...sensitiveHeaders, 'x-firebase-appcheck': 'valid_token' });
      await verifyNextRequestAppCheck(req, { adminAppCheckOverride: mockAdminAppCheckSuccess, routeId: 'API_GEOAPIFY', logger: mockLogger });
      assert.strictEqual(logs.length, 1);
      const metric = logs[0];
      assert.strictEqual(metric.event, 'app_check_verification');
      assert.strictEqual(metric.route, 'API_GEOAPIFY');
      assert.strictEqual(metric.status, 'valid');
      for (const field of FORBIDDEN_FIELDS) {
        assert.strictEqual(field in metric, false, `Metric for 'valid' must NOT contain sensitive/high-cardinality field '${field}'`);
      }
    }

    // 2. Missing Status Metric Test
    {
      const logs: any[] = [];
      const mockLogger = { info: (obj: any) => logs.push(obj), warn: () => {}, error: () => {} };
      const req = createMockRequest({ 'authorization': 'Bearer secret_user_jwt_token_999', 'x-forwarded-for': '192.168.1.100' });
      await verifyNextRequestAppCheck(req, { adminAppCheckOverride: mockAdminAppCheckSuccess, routeId: 'API_PARSE_INTENT', logger: mockLogger });
      assert.strictEqual(logs.length, 1);
      const metric = logs[0];
      assert.strictEqual(metric.event, 'app_check_verification');
      assert.strictEqual(metric.route, 'API_PARSE_INTENT');
      assert.strictEqual(metric.status, 'missing');
      for (const field of FORBIDDEN_FIELDS) {
        assert.strictEqual(field in metric, false, `Metric for 'missing' must NOT contain sensitive/high-cardinality field '${field}'`);
      }
    }

    // 3. Invalid Status Metric Test
    {
      const logs: any[] = [];
      const mockLogger = { info: (obj: any) => logs.push(obj), warn: () => {}, error: () => {} };
      const req = createMockRequest({ 'x-firebase-appcheck': 'invalid_token_str', 'authorization': 'Bearer secret_user_jwt_token_999', 'x-forwarded-for': '192.168.1.100' });
      await verifyNextRequestAppCheck(req, { adminAppCheckOverride: mockAdminAppCheckSuccess, routeId: 'API_ADMIN_USAGE', logger: mockLogger });
      assert.strictEqual(logs.length, 1);
      const metric = logs[0];
      assert.strictEqual(metric.event, 'app_check_verification');
      assert.strictEqual(metric.route, 'API_ADMIN_USAGE');
      assert.strictEqual(metric.status, 'invalid');
      for (const field of FORBIDDEN_FIELDS) {
        assert.strictEqual(field in metric, false, `Metric for 'invalid' must NOT contain sensitive/high-cardinality field '${field}'`);
      }
    }
  });
});