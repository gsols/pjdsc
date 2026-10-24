import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutMapMarkers } from './marker-layout.ts';

test('crowded hotspot/hospital icons remain separated and inside the map without moving source points', () => {
  const points = Array.from({ length: 188 }, (_, i) => ({ id: String(i), x: 200, y: 230, size: i < 10 ? 29 : i < 142 ? 16 : 25 }));
  const original = structuredClone(points);
  const layout = layoutMapMarkers(points, 500, 480);
  assert.equal(layout.length, 188);
  assert.deepEqual(points, original);
  assert.ok(layout.every(p => !p.overlaps));
  for (const [i, a] of layout.entries()) {
    assert.ok(a.x >= 0 && a.x <= 500 && a.y >= 0 && a.y <= 480);
    assert.equal(a.x, points[i].x + a.offsetX);
    assert.equal(a.y, points[i].y + a.offsetY);
    for (let j = 0; j < i; j++) assert.ok(Math.hypot(a.x - layout[j].x, a.y - layout[j].y) >= (points[i].size + points[j].size) / 2 + 4);
  }
  assert.deepEqual(layoutMapMarkers(points, 500, 480), layout);
});

test('edge markers fit within their own radius instead of being clipped', () => {
  const points = [{ id: 'edge', x: 1, y: 1, size: 29 }, { id: 'other', x: 499, y: 479, size: 25 }];
  const layout = layoutMapMarkers(points, 500, 480);
  for (const [i, p] of layout.entries()) {
    const radius = points[i].size / 2;
    assert.ok(p.x >= radius && p.x + radius <= 500 && p.y >= radius && p.y + radius <= 480);
  }
});

test('icons move clear of navigation and attribution controls', () => {
  const blocked = [{ left: 448, top: 0, width: 52, height: 116 }, { left: 0, top: 454, width: 500, height: 26 }];
  const points = [{ id: 'navigation', x: 470, y: 30, size: 29 }, { id: 'attribution', x: 250, y: 470, size: 25 }];
  const layout = layoutMapMarkers(points, 500, 480, blocked);
  for (const [i, p] of layout.entries()) {
    const radius = points[i].size / 2;
    assert.equal(p.overlaps, false);
    assert.ok(blocked.every(rect => p.x + radius <= rect.left || p.x - radius >= rect.left + rect.width
      || p.y + radius <= rect.top || p.y - radius >= rect.top + rect.height));
  }
});

test('all 188 icons fit a narrow mobile viewport with size adjustment', () => {
  const points = Array.from({ length: 188 }, (_, i) => ({ id: String(i), x: 160, y: 210, size: i < 10 ? 29 : i < 142 ? 16 : 25 }));
  const layout = layoutMapMarkers(points, 320, 420, [{ left: 268, top: 0, width: 52, height: 116 }, { left: 0, top: 394, width: 320, height: 26 }]);
  assert.equal(layout.length, 188);
  assert.ok(layout.every(point => !point.overlaps && point.scale <= 1 && point.size > 10));
  for (const [i, a] of layout.entries()) for (let j = 0; j < i; j++) {
    assert.ok(Math.hypot(a.x - layout[j].x, a.y - layout[j].y) >= (a.size + layout[j].size) / 2 + 4);
  }
});
