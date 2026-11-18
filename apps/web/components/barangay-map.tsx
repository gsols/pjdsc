'use client';
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/** Sequential single-hue ramps: blue = observed annual counts, teal = modeled allocation. */
const RAMP = { observed: { hue: 203, saturation: 45 }, modeled: { hue: 174, saturation: 52 } };
const MISSING = '#c5ced1';
const shade = (modeled: boolean, share: number) => {
  const { hue, saturation } = modeled ? RAMP.modeled : RAMP.observed;
  return `hsl(${hue}, ${saturation}%, ${93 - 55 * share}%)`;
};

export default function BarangayMap({ values, modeled, names = {}, unit }: {
  values: Record<string, number | null>; modeled: boolean; names?: Record<string, string>; unit: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState('');
  useEffect(() => {
    if (!root.current) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({ container: root.current, center: [121.055, 14.676], zoom: 11,
        style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e3eef0' } }] } });
    } catch { setError('Map unavailable. Every barangay is still listed in the table below.'); return; }
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    const controller = new AbortController();
    instance.on('load', async () => {
      try {
        const response = await fetch('/data/qc-barangays.geojson', { signal: controller.signal });
        if (!response.ok) throw Error();
        const data = await response.json();
        if (controller.signal.aborted) return;
        instance.addSource('barangays', { type: 'geojson', data, promoteId: 'ADM4_PCODE' });
        instance.addLayer({ id: 'burden', type: 'fill', source: 'barangays', paint: { 'fill-color': MISSING, 'fill-opacity': .9 } });
        instance.addLayer({ id: 'borders', type: 'line', source: 'barangays', paint: { 'line-color': '#fbfdfd', 'line-width': .7 } });
        instance.on('click', 'burden', e => {
          const id = e.features?.[0]?.properties?.ADM4_PCODE;
          if (id) setSelection(String(id));
        });
        instance.on('mouseenter', 'burden', () => { instance.getCanvas().style.cursor = 'pointer'; });
        instance.on('mouseleave', 'burden', () => { instance.getCanvas().style.cursor = ''; });
        setReady(true);
      } catch { if (!controller.signal.aborted) setError('Barangay boundaries unavailable. Use the table below.'); }
    });
    return () => { controller.abort(); instance.remove(); map.current = null; };
  }, []);
  const max = Math.max(1, ...Object.values(values).filter((v): v is number => v !== null));
  useEffect(() => {
    if (!ready || !map.current) return;
    const expression: unknown[] = ['match', ['get', 'ADM4_PCODE'], '__unmapped__', MISSING];
    for (const [id, value] of Object.entries(values)) expression.push(id, value === null ? MISSING : shade(modeled, value / max));
    expression.push(MISSING);
    map.current.setPaintProperty('burden', 'fill-color', expression as maplibregl.ExpressionSpecification);
  }, [ready, values, modeled, max]);
  const selected = selection ? values[selection] : undefined;
  return <div className="rs-map-card">
    <div ref={root} className="rs-map" aria-label={`Quezon City barangay map: ${modeled ? 'modeled first-week allocation' : 'observed annual cases'}`} />
    <div className="rs-map-footer">
      {error ? <p className="rs-map-status" role="status">{error}</p> : <>
        <div className="rs-map-legend" aria-label="Map key">
          <span className="rs-legend-title">{modeled ? 'Modeled cases (first forecast week)' : 'Observed cases (whole year)'}</span>
          <span className="rs-legend-ramp">
            <span>0</span>
            <i style={{ background: `linear-gradient(90deg, ${shade(modeled, 0)}, ${shade(modeled, .5)}, ${shade(modeled, 1)})` }} />
            <span>{max.toLocaleString('en-US', { maximumFractionDigits: modeled ? 1 : 0 })}</span>
          </span>
          <span className="rs-legend-missing"><i style={{ background: MISSING }} />Missing</span>
        </div>
        <p className="rs-map-status" role="status">
          {selection ? <><strong>{names[selection] ?? selection}</strong>{' · '}{selected === null || selected === undefined ? 'Missing' : `${selected.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${unit}`}</>
            : 'Select a barangay to see its value. Darker means more cases within this view.'}
        </p>
      </>}
    </div>
  </div>;
}
