'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Activity, BookOpen, Map } from 'lucide-react';

type P3 = readonly [number, number, number];
type Destination = 'dashboard' | 'simulation' | 'research';
// Retains the teammate's projected tower + annex construction, with a new
// architectural treatment. This is an invented navigation model, not a real
// facility, geospatial map, patient count, or hospital capability diagram.
const iso = (x: number, y: number, z = 0) => [560 + (x - y) * 25, 240 + (x + y) * 14.5 - z * 29] as const;
const points = (...vertices: P3[]) => vertices.map(([x, y, z]) => iso(x, y, z).map(n => n.toFixed(1)).join(',')).join(' ');
const flat = (x0: number, x1: number, y0: number, y1: number, z = 0) => points([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]);
const wallY = (y: number, x0: number, x1: number, z0: number, z1: number) => points([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]);
const wallX = (x: number, y0: number, y1: number, z0: number, z1: number) => points([x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]);

function Volume({ x, y, z }: { x: [number, number]; y: [number, number]; z: [number, number] }) {
  return <g className="hm-volume">
    <polygon className="hm-wall-lit" points={wallY(y[1], x[0], x[1], z[0], z[1])} />
    <polygon className="hm-wall-shade" points={wallX(x[1], y[0], y[1], z[0], z[1])} />
    <polygon className="hm-roof" points={flat(x[0], x[1], y[0], y[1], z[1])} />
  </g>;
}

const DESTINATIONS = [
  { id: 'dashboard', href: '/dashboard', label: 'Dashboard', description: 'Geography & historical patterns', detail: 'The catchment', number: '01', Icon: Map },
  { id: 'simulation', href: '/outbreak-response', label: 'Simulation', description: 'Hospital demand & capacity scenarios', detail: 'The hospital', number: '02', Icon: Activity },
  { id: 'research', href: '/research', label: 'Research', description: 'Data, backtests & assumptions', detail: 'The evidence', number: '03', Icon: BookOpen },
] as const;

