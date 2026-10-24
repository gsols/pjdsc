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

function renderDay(day) {
  let state = 0;
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = require.resolve.paths('react');
  const nativeRequire = loaded.require.bind(loaded);
  loaded.require = name => {
    if (name === 'react') return { ...React,
      useState(initial) {
        const index = state++;
        const overrides = { 2: fixture, 4: { barangays: ['fixture-hotspot', 'outside-top-ten'].map(id => ({ id, name: id, nearestHospitals: [] })), hospitals: [] }, 5: day, 8: 'fixture-hotspot', 16: false };
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
