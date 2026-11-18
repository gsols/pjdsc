import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITY_SHAPES, QC_SHAPE } from './home-city-map-data.ts';
import { FIELD, HOVER, ZOOM, buildField, coverFit, fillPinches, glowTiles, mixHex, project, rng, traceCells, unproject, zoomOrigin } from './home-city-map.ts';

test('the field is deterministic for a seed and different for another', () => {
  assert.deepEqual(buildField(CITY_SHAPES), buildField(CITY_SHAPES));
  const a = rng(1), b = rng(1);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.notDeepEqual(buildField(CITY_SHAPES, { ...FIELD, seed: 7 }).tiles.map(t => t.tone), buildField(CITY_SHAPES).tiles.map(t => t.tone));
});

test('the isometric grid covers the whole drawing', () => {
  const f = buildField(CITY_SHAPES);
  assert.equal(f.tiles.length, f.n * f.n);
  for (const [x, y] of [[0, 0], [f.width, 0], [0, f.height], [f.width, f.height]]) {
    const g = unproject(f, x, y);
    assert.ok(g.c > 0 && g.c < f.n && g.r > 0 && g.r < f.n, `corner ${x},${y} lands on a tile`);
  }
});

test('project and unproject are inverses; the tile slope matches the hospital drawing', () => {
  const f = buildField(CITY_SHAPES);
  const p = project(f, 7.25, 3.5), g = unproject(f, p.x, p.y);
  assert.ok(Math.abs(g.c - 7.25) < 1e-9 && Math.abs(g.r - 3.5) < 1e-9);
  assert.equal(project(f, 1, 1, 10).y, project(f, 1, 1).y - 10, 'height lifts straight up');
  assert.ok(Math.abs(f.b / f.a - 14.5 / 25) < 1e-9);
});

test('one Quezon City tile, plain, one step right of the anchor tile on screen', () => {
  const f = buildField(CITY_SHAPES);
  assert.equal(f.tiles.filter(t => t.city).length, 1);
  assert.equal(f.city.doodles.length, 0);
  const c = project(f, f.city.col + 0.5, f.city.row + 0.5);
  assert.ok(Math.abs(c.x - (f.width * FIELD.anchorAt[0] + 2 * f.a)) < 1e-6, 'one tile to the right');
  assert.ok(Math.abs(c.y - f.height * FIELD.anchorAt[1]) < 1e-6, 'same height on screen');
  assert.ok(c.x > 0 && c.x < f.width && c.y > 0 && c.y < f.height);
});

test('every other tile shows a real Metro Manila city outline, never Quezon City', () => {
  const f = buildField(CITY_SHAPES);
  const names = new Set(CITY_SHAPES.map(c => c.name));
  assert.ok(CITY_SHAPES.length >= 10);
  assert.ok(![...names].some(name => /quezon/i.test(name)), 'Quezon City is the hospital tile, not a pattern');
  for (const t of f.tiles) {
    if (t.city) { assert.equal(t.place, ''); continue; }
    assert.ok(names.has(t.place), t.place);
    assert.ok(t.doodles.length >= 1, `${t.place} has an outline`);
    for (const d of t.doodles) {
      assert.ok(d.closed && d.pts.length >= 8 && d.pts.length % 2 === 0);
      assert.ok(d.pts.every(v => v >= 0.05 && v <= 0.95), 'within the tile');
    }
  }
  // Neighbouring tiles never repeat a city, and every city appears somewhere.
  const at = (c, r) => f.tiles[r * f.n + c];
  for (const t of f.tiles) {
    for (const [dc, dr] of [[1, 0], [0, 1]]) {
      const u = t.col + dc < f.n && t.row + dr < f.n ? at(t.col + dc, t.row + dr) : null;
      if (u && !t.city && !u.city) assert.notEqual(t.place, u.place);
    }
  }
  assert.equal(new Set(f.tiles.filter(t => !t.city).map(t => t.place)).size, names.size);
  assert.throws(() => buildField([]), /at least one city outline/);
  // With Quezon City's shape given, the tile under the hospital carries its outline.
  const withQc = buildField(CITY_SHAPES, undefined, QC_SHAPE);
  assert.equal(withQc.city.place, 'Quezon City');
  assert.ok(withQc.city.doodles.length >= 1);
  assert.equal(QC_SHAPE.rows.length, 12);
});

