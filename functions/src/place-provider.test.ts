import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolvePlaceViaGeoapify } from './activities';

test('provider verification trims secret whitespace and distinguishes provider errors from invalid IDs', async () => {
  const originalFetch = globalThis.fetch;
  const envNames = ['GEOAPIFY_API_KEY', 'FUNCTIONS_EMULATOR', 'FIREBASE_EMULATOR_HUB', 'NODE_ENV'] as const;
  const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
  try {
    delete process.env.FUNCTIONS_EMULATOR;
    delete process.env.FIREBASE_EMULATOR_HUB;
    process.env.NODE_ENV = 'development';
    process.env.GEOAPIFY_API_KEY = '  fixture-key\r\n';
    let requestedUrl: URL | undefined;
    globalThis.fetch = async input => {
      requestedUrl = new URL(String(input));
      return new Response(JSON.stringify({ features: [{
        properties: { name: 'Tiergehege', formatted: 'Adolf-Hoff-Weg, Bremerhaven', lat: 53.5, lon: 8.5, categories: ['entertainment.zoo'] },
      }] }), { status: 200 });
    };
    const result = await resolvePlaceViaGeoapify('provider-place');
    assert.equal(requestedUrl?.searchParams.get('apiKey'), 'fixture-key');
    assert.equal(requestedUrl?.searchParams.get('id'), 'provider-place');
    assert.equal(result.name, 'Tiergehege');
    assert.deepEqual(result.categories, ['entertainment.zoo']);

    for (const [status, expectedCode] of [
      [401, 'failed-precondition'], [403, 'failed-precondition'],
      [429, 'unavailable'], [500, 'unavailable'], [503, 'unavailable'],
      [400, 'invalid-argument'], [404, 'invalid-argument'],
    ] as const) {
      globalThis.fetch = async () => new Response('{}', { status });
      await assert.rejects(resolvePlaceViaGeoapify('provider-place'), (error: any) => {
        assert.equal(error.code, expectedCode, `HTTP ${status}`);
        assert.equal(error.message.includes('fixture-key'), false);
        return true;
      });
    }

    // A successful HTTP response alone is insufficient: the provider must return a real place.
    globalThis.fetch = async () => new Response('{"features":[]}', { status: 200 });
    await assert.rejects(resolvePlaceViaGeoapify('missing-place'), (error: any) => error.code === 'invalid-argument');
    process.env.GEOAPIFY_API_KEY = ' \r\n';
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response('{}'); };
    await assert.rejects(resolvePlaceViaGeoapify('provider-place'), (error: any) => error.code === 'unavailable');
    assert.equal(calls, 0, 'An empty secret must not be sent to Geoapify');
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of envNames) {
      if (originalEnv[name] === undefined) delete process.env[name];
      else process.env[name] = originalEnv[name];
    }
  }
});
