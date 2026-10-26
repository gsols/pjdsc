import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as connection from './engine-connection.ts';

const require = createRequire(import.meta.url);
function harness(waitForEngine = connection.waitForEngine) {
  const states = [], effects = [];
  let cursor = 0;
  function load(relative) {
    const filename = fileURLToPath(new URL(relative, import.meta.url));
    const loaded = new Module(filename);
    loaded.filename = filename;
    loaded.paths = require.resolve.paths('react');
    const nativeRequire = loaded.require.bind(loaded);
    loaded.require = name => {
      if (name === 'react') return { ...React,
        useState(initial) {
          const index = cursor++;
          if (!(index in states)) states[index] = initial;
          return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
        },
        useEffect: effect => effects.push(effect),
      };
      if (name === '@/lib/engine-connection') return { ...connection, waitForEngine };
      if (name === '@/components/engine-startup') return { default: Startup };
      if (name.endsWith('.css')) return {};
      return nativeRequire(name);
    };
    loaded._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, filename);
    return loaded.exports.default;
  }
  const Startup = load('../components/engine-startup.tsx');
  const Layout = load('../app/layout.tsx');
  return {
    states, effects,
    tree() { cursor = 0; return Startup(); },
    render() { cursor = 0; return renderToStaticMarkup(React.createElement(Layout, null, React.createElement('main', null, 'Dashboard fixture'))); },
  };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('opening the root layout wakes the engine without a research request and keeps the dashboard usable', async () => {
  const original = globalThis.fetch;
  let finish;
  const calls = [];
  globalThis.fetch = (url, init) => {
    calls.push({ url, init });
    return new Promise(resolve => { finish = resolve; });
  };
  let cleanup;
  try {
    const app = harness();
    const initial = app.render();
    assert.match(initial, /Dashboard fixture/);
    assert.match(initial, /role="status"[^>]*>Connecting to the forecast engine/);
    cleanup = app.effects[0]();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/engine/health');
    assert.equal(calls[0].init.cache, 'no-store');
    finish(Response.json({ status: 'ok' }));
    await flush();
    assert.equal(app.states[1], 'ready');
    assert.ok(!app.render().includes('engine-startup'));
    assert.equal(calls.length, 1);
  } finally { cleanup?.(); globalThis.fetch = original; }
});

test('startup shows waiting and configuration errors, supports retry, and ignores late results after unmount', async () => {
  const requests = [];
  const app = harness(options => new Promise((resolve, reject) => requests.push({ ...options, resolve, reject })));
  app.render();
  const cleanup = app.effects[0]();
  requests[0].onStarting();
  assert.match(app.render(), /Connecting automatically; this can take up to two minutes/);
  requests[0].reject(Error('Set a valid server-only ENGINE_BASE_URL on the frontend service and redeploy it.'));
  await flush();
  assert.match(app.render(), /role="alert"[^>]*>Set a valid server-only ENGINE_BASE_URL/);
  const retry = app.tree().props.children[1];
  assert.equal(retry.props.children, 'Retry engine connection');
  retry.props.onClick();
  assert.equal(app.states[0], 1);
  cleanup();
  assert.equal(requests[0].signal.aborted, true);
  app.tree();
  const stopRetry = app.effects.at(-1)();
  assert.equal(requests.length, 2);
  assert.equal(app.states[1], 'connecting');
  stopRetry();
  assert.equal(requests[1].signal.aborted, true);
  requests[1].onStarting();
  requests[1].resolve();
  await flush();
  assert.equal(app.states[1], 'connecting');
});
