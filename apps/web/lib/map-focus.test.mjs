import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import ts from 'typescript';

const filename = fileURLToPath(new URL('../components/outbreak-map.tsx', import.meta.url));
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const require = createRequire(import.meta.url);

test('actual selection camera frames the clicked network smoothly, cancels stale clicks and ignores day changes', () => {
  const fits = [], frames = new Map(), refs = [], effects = [];
  let frameId = 0, refIndex = 0, stateIndex = 0, stops = 0;
  const map = { fitBounds: (bounds, options) => fits.push({ bounds, options }), stop: () => stops++, resize() {} };
  const root = { clientWidth: 1000, clientHeight: 700,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 700 }),
    closest: () => ({ querySelectorAll: () => [] }),
  };
  const loaded = new Module(filename);
  loaded.filename = filename; loaded.paths = require.resolve.paths('react');
  const native = loaded.require.bind(loaded);
  loaded.require = name => {
    if (name === 'react') return { ...React,
      useRef: value => { const index = refIndex++; return refs[index] ??= { current: index === 0 ? root : index === 1 ? map : value }; },
      useState: value => [stateIndex++ === 0 ? true : value, () => {}],
      useEffect: (callback, dependencies) => effects.push({ callback, dependencies }),
    };
    if (name === 'maplibre-gl') return { default: {} };
    if (name === '@/components/workspace-loader') return { default: () => null };
    if (name.endsWith('.css')) return {};
    if (name.startsWith('@/lib/')) return require(`./${name.slice('@/lib/'.length)}.ts`);
    return native(name);
  };
  loaded._compile(compiled, filename);
  const context = {
    barangays: [{ id: 'A', coordinates: [121.02,14.65], nearestHospitals: [{ facilityId: 'H', distanceKm: 1 }] }],
    hospitals: [{ id: 'H', coordinates: [121.04,14.66] }],
  };
  const props = { context, snapshot: null, selected: 'A', selectedHospital: '', hotspotIds: ['A'],
    connectionFocus: 'barangay', inspectionVersion: 42, reducedMotion: false, onSelect() {}, onHospital() {}, view: 'qc' };
  const render = values => {
    refIndex = stateIndex = 0; effects.length = 0; loaded.exports.default(values);
    return effects.find(e => e.dependencies?.length === 5 && e.dependencies.includes(42));
  };
  const previousRAF = globalThis.requestAnimationFrame, previousCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  try {
    const first = render(props);
    const cancel = first.callback();
    assert.equal(fits.length, 0, 'wait for the inspector/map layout before fitting');
    cancel(); assert.equal(frames.size, 0, 'an obsolete selection must not move the camera');
    render(props).callback();
    [...frames.values()].at(-1)(); frames.clear();
    assert.deepEqual(fits[0].bounds, [[121.02,14.65],[121.04,14.66]]);
    assert.equal(fits[0].options.duration, 850);
    assert.equal(fits[0].options.maxZoom, 14.5);
    assert.equal(fits[0].options.essential, false);
    assert.ok(fits[0].options.padding.top >= 65);
    const dayChange = render({ ...props, snapshot: { dayIndex: 1, assignments: [] } });
    assert.deepEqual(dayChange.dependencies, first.dependencies, 'playback must not retrigger focus');
    render({ ...props, selectedHospital: 'H', connectionFocus: 'hospital', reducedMotion: true }).callback();
    [...frames.values()].at(-1)(); frames.clear();
    assert.equal(fits.at(-1).options.duration, 0);
    assert.equal(stops, 2, 'a new focus interrupts the previous camera transition');
    const idle = render({ ...props, connectionFocus: null }); idle.callback();
    assert.equal(frames.size, 0, 'the default selected record does not auto-focus the map');
  } finally {
    if (previousRAF === undefined) delete globalThis.requestAnimationFrame; else globalThis.requestAnimationFrame = previousRAF;
    if (previousCancel === undefined) delete globalThis.cancelAnimationFrame; else globalThis.cancelAnimationFrame = previousCancel;
  }
});
