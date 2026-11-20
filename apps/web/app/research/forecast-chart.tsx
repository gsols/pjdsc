'use client';
import { useEffect, useRef, useState } from 'react';

type Point = { label: string; forecast: number; observed: number };
const HEIGHT = 230;
const PAD = { top: 16, right: 92, bottom: 34, left: 44 };
const fmt = (value: number, digits = 1) => value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function niceMax(value: number) {
  const step = 10 ** Math.floor(Math.log10(Math.max(1, value)));
  for (const multiple of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (multiple * step >= value) return multiple * step;
  return 10 * step;
}

/** Forecast (dashed, diamond) against observed (solid, circle) reported cases for one saved run. */
export default function ForecastChart({ points }: { points: Point[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  if (!points.length) return null;
  const top = niceMax(Math.max(...points.flatMap(p => [p.forecast, p.observed])) * 1.08);
  const ticks = [0, .25, .5, .75, 1].map(t => t * top);
  const plotW = width - PAD.left - PAD.right, plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const path = (key: 'forecast' | 'observed') => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  // End labels: keep at least 15px apart so they never overlap.
  const last = points.length - 1;
  let observedLabel = y(points[last].observed), forecastLabel = y(points[last].forecast);
  if (Math.abs(observedLabel - forecastLabel) < 15) {
    const mid = (observedLabel + forecastLabel) / 2, up = observedLabel <= forecastLabel;
    observedLabel = mid + (up ? -7.5 : 7.5); forecastLabel = mid + (up ? 7.5 : -7.5);
  }
  function move(clientX: number) {
    const bounds = root.current?.getBoundingClientRect();
    if (!bounds) return;
    const relative = clientX - bounds.left;
    let nearest = 0;
    points.forEach((_, i) => { if (Math.abs(x(i) - relative) < Math.abs(x(nearest) - relative)) nearest = i; });
    setHover(nearest);
  }
  const active = hover === null ? null : points[hover];
  const summary = points.map(p => `${p.label}: forecast ${fmt(p.forecast)}, observed ${fmt(p.observed, 0)}`).join('; ');
  return <figure className="rs-chart">
    <figcaption className="rs-chart-head">
      <span>Reported dengue cases per week</span>
      <span className="rs-chart-legend">
        <span><i className="rs-swatch rs-swatch-observed" aria-hidden="true" />Observed</span>
        <span><i className="rs-swatch rs-swatch-forecast" aria-hidden="true" />Forecast</span>
      </span>
    </figcaption>
    <div ref={root} className="rs-chart-canvas" onPointerMove={event => move(event.clientX)} onPointerLeave={() => setHover(null)}>
      <svg width={width} height={HEIGHT} role="img" aria-label={`Forecast versus observed cases. ${summary}`}>
        {ticks.map(t => <g key={t}>
          <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'rs-axis' : 'rs-grid'} />
          <text x={PAD.left - 8} y={y(t)} className="rs-tick" textAnchor="end" dominantBaseline="middle">{Math.round(t).toLocaleString('en-US')}</text>
        </g>)}
        {points.map((p, i) => <text key={p.label} x={x(i)} y={HEIGHT - 10} className="rs-tick" textAnchor="middle">{p.label.replace(/^\d{4} · /, '')}</text>)}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} className="rs-crosshair" />}
        <path d={path('observed')} className="rs-line rs-line-observed" />
        <path d={path('forecast')} className="rs-line rs-line-forecast" />
        {points.map((p, i) => <g key={`m-${p.label}`}>
          <circle cx={x(i)} cy={y(p.observed)} r={hover === i ? 5.5 : 4.5} className="rs-marker rs-marker-observed" />
          <rect x={x(i) - 4.2} y={y(p.forecast) - 4.2} width={8.4} height={8.4} transform={`rotate(45 ${x(i)} ${y(p.forecast)})`} className="rs-marker rs-marker-forecast" />
        </g>)}
        <text x={x(last) + 12} y={observedLabel} className="rs-end-label" dominantBaseline="middle">Observed</text>
        <text x={x(last) + 12} y={forecastLabel} className="rs-end-label" dominantBaseline="middle">Forecast</text>
      </svg>
      {active && hover !== null && <div className="rs-tooltip" role="presentation"
        style={{ left: Math.min(Math.max(x(hover), 90), width - 90), top: Math.min(y(active.forecast), y(active.observed)) - 12 }}>
        <strong>{active.label}</strong>
        <span><i className="rs-swatch rs-swatch-observed" />Observed <b>{fmt(active.observed, 0)}</b></span>
        <span><i className="rs-swatch rs-swatch-forecast" />Forecast <b>{fmt(active.forecast)}</b></span>
        <span className="rs-tooltip-diff">Difference {active.forecast - active.observed > 0 ? '+' : ''}{fmt(active.forecast - active.observed)}</span>
      </div>}
    </div>
  </figure>;
}