test('city masks are 12 x 12 and each traces to at least one loop', () => {
  for (const shape of CITY_SHAPES) {
    assert.equal(shape.rows.length, 12, shape.name);
    assert.ok(shape.rows.every(r => r.length === 12 && /^[#.]+$/.test(r)), shape.name);
    assert.ok(shape.rows.join('').split('#').length - 1 >= 6, `${shape.name} has enough cells`);
  }
});

test('outline tracing follows cell edges: square, L-shape and a ring with a hole', () => {
  const cells = list => (i, j) => list.some(([a, b]) => a === i && b === j);
  assert.deepEqual(traceCells(cells([[0, 0]]), 3).map(l => l.length), [4]);
  assert.deepEqual(traceCells(cells([[0, 0], [1, 0], [0, 1]]), 3).map(l => l.length), [6]);
  const ring = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== 1 || j !== 1) ring.push([i, j]);
  assert.deepEqual(traceCells(cells(ring), 3).map(l => l.length).sort(), [4, 4], 'outer edge and the hole');
});

test('corner-only contacts are filled so outlines stay simple', () => {
  const set = new Set([0, 4]); // cells (0,0) and (1,1) on a 3-wide grid touch only at a corner
  fillPinches(set, 3);
  assert.equal(set.size, 3);
  const loops = traceCells((i, j) => i >= 0 && j >= 0 && i < 3 && j < 3 && set.has(j * 3 + i), 3);
  assert.equal(loops.length, 1);
  // Every step of a traced loop is horizontal or vertical, including the closing one.
  const loop = loops[0];
  loop.forEach((p, k) => { const q = loop[(k + 1) % loop.length]; assert.ok(p[0] === q[0] || p[1] === q[1]); });
});

test('hovering raises only the tile under the cursor, never the hospital tile', () => {
  const f = buildField(CITY_SHAPES);
  assert.equal(HOVER.count, 1);
  const i = 5 * f.n + 5;
  assert.deepEqual(glowTiles(f, i), [i]);
  assert.deepEqual(glowTiles(f, f.city.row * f.n + f.city.col), [], 'the hospital tile lights nothing');
  assert.deepEqual(glowTiles(f, 0), [0], 'works in a corner');
  // The helper still supports lighting several nearby tiles.
  const four = glowTiles(f, i, 4, 1);
  assert.equal(four.length, 4);
  assert.equal(four[0], i);
  assert.ok(four.every(j => Math.abs(f.tiles[j].col - 5) <= 1 && Math.abs(f.tiles[j].row - 5) <= 1 && !f.tiles[j].city));
});

test('colour mixing and the cover fit used for drawing, pointer mapping and zoom', () => {
  assert.equal(mixHex('#000000', '#ffffff', 0), 'rgb(0,0,0)');
  assert.equal(mixHex('#000000', '#ffffff', 1), 'rgb(255,255,255)');
  assert.equal(mixHex('#000000', '#ffffff', 2), 'rgb(255,255,255)', 'clamped');
  assert.deepEqual(coverFit(1440, 900, 1440, 900), { scale: 1, x: 0, y: 0 });
  assert.deepEqual(coverFit(1000, 500, 500, 500), { scale: 1, x: -250, y: 0 });
  assert.deepEqual(zoomOrigin(500, 250, 1000, 500, 500, 500), { x: 250, y: 250 });
  assert.ok(ZOOM.scale > 1 && ZOOM.ms > 0);
});
