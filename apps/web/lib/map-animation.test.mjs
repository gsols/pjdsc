import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import ts from 'typescript';
import { caseColor } from './case-bands.ts';

// Exercise the real map color effect with a controlled frame clock and map paint
// sink. This verifies animation behavior without pretending to be visual WebGL QA.
const filename = fileURLToPath(new URL('../components/outbreak-map.tsx', import.meta.url));
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const require = createRequire(import.meta.url);

test('real map paint interpolates forecast colors, keeps non-candidates neutral and honors reduced motion', () => {
  const paints = [], effects = [], refs = [];
  const map = { getLayer: () => true, setPaintProperty: (layer, name, value) => paints.push({ layer, name, value }) };
  let refIndex = 0, stateIndex = 0;
  const loaded = new Module(filename);
  loaded.filename = filename; loaded.paths = require.resolve.paths('react');
  const native = loaded.require.bind(loaded);
  loaded.require = name => {
    if (name === 'react') return { ...React,
      useRef: value => { const index = refIndex++; return refs[index] ??= { current: index === 1 ? map : value }; },
      useState: value => [stateIndex++ === 0 ? true : value, () => {}],
      useEffect: (callback, dependencies) => effects.push({ callback, dependencies }),
    };
    if (name === 'maplibre-gl') return { default: {} };
    if (name.endsWith('.css')) return {};
    if (name.startsWith('@/lib/')) return require(`./${name.slice('@/lib/'.length)}.ts`);
    return native(name);
  };
  loaded._compile(compiled, filename);
  const props = { context: { barangays: [{ id: 'A' }, { id: 'B' }], hospitals: [] },
    snapshot: { barangays: [{ barangayId: 'A', cumulativeCases: 4 }, { barangayId: 'B', cumulativeCases: 3 }] },
    selected: 'B', rankedHotspotIds: ['A'], hotspotIds: ['A'], caseMetric: 'cumulative',
    caseColorMaximum: 50, animationDurationMs: 400, onSelect() {}, onHospital() {}, reducedMotion: false };
  const frames = [];
  const previousRAF = globalThis.requestAnimationFrame, previousCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  globalThis.cancelAnimationFrame = () => {};
  const render = values => {
    refIndex = 0; stateIndex = 0; effects.length = 0;
    loaded.exports.default(values);
    const effect = effects.find(effect => effect.dependencies?.includes(50) && effect.dependencies?.includes(400));
    assert.ok(effect, 'The map must have an animation effect tied to the forecast scale and playback duration');
    return effect.callback();
  };
  const color = () => paints.filter(p => p.layer === 'barangays' && p.name === 'fill-color').at(-1).value;
  try {
    const cleanup = render(props);
    assert.equal(frames.length, 1);
    frames.shift()(0);
    assert.equal(color()[color().indexOf('A') + 1], caseColor(0, 50));
    frames.shift()(200);
    assert.equal(color()[color().indexOf('A') + 1], caseColor(2, 50));
    frames.shift()(400);
    assert.equal(color()[color().indexOf('A') + 1], caseColor(4, 50));
    assert.ok(!color().includes('B'));
    assert.equal(paints.filter(p => p.layer === 'selected-raised' && p.name === 'fill-extrusion-color').at(-1).value, '#20394c');
    cleanup();
    render({ ...props, reducedMotion: true });
    assert.equal(frames.length, 0);
    assert.equal(color()[color().indexOf('A') + 1], caseColor(4, 50));
  } finally {
    if (previousRAF === undefined) delete globalThis.requestAnimationFrame; else globalThis.requestAnimationFrame = previousRAF;
    if (previousCancel === undefined) delete globalThis.cancelAnimationFrame; else globalThis.cancelAnimationFrame = previousCancel;
  }
});
