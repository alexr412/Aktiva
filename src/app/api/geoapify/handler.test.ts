import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGeoapifyHandler } from './handler';
import { ServerResponseCache } from '@/lib/server-response-cache';

const request = (params: Record<string, string>, authorization = '') => ({
  headers: new Headers(authorization ? { authorization } : {}),
  json: async () => ({ service: 'places', params }),
}) as any;
const params = { categories: 'entertainment.cinema', filter: 'circle:8,53,5000', limit: '30', offset: '0' };
const base = { verifyAppCheck: async () => ({ valid: true }), limiter: async () => ({ success: true }) as any };

test('identical Geoapify responses are shared, category/page/radius changes fetch separately and credits count provider calls only', async () => {
  let calls = 0, transactions = 0;
  const handler = createGeoapifyHandler({ ...base, cache: new ServerResponseCache(),
    fetch: async () => { calls++; return Response.json({ features: [{ properties: { place_id: 'venue' } }] }); },
    recordTransaction: async () => { transactions++; return { credits: 2, duplicate: false }; },
  });
  assert.equal((await handler(request(params))).headers.get('X-Aktiva-Cache'), 'miss');
  assert.equal((await handler(request(params))).headers.get('X-Aktiva-Cache'), 'hit');
  assert.equal(calls, 1); assert.equal(transactions, 1);
  for (const delta of [{ categories: 'entertainment.museum' }, { offset: '30' }, { filter: 'circle:8,53,10000' }]) await handler(request({ ...params, ...delta }));
  assert.equal(calls, 4); assert.equal(transactions, 4);
});
test('provider errors are never cached and App Check/auth/rate limits run before all cache work', async () => {
  let calls = 0, cacheReads = 0;
  const cache = new ServerResponseCache({ get: async () => { cacheReads++; return null; }, set: async () => {} });
  const deps = { ...base, cache, fetch: async () => { calls++; return new Response('busy', { status: 429 }); }, recordTransaction: async () => ({ credits: 0, duplicate: false }) };
  const handler = createGeoapifyHandler(deps);
  assert.equal((await handler(request(params))).status, 429);
  assert.equal((await handler(request(params))).status, 429);
  assert.equal(calls, 2);
  const previousReads = cacheReads;
  const invalidAppCheck = createGeoapifyHandler({ ...deps, verifyAppCheck: async () => ({ valid: false, errorResponse: Response.json({ error: 'Unauthorized' }, { status: 401 }) as any }) });
  assert.equal((await invalidAppCheck(request(params))).status, 401);
  assert.equal((await handler(request(params, 'Basic invalid'))).status, 401);
  const limited = createGeoapifyHandler({ ...deps, limiter: async () => ({ success: false, resetTimeMs: Date.now() }) as any });
  assert.equal((await limited(request(params))).status, 429);
  assert.equal(cacheReads, previousReads);
});
