import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { areaLabel } from './dashboard-map.ts';

const require = createRequire(import.meta.url);
const records = JSON.parse(readFileSync(new URL('../public/data/qc-philhealth-hospitals.json', import.meta.url)));
function harness(overrides = {}) {
  const states = [], refs = [];
  let cursor = 0, refCursor = 0;
  const filename = fileURLToPath(new URL('../app/dashboard/page.tsx', import.meta.url));
  const loaded = new Module(filename);
  loaded.filename = filename; loaded.paths = require.resolve.paths('react');
  loaded.require = name => {
    if (name === 'react') return { ...React,
      useState(initial) { const i = cursor++; if (!(i in states)) states[i] = i in overrides ? overrides[i] : initial;
        return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
      useRef(initial) { return refs[refCursor++] ??= { current: initial }; },
      useEffect() {}, useCallback: fn => fn,
    };
    if (name === 'next/dynamic') return { default: () => props => React.createElement('div', { 'data-map-records': props.facilities.length, 'data-3d': String(props.buildings3d) }) };
    if (name === 'next/link') return { default: props => React.createElement('a', props) };
    if (name === '@/components/workspace-select') return { default: props => React.createElement('button', { 'aria-label': props.label }, props.value) };
    if (name === '@/lib/dashboard-map') return { areaLabel };
    if (name === '@/lib/facilities') return { loadFacilities() {}, FACILITY_DATASET_ID: 'fixture-registry' };
    if (name.endsWith('.css')) return {};
    return require(name);
  };
  loaded._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, filename);
  return { states, render() { cursor = 0; refCursor = 0; return renderToStaticMarkup(React.createElement(loaded.exports.default)); } };
}
const ready = { 2: records, 4: false };

test('dashboard opens as a map with an optional single explorer and retains custom geography selection', () => {
  const html = harness(ready).render();
  assert.match(html, /data-panel="none"/);
  assert.match(html, /data-map-records="46"/);
  assert.match(html, /aria-label="Map geography"/);
  assert.ok(!html.includes('<aside') && !html.includes('<header'));
  assert.ok(!html.includes('dashboard-simulation-launch') && !html.includes('<select'));
});

test('hospital inventory, search and ownership filters share one dedicated results region', () => {
  const h = harness({ ...ready, 9: 'hospitals' });
  let html = h.render();
  assert.match(html, /46 of 46 hospitals/);
  assert.match(html, /9,389/);
  assert.match(html, /class="db-hospital-list" role="region" aria-label="Hospital results" tabindex="0"/);
  assert.equal((html.match(/<aside/g) ?? []).length, 1);
  h.states[7] = 'no-such-hospital-xyz'; html = h.render();
  assert.match(html, /No matching hospitals/); assert.match(html, /data-map-records="0"/);
  h.states[7] = ''; h.states[8] = records[0].ownership; html = h.render();
  assert.match(html, new RegExp(`${records.filter(f => f.ownership === records[0].ownership).length} of 46 hospitals`));
});

test('NCR context never expands QC hospital coverage and unavailable records are never displayed as zero', () => {
  const html = harness({ ...ready, 0: 'NCR', 9: 'hospitals' }).render();
  assert.match(html, /data-map-records="0"/);
  assert.match(html, /Hospital coverage is QC only/);
  const failed = harness({ 3: 'Source validation failed', 4: false, 9: 'hospitals', 10: 'unavailable' }).render();
  assert.match(failed, /Retry hospital records/);
  assert.match(failed, /Inventory unavailable/);
  assert.ok(!failed.includes('0 of 0 hospitals') && !failed.includes('>0</strong>'));
});

test('Layers retains 3D and overlay controls without deferred imagery options', () => {
  const html = harness({ ...ready, 9: 'layers', 13: true }).render();
  assert.match(html, /3D view/); assert.match(html, /data-3d="true"/);
  assert.match(html, /QC hospitals/); assert.match(html, /City boundaries/);
  assert.ok(!/satellite|regional imagery|maptiler|eox/i.test(html));
});
