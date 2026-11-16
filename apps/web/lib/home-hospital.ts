/**
 * The isometric hospital from the earlier Home design (tower, annex and entrance canopy)
 * and its layered site platform, as two standalone SVGs (so the building can float on
 * its platform) in the simulation page's palette. The tiled field floats it above the Quezon City tile. An illustration, not a
 * real facility.
 */
type P3 = readonly [number, number, number];

// Same projection as the original drawing (and the field's tile slope, 25 : 14.5).
const iso = (x: number, y: number, z = 0) => [560 + (x - y) * 25, 240 + (x + y) * 14.5 - z * 29] as const;
const pts = (...v: P3[]) => v.map(([x, y, z]) => iso(x, y, z).map(n => n.toFixed(1)).join(',')).join(' ');
const flat = (x0: number, x1: number, y0: number, y1: number, z = 0) => pts([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]);
const wallY = (y: number, x0: number, x1: number, z0: number, z1: number) => pts([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]);
const wallX = (x: number, y0: number, y1: number, z0: number, z1: number) => pts([x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]);
const poly = (points: string, fill: string, stroke = 'none', width = 0) => `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`;

// Simulation palette (apps/web/app/outbreak-response/qc-simulation.css) and soft greys.
const C = {
  rim: '#8a9a96', roofInset: '#d3e1db', sign: '#203f4b', cross: '#fbfdfb', fin: '#e0eee7', leg: '#adc8bd',
  layerBottom: '#9fb2ab', layerMiddle: '#ddd8c6', layerTop: '#e7ece9', siteEdge: '#b8c7c2', site: '#dfe6e3', siteLine: '#a9b8b3',
};

function slab(z: number, fill: string, edge: string) {
  return poly(wallY(12, 0, 14, z - 0.32, z), edge) + poly(wallX(14, 0, 12, z - 0.32, z), edge) + poly(flat(0, 14, 0, 12, z), fill, edge, 0.8);
}

function volume(x: [number, number], y: [number, number], z: [number, number]) {
  return poly(wallY(y[1], x[0], x[1], z[0], z[1]), 'url(#lit)', C.rim, 0.8)
    + poly(wallX(x[1], y[0], y[1], z[0], z[1]), 'url(#shade)', C.rim, 0.8)
    + poly(flat(x[0], x[1], y[0], y[1], z[1]), 'url(#roof)', C.rim, 0.8);
}

/**
 * The drawing's box in its own units, and `anchor`: the point of the platform's bottom
 * centre (under its middle) that the field places over the Quezon City tile's centre.
 * `siteWidth` is the platform's width in these units along the grid (14 site units).
 */
const [ax, ay] = iso(7, 6, -2.3);
// Centre of the building's footprint on the site top, where its floating shadow falls.
const [fx, fy] = iso(7.5, 4.85, 0);
export const HOSPITAL_VIEWBOX = { x: 250, y: 100, width: 670, height: 600, anchorX: ax, anchorY: ay, footX: fx, footY: fy, siteUnits: 14 } as const;

const svg = (parts: string[]) => {
  const { x, y, width, height } = HOSPITAL_VIEWBOX;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" width="${width}" height="${height}">`
    + '<defs>'
    + '<linearGradient id="lit" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fbfdfb"/><stop offset="1" stop-color="#d3e1db"/></linearGradient>'
    + '<linearGradient id="shade" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c3d0cc"/><stop offset="1" stop-color="#93a6a0"/></linearGradient>'
    + '<linearGradient id="roof" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fbfdfb"/><stop offset="1" stop-color="#e0eee7"/></linearGradient>'
    + '<linearGradient id="glass" x1="0" y1="0" x2="0.6" y2="1"><stop stop-color="#7d9fae"/><stop offset="1" stop-color="#2f5577"/></linearGradient>'
    + '</defs>'
    + parts.join('')
    + '</svg>';
};

/** The layered site platform, alone (same viewBox as the building, so they line up). */
export const HOSPITAL_PLATFORM_SVG = (() => {
  const parts: string[] = [];
  // Platform: three thin layers under the site slab.
  parts.push(slab(-1.98, C.layerBottom, '#8aa098'));
  parts.push(slab(-1.43, C.layerMiddle, '#c6c0a8'));
  parts.push(slab(-0.88, C.layerTop, '#c5d0cb'));
  parts.push(poly(wallY(12, 0, 14, -0.38, 0), C.siteEdge) + poly(wallX(14, 0, 12, -0.38, 0), C.siteEdge));
  parts.push(poly(flat(0, 14, 0, 12), C.site, C.siteEdge, 0.8));
  for (const r of [[0.6, 13.4, 0.6, 11.4], [0.8, 2.2, 1.4, 4.8], [0.8, 2.2, 5.5, 8.2], [3, 6, 9.1, 10.8], [6.5, 9.7, 9.1, 10.8]] as const) {
    parts.push(`<polygon points="${flat(r[0], r[1], r[2], r[3], 0.01)}" fill="none" stroke="${C.siteLine}" stroke-width="1"/>`);
  }
  return svg(parts);
})();

/** The hospital building alone: tower, windows, sign with cross, annex and entrance canopy. */
export const HOSPITAL_BUILDING_SVG = (() => {
  const parts: string[] = [];
  parts.push(volume([3.5, 8.1], [2, 6.5], [0, 7.1]));
  for (const z of [0.8, 2, 3.2, 4.4]) {
    parts.push(poly(wallY(6.5, 3.85, 7.75, z, z + 0.7), 'url(#glass)'));
    parts.push(poly(wallX(8.1, 2.3, 6.2, z, z + 0.7), 'url(#glass)'));
  }
  for (const x of [4.8, 5.8, 6.8]) parts.push(poly(wallY(6.51, x, x + 0.055, 0.7, 5.2), C.fin));
  for (const y of [3.25, 4.25, 5.25]) parts.push(poly(wallX(8.11, y, y + 0.055, 0.7, 5.2), C.fin));
  parts.push(poly(flat(3.8, 7.8, 2.3, 6.2, 7.11), C.roofInset, C.rim, 0.8));
  parts.push(poly(wallY(6.52, 5.1, 6.5, 5.5, 6.6), C.sign));
  parts.push(poly(wallY(6.53, 5.64, 5.96, 5.68, 6.42), C.cross));
  parts.push(poly(wallY(6.54, 5.34, 6.26, 5.9, 6.2), C.cross));
  parts.push(volume([8.1, 11.5], [3.2, 6.5], [0, 3.4]));
  parts.push(poly(flat(8.35, 11.25, 3.45, 6.25, 3.41), C.roofInset, C.rim, 0.8));
  for (const z of [0.5, 1.85]) parts.push(poly(wallX(11.5, 3.5, 6.2, z, z + 0.8), 'url(#glass)'));
  parts.push(poly(wallY(6.51, 8.45, 11.15, 1.9, 2.65), 'url(#glass)'));
  parts.push(poly(wallY(6.52, 9.1, 10.5, 0, 1.4), 'url(#glass)'));
  parts.push(volume([8.75, 10.85], [6.5, 7.7], [1.4, 1.55]));
  parts.push(poly(wallY(7.6, 8.9, 9, 0, 1.4), C.leg, C.leg, 0.8));
  parts.push(poly(wallY(7.6, 10.55, 10.65, 0, 1.4), C.leg, C.leg, 0.8));
  return svg(parts);
})();
