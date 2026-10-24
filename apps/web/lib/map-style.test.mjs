import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';

test('actual map layer definitions satisfy the installed MapLibre style contract', () => {
  const code = readFileSync(new URL('../components/outbreak-map.tsx', import.meta.url), 'utf8');
  const file = ts.createSourceFile('outbreak-map.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const layers = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'addLayer' && ts.isObjectLiteralExpression(node.arguments[0])) {
      // Read the actual declarative layer objects; validate using MapLibre's own schema.
      layers.push(JSON.parse(JSON.stringify(runInNewContext(`(${node.arguments[0].getText(file)})`))));
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(layers.some(layer => layer.id === 'selected-raised'));
  assert.ok(layers.some(layer => layer.id === 'hospital-link-line'));
  const sources = Object.fromEntries(layers.filter(layer => layer.source).map(layer => [layer.source,
    { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }]));
  const errors = validateStyleMin({ version: 8, sources, layers });
  assert.deepEqual(errors.map(error => error.message), []);
});
