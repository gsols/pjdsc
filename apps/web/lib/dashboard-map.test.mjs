import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { areaBounds } from './dashboard-map.ts';
import { dashboardLayerPaint } from './dashboard-map-style.ts';

const boundaries = JSON.parse(readFileSync(new URL('../public/data/ncr-cities.geojson', import.meta.url)));

test('camera bounds use the approved QC polygon and NCR union; unknown or duplicate IDs never fall back', () => {
  const qc = areaBounds(boundaries, 'QUEZON_CITY'), ncr = areaBounds(boundaries, 'NCR');
  assert.ok(qc && ncr);
  assert.ok(ncr[0][0] <= qc[0][0] && ncr[0][1] <= qc[0][1]);
  assert.ok(ncr[1][0] >= qc[1][0] && ncr[1][1] >= qc[1][1]);
  assert.notDeepEqual(qc, ncr);
  assert.equal(areaBounds(boundaries, 'MISSING'), null);
  const feature = boundaries.features.find(f => f.properties.area_id === 'QUEZON_CITY');
  assert.equal(areaBounds({ features: [feature, feature] }, 'QUEZON_CITY'), null);
});

test('camera refuses missing, non-finite, out-of-range and unsupported geometry', () => {
  for (const coordinates of [[], [[[121, null]]], [[[NaN, 14]]], [[[181, 14]]], [[[121, 91]]]]) {
    assert.equal(areaBounds({ features: [{ properties: { area_id: 'QC' }, geometry: { type: 'Polygon', coordinates } }] }, 'QC'), null);
  }
  assert.equal(areaBounds(null, 'NCR'), null);
  assert.equal(areaBounds({ features: [] }, 'NCR'), null);
});

test('cartographic palette satisfies MapLibre and preserves sourced geometry and height expressions', () => {
  const layers = [
    { id: 'background', type: 'background' },
    { id: 'natural_earth', type: 'raster', source: 'relief' },
    ...['water', 'park', 'landuse', 'building'].map(name => ({ id: name, type: 'fill', source: 'osm', 'source-layer': name })),
    { id: 'building-3d', type: 'fill-extrusion', source: 'osm', 'source-layer': 'building', paint: { 'fill-extrusion-height': ['get', 'render_height'] } },
    { id: 'road_motorway', type: 'line', source: 'osm', 'source-layer': 'transportation', paint: { 'line-width': 2 } },
    { id: 'road_motorway_casing', type: 'line', source: 'osm', 'source-layer': 'transportation' },
    { id: 'waterway', type: 'line', source: 'osm', 'source-layer': 'waterway' },
    { id: 'label_city', type: 'symbol', source: 'osm', 'source-layer': 'place', layout: { 'text-field': ['get', 'name'] } },
  ];
  const original = structuredClone(layers);
  const styled = layers.map(layer => ({ ...layer, paint: { ...layer.paint, ...dashboardLayerPaint(layer) } }));
  assert.deepEqual(layers, original, 'styling must not mutate source definitions');
  assert.deepEqual(styled[6].paint['fill-extrusion-height'], ['get', 'render_height']);
  const errors = validateStyleMin({ version: 8, glyphs: 'https://example.invalid/{fontstack}/{range}.pbf',
    sources: { osm: { type: 'vector', tiles: ['https://example.invalid/{z}/{x}/{y}.pbf'] }, relief: { type: 'raster', tiles: ['https://example.invalid/{z}/{x}/{y}.png'] } }, layers: styled });
  assert.deepEqual(errors.map(error => error.message), []);
  for (const layer of styled) {
    assert.ok(!Object.keys(dashboardLayerPaint(layer)).some(key => /height|base|width|radius/.test(key) && key !== 'text-halo-width'));
  }
});
