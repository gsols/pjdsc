import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { SIMULATION_LINES } from './simulation-connections.ts';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

// Constructed display fixture, not source observations. Distinct sentinel counts
// detect projections leaking into the loaded-but-not-started workspace.
const dayFixture = (dayIndex) => ({
  dayIndex,
  date: '2027-01-01',
  intervalStart: '2027-01-01',
  intervalEnd: '2027-01-02',
  expectedCases: 987654,
  cumulativeCases: 987654,
  baselineCases: 987654,
  barangays: [],
  facilities: [
    {
      facilityId: 'fixture-hospital',
      supportedOccupancyPct: 87.5,
      bedForecast: {
        expectedBeds: 12,
        assumedSupportedDengueCapacity: 10,
        demandUtilizationPct: 120,
      },
    },
  ],
  hotspotIds: ['fixture-hotspot'],
  expansionRing: [],
  bedForecast: { staffedBedsRequired: 765432 },
  supportedCensus: 0,
  holdingCensus: 0,
  cumulativeUnresolved: 0,
});
const fixture = {
  durationDays: 1,
  days: [dayFixture(0), dayFixture(1)],
  periodSummary: {
    expectedCases: 987654,
    caseRange: { lowerCases: 876543, upperCases: 1098765 },
    barangays: [
      { barangayId: 'fixture-hotspot', cumulativeCases: 987654 },
      { barangayId: 'outside-top-ten', cumulativeCases: 23 },
    ],
  },
  bedProjection: {
    staffedBedsRequired: 765432,
    hospitalPeaks: [],
    placePeaks: [
      {
        barangayId: 'fixture-hotspot',
        hospitals: [
          {
            facilityId: 'fixture-hospital',
            share: 1,
            expectedAdmissions: 543210,
            peakStaffedBedsRequired: 765432,
            baselinePeakStaffedBedsRequired: 65432,
            additionalStaffedBedsDueToSurge: 12345,
          },
        ],
      },
    ],
  },
  forecastEvidence: {
    issueBlock: { YR: 2025, WN: 52 },
    environmentalInputs: [],
    observedSourceYearToDateCases: 654321,
  },
  forecastBacktest: [],
};
const filename = fileURLToPath(
  new URL('../components/qc-simulation-workspace.tsx', import.meta.url)
);
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;
const require = createRequire(import.meta.url);

function renderWorkspace(day, stateOverrides = {}) {
  let state = 0;
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = require.resolve.paths('react');
  const nativeRequire = loaded.require.bind(loaded);
  loaded.require = (name) => {
    if (name === 'react')
      return {
        ...React,
        useState(initial) {
          const index = state++;
          const overrides = {
            2: fixture,
            4: {
              barangays: ['fixture-hotspot', 'outside-top-ten'].map((id) => ({
                id,
                name: id,
                nearestHospitals: [],
              })),
              hospitals: [],
            },
            5: day,
            8: 'fixture-hotspot',
            16: false,
            ...stateOverrides,
          };
          return [index in overrides ? overrides[index] : initial, () => {}];
        },
        useRef: (value) => ({ current: value }),
        useEffect: () => {},
        useCallback: (callback) => callback,
      };
    if (name === 'next/dynamic')
      return {
        default: () => (props) =>
          React.createElement('output', {
            'data-hotspot-markers': props.hotspotIds?.join(',') ?? '',
          }),
      };
    if (name === '@/components/workspace-select') return { default: props => React.createElement('button', { type: 'button', role: 'combobox', 'aria-label': props.label, disabled: props.disabled }, props.options.find(option => option.value === props.value)?.label ?? props.value) };
    if (name === '@/components/qc-workspace-sidebar')
      return { default: ({ children }) => children };
    if (name === '@/components/workspace-loader') return { default: () => null };
    if (name === '@/components/surgewise-mark') return { default: () => null };
    if (name.startsWith('@/lib/'))
      return require(`./${name.slice('@/lib/'.length)}.ts`);
    return nativeRequire(name);
  };
  loaded._compile(compiled, filename);
  return loaded.exports.default();
}

