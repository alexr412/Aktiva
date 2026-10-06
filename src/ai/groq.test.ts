import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateSearchIntent } from './groq';

test('provider uses strict bounded output, validates categories and reports actual usage', async () => {
  let body: any;
  const mockFetch = async (_url: any, init: any) => {
    body = JSON.parse(init.body);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ categories: ['entertainment.cinema'], filterByName: false, nameQuery: '', radiusKm: 5, unsupported: false }) } }], usage: { prompt_tokens: 123, completion_tokens: 45 } });
  };
  const result = await generateSearchIntent('ein Abend mit einem Film', undefined, { apiKey: 'test-key', fetch: mockFetch as any });
  assert.equal(result.output?.radiusKm, 5);
  assert.deepEqual(result.usage, { inputTokens: 123, outputTokens: 45 });
  assert.equal(body.response_format.json_schema.strict, true);
  assert.equal(body.max_completion_tokens, 512);
  assert.equal(body.reasoning_effort, 'low');
});
test('truncated output keeps usage, missing key never calls provider', async () => {
  const truncated = await generateSearchIntent('query', undefined, { apiKey: 'test-key', fetch: (async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }], usage: { prompt_tokens: 12, completion_tokens: 512 } })) as any });
  assert.equal(truncated.output, null);
  assert.equal(truncated.usage?.outputTokens, 512);
  assert.deepEqual(await generateSearchIntent('query', undefined, { apiKey: '', fetch: async () => { throw Error('must not fetch'); } }), { output: null });
});
test('timeout actually aborts provider I/O; caller cancellation is forwarded', async () => {
  const slowFetch = async (_url: any, init: any) => new Promise<Response>((_resolve, reject) => {
    const fail = () => reject(init.signal.reason);
    if (init.signal.aborted) fail(); else init.signal.addEventListener('abort', fail, { once: true });
  });
  // A referenced timer simulates pending I/O in this mock.
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(generateSearchIntent('query', undefined, { apiKey: 'test-key', fetch: slowFetch as any, timeoutMs: 10 }), { name: 'TimeoutError' });
    const controller = new AbortController(); controller.abort();
    await assert.rejects(generateSearchIntent('query', controller.signal, { apiKey: 'test-key', fetch: slowFetch as any }), { name: 'AbortError' });
  } finally { clearTimeout(keepAlive); }
});
