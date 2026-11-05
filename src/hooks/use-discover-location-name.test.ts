import assert from 'node:assert/strict';
import test from 'node:test';
import { recoverLocationName } from './use-discover-location-name';

test('restores the city of saved device coordinates and resolves cache misses once', async (t) => {
  const store = new Map<string, string>();
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
  });
  t.after(() => {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });

  const bremerhaven = 'activa_city_cache_53.54_8.58';
  store.set(bremerhaven, JSON.stringify({ city: 'Bremerhaven', ts: Date.now() }));
  const noLookup = async () => assert.fail('The matching city is cached');
  assert.equal(await recoverLocationName(53.54, 8.58, noLookup), 'Bremerhaven');

  const lookup = t.mock.fn(async (latitude: number, longitude: number) => {
    assert.equal(latitude, 52.0302);
    assert.equal(longitude, 8.5325);
    return 'Bielefeld';
  });
  assert.equal(await recoverLocationName(52.0302, 8.5325, lookup), 'Bielefeld');
  assert.equal(await recoverLocationName(52.0302, 8.5325, noLookup), 'Bielefeld');
  assert.equal(lookup.mock.callCount(), 1);

  store.set(bremerhaven, JSON.stringify({ city: 'Bremerhaven', ts: Date.now() - 31 * 86400_000 }));
  assert.equal(await recoverLocationName(53.54, 8.58, async () => null), null);
});