function renderDay(day, stateOverrides = {}) {
  return renderToStaticMarkup(renderWorkspace(day, stateOverrides));
}

test('legend uses renderer line definitions, preserves day-zero gating and covers actual marker meanings', () => {
  const lines = tree => findElements(tree, node => node.props?.['data-line-kind']);
  const preview = renderWorkspace(0);
  assert.deepEqual(lines(preview).map(({node})=>node.props['data-line-kind']), ['proximity','hospital-context']);
  const started = renderWorkspace(1);
  for (const { node } of lines(started)) {
    const definition = SIMULATION_LINES[node.props['data-line-kind']];
    const swatch = findElements(node, child=>child.type==='i')[0].node;
    assert.equal(swatch.props.style.borderTop, `${definition.width}px ${definition.dash.length ? 'dashed' : 'solid'} ${definition.color}`);
    assert.ok(renderToStaticMarkup(node).includes(definition.label));
  }
  assert.ok(lines(started).some(({node})=>node.props['data-line-kind']==='holding'));
  const html=renderToStaticMarkup(started);
  for(const label of ['amber dot = provisional point','unranked','Selected barangay boundary','Click a marker to reveal its links']) assert.ok(html.includes(label),label);
  assert.ok(!html.includes('Hover or inspect a separated'));
});

function findElements(node, predicate, ancestors = []) {
  if (!node || typeof node !== 'object') return [];
  const matches = predicate(node) ? [{ node, ancestors }] : [];
  const children = node.props?.children;
  for (const child of Array.isArray(children)
    ? children.flat(Infinity)
    : [children]) {
    matches.push(...findElements(child, predicate, [...ancestors, node]));
  }
  return matches;
}

const controlFixture = {
  startDate: '2025-07-01',
  endDate: '2025-07-15',
  mode: 'forecast',
  normalCapacity: 20,
  surgeCapacity: 10,
  holdingCapacity: 5,
  hospitalizationRate: 0.15,
  baselineOccupancy: 0.75,
  lengthOfStayDays: 4,
  admissionDelayDays: 0,
  surgeActivationDay: 0,
  allocationPolicy: 'nearest',
  arrivalSplitPolicy: 'nearest_three_equal',
};

test('the initial view reserves the map, with one hidden contextual panel and an independent timeline', () => {
  const tree = renderWorkspace(0, { 3: controlFixture });
  const panel = findElements(tree, node => node.props?.id === 'qs-context-panel')[0].node;
  assert.equal(panel.props.hidden, true);
  const timeline = findElements(tree, node => node.props?.['aria-label'] === 'Simulation timeline and playback');
  assert.equal(timeline.length, 1);
  assert.ok(!timeline[0].ancestors.some(node => node.props?.id === 'qs-context-panel'));
  assert.equal(findElements(tree, node => node.type === 'header').length, 0);
  assert.equal(findElements(tree, node => node.type === 'aside').length, 1);
});

test('both modes and original inputs remain accessible in Scenario while export has one Results entry point', () => {
  const tree = renderWorkspace(1, { 3: controlFixture, 23: 'scenario' });
  const settings = findElements(tree, node => node.props?.['aria-label'] === 'Simulation controls')[0];
  assert.equal(settings.node.props.hidden, false);
  const tabs = findElements(settings.node, node => node.props?.role === 'tab' && node.props?.id?.startsWith('qc-tab-'));
  assert.equal(tabs.length, 2); assert.equal(tabs.filter(item => item.node.props['aria-selected']).length, 1);
  for (const label of ['Forecast start date', 'Forecast end date', 'Forecast horizon in days', 'Admission fraction', 'Length of stay', 'Non-dengue occupancy', 'Normal staffed beds / site', 'Supported surge beds / site', 'Unstaffed holding spaces / site']) {
    assert.equal(findElements(settings.node, node => node.props?.['aria-label'] === label).length, 1, label);
  }
  assert.equal(findElements(settings.node, node => node.props?.label === 'Hospital arrival split').length, 1);
  assert.equal(findElements(settings.node, node => node.props?.label === 'Hospital allocation policy').length, 1);
  const exports = findElements(tree, node => node.type === 'button' && node.props.onClick?.name === 'download');
  assert.equal(exports.length, 1);
  assert.ok(exports[0].ancestors.some(node => node.props?.['aria-label'] === 'Simulation results'));
});

