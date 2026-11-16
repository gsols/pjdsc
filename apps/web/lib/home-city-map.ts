/**
 * The isometric tiled field on Home: a large grid of diamond tiles in pale greys, each
 * carrying the simplified blocky outline of a real Metro Manila city, and one
 * Quezon City tile near the centre on which the hospital stands. Built deterministically
 * from a fixed seed. On the page, a few tiles near the cursor rise a little and glow warm white;
 * clicking the Quezon City tile zooms into it and opens the simulation. Decorative only:
 * the line-art is not geography.
 */
export type Doodle = { pts: number[]; closed: boolean };
/** `place`: the real city whose simplified outline the tile shows ('' if none). */
export type Tile = { col: number; row: number; tone: number; city: boolean; place: string; doodles: Doodle[] };
export type TileField = {
  n: number; a: number; b: number; ox: number; oy: number; width: number; height: number;
  tiles: Tile[]; city: Tile;
};

/**
 * Drawing size, grid size (n × n tiles), tile half-width `a` and half-height `b` (the
 * same 25 : 14.5 slope as the hospital drawing), where the anchor tile's centre sits on
 * the drawing (fractions of width and height), and the Quezon City tile's grid offset
 * from that anchor (one step right on screen).
 */
export const FIELD = { width: 1440, height: 900, n: 12, a: 250, b: 250 * 14.5 / 25, anchorAt: [0.353, 0.61], cityStep: [1, -1], seed: 20261116 } as const;
/**
 * Hover: `count` tiles light up (the hovered tile, then nearby ones within `reach` tiles),
 * each rising `lift` px with the inside of its city outline shaded, starting `stagger` ms
 * apart. One for now: only the tile under the cursor rises.
 */
export const HOVER = { count: 1, reach: 1, lift: 15, ease: 0.14, stagger: 90 } as const;
/** Zoom factor and timing for the transition into the simulation. */
export const ZOOM = { scale: 9, ms: 900 } as const;

/** Small deterministic PRNG (mulberry32): the same seed always draws the same field. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cells across a tile for its city outline, and the inner margin the outline keeps. */
const GRID = 12, MARGIN = 0.08, CELL = (1 - 2 * MARGIN) / GRID;

/**
 * Trace the outline(s) of a set of grid cells as closed loops along cell edges, with the
 * filled cells on the left. Returns loops of grid corner points, collinear points removed.
 */
export function traceCells(filled: (i: number, j: number) => boolean, size: number): [number, number][][] {
  const edges = new Map<string, [number, number]>();
  const key = (x: number, y: number) => `${x},${y}`;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    if (!filled(i, j)) continue;
    // Corners of cell (i, j): (i, j) top-left … edges run clockwise in screen axes.
    if (!filled(i, j - 1)) edges.set(key(i, j), [i + 1, j]);
    if (!filled(i + 1, j)) edges.set(key(i + 1, j), [i + 1, j + 1]);
    if (!filled(i, j + 1)) edges.set(key(i + 1, j + 1), [i, j + 1]);
    if (!filled(i - 1, j)) edges.set(key(i, j + 1), [i, j]);
  }
  const loops: [number, number][][] = [];
  while (edges.size) {
    const [startKey, first] = edges.entries().next().value as [string, [number, number]];
    edges.delete(startKey);
    const [sx, sy] = startKey.split(',').map(Number);
    const loop: [number, number][] = [[sx, sy]];
    let cur = first;
    while (key(cur[0], cur[1]) !== startKey) {
      loop.push(cur);
      const next = edges.get(key(cur[0], cur[1]));
      if (!next) break;
      edges.delete(key(cur[0], cur[1]));
      cur = next;
    }
    // Drop points in the middle of straight runs.
    const simple = loop.filter((p, i) => {
      const a = loop[(i - 1 + loop.length) % loop.length], b = loop[(i + 1) % loop.length];
      return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
    });
    if (simple.length >= 4) loops.push(simple);
  }
  return loops;
}

/**
 * Fill one cell wherever two cells touch only at a corner, until none do, so every outline
 * traces as a simple loop (`traceCells` needs this). `cells` holds j * size + i.
 */
export function fillPinches(cells: Set<number>, size: number): void {
  const has = (i: number, j: number) => i >= 0 && j >= 0 && i < size && j < size && cells.has(j * size + i);
  for (let changed = true; changed;) {
    changed = false;
    for (let j = 0; j < size - 1; j++) for (let i = 0; i < size - 1; i++) {
      const a = has(i, j), b = has(i + 1, j), c = has(i, j + 1), d = has(i + 1, j + 1);
      if ((a && d && !b && !c) || (b && c && !a && !d)) { cells.add(j * size + i + (a ? 1 : 0)); changed = true; }
    }
  }
}

