import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { authenticateAndAuthorizeAdminRequest } from './auth-helper';

console.log('--- RUNNING ECHTEN ADMIN USAGE API SECURITY & AUTHENTICATION UNIT TESTS ---');

function createNextRequest(headers: Record<string, string> = {}) {
  const reqHeaders = new Headers();
  Object.entries(headers).forEach(([k, v]) => reqHeaders.set(k, v));
  return new NextRequest('http://localhost:9002/api/admin/usage', {
    method: 'POST',
    headers: reqHeaders,
  });
}

function createMockDeps(config: {
  adminAuthAvailable?: boolean;
  adminDbAvailable?: boolean;
  verifyResult?: { uid: string } | Error;
  userDocResult?: { exists: boolean; data?: any } | Error;
}) {
  const {
    adminAuthAvailable = true,
    adminDbAvailable = true,
    verifyResult,
    userDocResult,
  } = config;

  const mockAdminAuth = adminAuthAvailable ? {
    verifyIdToken: async (_token: string, _checkRevoked?: boolean) => {
      if (verifyResult instanceof Error) throw verifyResult;
      if (!verifyResult) throw new Error('Token verification failed');
      return verifyResult;
    }
  } : null;

  const mockAdminDb = adminDbAvailable ? {
    collection: (_collName: string) => ({
      doc: (_docId: string) => ({
        get: async () => {
          if (userDocResult instanceof Error) throw userDocResult;
          return {
            exists: userDocResult?.exists ?? false,
            data: () => userDocResult?.data ?? {},
          };
        }
      })
    })
  } : null;

  return {
    adminAuth: mockAdminAuth as any,
    adminDb: mockAdminDb as any,
  };
}

async function runTests() {
  // Test 1: Missing Auth Header -> 401
  const req1 = createNextRequest({});
  const res1 = await authenticateAndAuthorizeAdminRequest(req1, createMockDeps({}));
  assert.strictEqual(res1.errorResponse?.status, 401, '1. Missing auth header must return 401');

  // Test 2: Malformed Bearer Token -> 401
  const req2 = createNextRequest({ authorization: 'Bearer ' });
  const res2 = await authenticateAndAuthorizeAdminRequest(req2, createMockDeps({}));
  assert.strictEqual(res2.errorResponse?.status, 401, '2. Malformed bearer token must return 401');

  // Test 3: Invalid or Revoked Token -> 401
  const req3 = createNextRequest({ authorization: 'Bearer revoked_token_123' });
  const res3 = await authenticateAndAuthorizeAdminRequest(req3, createMockDeps({
    verifyResult: new Error('Token revoked or invalid')
  }));
  assert.strictEqual(res3.errorResponse?.status, 401, '3. Revoked/Invalid token must return 401');

  // Test 4: Forged unverified token -> 401
  const req4 = createNextRequest({ authorization: 'Bearer forged.payload.signature' });
  const res4 = await authenticateAndAuthorizeAdminRequest(req4, createMockDeps({
    verifyResult: new Error('Signature verification failed')
  }));
  assert.strictEqual(res4.errorResponse?.status, 401, '4. Forged token must return 401');

  // Test 5: Missing user document in Firestore -> 403
  const req5 = createNextRequest({ authorization: 'Bearer valid_token' });
  const res5 = await authenticateAndAuthorizeAdminRequest(req5, createMockDeps({
    verifyResult: { uid: 'nonexistent_user' },
    userDocResult: { exists: false }
  }));
  assert.strictEqual(res5.errorResponse?.status, 403, '5. Missing user doc must return 403');

  // Test 6: Stale admin claim with Firestore doc role user -> 403
  const req6 = createNextRequest({ authorization: 'Bearer stale_admin_token' });
  const res6 = await authenticateAndAuthorizeAdminRequest(req6, createMockDeps({
    verifyResult: { uid: 'ex_admin' }, // Claim said admin
    userDocResult: { exists: true, data: { role: 'user' } } // Firestore doc says user
  }));
  assert.strictEqual(res6.errorResponse?.status, 403, '6. Stale admin claim must return 403');

  // Test 7: Supporter role -> 403
  const req7 = createNextRequest({ authorization: 'Bearer supporter_token' });
  const res7 = await authenticateAndAuthorizeAdminRequest(req7, createMockDeps({
    verifyResult: { uid: 'supporter1' },
    userDocResult: { exists: true, data: { role: 'supporter' } }
  }));
  assert.strictEqual(res7.errorResponse?.status, 403, '7. Supporter role must return 403');

  // Test 8: Moderator role -> 403
  const req8 = createNextRequest({ authorization: 'Bearer mod_token' });
  const res8 = await authenticateAndAuthorizeAdminRequest(req8, createMockDeps({
    verifyResult: { uid: 'mod1' },
    userDocResult: { exists: true, data: { role: 'moderator' } }
  }));
  assert.strictEqual(res8.errorResponse?.status, 403, '8. Moderator role must return 403');

  // Test 9: Finance role -> 403
  const req9 = createNextRequest({ authorization: 'Bearer fin_token' });
  const res9 = await authenticateAndAuthorizeAdminRequest(req9, createMockDeps({
    verifyResult: { uid: 'fin1' },
    userDocResult: { exists: true, data: { role: 'finance' } }
  }));
  assert.strictEqual(res9.errorResponse?.status, 403, '9. Finance role must return 403');

  // Test 10: Admin role -> Allowed (errorResponse undefined, role 'admin')
  const req10 = createNextRequest({ authorization: 'Bearer admin_token' });
  const res10 = await authenticateAndAuthorizeAdminRequest(req10, createMockDeps({
    verifyResult: { uid: 'admin1' },
    userDocResult: { exists: true, data: { role: 'admin' } }
  }));
  assert.strictEqual(res10.errorResponse, undefined, '10. Admin role must pass auth check');
  assert.strictEqual(res10.role, 'admin');

  // Test 11: Superadmin role -> Allowed (errorResponse undefined, role 'superadmin')
  const req11 = createNextRequest({ authorization: 'Bearer superadmin_token' });
  const res11 = await authenticateAndAuthorizeAdminRequest(req11, createMockDeps({
    verifyResult: { uid: 'super1' },
    userDocResult: { exists: true, data: { role: 'superadmin' } }
  }));
  assert.strictEqual(res11.errorResponse, undefined, '11. Superadmin role must pass auth check');
  assert.strictEqual(res11.role, 'superadmin');

  // Test 12: Admin SDK Uninitialized (Fail-Closed) -> 503
  const req12 = createNextRequest({ authorization: 'Bearer admin_token' });
  const res12 = await authenticateAndAuthorizeAdminRequest(req12, createMockDeps({
    adminAuthAvailable: false,
    adminDbAvailable: false
  }));
  assert.strictEqual(res12.errorResponse?.status, 503, '12. Uninitialized Admin SDK must fail-closed with 503');

  // Test 13: Firestore Read Error (Fail-Closed) -> 503
  const req13 = createNextRequest({ authorization: 'Bearer admin_token' });
  const res13 = await authenticateAndAuthorizeAdminRequest(req13, createMockDeps({
    verifyResult: { uid: 'admin1' },
    userDocResult: new Error('Firestore connection timeout')
  }));
  assert.strictEqual(res13.errorResponse?.status, 503, '13. Firestore read error must fail-closed with 503');

  console.log('🎉 ALL REAL ADMIN USAGE API SECURITY & AUTHENTICATION TESTS PASSED SUCCESSFULLY! 🎉');
}

runTests().catch((err) => {
  console.error('API Test Execution Failed:', err);
  process.exit(1);
});
