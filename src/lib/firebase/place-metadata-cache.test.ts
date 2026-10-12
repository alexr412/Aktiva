import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { LocalDataCache } from '../cache/local-data-cache';

function harness() {
  let now = 0, reads = 0, calls = 0, value = 1;
  const metrics = { documentReads: 0 };
  const timers = new Map<number, () => void>();
  const browser = Object.assign(new EventTarget(), {
    setInterval: (fn: () => void) => { const id = timers.size + 1; timers.set(id, fn); return id; },
    clearInterval: (id: number) => timers.delete(id),
  });
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const firestore = {
    collection: () => ({}), documentId: () => 'id', where: (_: any, __: any, ids: string[]) => ids,
    query: (_: any, ids: string[]) => ids,
    getDocs: async (ids: string[]) => {
      calls++;
      const docs = ids.filter(id => id !== 'missing').map(id => ({ id, data: () => ({ upvotes: value, userVotes: { one: 'up', two: 'down' }, privateField: 'secret' }) }));
      reads += Math.max(1, docs.length);
      return { docs, size: docs.length };
    },
  };
  const cache = new LocalDataCache(undefined, () => now);
  const stubs: Record<string, unknown> = {
    'firebase/firestore': firestore, './client': { db: {} },
    '../cache/browser-data-cache': { browserDataCache: cache }, '../cache/local-data-cache': { localDataMetrics: metrics },
  };
  const module = { exports: {} as any };
  const compiled = ts.transpileModule(readFileSync('src/lib/firebase/place-metadata-cache.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  class DetailEvent extends Event { constructor(type: string, public detailOptions: any) { super(type); } get detail() { return this.detailOptions.detail; } }
  vm.runInNewContext(compiled, { module, exports: module.exports, require: (id: string) => { if (!(id in stubs)) throw Error(id); return stubs[id]; }, window: browser, document, CustomEvent: DetailEvent, queueMicrotask, console });
  return { api: module.exports, timers, document, metrics, calls: () => calls, reads: () => reads, setNow: (next: number) => { now = next; }, setValue: (next: number) => { value = next; } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('metadata reuses sorted queries, caches absent spots and only retains the current account vote', async () => {
  const h = harness();
  const first = await h.api.loadPlaceMetadata('one', ['park', 'missing']);
  const second = await h.api.loadPlaceMetadata('one', ['missing', 'park']);
  assert.equal(h.calls(), 1);
  assert.equal(first.find((r: any) => r.id === 'park').data.userVotes.two, undefined);
  assert.equal(first.find((r: any) => r.id === 'park').data.privateField, undefined);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(JSON.stringify(first.find((r: any) => r.id === 'missing').data), '{}');
  await h.api.loadPlaceMetadata('two', ['park']);
  assert.equal(h.calls(), 2);
});

test('a vote invalidates the cache immediately; hidden feeds do not poll and unsubscribed feeds ignore updates', async () => {
  const h = harness();
  const results: any[] = [];
  const stop = h.api.watchCachedPlaceMetadata('one', ['park'], (value: any) => results.push(value), assert.fail);
  await tick();
  h.setValue(2);
  await h.api.invalidatePlaceMetadata('one', 'park');
  await tick();
  assert.equal(results.at(-1)[0].data.upvotes, 2);
  assert.equal(h.calls(), 2);
  h.setNow(h.api.PLACE_METADATA_TTL_MS);
  h.document.visibilityState = 'hidden';
  for (const timer of h.timers.values()) timer();
  await tick();
  assert.equal(h.calls(), 2);
  h.document.visibilityState = 'visible';
  h.document.dispatchEvent(new Event('visibilitychange'));
  await tick();
  assert.equal(h.calls(), 3);
  stop();
  assert.equal(h.timers.size, 0);
  const count = results.length;
  await h.api.invalidatePlaceMetadata('one', 'park');
  await tick();
  assert.equal(results.length, count);
});

test('overlapping pages fetch only missing spots and a vote re-reads only its own document', async () => {
  const h = harness();
  await h.api.loadPlaceMetadata('one', ['park', 'cafe']);
  assert.equal(h.reads(), 2);
  await h.api.loadPlaceMetadata('one', ['park', 'cafe', 'pool']);
  assert.equal(h.reads(), 3);
  await h.api.invalidatePlaceMetadata('one', 'park');
  await h.api.loadPlaceMetadata('one', ['park', 'cafe', 'pool']);
  assert.equal(h.reads(), 4);
});
