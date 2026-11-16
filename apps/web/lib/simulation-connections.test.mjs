import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulationConnections, connectionFrame, drawSimulationFlow, SIMULATION_LINES } from './simulation-connections.ts';

const hospitals = ['H1', 'H2', 'H3', 'H4'].map((id, index) => ({ id, coordinates: [121 + index / 100, 14.6] }));
const link = (facilityId, distanceKm = 1) => ({ facilityId, distanceKm });
const context = { hospitals, barangays: [
  { id: 'B1', coordinates: [121, 14.7], nearestHospitals: [link('H1'), link('H2'), link('H3'), link('H4')], hospitalsWithinBarangay: [link('H4')] },
  { id: 'B2', coordinates: [121.1, 14.7], nearestHospitals: [link('H2'), link('H3'), link('H4')] },
  { id: 'B3', coordinates: [121.2, 14.7], nearestHospitals: [link('H3')] },
] };
const snapshot = { assignments: [
  { barangayId: 'B1', facilityId: 'H2', supportedPlacements: 3, holdingPlacements: 0 },
  { barangayId: 'B2', facilityId: 'H2', supportedPlacements: 0, holdingPlacements: 2 },
  { barangayId: 'B3', facilityId: 'H3', supportedPlacements: 0, holdingPlacements: 0 },
  { barangayId: 'missing', facilityId: 'H2', supportedPlacements: 3, holdingPlacements: 0 },
] };
const options = { selected: 'B1', selectedHospital: '', focus: null, hotspotIds: ['B1', 'B2'], showOverview: false };

test('initial map has no connections until inspection or the overview toggle', () => {
  assert.deepEqual(simulationConnections(context, snapshot, options), []);
  assert.ok(simulationConnections(context, snapshot, { ...options, showOverview: true }).length);
});
test('barangay inspection connects its three nearest and contained hospitals using supplied coordinates', () => {
  const source = structuredClone(context);
  const connections = simulationConnections(context, null, { ...options, focus: 'barangay' });
  assert.deepEqual(connections.map(c => c.facilityId), ['H1', 'H2', 'H3', 'H4']);
  for (const connection of connections) {
    assert.equal(connection.barangayId, 'B1');
    assert.equal(connection.kind, 'proximity');
    assert.deepEqual(connection.from, context.barangays[0].coordinates);
    assert.deepEqual(connection.to, hospitals.find(h => h.id === connection.facilityId).coordinates);
  }
  assert.deepEqual(context, source);
});
test('hospital inspection shows incoming saved placements and never reverses their origin', () => {
  const connections = simulationConnections(context, snapshot, { ...options, selectedHospital: 'H2', focus: 'hospital' });
  assert.ok(connections.length);
  assert.ok(connections.every(c => c.facilityId === 'H2'));
  assert.deepEqual(connections.filter(c => c.kind === 'placement').map(c => [c.barangayId, c.patients, c.holding]), [['B1', 3, 0], ['B2', 2, 2]]);
  assert.ok(connections.every(c => c.from[1] === 14.7 && c.to[1] === 14.6));
});
test('unknown IDs and zero placements do not create orphan or fictional connections', () => {
  assert.deepEqual(simulationConnections(context, snapshot, { ...options, focus: 'barangay', selected: 'missing' }), []);
  assert.deepEqual(simulationConnections(context, snapshot, { ...options, focus: 'hospital', selectedHospital: 'missing' }), []);
  const connections = simulationConnections(context, snapshot, { ...options, focus: 'barangay', selected: 'B3' });
  assert.ok(connections.every(c => c.kind !== 'placement'));
});
test('hospital nearest-ranked context is directed from barangay to hospital before playback', () => {
  const connections = simulationConnections(context, null, { ...options, focus: 'hospital', selectedHospital: 'H1', hospitalHotspot: { barangayId: 'B3' } });
  assert.ok(connections.some(c => c.kind === 'hospital-context' && c.barangayId === 'B3' && c.facilityId === 'H1'));
  assert.ok(connections.every(c => c.kind !== 'placement'));
});
test('reveal and moving chevrons travel from the origin to destination; reduced motion is static', () => {
  const from = { x: 100, y: 200 }, to = { x: 400, y: 100 };
  const first = connectionFrame(from, to, 0, false);
  const later = connectionFrame(from, to, 400, false);
  assert.deepEqual(first.end, from);
  assert.ok(later.end.x > from.x && later.end.x < to.x);
  assert.ok(later.arrow.x > from.x && later.arrow.x < to.x);
  assert.ok(later.arrow.y < from.y && later.arrow.y > to.y);
  assert.equal(first.angle, later.angle);
  assert.deepEqual(connectionFrame(from, to, 900, false).end, to);
  assert.deepEqual(connectionFrame(from, to, 0, true), connectionFrame(from, to, 5000, true));
  assert.deepEqual(connectionFrame(from, to, 0, true).end, to);
});

