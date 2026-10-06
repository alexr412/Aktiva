import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createParseIntentHandler } from './handler';
import { ServerResponseCache } from '@/lib/server-response-cache';

const req = (query: unknown, authorization = 'Bearer valid') => ({
  headers: new Headers({ authorization }), signal: new AbortController().signal,
  json: async () => ({ query }),
}) as any;
const auth = { verifyIdToken: async () => ({ uid: 'user-1' }) } as any;
const base = { verifyAppCheck: async () => ({ valid: true }), adminAuth: auth, rateLimit: () => ({ success: true, headers: {} }) };

test('local queries skip AI, cache reads and token writes; malformed input is rejected', async () => {
  let ai = 0, usage = 0, reads = 0;
  const cache = new ServerResponseCache({ get: async () => { reads++; return null; }, set: async () => {} });
  const handler = createParseIntentHandler({ ...base, cache, aiGenerate: async () => { ai++; return { output: null }; }, recordUserTokenUsage: async () => { usage++; } });
  const response = await handler(req('Museum in 5 km'));
  assert.equal((await response.json()).radiusKm, 5);
  assert.equal(ai, 0); assert.equal(usage, 0); assert.equal(reads, 0);
  for (const input of [42, {}, null, 'x'.repeat(201)]) assert.equal((await handler(req(input))).status, 400);
});
test('AI intent is cached across users without charging tokens again; invalid output is not cached', async () => {
  let calls = 0;
  const tokens: any[] = [];
  const handler = createParseIntentHandler({ ...base, cache: new ServerResponseCache(),
    aiGenerate: async () => { calls++; return { output: { categories: ['entertainment.cinema'], filterByName: false, radiusKm: 5 }, usage: { inputTokens: 31, outputTokens: 15 } }; },
    recordUserTokenUsage: async data => { tokens.push(data); },
  });
  assert.equal((await (await handler(req('Ein Abend mit einem Film'))).json()).source, 'ai');
  assert.equal((await (await handler(req('ein abend mit einem film'))).json()).source, 'cache');
  assert.equal(calls, 1); assert.equal(tokens.length, 1); assert.equal(tokens[0].promptTokens, 31);
  const invalid = createParseIntentHandler({ ...base, aiGenerate: async () => ({ output: { categories: ['invented'], filterByName: false }, usage: { inputTokens: 3, outputTokens: 2 } }), recordUserTokenUsage: async data => { tokens.push(data); } });
  assert.equal((await (await invalid(req('Freier Suchtext'))).json()).source, 'fallback');
  assert.equal(tokens.length, 2, 'invalid provider output still consumes tokens');
});
test('auth and rate limits precede cache reads and no-token responses do not invent usage', async () => {
  let reads = 0, usage = 0;
  const cache = new ServerResponseCache({ get: async () => { reads++; return null; }, set: async () => {} });
  const unauthorized = createParseIntentHandler({ ...base, cache });
  assert.equal((await unauthorized(req('Free form query', 'Basic invalid'))).status, 401);
  const limited = createParseIntentHandler({ ...base, cache, rateLimit: () => ({ success: false, headers: {} }) });
  assert.equal((await limited(req('Free form query'))).status, 429);
  assert.equal(reads, 0);
  const missingUsage = createParseIntentHandler({ ...base, cache: new ServerResponseCache(), aiGenerate: async () => ({ output: { categories: ['entertainment.cinema'], filterByName: false } }), recordUserTokenUsage: async () => { usage++; } });
  await missingUsage(req('Free form query'));
  assert.equal(usage, 0);
});
