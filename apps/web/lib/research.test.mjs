import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parseAnnualRecords } from './annual-burden.ts';

test('annual browser contract preserves missing values and rejects invalid source records', () => {
  const source = JSON.parse(readFileSync(new URL('../public/data/qc-annual-burden.json', import.meta.url), 'utf8')).records;
  assert.equal(parseAnnualRecords(source).length, 142);
  assert.equal(source.filter(r => r.DC_2014 === null).length, 12);
  for (const value of [undefined, [], source.slice(1)]) assert.throws(() => parseAnnualRecords(value));
  for (const [key, value] of [['DC_2024', -1], ['DC_2024', NaN], ['DC_2024', undefined], ['ADM4_PCODE', source[1].ADM4_PCODE]]) {
    const invalid = structuredClone(source); invalid[0][key] = value;
    assert.throws(() => parseAnnualRecords(invalid));
  }
});

// Compile the actual Next handler to CJS so native Node tests exercise its HTTP
// behavior without starting a dev server. No alternate proxy implementation.
const filename = fileURLToPath(new URL('../app/api/research/[...path]/route.ts', import.meta.url));
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = new Module(filename);
loaded.filename = filename;
loaded.paths = createRequire(import.meta.url).resolve.paths('next');
loaded._compile(compiled, filename);
const { GET, POST } = loaded.exports;
const context = path => ({ params: Promise.resolve({ path: path.split('/') }) });

test('research BFF rejects unsupported routes, malformed/oversized payloads, and invalid scope', async () => {
  const previous = process.env.ENGINE_BASE_URL;
  process.env.ENGINE_BASE_URL = 'http://engine.test';
  try {
    assert.equal((await GET(new Request('http://local/api/research/admin'), context('admin'))).status, 404);
    assert.equal((await GET(new Request('http://local/api/research/forecast-runs?area=OTHER'), context('forecast-runs'))).status, 422);
    const post = body => new Request('http://local/api/research/scenarios', { method: 'POST', body });
    assert.equal((await POST(post('{'), context('scenarios'))).status, 422);
    assert.equal((await POST(post('x'.repeat(32769)), context('scenarios'))).status, 413);
  } finally {
    if (previous === undefined) delete process.env.ENGINE_BASE_URL; else process.env.ENGINE_BASE_URL = previous;
  }
});

test('research BFF fails closed without engine and forwards typed engine errors with timeout', async () => {
  const previous = process.env.ENGINE_BASE_URL;
  const original = globalThis.fetch;
  try {
    delete process.env.ENGINE_BASE_URL;
    assert.equal((await GET(new Request('http://local/api/research/forecast-runs'), context('forecast-runs'))).status, 503);
    process.env.ENGINE_BASE_URL = 'http://engine.test/';
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'http://engine.test/v1/forecast-runs?area=NCR');
      assert.equal(init.cache, 'no-store');
      assert.ok(init.signal);
      return Response.json({ detail: { code: 'RESEARCH_DATA_UNAVAILABLE' } }, { status: 503 });
    };
    const response = await GET(new Request('http://local/api/research/forecast-runs?area=NCR'), context('forecast-runs'));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).detail.code, 'RESEARCH_DATA_UNAVAILABLE');
    globalThis.fetch = async () => { throw Error('private backend error'); };
    const failed = await GET(new Request('http://local/api/research/forecast-runs'), context('forecast-runs'));
    assert.equal(failed.status, 503);
    assert.ok(!(await failed.text()).includes('private backend error'));
  } finally {
    globalThis.fetch = original;
    if (previous === undefined) delete process.env.ENGINE_BASE_URL; else process.env.ENGINE_BASE_URL = previous;
  }
});