test('actual SVG renderer uses displayed endpoints, preserves direction, cancels frames and suppresses duplicate pair decorations', () => {
  const previous = { document: globalThis.document, raf: globalThis.requestAnimationFrame, cancel: globalThis.cancelAnimationFrame };
  const frames = [], cancelled = [];
  const node = () => ({ dataset: {}, attributes: {}, children: [], setAttribute(key, value) { this.attributes[key] = value; }, append(...children) { this.children.push(...children); }, replaceChildren() { this.children = []; } });
  globalThis.document = { createElementNS: () => node() };
  globalThis.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  globalThis.cancelAnimationFrame = id => cancelled.push(id);
  try {
    const svg = node();
    const connections = simulationConnections(context, snapshot, { ...options, focus: 'barangay' });
    const project = id => id.startsWith('b-') ? { x: 50, y: 150 } : { x: 350, y: 50 };
    const started = performance.now();
    const flow = drawSimulationFlow(svg, connections, project, false, started);
    assert.equal(svg.children.length, 4, 'one visible relationship per endpoint pair');
    const placement = svg.children.find(group => group.dataset.kind === 'placement');
    assert.equal(placement.dataset.from, 'B1');
    assert.equal(placement.dataset.to, 'H2');
    frames.shift()(started + 1000);
    assert.equal(placement.children[1].attributes.x1, '50');
    assert.equal(placement.children[1].attributes.y1, '150');
    assert.equal(placement.children[1].attributes.x2, '350');
    assert.equal(placement.children[1].attributes.y2, '50');
    assert.match(placement.children[2].attributes.transform, /rotate\(-18\.43/);
    assert.equal(placement.children[1].attributes['stroke-dasharray'], undefined);
    flow.destroy();
    assert.equal(svg.children.length, 0);
    assert.ok(cancelled.length);
    frames.length = 0;
    const still = drawSimulationFlow(svg, connections, project, true, started);
    assert.equal(frames.length, 0, 'reduced motion must never schedule animation frames');
    assert.equal(svg.children[0].children[1].attributes.x2, '350');
    assert.equal(svg.children[0].children[1].attributes['stroke-dasharray'], '4 5');
    still.destroy();
    const incoming=simulationConnections(context,snapshot,{...options,focus:'hospital',selectedHospital:'H2'});
    const holding=drawSimulationFlow(svg,incoming,project,true,started);
    const held=svg.children.find(group=>group.dataset.from==='B2' && group.dataset.kind==='placement');
    assert.equal(held.children[1].attributes.stroke,SIMULATION_LINES.holding.color);
    assert.equal(held.children[2].attributes.stroke,SIMULATION_LINES.holding.color);
    holding.destroy();
  } finally {
    if (previous.document === undefined) delete globalThis.document; else globalThis.document = previous.document;
    if (previous.raf === undefined) delete globalThis.requestAnimationFrame; else globalThis.requestAnimationFrame = previous.raf;
    if (previous.cancel === undefined) delete globalThis.cancelAnimationFrame; else globalThis.cancelAnimationFrame = previous.cancel;
  }
});