test('fullscreen contains the timeline and contextual controls, and loading/errors stay visible outside closed panels', () => {
  const tree = renderWorkspace(0, { 3: controlFixture });
  const fullscreen = findElements(tree, node => node.props?.['data-map-fullscreen'] !== undefined);
  assert.equal(fullscreen.length, 1);
  assert.equal(findElements(fullscreen[0].node, node => node.props?.['aria-label'] === 'Simulation timeline and playback').length, 1);
  assert.equal(findElements(fullscreen[0].node, node => node.props?.id === 'qs-context-panel').length, 1);
  for (const overrides of [{ 2: null, 4: null, 16: true }, { 17: 'Forecast unavailable' }]) {
    const current = renderWorkspace(0, overrides);
    const messages = findElements(current, node => node.props?.className?.startsWith('qs-engine-status'));
    assert.equal(messages.length, 1);
    assert.ok(!messages[0].ancestors.some(node => node.props?.id === 'qs-context-panel'));
  }
});

test('hospital inspection keeps actions outside explanatory paragraphs and retains separate capacity and occupancy facts', () => {
  const context = {
    barangays: ['fixture-hotspot','outside-top-ten'].map(id => ({ id,name:'Constructed barangay fixture',nearestHospitals:[{facilityId:'fixture-hospital',distanceKm:1}],hospitalsWithinBarangay:[] })),
    hospitals: [{ id:'fixture-hospital',name:'Constructed hospital fixture',accreditedBeds:100,sourceAsOf:'2026-09-30',primarySourceUrl:'https://example.invalid/register',coordinateSourceUrl:'https://example.invalid/point' }],
  };
  const tree = renderWorkspace(1,{4:context,9:'fixture-hospital',23:'hospitals'});
  const inspector = findElements(tree,node=>node.props?.className==='qs-panel-body qs-inspector-body')[0].node;
  assert.equal(inspector.props.hidden,false);
  for(const paragraph of findElements(inspector,node=>node.type==='p')) {
    assert.equal(findElements(paragraph.node,node=>node.type==='button').length,0);
  }
  const html=renderToStaticMarkup(tree);
  for(const label of ['Actual staffed / dengue beds','Unknown','Normal-relative occupancy','Supported-relative occupancy','Unstaffed holding','Activated surge capacity','Residual supported slots','Expected dengue census','Window peak staffing need','Coordinate evidence']) assert.ok(html.includes(label),label);
  assert.match(html,/120% of modeled dengue slots/);
});

test('loaded day zero hides projection counts, bed forecasts and historic totals; advancing reveals them', () => {
  const before = renderDay(0);
  assert.match(before, /Simulation not started/);
  assert.match(before, /Base cases for selected date/);
  assert.match(before, /data-hotspot-markers="fixture-hotspot"/);
  assert.ok(
    !before.includes('data-hotspot-markers="fixture-hotspot,outside-top-ten"')
  );
  assert.match(before, /Forecast locations preview · case values hidden/);
  for (const count of [
    '987,654',
    '876,543',
    '1,098,765',
    '765,432',
    '654,321',
    '543,210',
    '12,345',
  ])
    assert.ok(!before.includes(count), count);
  assert.ok(!before.includes('120% of modeled dengue slots'));
  const after = renderDay(1);
  assert.ok(!after.includes('Simulation not started'));
  for (const count of ['987,654', '765,432', '654,321', '543,210', '12,345'])
    assert.ok(after.includes(count), count);
  assert.match(after, /120% of modeled dengue slots/);
  assert.match(after, /87.5%/);
  assert.match(after, /This is not bed utilization/);
  const restarted = renderDay(0);
  assert.ok(!restarted.includes('987,654'));
});

