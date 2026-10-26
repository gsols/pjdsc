import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

// Constructed display fixture, not source observations. Distinct sentinel counts
// detect projections leaking into the loaded-but-not-started workspace.
const dayFixture = dayIndex => ({ dayIndex, date: '2027-01-01', intervalStart: '2027-01-01', intervalEnd: '2027-01-02',
  expectedCases: 987654, cumulativeCases: 987654, baselineCases: 987654, barangays: [], facilities: [
    { facilityId: 'fixture-hospital', supportedOccupancyPct: 87.5,
      bedForecast: { expectedBeds: 12, assumedSupportedDengueCapacity: 10, demandUtilizationPct: 120 } },
  ], hotspotIds: ['fixture-hotspot'],
  bedForecast: { staffedBedsRequired: 765432 }, supportedCensus: 0, holdingCensus: 0, cumulativeUnresolved: 0 });
const fixture = {
  durationDays: 1, days: [dayFixture(0), dayFixture(1)],
  periodSummary: { expectedCases: 987654, caseRange: { lowerCases: 876543, upperCases: 1098765 },
    barangays: [{ barangayId: 'fixture-hotspot', cumulativeCases: 987654 }, { barangayId: 'outside-top-ten', cumulativeCases: 23 }] },
  bedProjection: { staffedBedsRequired: 765432, hospitalPeaks: [], placePeaks: [{ barangayId: 'fixture-hotspot', hospitals: [
    { facilityId: 'fixture-hospital', share: 1, expectedAdmissions: 543210, peakStaffedBedsRequired: 765432,
      baselinePeakStaffedBedsRequired: 65432, additionalStaffedBedsDueToSurge: 12345 },
  ] }] },
  forecastEvidence: { issueBlock: { YR: 2025, WN: 52 }, environmentalInputs: [], observedSourceYearToDateCases: 654321 },
  forecastBacktest: [],
};
const filename = fileURLToPath(new URL('../components/qc-simulation-workspace.tsx', import.meta.url));
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const require = createRequire(import.meta.url);

function renderDay(day, stateOverrides = {}) {
  let state = 0;
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = require.resolve.paths('react');
  const nativeRequire = loaded.require.bind(loaded);
  loaded.require = name => {
    if (name === 'react') return { ...React,
      useState(initial) {
        const index = state++;
        const overrides = { 2: fixture, 4: { barangays: ['fixture-hotspot', 'outside-top-ten'].map(id => ({ id, name: id, nearestHospitals: [] })), hospitals: [] }, 5: day, 8: 'fixture-hotspot', 16: false, ...stateOverrides };
        return [index in overrides ? overrides[index] : initial, () => {}];
      },
      useRef: value => ({ current: value }), useEffect: () => {}, useCallback: callback => callback,
    };
    if (name === 'next/dynamic') return { default: () => props => React.createElement('output', { 'data-hotspot-markers': props.hotspotIds?.join(',') ?? '' }) };
    if (name === '@/components/qc-workspace-sidebar') return { default: ({ children }) => children };
    if (name.startsWith('@/lib/')) return require(`./${name.slice('@/lib/'.length)}.ts`);
    return nativeRequire(name);
  };
  loaded._compile(compiled, filename);
  return renderToStaticMarkup(loaded.exports.default());
}

test('loaded day zero hides projection counts, bed forecasts and historic totals; advancing reveals them', () => {
  const before = renderDay(0);
  assert.match(before, /Simulation not started/);
  assert.match(before, /Base cases for selected date/);
  assert.match(before, /data-hotspot-markers="fixture-hotspot"/);
  assert.ok(!before.includes('data-hotspot-markers="fixture-hotspot,outside-top-ten"'));
  assert.match(before, /Hotspot location preview/);
  for (const count of ['987,654', '876,543', '1,098,765', '765,432', '654,321', '543,210', '12,345']) assert.ok(!before.includes(count), count);
  assert.ok(!before.includes('120% of modeled dengue slots'));
  const after = renderDay(1);
  assert.ok(!after.includes('Simulation not started'));
  for (const count of ['987,654', '765,432', '654,321', '543,210', '12,345']) assert.ok(after.includes(count), count);
  assert.match(after, /120% of modeled dengue slots/);
  assert.match(after, /87.5%/);
  assert.match(after, /This is not bed utilization/);
  const restarted = renderDay(0);
  assert.ok(!restarted.includes('987,654'));
});

test('workspace shows automatic engine startup status and a reload action on failure', () => {
  const starting = renderDay(0, { 2: null, 4: null, 16: true, 20: 'starting' });
  assert.match(starting, /role="status"[^>]*>Engine starting or temporarily unavailable/);
  assert.match(starting, /Connecting automatically; this can take up to two minutes/);
  const failed = renderDay(0, { 2: null, 4: null, 17: 'Engine did not respond within two minutes.' });
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Engine did not respond within two minutes/);
  assert.match(failed, /Reload data-based forecast/);
  assert.ok(!failed.includes('Engine starting or temporarily unavailable'));
});

test('switching tabs and leaving the workspace cancel requests; late old results stay hidden', async () => {
  const effects = [], requests = [], updates = [];
  let state = 0;
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = require.resolve.paths('react');
  const nativeRequire = loaded.require.bind(loaded);
  loaded.require = name => {
    if (name === 'react') return { ...React,
      useState(initial) {
        const index = state++;
        return [initial, value => updates.push([index, value])];
      },
      useRef: value => ({ current: value }), useEffect: effect => effects.push(effect), useCallback: callback => callback,
    };
    if (name === 'next/dynamic') return { default: () => () => null };
    if (name === '@/components/qc-workspace-sidebar') return { default: ({ children }) => children };
    if (name === '@/lib/engine-connection') return {
      ENGINE_STARTING_MESSAGE: 'Test startup status',
      // Deliberately permit late responses after abort to exercise the UI guard.
      fetchResearch: (url, init) => new Promise(resolve => requests.push({ url, signal: init.signal, resolve })),
    };
    if (name.startsWith('@/lib/')) return require(`./${name.slice('@/lib/'.length)}.ts`);
    return nativeRequire(name);
  };
  loaded._compile(compiled, filename);
  const tree = loaded.exports.default();
  const cleanup = effects[0]();
  assert.equal(requests[0].url, '/api/research/qc-simulation');
  function find(node, id) {
    if (!node || typeof node !== 'object') return undefined;
    if (node.props?.id === id) return node;
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children.flat(Infinity) : [children]) {
      const found = find(child, id);
      if (found) return found;
    }
  }
  find(tree, 'qc-tab-future').props.onClick();
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(requests[1].url, '/api/research/future-simulation');
  requests[0].resolve(Response.json(fixture));
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(!updates.some(([index, value]) => index === 2 && value !== null));
  cleanup();
  assert.equal(requests[1].signal.aborted, true);
  requests[1].resolve(Response.json(fixture));
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(!updates.some(([index, value]) => index === 2 && value !== null));
});
