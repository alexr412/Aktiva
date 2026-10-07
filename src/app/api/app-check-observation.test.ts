import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGeoapifyHandler } from './geoapify/handler';
import { createParseIntentHandler } from './parse-intent/handler';
import { verifyNextRequestAppCheck } from '@/lib/firebase/admin-app-check';
import { ServerResponseCache } from '@/lib/server-response-cache';

test('Geoapify and search honor observation mode while enforcement still rejects before any work', async t => {
  const previousMode = process.env.APP_CHECK_ENFORCEMENT_MODE;
  const quietLogger = { info: () => {}, warn: () => {}, error: () => {} };
  const appCheck = { verifyToken: async () => { throw new Error('Invalid token'); } };
  try {
    for (const route of ['geoapify', 'parse-intent']) {
      for (const mode of ['observe', 'enforce']) {
        for (const token of ['', 'invalid-token']) {
          await t.test(`${route}: ${mode}, ${token ? 'invalid' : 'missing'} token`, async () => {
            process.env.APP_CHECK_ENFORCEMENT_MODE = mode;
            let limitCalls = 0, authCalls = 0, bodyCalls = 0, providerCalls = 0, cacheReads = 0;
            const cache = new ServerResponseCache({ get: async () => { cacheReads++; return null; }, set: async () => {} });
            const verifyAppCheck: typeof verifyNextRequestAppCheck = (request, options) => verifyNextRequestAppCheck(request, {
              ...options, adminAppCheckOverride: appCheck, logger: quietLogger,
            });
            const auth = { verifyIdToken: async () => { authCalls++; return { uid: 'user-1' }; } } as any;
            const request = {
              headers: new Headers({ authorization: 'Bearer signed-in-user', ...(token ? { 'x-firebase-appcheck': token } : {}) }),
              signal: new AbortController().signal,
              json: async () => {
                bodyCalls++;
                return route === 'geoapify'
                  ? { service: 'places', params: { categories: 'entertainment.cinema', filter: 'circle:8,53,10000', limit: '1' } }
                  : { query: 'Museum in 5 km' };
              },
            } as any;
            const handler = route === 'geoapify'
              ? createGeoapifyHandler({ verifyAppCheck, auth, cache,
                  limiter: async () => { limitCalls++; return { success: true } as any; },
                  fetch: async () => { providerCalls++; return Response.json({ features: [{ properties: { place_id: 'museum' } }] }); },
                  recordTransaction: async () => ({ credits: 1, duplicate: false }),
                })
              : createParseIntentHandler({ verifyAppCheck, adminAuth: auth, cache,
                  rateLimit: () => { limitCalls++; return { success: true, headers: {} }; },
                  aiGenerate: async () => { providerCalls++; return { output: null }; },
                });
            const response = await handler(request);
            if (mode === 'enforce') {
              assert.equal(response.status, token ? 403 : 401);
              assert.equal(authCalls + limitCalls + bodyCalls + providerCalls + cacheReads, 0);
            } else {
              assert.equal(response.status, 200);
              assert.equal(authCalls, 1);
              assert.equal(limitCalls, 1);
              assert.equal(bodyCalls, 1);
              const result = await response.json();
              if (route === 'geoapify') {
                assert.equal(result.features.length, 1);
                assert.equal(providerCalls, 1);
              } else {
                assert.equal(result.radiusKm, 5);
                assert.equal(providerCalls, 0, 'local search needs no AI call');
              }
            }
          });
        }
      }
    }
  } finally {
    if (previousMode === undefined) delete process.env.APP_CHECK_ENFORCEMENT_MODE;
    else process.env.APP_CHECK_ENFORCEMENT_MODE = previousMode;
  }
});