/** Cut some corners of a stepped loop into short diagonals, like a hand-drawn blocky map. */
function chamfer(loop: [number, number][], random: () => number): [number, number][] {
  const out: [number, number][] = [];
  loop.forEach((p, i) => {
    const a = loop[(i - 1 + loop.length) % loop.length], b = loop[(i + 1) % loop.length];
    const la = Math.hypot(p[0] - a[0], p[1] - a[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    if (la >= 1 && lb >= 1 && random() < 0.28) {
      out.push([p[0] + (a[0] - p[0]) * 0.5 / la, p[1] + (a[1] - p[1]) * 0.5 / la], [p[0] + (b[0] - p[0]) * 0.5 / lb, p[1] + (b[1] - p[1]) * 0.5 / lb]);
    } else out.push(p);
  });
  return out;
}

/**
 * One tile's drawing: the simplified outline of a real city (a 12 × 12 cell mask from
 * lib/home-city-map-data.ts), traced along cell edges with a few corners cut. The masks
 * keep each city's real shape and proportions, scaled to fill the tile.
 */
export function cityOutline(rows: readonly string[], random: () => number): Doodle[] {
  const cells = new Set<number>();
  rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') cells.add(j * GRID + i); }));
  fillPinches(cells, GRID);
  const filled = (i: number, j: number) => i >= 0 && j >= 0 && i < GRID && j < GRID && cells.has(j * GRID + i);
  const toTile = ([x, y]: [number, number]) => [MARGIN + x * CELL, MARGIN + y * CELL];
  return traceCells(filled, GRID).map(loop => ({ pts: chamfer(loop, random).flatMap(toTile), closed: true }));
}

/** Build the field: tones, a mini-map per tile and the Quezon City tile near the middle. */
type Shape = { name: string; rows: readonly string[] };

/** `cityShape`, when given, is drawn on the Quezon City tile (under the hospital). */
export function buildField(shapes: readonly Shape[], { width, height, n, a, b, anchorAt, cityStep, seed } = FIELD, cityShape?: Shape): TileField {
  if (!shapes.length) throw new Error('Home field needs at least one city outline');
  const random = rng(seed);
  const anchorCol = Math.floor(n / 2), anchorRow = Math.floor(n / 2) - 1;
  const cityCol = anchorCol + cityStep[0], cityRow = anchorRow + cityStep[1];
  const tiles: Tile[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const city = c === cityCol && r === cityRow;
      const tone = city ? 0 : random() < 0.18 ? 1 : random() < 0.12 ? 2 : 0;
      // Neighbouring tiles never repeat a city: stepping a column adds 5, a row adds 3.
      const shape = shapes[(c * 5 + r * 3) % shapes.length];
      const drawn = city ? cityShape : shape;
      tiles.push({ col: c, row: r, tone, city, place: drawn ? drawn.name : '', doodles: drawn ? cityOutline(drawn.rows, random) : [] });
    }
  }
  // Place the grid so the anchor tile's centre lands at `anchorAt` on the drawing.
  const ox = width * anchorAt[0] - (anchorCol - anchorRow) * a;
  const oy = height * anchorAt[1] - (anchorCol + anchorRow + 1) * b;
  return { n, a, b, ox, oy, width, height, tiles, city: tiles[cityRow * n + cityCol] };
}

/** Screen point of the grid corner (c, r) at height h (c, r may be fractional). */
export function project(f: Pick<TileField, 'a' | 'b' | 'ox' | 'oy'>, c: number, r: number, h = 0) {
  return { x: f.ox + (c - r) * f.a, y: f.oy + (c + r) * f.b - h };
}

/** Grid position (fractional) under a ground-level screen point. */
export function unproject(f: Pick<TileField, 'a' | 'b' | 'ox' | 'oy'>, x: number, y: number) {
  const u = (x - f.ox) / f.a, v = (y - f.oy) / f.b;
  return { c: (u + v) / 2, r: (v - u) / 2 };
}

/**
 * The tiles that light up when tile `index` is hovered: the hovered tile first, then
 * `count - 1` others within `reach` tiles, picked by a seeded shuffle so the same tile
 * always lights the same set. Hovering the Quezon City tile lights nothing; it is never
 * picked as a neighbour either.
 */
export function glowTiles(field: Pick<TileField, 'n' | 'tiles'>, index: number, count: number = HOVER.count, reach: number = HOVER.reach): number[] {
  const { n, tiles } = field;
  const t = tiles[index];
  if (!t || t.city) return [];
  const near: number[] = [];
  for (let r = Math.max(0, t.row - reach); r <= Math.min(n - 1, t.row + reach); r++) {
    for (let c = Math.max(0, t.col - reach); c <= Math.min(n - 1, t.col + reach); c++) {
      const i = r * n + c;
      if (i !== index && !tiles[i].city) near.push(i);
    }
  }
  const random = rng(0x9e3779b1 ^ index);
  for (let i = near.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [near[i], near[j]] = [near[j], near[i]];
  }
  return [index, ...near.slice(0, Math.max(0, count - 1))];
}

/** Mix two #rrggbb colours: t = 0 gives `a`, t = 1 gives `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const k = Math.max(0, Math.min(1, t));
  return `rgb(${[0, 1, 2].map(i => Math.round(p(a, i) + (p(b, i) - p(a, i)) * k)).join(',')})`;
}

/** "Cover" fit of a `vw` × `vh` drawing into a `bw` × `bh` box: scale and offsets in box px. */
export function coverFit(vw: number, vh: number, bw: number, bh: number) {
  const scale = Math.max(bw / vw, bh / vh);
  return { scale, x: (bw - vw * scale) / 2, y: (bh - vh * scale) / 2 };
}

/** CSS transform-origin (box px) that keeps the drawing point (x, y) fixed under a cover fit. */
export function zoomOrigin(x: number, y: number, vw: number, vh: number, bw: number, bh: number): { x: number; y: number } {
  const fit = coverFit(vw, vh, bw, bh);
  return { x: fit.x + x * fit.scale, y: fit.y + y * fit.scale };
}
