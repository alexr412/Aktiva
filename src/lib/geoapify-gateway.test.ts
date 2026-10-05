import assert from 'node:assert/strict';
import { test } from 'node:test';
import { callGeoapifyGateway } from './geoapify';

test('gateway survives a 17-second response and supports GeoJSON text search', async t => {
  // Load dynamic dependencies before replacing timers.
  await import('./api-client');
  const originalFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const previousEnabled = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED;
  process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED = 'false';
  globalThis.window = {} as Window & typeof globalThis;
  t.mock.timers.enable({ apis: ['setTimeout'] });

  let entered!: () => void;
  const requestStarted = new Promise<void>(resolve => { entered = resolve; });
  let respond!: (response: Response) => void;
  const response = new Promise<Response>(resolve => { respond = resolve; });
  let signal: AbortSignal | undefined;
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith('/telemetry')) return new Response('{}');
    signal = init?.signal as AbortSignal;
    entered();
    return response;
  };

  try {
    const pending = callGeoapifyGateway('geocoding', { text: 'Berlin' });
    await requestStarted;
    t.mock.timers.tick(17000);
    assert.equal(signal?.aborted, false, 'a valid slow response must survive the former 10-second deadline');
    const features = [{ properties: { place_id: 'berlin', lat: 52.52, lon: 13.4 } }];
    respond(new Response(JSON.stringify({ type: 'FeatureCollection', features })));
    const data = await pending;
    assert.deepEqual(data.features, features, 'address lookup retains GeoJSON features');
    assert.deepEqual(data.results, features.map(feature => feature.properties), 'text search receives JSON results');
  } finally {
    t.mock.timers.reset();
    globalThis.fetch = originalFetch;
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, 'window');
    else globalThis.window = previousWindow;
    if (previousEnabled === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED;
    else process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED = previousEnabled;
  }
});
