/**
 * Decorative isometric scene for the landing page hero: a hospital on a city
 * map tile, a location pin, and an illustrative hotspot joined to the
 * hospital entrance by a dashed nearest-hospital line (the same dashed style
 * the simulation map uses for proximity). It encodes no data and is hidden
 * from assistive technology.
 *
 * World units: the tile spans x, y in [0, 12]; z is height. `iso` projects a
 * world point onto the 600 x 470 viewBox (30° isometric).
 */
type P3 = readonly [number, number, number];

const U = 24;
const OX = 300;
const OY = 118;
const DX = 0.866 * U;
const DY = 0.5 * U;
const S2 = Math.SQRT1_2;

function iso(x: number, y: number, z = 0): [number, number] {
  return [OX + (x - y) * DX, OY + (x + y) * DY - z * U];
}
function pts(...corners: P3[]): string {
  return corners.map(([x, y, z]) => iso(x, y, z).map(v => v.toFixed(1)).join(',')).join(' ');
}
/** Horizontal rectangle at height z. */
const flat = (xa: number, xb: number, ya: number, yb: number, z = 0) =>
  pts([xa, ya, z], [xb, ya, z], [xb, yb, z], [xa, yb, z]);
/** Rectangle on the visible wall facing +y (the "left" face on screen). */
const wallY = (y: number, xa: number, xb: number, za: number, zb: number) =>
  pts([xa, y, za], [xb, y, za], [xb, y, zb], [xa, y, zb]);
/** Rectangle on the visible wall facing +x (the "right" face on screen). */
const wallX = (x: number, ya: number, yb: number, za: number, zb: number) =>
  pts([x, ya, za], [x, yb, za], [x, yb, zb], [x, ya, zb]);
/** A circle of radius r lying flat is an axis-aligned ellipse in this projection. */
const isoEllipse = (r: number) => ({ rx: 1.2247 * r * U, ry: 0.7071 * r * U });

type Faces = { top: string; left: string; right: string };
function Box({ x: [x0, x1], y: [y0, y1], z: [z0, z1], fill, rim = true }: {
  x: [number, number]; y: [number, number]; z: [number, number]; fill: Faces; rim?: boolean;
}) {
  const [cx, cyBottom] = iso(x1, y1, z0);
  const [, cyTop] = iso(x1, y1, z1);
  return <g>
    <polygon points={wallY(y1, x0, x1, z0, z1)} fill={fill.left} />
    <polygon points={wallX(x1, y0, y1, z0, z1)} fill={fill.right} />
    <polygon points={flat(x0, x1, y0, y1, z1)} fill={fill.top}
      stroke={rim ? '#ffffff' : 'none'} strokeOpacity={0.75} strokeWidth={1} strokeLinejoin="round" />
    {rim && <line x1={cx} y1={cyBottom} x2={cx} y2={cyTop} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={1} />}
  </g>;
}

function WindowY({ y, x: [xa, xb], z: [za, zb], fill = 'url(#lp-glass-lit)' }: {
  y: number; x: [number, number]; z: [number, number]; fill?: string;
}) {
  const [m1x, m1y] = iso((xa + xb) / 2, y, za);
  const [m2x, m2y] = iso((xa + xb) / 2, y, zb);
  return <g>
    <polygon points={wallY(y, xa, xb, za, zb)} fill={fill} stroke="#f1faee" strokeWidth={1.3} strokeLinejoin="round" />
    <line x1={m1x} y1={m1y} x2={m2x} y2={m2y} stroke="#f1faee" strokeOpacity={0.8} strokeWidth={1.2} />
  </g>;
}
function WindowX({ x, y: [ya, yb], z: [za, zb], fill = 'url(#lp-glass-shade)' }: {
  x: number; y: [number, number]; z: [number, number]; fill?: string;
}) {
  const [m1x, m1y] = iso(x, (ya + yb) / 2, za);
  const [m2x, m2y] = iso(x, (ya + yb) / 2, zb);
  return <g>
    <polygon points={wallX(x, ya, yb, za, zb)} fill={fill} stroke="#e4f1ef" strokeWidth={1.3} strokeLinejoin="round" />
    <line x1={m1x} y1={m1y} x2={m2x} y2={m2y} stroke="#e4f1ef" strokeOpacity={0.7} strokeWidth={1.2} />
  </g>;
}