test('workspace shows automatic engine startup status and a reload action on failure', () => {
  const starting = renderDay(0, { 2: null, 4: null, 16: true, 20: 'starting' });
  assert.match(
    starting,
    /Engine starting or temporarily unavailable/
  );
  assert.match(
    starting,
    /Connecting automatically; this can take up to two minutes/
  );
  const failed = renderDay(0, {
    2: null,
    4: null,
    17: 'Engine did not respond within two minutes.',
  });
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Engine did not respond within two minutes/);
  assert.match(failed, /Reload data-based forecast/);
  assert.ok(!failed.includes('Engine starting or temporarily unavailable'));
});

test('switching tabs and leaving the workspace cancel requests; late old results stay hidden', async () => {
  const effects = [],
    requests = [],
    updates = [];
  let state = 0;
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = require.resolve.paths('react');
  const nativeRequire = loaded.require.bind(loaded);
  loaded.require = (name) => {
    if (name === 'react')
      return {
        ...React,
        useState(initial) {
          const index = state++;
          return [initial, (value) => updates.push([index, value])];
        },
        useRef: (value) => ({ current: value }),
        useEffect: (effect) => effects.push(effect),
        useCallback: (callback) => callback,
      };
    if (name === 'next/dynamic') return { default: () => () => null };
    if (name === '@/components/workspace-select') return { default: props => React.createElement('button', { type: 'button', role: 'combobox', 'aria-label': props.label, disabled: props.disabled }, props.options.find(option => option.value === props.value)?.label ?? props.value) };
    if (name === '@/components/qc-workspace-sidebar')
      return { default: ({ children }) => children };
    if (name === '@/components/workspace-loader') return { default: () => null };
    if (name === '@/components/surgewise-mark') return { default: () => null };
    if (name === '@/lib/engine-connection')
      return {
        ENGINE_STARTING_MESSAGE: 'Test startup status',
        // Deliberately permit late responses after abort to exercise the UI guard.
        fetchResearch: (url, init) =>
          new Promise((resolve) =>
            requests.push({ url, signal: init.signal, resolve })
          ),
      };
    if (name.startsWith('@/lib/'))
      return require(`./${name.slice('@/lib/'.length)}.ts`);
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
    for (const child of Array.isArray(children)
      ? children.flat(Infinity)
      : [children]) {
      const found = find(child, id);
      if (found) return found;
    }
  }
  find(tree, 'qc-tab-future').props.onClick();
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(requests[1].url, '/api/research/future-simulation');
  requests[0].resolve(Response.json(fixture));
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(!updates.some(([index, value]) => index === 2 && value !== null));
  cleanup();
  assert.equal(requests[1].signal.aborted, true);
  requests[1].resolve(Response.json(fixture));
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(!updates.some(([index, value]) => index === 2 && value !== null));
});

