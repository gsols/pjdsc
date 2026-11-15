import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const filename = fileURLToPath(new URL('../components/home-dot-field.tsx', import.meta.url));
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function harness({ fine = true, reduced = false } = {}) {
  const previous = globalThis.window;
  const frames = new Map();
  const properties = {};
  let sequence = 0, setup;
  const canvas = new EventTarget();
  canvas.getBoundingClientRect = () => ({ left: 100, top: 50 });
  const element = { parentElement: canvas, dataset: {}, style: { setProperty: (key, value) => { properties[key] = value; } } };
  globalThis.window = {
    matchMedia: query => ({ matches: query.includes('reduced-motion') ? reduced : fine }),
    requestAnimationFrame: callback => { const id = ++sequence; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
  };
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = require.resolve.paths('react');
  loaded.require = name => name === 'react'
    ? { ...React, useRef: () => ({ current: element }), useEffect: effect => { setup = effect; } }
    : require(name);
  loaded._compile(compiled, filename);
  loaded.exports.default();
  const cleanup = setup();
  return {
    frames, properties, element,
    move(x, y, pointerType = 'mouse') { canvas.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: x, clientY: y, pointerType })); },
    leave() { canvas.dispatchEvent(new Event('pointerleave')); },
    flush() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); },
    cleanup,
    restore() { cleanup(); if (previous === undefined) delete globalThis.window; else globalThis.window = previous; },
  };
}

test('decorative pointer tracking coalesces moves into one frame and uses canvas-relative coordinates', () => {
  const h = harness();
  try {
    h.move(200, 100); h.move(420, 270);
    assert.equal(h.frames.size, 1);
    assert.deepEqual(h.properties, {});
    h.flush();
    assert.deepEqual(h.properties, { '--dot-x': '320px', '--dot-y': '220px' });
    assert.equal(h.element.dataset.active, 'true');
    h.move(500, 300); h.leave();
    assert.equal(h.frames.size, 0);
    assert.equal(h.element.dataset.active, 'false');
    h.flush();
    assert.equal(h.element.dataset.active, 'false', 'a queued frame cannot restore a departed highlight');
  } finally { h.restore(); }
});

test('touch, coarse pointers, and reduced motion keep the static field without pointer tracking', () => {
  for (const options of [{ fine: false }, { reduced: true }, { pointerType: 'touch' }]) {
    const h = harness(options);
    try {
      h.move(240, 180, options.pointerType ?? 'mouse');
      assert.equal(h.frames.size, 0);
      assert.deepEqual(h.properties, {});
    } finally { h.restore(); }
  }
});

test('leaving Home removes pointer listeners and cancels pending animation work', () => {
  const h = harness();
  try {
    h.move(240, 180);
    h.cleanup();
    assert.equal(h.frames.size, 0);
    h.move(400, 300);
    assert.equal(h.frames.size, 0);
  } finally { h.restore(); }
});