export default function HospitalNavigationModel() {
  const [hovered, setHovered] = useState<Destination | null>(null);
  const [focused, setFocused] = useState<Destination | null>(null);
  const active = hovered ?? focused;
  const events = (id: Destination) => ({
    onPointerEnter: () => setHovered(id), onPointerLeave: () => setHovered(null),
    onFocus: () => setFocused(id), onBlur: () => setFocused(null),
  });

  return (
    <div className="home-model-wrap" data-active={active ?? 'none'}>
      <svg className="home-model" viewBox="0 0 1100 720" aria-labelledby="home-model-title home-model-desc">
        <title id="home-model-title">SurgeWise hospital navigation</title>
        <desc id="home-model-desc">An architectural illustration with three linked parts: its catchment opens Dashboard, its building opens Simulation, and its evidence foundation opens Research.</desc>
        <defs>
          <linearGradient id="hm-lit" x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--model-lit-start)" /><stop offset="1" stopColor="var(--model-lit-end)" /></linearGradient>
          <linearGradient id="hm-shade" x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--model-shade-start)" /><stop offset="1" stopColor="var(--model-shade-end)" /></linearGradient>
          <linearGradient id="hm-top" x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--model-roof-start)" /><stop offset="1" stopColor="var(--model-roof-end)" /></linearGradient>
          <linearGradient id="hm-glass" x1="0" y1="0" x2="0.6" y2="1"><stop stopColor="var(--model-glass-start)" /><stop offset="1" stopColor="var(--model-glass-end)" /></linearGradient>
          <linearGradient id="hm-site" x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--model-site-start)" /><stop offset="1" stopColor="var(--model-site-end)" /></linearGradient>
          <filter id="hm-shadow" x="-50%" y="-70%" width="200%" height="240%"><feGaussianBlur stdDeviation="20" /></filter>
        </defs>
        <g aria-hidden="true" className="hm-reference">
          <path d="M170 491L635 222M317 657L917 309M260 393L868 746" />
          <path d="M230 490h14m-7-7v14M884 412h14m-7-7v14M584 656h14m-7-7v14" />
          <ellipse cx={572} cy={558} rx={300} ry={62} fill="var(--model-shadow)" stroke="none" opacity="0.4" filter="url(#hm-shadow)" />
        </g>

        <Link href="/research" prefetch={false} className={`home-model-part hm-evidence${active === 'research' ? ' is-active' : ''}`}
          aria-label="Research: explore the evidence foundation" {...events('research')}>
          <g className="hm-assembly-layer hm-assembly-evidence">
            <polygon className="hm-evidence-bottom" points={flat(0, 14, 0, 12, -2.3)} />
            <polygon className="hm-evidence-middle" points={flat(0, 14, 0, 12, -1.75)} />
            <polygon className="hm-evidence-top" points={flat(0, 14, 0, 12, -1.2)} />
          </g>
        </Link>

        <Link href="/dashboard" prefetch={false} className={`home-model-part hm-catchment${active === 'dashboard' ? ' is-active' : ''}`}
          aria-label="Dashboard: explore the catchment and historical patterns" {...events('dashboard')}>
          <g className="hm-assembly-layer hm-assembly-site">
            <polygon className="hm-site-edge" points={wallY(12, 0, 14, -0.38, 0)} />
            <polygon className="hm-site-edge" points={wallX(14, 0, 12, -0.38, 0)} />
            <polygon className="hm-site" points={flat(0, 14, 0, 12)} />
            <g className="hm-site-lines" aria-hidden="true">
              <polygon points={flat(0.3, 13.7, 0.2, 11.8)} />
            </g>
            <g className="hm-site-nodes" aria-hidden="true">
              {[[1.5, 6.7], [4.5, 9.9], [8.1, 9.9]].map(([x, y]) => {
                const [cx, cy] = iso(x, y);
                return <g key={x}><ellipse cx={cx} cy={cy} rx={10} ry={5.8} /><circle cx={cx} cy={cy} r={2} /></g>;
              })}
            </g>
          </g>
        </Link>

        <Link href="/outbreak-response" prefetch={false} className={`home-model-part hm-hospital${active === 'simulation' ? ' is-active' : ''}`}
          aria-label="Simulation: explore hospital demand and capacity scenarios" {...events('simulation')}>
          <g className="hm-assembly-layer hm-assembly-building">
            <Volume x={[3.5, 8.1]} y={[2, 6.5]} z={[0, 7.1]} />
            <g className="hm-facade" aria-hidden="true">
              {[0.8, 2, 3.2, 4.4].map(z => <g key={z}>
                <polygon points={wallY(6.5, 3.85, 7.75, z, z + 0.7)} />
                <polygon points={wallX(8.1, 2.3, 6.2, z, z + 0.7)} />
              </g>)}
            </g>
            <g className="hm-fins" aria-hidden="true">
              {[4.8, 5.8, 6.8].map(x => <polygon key={x} points={wallY(6.51, x, x + 0.055, 0.7, 5.2)} />)}
              {[3.25, 4.25, 5.25].map(y => <polygon key={y} points={wallX(8.11, y, y + 0.055, 0.7, 5.2)} />)}
            </g>
            <polygon className="hm-roof-inset" points={flat(3.8, 7.8, 2.3, 6.2, 7.11)} />
            <polygon className="hm-roof-seam" points={flat(4.1, 7.5, 2.6, 5.9, 7.12)} />
            <polygon className="hm-sign" points={wallY(6.52, 5.1, 6.5, 5.5, 6.6)} />
            <polygon className="hm-cross" points={wallY(6.53, 5.64, 5.96, 5.68, 6.42)} />
            <polygon className="hm-cross" points={wallY(6.54, 5.34, 6.26, 5.9, 6.2)} />
            <Volume x={[8.1, 11.5]} y={[3.2, 6.5]} z={[0, 3.4]} />
            <polygon className="hm-roof-inset" points={flat(8.35, 11.25, 3.45, 6.25, 3.41)} />
            <g className="hm-facade" aria-hidden="true">
              {[0.5, 1.85].map(z => <polygon key={z} points={wallX(11.5, 3.5, 6.2, z, z + 0.8)} />)}
              <polygon points={wallY(6.51, 8.45, 11.15, 1.9, 2.65)} />
              <polygon points={wallY(6.52, 9.1, 10.5, 0, 1.4)} />
            </g>
            <Volume x={[8.75, 10.85]} y={[6.5, 7.7]} z={[1.4, 1.55]} />
            <polygon className="hm-canopy-leg" points={wallY(7.6, 8.9, 9, 0, 1.4)} />
            <polygon className="hm-canopy-leg" points={wallY(7.6, 10.55, 10.65, 0, 1.4)} />
          </g>
        </Link>

        {/* Leaders start on the three thin layers under the platform (user request): the top
            layer for Dashboard, the middle for Simulation, the bottom for Research. */}
        <g className="hm-leaders" aria-hidden="true">
          <g className="hm-leader hm-leader-dashboard">
            <path pathLength={1} className={active === 'dashboard' ? 'is-active' : ''} d="M370 501L268 346H130" />
            <circle cx={370} cy={501} r={3} />
          </g>
          <g className="hm-leader hm-leader-simulation">
            <path pathLength={1} className={active === 'simulation' ? 'is-active' : ''} d="M835 529L880 484V110" />
            <circle cx={835} cy={529} r={3} />
          </g>
          <g className="hm-leader hm-leader-research">
            <path pathLength={1} className={active === 'research' ? 'is-active' : ''} d="M685 632L905 748H931" />
            <circle cx={685} cy={632} r={3} />
          </g>
        </g>
      </svg>

      <nav className="home-model-labels" aria-label="Explore SurgeWise workspaces">
        {DESTINATIONS.map(({ id, href, label, description, detail, number, Icon }) => (
          <Link key={id} href={href} prefetch={false} className={`home-model-label home-label-${id}${active === id ? ' is-active' : ''}`} {...events(id)}>
            <span className="home-label-kicker"><span>{number}</span>{detail}</span>
            <span className="home-label-title"><Icon size={17} strokeWidth={1.5} aria-hidden="true" />{label}<ArrowUpRight size={16} aria-hidden="true" /></span>
            <span className="home-label-description">{description}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