test('each mode restores its edited dates and input edits invalidate playback results', async () => {
  const context = {
    barangays: ['fixture-hotspot', 'outside-top-ten'].map((id) => ({
      id,
      name: id,
      nearestHospitals: [],
    })),
    hospitals: [],
  };
  const futureControls = {
    ...controlFixture,
    startDate: '2026-11-16',
    endDate: '2026-11-30',
    horizonDays: 14,
    weatherProfile: 'typical',
  };
  const states = new Map([
    [2, fixture],
    [3, controlFixture],
    [4, context],
    [5, 1],
    [6, true],
    [16, false],
  ]);
  const refs = [];
  const requests = [];
  let stateIndex = 0;
  let refIndex = 0;
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = require.resolve.paths('react');
  const nativeRequire = loaded.require.bind(loaded);
  loaded.require = (name) => {
    if (name === 'react') {
      return {
        ...React,
        useState(initial) {
          const index = stateIndex++;
          if (!states.has(index)) states.set(index, initial);
          return [
            states.get(index),
            (value) =>
              states.set(
                index,
                typeof value === 'function' ? value(states.get(index)) : value
              ),
          ];
        },
        useRef(initial) {
          const index = refIndex++;
          refs[index] ??= { current: initial };
          return refs[index];
        },
        useEffect: () => {},
        useCallback: (callback) => callback,
      };
    }
    if (name === 'next/dynamic') return { default: () => () => null };
    if (name === '@/components/workspace-select') return { default: props => React.createElement('button', { type: 'button', role: 'combobox', 'aria-label': props.label, disabled: props.disabled }, props.options.find(option => option.value === props.value)?.label ?? props.value) };
    if (name === '@/components/qc-workspace-sidebar')
      return { default: ({ children }) => children };
    if (name === '@/components/workspace-loader') return { default: () => null };
    if (name === '@/components/surgewise-mark') return { default: () => null };
    if (name === '@/lib/engine-connection') {
      return {
        ENGINE_STARTING_MESSAGE: 'Test startup status',
        async fetchResearch(url, init) {
          const controls = init.body ? JSON.parse(init.body) : futureControls;
          requests.push({ url, controls });
          return Response.json({
            ...fixture,
            context,
            controlValues: controls,
          });
        },
      };
    }
    if (name.startsWith('@/lib/'))
      return require(`./${name.slice('@/lib/'.length)}.ts`);
    return nativeRequire(name);
  };
  loaded._compile(compiled, filename);
  function render() {
    stateIndex = 0;
    refIndex = 0;
    return loaded.exports.default();
  }
  function element(tree, predicate) {
    const matches = findElements(tree, predicate);
    assert.equal(matches.length, 1);
    return matches[0].node;
  }
  function changeStart(date) {
    element(
      render(),
      (node) => node.props?.['aria-label'] === 'Forecast start date'
    ).props.onChange({ target: { value: date } });
  }
  async function switchMode(mode) {
    element(
      render(),
      (node) => node.props?.id === `qc-tab-${mode}`
    ).props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
  }

  element(render(), node => node.props?.['aria-label'] === 'Edit simulation scenario').props.onClick();
  assert.equal(states.get(23), 'scenario');
  assert.equal(states.get(3), controlFixture);
  assert.equal(states.get(2), fixture);
  element(render(), node => node.props?.['aria-label'] === 'Close simulation panel').props.onClick();
  assert.equal(states.get(23), null);
  changeStart('2025-08-01');
  assert.equal(states.get(2), null, 'outdated results are cleared');
  assert.equal(states.get(5), 0, 'playback resets to day zero');
  assert.equal(states.get(6), false, 'playback pauses');
  const scrolls = [];
  const scrollRegion = element(
    render(),
    (node) => node.props?.className === 'qs-settings-scroll qc-controls'
  );
  assert.ok(
    scrollRegion.props.ref,
    'the form scroll region is available during mode changes'
  );
  scrollRegion.props.ref.current = {
    scrollTo: (options) => scrolls.push(options),
  };
  await switchMode('future');
  assert.equal(states.get(3).startDate, '2026-11-16');
  changeStart('2026-12-01');
  await switchMode('historical');
  assert.equal(states.get(3).startDate, '2025-08-01');
  await switchMode('future');
  assert.equal(states.get(3).startDate, '2026-12-01');
  assert.deepEqual(scrolls, [{ top: 0 }, { top: 0 }, { top: 0 }]);
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      '/api/research/future-simulation',
      '/api/research/qc-simulation',
      '/api/research/future-simulation',
    ]
  );
});

test('the loaded mode form enters after asynchronous loading and manual reduced motion is exposed', () => {
  const pending = renderWorkspace(0, {
    0: 'future',
    2: null,
    3: null,
    4: null,
  });
  const loaded = renderWorkspace(0, {
    0: 'future',
    3: controlFixture,
    13: true,
  });
  const pendingForm = findElements(
    pending,
    (node) => node.props?.id === 'qc-tab-panel'
  )[0].node;
  const loadedForm = findElements(
    loaded,
    (node) => node.props?.id === 'qc-tab-panel'
  )[0].node;
  assert.notEqual(
    pendingForm.key,
    loadedForm.key,
    'ready fields receive their own entry after loading'
  );
  const left = findElements(
    loaded,
    (node) => node.props?.['aria-label'] === 'Simulation controls'
  )[0].node;
  const dock = findElements(loaded, node => node.props?.id === 'qs-context-panel')[0].node;
  assert.ok(left); assert.equal(dock.props['data-reduced-motion'], true);
});
