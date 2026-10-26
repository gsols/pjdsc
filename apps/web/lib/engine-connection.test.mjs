import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { waitForEngine, fetchResearch } from './engine-connection.ts';

const filename = fileURLToPath(new URL('../app/api/engine/health/route.ts', import.meta.url));
const loaded = new Module(filename);
loaded.filename = filename;
loaded.paths = createRequire(import.meta.url).resolve.paths('next');
loaded._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { GET } = loaded.exports;
const probe = () => GET(new Request('http://frontend.test/api/engine/health'));

test('health BFF validates config and only exposes sanitized uncached liveness', async () => {
  const original = globalThis.fetch, previous = process.env.ENGINE_BASE_URL;
  try {
    let calls = 0;
    globalThis.fetch = async (url, init) => {
      calls++;
      assert.equal(url, 'https://engine.test/health');
      assert.equal(init.cache, 'no-store');
      assert.ok(init.signal instanceof AbortSignal);
      return Response.json({ status: 'ok', internal: 'private' });
    };
    for (const base of [undefined, 'localhost:8000', 'file:///private', 'https://user:password@engine.test', 'https://engine.test?token=secret']) {
      if (base === undefined) delete process.env.ENGINE_BASE_URL; else process.env.ENGINE_BASE_URL = base;
      const response = await probe();
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, 'ENGINE_NOT_CONFIGURED');
    }
    assert.equal(calls, 0);
    process.env.ENGINE_BASE_URL = 'https://engine.test/';
    const response = await probe();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { status: 'ok' });
    globalThis.fetch = async () => { throw Error('secret hostname and credentials'); };
    const failure = await probe();
    assert.equal(failure.status, 503);
    assert.deepEqual(await failure.json(), { code: 'ENGINE_STARTING', error: 'Engine is not responding yet. It may be starting or temporarily unavailable.' });
    globalThis.fetch = async () => new Response('<html>Render loading</html>');
    assert.equal((await (await probe()).json()).code, 'ENGINE_STARTING');
    globalThis.fetch = async () => new Response('upstream unavailable', { status: 502 });
    assert.equal((await (await probe()).json()).code, 'ENGINE_STARTING');
    globalThis.fetch = async () => new Response('wrong path', { status: 404 });
    assert.equal((await (await probe()).json()).code, 'ENGINE_HEALTH_FAILED');
    globalThis.fetch = async () => Response.json({ status: 'something else' });
    assert.equal((await (await probe()).json()).code, 'ENGINE_HEALTH_FAILED');
  } finally {
    globalThis.fetch = original;
    if (previous === undefined) delete process.env.ENGINE_BASE_URL; else process.env.ENGINE_BASE_URL = previous;
  }
});

test('wake checks recover from cold starts, loading pages and network failures then stop', async () => {
  const original = globalThis.fetch;
  try {
    let calls = 0, starting = 0;
    globalThis.fetch = async (url, init) => {
      assert.equal(url, '/api/engine/health');
      assert.equal(init.cache, 'no-store');
      assert.ok(init.signal instanceof AbortSignal);
      switch (++calls) {
        case 1: return Response.json({ code: 'ENGINE_STARTING' }, { status: 503 });
        case 2: return new Response('<html>loading</html>');
        case 3: throw TypeError('Failed to fetch');
        default: return Response.json({ status: 'ok' });
      }
    };
    await waitForEngine({ retryDelayMs: 1, onStarting: () => starting++ });
    assert.equal(calls, 4);
    assert.equal(starting, 3);
  } finally { globalThis.fetch = original; }
});

test('configuration errors fail immediately instead of retrying for two minutes', async () => {
  const original = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ code: 'ENGINE_NOT_CONFIGURED', error: 'Set ENGINE_BASE_URL' }, { status: 503 }); };
    await assert.rejects(waitForEngine({ retryDelayMs: 1 }), /Set ENGINE_BASE_URL/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test('wake checks have a total deadline and cancellation stops pending polls and fetches', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ code: 'ENGINE_STARTING' }, { status: 503 });
    await assert.rejects(waitForEngine({ maxWaitMs: 20, retryDelayMs: 1 }), /Engine did not respond/);
    const controller = new AbortController();
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ code: 'ENGINE_STARTING' }, { status: 503 }); };
    const waiting = waitForEngine({ signal: controller.signal, onStarting: () => controller.abort() });
    await assert.rejects(waiting, { name: 'AbortError' });
    assert.equal(calls, 1);
    await assert.rejects(waitForEngine({ signal: controller.signal }), { name: 'AbortError' });
    assert.equal(calls, 1);
    const active = new AbortController();
    globalThis.fetch = async (_url, { signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      active.abort();
    });
    await assert.rejects(waitForEngine({ signal: active.signal }), { name: 'AbortError' });
  } finally { globalThis.fetch = original; }
});

test('simulation POST is sent once after liveness and preserves model/data errors', async () => {
  const original = globalThis.fetch;
  try {
    const calls = [], statuses = [];
    globalThis.fetch = async (url, init) => {
      calls.push([url, init]);
      if (url === '/api/engine/health') return Response.json({ status: 'ok' });
      return Response.json({ detail: { code: 'SEASONAL_ARTIFACTS_UNAVAILABLE' } }, { status: 503 });
    };
    const response = await fetchResearch('/api/research/future-simulation', { method: 'POST', body: '{"assumption":true}' }, status => statuses.push(status));
    assert.deepEqual(statuses, ['connecting', 'loading']);
    assert.equal(calls.length, 2);
    assert.equal(calls[1][1].method, 'POST');
    assert.equal(calls[1][1].body, '{"assumption":true}');
    assert.equal(response.status, 503);
    assert.equal((await response.json()).detail.code, 'SEASONAL_ARTIFACTS_UNAVAILABLE');
  } finally { globalThis.fetch = original; }
});
