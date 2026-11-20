import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React from 'react';

const filename = fileURLToPath(
  new URL('../components/outbreak-map.tsx', import.meta.url)
);
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;
const require = createRequire(import.meta.url);
const loaded = new Module(filename);
loaded.filename = filename;
loaded.paths = require.resolve.paths('react');
const nativeRequire = loaded.require.bind(loaded);
loaded.require = (name) => {
  if (name === 'maplibre-gl') return { default: {} };
  if (name === '@/components/workspace-loader') return { default: () => null };
    if (name.endsWith('.css')) return {};
  if (name.startsWith('@/lib/'))
    return require(`./${name.slice('@/lib/'.length)}.ts`);
  return nativeRequire(name);
};
// Expose the actual private helper in this test module only.
loaded._compile(
  `${compiled}\nexports.inspectOverlays = overlayElements;`,
  filename
);

test('marker exclusion includes floating controls outside the immediate map parent', () => {
  const floatingControls = { id: 'floating-controls' };
  const help = { id: 'map-help' };
  const mapParent = { querySelectorAll: () => [help] };
  const workspace = { querySelectorAll: () => [floatingControls, help] };
  const mapRoot = {
    parentElement: mapParent,
    closest(selector) {
      assert.equal(selector, '[data-map-fullscreen]');
      return workspace;
    },
  };
  assert.deepEqual(loaded.exports.inspectOverlays(mapRoot), [
    floatingControls,
    help,
  ]);
  assert.deepEqual(
    loaded.exports.inspectOverlays({ ...mapRoot, closest: () => null }),
    [help]
  );
  assert.deepEqual(loaded.exports.inspectOverlays(null), []);
});

test('fitting a narrow map leaves room beside floating controls', () => {
  const effects = [];
  const fits = [];
  const panel = {
    getBoundingClientRect: () => ({
      left: 12,
      top: 12,
      width: 296,
      height: 250,
    }),
  };
  const root = {
    clientWidth: 320,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 640 }),
    closest: () => ({ querySelectorAll: () => [panel] }),
  };
  const map = { fitBounds: (bounds, options) => fits.push(options), resize() {} };
  let ref = 0;
  let state = 0;
  const component = new Module(filename);
  component.filename = filename;
  component.paths = require.resolve.paths('react');
  component.require = (name) =>
    name === 'react'
      ? {
          ...React,
          useRef(initial) {
            const index = ref++;
            return {
              current: index === 0 ? root : index === 1 ? map : initial,
            };
          },
          useState: (initial) => [state++ === 0 ? true : initial, () => {}],
          useEffect: (callback, dependencies) =>
            effects.push({ callback, dependencies }),
        }
      : loaded.require(name);
  component._compile(compiled, filename);
  component.exports.default({
    context: null,
    snapshot: null,
    selected: '',
    view: 'qc',
    reducedMotion: true,
  });
  effects
    .find(
      (effect) =>
        effect.dependencies?.length === 3 && effect.dependencies.includes('qc')
    )
    .callback();
  assert.equal(fits.length, 1);
  assert.ok(fits[0].padding.left + fits[0].padding.right < root.clientWidth);
});