function Tree({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  const [tx, ty] = iso(x, y);
  const r = 10 * size;
  return <g>
    <ellipse cx={tx + 4} cy={ty + 1} rx={r * 0.95} ry={r * 0.42} fill="#1d3557" opacity={0.16} />
    <line x1={tx} y1={ty} x2={tx} y2={ty - 9 * size} stroke="#2f5577" strokeWidth={3 * size} strokeLinecap="round" />
    <circle cx={tx} cy={ty - 9 * size - r * 0.8} r={r} fill="url(#lp-tree)" />
  </g>;
}

// Scene layout (world units).
const TOWER = { x: [3.6, 6.8], y: [2.2, 5.4], h: 6.6 } as const;
const ANNEX = { x: [6.8, 9.6], y: [2.8, 5.4], h: 3.6 } as const;
const HOTSPOT: [number, number] = [11.1, 5.6];
const ENTRANCE: [number, number] = [8.2, 6.5];
const PIN: [number, number] = [0.85, 9.8];

const WALL: Faces = { top: 'url(#lp-roof)', left: 'url(#lp-wall-lit)', right: 'url(#lp-wall-shade)' };
const HOUSE: Faces = { top: '#f9fdf8', left: '#dff0ed', right: '#a9d3d7' };

const CROSS: [number, number][] = [
  [-0.19, 0.56], [0.19, 0.56], [0.19, 0.19], [0.56, 0.19], [0.56, -0.19], [0.19, -0.19],
  [0.19, -0.56], [-0.19, -0.56], [-0.19, -0.19], [-0.56, -0.19], [-0.56, 0.19], [-0.19, 0.19],
];
const H_LETTER: [number, number][] = [
  [-0.42, -0.5], [-0.2, -0.5], [-0.2, -0.1], [0.2, -0.1], [0.2, -0.5], [0.42, -0.5],
  [0.42, 0.5], [0.2, 0.5], [0.2, 0.1], [-0.2, 0.1], [-0.2, 0.5], [-0.42, 0.5],
];

export default function LandingHeroArt({ className }: { className?: string }) {
  const [tx0, tx1] = TOWER.x;
  const [ty0, ty1] = TOWER.y;
  const [ax0, ax1] = ANNEX.x;
  const [ay0, ay1] = ANNEX.y;
  const roofCx = (tx0 + tx1) / 2;
  const roofCy = (ty0 + ty1) / 2;
  const [padX, padY] = iso(roofCx, roofCy, TOWER.h);
  const pad = isoEllipse(0.85);
  const crossCx = (tx0 + tx1) / 2;
  const crossCz = 5.5;
  const [hsX, hsY] = iso(...HOTSPOT);
  const [enX, enY] = iso(...ENTRANCE);
  const hsCore = isoEllipse(0.34);
  const hsRing = isoEllipse(0.95);
  const [pinX, pinY] = iso(...PIN);
  const puck = isoEllipse(0.62);
  const PIN_SCALE = 4.6;

  const laneA = [[0.3, 0.9], [3.0, 3.6], [4.3, 4.9], [5.6, 6.2], [6.9, 7.5], [8.2, 8.8], [9.5, 10.1], [10.8, 11.4]];
  const laneB = [[0.3, 0.9], [1.6, 2.2], [2.9, 3.5], [4.2, 4.8], [5.5, 6.1], [8.7, 9.3], [10.0, 10.6], [11.2, 11.8]];

  return <svg className={className} viewBox="0 0 600 470" role="presentation" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="lp-ground" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#d6eeeb" /><stop offset="1" stopColor="#bcdfe0" />
      </linearGradient>
      <linearGradient id="lp-tile-left" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a8dadc" /><stop offset="1" stopColor="#8cc3cb" />
      </linearGradient>
      <linearGradient id="lp-tile-right" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#6f9fb8" /><stop offset="1" stopColor="#5b8cab" />
      </linearGradient>
      <linearGradient id="lp-wall-lit" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#ecf6f2" />
      </linearGradient>
      <linearGradient id="lp-wall-shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#d9eaea" /><stop offset="1" stopColor="#c1d9dd" />
      </linearGradient>
      <linearGradient id="lp-roof" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#eef7f1" />
      </linearGradient>
      <linearGradient id="lp-glass-lit" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stopColor="#86b4d0" /><stop offset="1" stopColor="#457b9d" />
      </linearGradient>
      <linearGradient id="lp-glass-shade" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stopColor="#5f90b2" /><stop offset="1" stopColor="#2f5577" />
      </linearGradient>
      <linearGradient id="lp-pad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#6b9cbc" /><stop offset="1" stopColor="#457b9d" />
      </linearGradient>
      <radialGradient id="lp-pin" cx="0.34" cy="0.28" r="0.85">
        <stop offset="0" stopColor="#9cc6de" /><stop offset="0.5" stopColor="#4f86aa" /><stop offset="1" stopColor="#264a6e" />
      </radialGradient>
      <linearGradient id="lp-puck" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#d0ece6" /><stop offset="1" stopColor="#8cc3cb" />
      </linearGradient>
      <radialGradient id="lp-tree" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#d0ece6" /><stop offset="0.6" stopColor="#8cc3cb" /><stop offset="1" stopColor="#5b8cab" />
      </radialGradient>
      <filter id="lp-blur-lg" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="26" /></filter>
      <filter id="lp-blur-md" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="12" /></filter>
      <filter id="lp-blur-sm" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" /></filter>
    </defs>

    {/* Soft glow behind the tile and its shadow on the stage. */}
    <ellipse cx={300} cy={240} rx={270} ry={170} fill="#a8dadc" opacity={0.26} filter="url(#lp-blur-lg)" />
    <polygon className="lp-art-shadow" points={pts([0, 0, -2.2], [12, 0, -2.2], [12, 12, -2.2], [0, 12, -2.2])}
      fill="#0b1c2e" opacity={0.42} filter="url(#lp-blur-md)" />

    <g className="lp-art-scene">
      {/* Map tile */}
      <polygon points={wallY(12, 0, 12, -0.7, 0)} fill="url(#lp-tile-left)" />
      <polygon points={wallX(12, 0, 12, -0.7, 0)} fill="url(#lp-tile-right)" />
      <polygon points={flat(0, 12, 0, 12)} fill="url(#lp-ground)" stroke="#e9f6f2" strokeWidth={1.5} strokeLinejoin="round" />

      {/* Ground: hospital lot, roads and lane markings */}
      <polygon points={flat(3.1, 10.0, 1.8, 7.0)} fill="#e7f5f2" />
      <polygon points={flat(0, 12, 7.0, 8.0)} fill="#f7fcf6" />
      <polygon points={flat(1.7, 2.7, 0, 12)} fill="#f7fcf6" />
      {laneA.map(([a, b]) => <polygon key={`a${a}`} points={flat(a, b, 7.45, 7.55)} fill="#bfe1e0" />)}
      {laneB.map(([a, b]) => <polygon key={`b${a}`} points={flat(2.15, 2.25, a, b)} fill="#bfe1e0" />)}

      {/* Building contact shadow */}
      <polygon points={flat(3.7, 10.7, 2.3, 6.1)} fill="#1d3557" opacity={0.2} filter="url(#lp-blur-sm)" />

      {/* Neighbourhood behind the hospital */}
      <Box x={[0.35, 1.35]} y={[0.5, 1.9]} z={[0, 1.3]} fill={HOUSE} />
      <Box x={[0.35, 1.35]} y={[2.5, 3.9]} z={[0, 0.8]} fill={HOUSE} />
      <Box x={[10.5, 11.6]} y={[0.5, 1.8]} z={[0, 1.0]} fill={HOUSE} />
      <Tree x={0.9} y={5.2} />
      <Tree x={0.9} y={6.3} size={0.85} />

      {/* Main tower */}
      <Box x={[tx0, tx1]} y={[ty0, ty1]} z={[0, TOWER.h]} fill={WALL} />
      {[[1.85, 2.5], [2.9, 3.55], [3.95, 4.6]].map(([za, zb]) =>
        [[3.85, 4.47], [4.9, 5.5], [5.93, 6.55]].map(([xa, xb]) =>
          <WindowY key={`tl${za}${xa}`} y={ty1} x={[xa, xb]} z={[za, zb]} />))}
      <WindowY y={ty1} x={[3.85, 4.35]} z={[0.4, 1.2]} />
      <WindowY y={ty1} x={[6.05, 6.55]} z={[0.4, 1.2]} />
      <WindowY y={ty1} x={[4.65, 5.75]} z={[0, 1.45]} fill="url(#lp-glass-shade)" />
      {[[4.1, 4.7], [5.2, 5.8]].map(([za, zb]) =>
        [[2.5, 3.1], [3.5, 4.1], [4.5, 5.1]].map(([ya, yb]) =>
          <WindowX key={`tr${za}${ya}`} x={tx1} y={[ya, yb]} z={[za, zb]} />))}
      {/* Red cross: a raised sign on the front wall */}
      <polygon points={pts(...CROSS.map(([u, v]) => [crossCx + u + 0.07, ty1, crossCz + v - 0.05] as const))} fill="#b52a37" />
      <polygon points={pts(...CROSS.map(([u, v]) => [crossCx + u, ty1 + 0.12, crossCz + v] as const))} fill="#e63946" />
      {/* Roof with parapet and helipad */}
      <polygon points={flat(tx0 + 0.22, tx1 - 0.22, ty0 + 0.22, ty1 - 0.22, TOWER.h)} fill="#dbeceb" />
      <polygon points={flat(tx0 + 0.6, tx1 - 0.6, ty0 + 0.6, ty1 - 0.6, TOWER.h)} fill="url(#lp-pad)" />
      <ellipse cx={padX} cy={padY} rx={pad.rx} ry={pad.ry} fill="none" stroke="#f1faee" strokeWidth={2.6} />
      <polygon fill="#f1faee"
        points={pts(...H_LETTER.map(([p, q]) => [roofCx + (p - q) * S2 * 0.85, roofCy + (-p - q) * S2 * 0.85, TOWER.h] as const))} />

      {/* Annex with emergency entrance */}
      <Box x={[ax0, ax1]} y={[ay0, ay1]} z={[0, ANNEX.h]} fill={WALL} />
      {[[7.05, 7.6], [7.9, 8.45], [8.75, 9.3]].map(([xa, xb]) =>
        <WindowY key={`al${xa}`} y={ay1} x={[xa, xb]} z={[2.2, 2.85]} />)}
      {[[0.6, 1.3], [2.2, 2.85]].map(([za, zb]) =>
        [[3.0, 3.55], [3.85, 4.4], [4.7, 5.25]].map(([ya, yb]) =>
          <WindowX key={`ar${za}${ya}`} x={ax1} y={[ya, yb]} z={[za, zb]} />))}
      <polygon points={flat(ax0 + 0.2, ax1 - 0.2, ay0 + 0.2, ay1 - 0.2, ANNEX.h)} fill="#dbeceb" />
      <Box x={[8.3, 9.1]} y={[3.2, 3.9]} z={[ANNEX.h, ANNEX.h + 0.45]} fill={{ top: '#f1faee', left: '#cfe5e6', right: '#a8c9d1' }} />
      <WindowY y={ay1} x={[7.8, 8.6]} z={[0, 1.3]} fill="url(#lp-glass-shade)" />
      <Box x={[7.56, 7.68]} y={[6.3, 6.42]} z={[0, 1.6]} fill={{ top: '#f1faee', left: '#f1faee', right: '#c1d9dd' }} rim={false} />
      <Box x={[8.76, 8.88]} y={[6.3, 6.42]} z={[0, 1.6]} fill={{ top: '#f1faee', left: '#f1faee', right: '#c1d9dd' }} rim={false} />
      <Box x={[7.4, 9.0]} y={[ay1, 6.6]} z={[1.6, 1.85]} fill={{ top: '#ea575e', left: '#e63946', right: '#c22f3b' }} />

      {/* Front of the scene */}
      <Tree x={3.25} y={6.45} />
      <Box x={[6.6, 8.6]} y={[9.0, 10.4]} z={[0, 0.75]} fill={HOUSE} />
      <Tree x={3.6} y={9.0} />
      <Tree x={4.6} y={10.4} size={0.9} />
      <Tree x={10.4} y={9.3} size={0.9} />
      <Tree x={11.3} y={10.6} />

      {/* Illustrative hotspot, dashed nearest-hospital line to the entrance */}
      <line className="lp-art-route" x1={hsX} y1={hsY} x2={enX} y2={enY}
        stroke="#457b9d" strokeWidth={3} strokeLinecap="round" strokeDasharray="2 8" />
      <circle cx={enX} cy={enY} r={4.5} fill="#457b9d" stroke="#f1faee" strokeWidth={1.5} />
      <ellipse className="lp-art-ring" cx={hsX} cy={hsY} rx={hsRing.rx} ry={hsRing.ry} fill="none" stroke="#e63946" strokeWidth={2} />
      <ellipse className="lp-art-ring lp-art-ring-late" cx={hsX} cy={hsY} rx={hsRing.rx} ry={hsRing.ry} fill="none" stroke="#e63946" strokeWidth={2} />
      <ellipse cx={hsX} cy={hsY} rx={hsCore.rx * 1.9} ry={hsCore.ry * 1.9} fill="#e63946" opacity={0.18} />
      <ellipse cx={hsX} cy={hsY} rx={hsCore.rx} ry={hsCore.ry} fill="#e63946" stroke="#f1faee" strokeWidth={2} />

      {/* Location pin on its base */}
      <ellipse cx={pinX} cy={pinY + 4} rx={puck.rx} ry={puck.ry} fill="#2f5577" />
      <ellipse cx={pinX} cy={pinY} rx={puck.rx} ry={puck.ry} fill="url(#lp-puck)" />
      <ellipse className="lp-art-pin-shadow" cx={pinX + 2} cy={pinY} rx={9} ry={4.5} fill="#1d3557" opacity={0.35} />
      <g className="lp-art-pin">
        <g transform={`translate(${(pinX - 12 * PIN_SCALE).toFixed(1)} ${(pinY - 22 * PIN_SCALE).toFixed(1)}) scale(${PIN_SCALE})`}>
          <path d="M12 22s8-6.6 8-12a8 8 0 1 0-16 0c0 5.4 8 12 8 12z" fill="url(#lp-pin)" />
          <circle cx={12} cy={10} r={3.3} fill="#f1faee" />
          <circle cx={12} cy={10} r={3.3} fill="none" stroke="#1d3557" strokeOpacity={0.25} strokeWidth={0.6} />
          <ellipse cx={8.6} cy={6.4} rx={2.2} ry={1.1} transform="rotate(-38 8.6 6.4)" fill="#ffffff" opacity={0.5} />
        </g>
      </g>
    </g>
  </svg>;
}
