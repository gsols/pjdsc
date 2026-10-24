'use client';
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function BarangayMap({ values, modeled }: { values: Record<string, number | null>; modeled: boolean }) {
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
        style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#101f2d' } }] } });
    } catch { setError('Map unavailable. All barangays remain in the table below.'); return; }
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl());
    const controller = new AbortController();
    instance.on('load', async () => {
      try {
        const response = await fetch('/data/qc-barangays.geojson', { signal: controller.signal });
        if (!response.ok) throw Error();
        const data = await response.json();
        if (controller.signal.aborted) return;
        instance.addSource('barangays', { type: 'geojson', data, promoteId: 'ADM4_PCODE' });
        instance.addLayer({ id: 'burden', type: 'fill', source: 'barangays', paint: { 'fill-color': '#566a7a', 'fill-opacity': .8 } });
        instance.addLayer({ id: 'borders', type: 'line', source: 'barangays', paint: { 'line-color': '#b8dfe3', 'line-width': .6 } });
        instance.on('click', 'burden', e => {
          const id = e.features?.[0]?.properties?.ADM4_PCODE;
          if (id) setSelection(String(id));
        });
        setReady(true);
      } catch { if (!controller.signal.aborted) setError('Barangay geometry unavailable. Use the data table below.'); }
    });
    return () => { controller.abort(); instance.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    const max = Math.max(1, ...Object.values(values).filter((v): v is number => v !== null));
    const expression: unknown[] = ['match', ['get', 'ADM4_PCODE'], '__unmapped__', '#566a7a'];
    for (const [id, value] of Object.entries(values)) {
      expression.push(id, value === null ? '#566a7a' : `hsl(${modeled ? 32 : 175}, 65%, ${24 + 48 * value / max}%)`);
    }
    expression.push('#566a7a');
    map.current.setPaintProperty('burden', 'fill-color', expression as maplibregl.ExpressionSpecification);
  }, [ready, values, modeled]);
  return <div><div ref={root} style={{ height: 420 }} aria-label="QC barangay burden map" />
    <p role="status">{error || `${modeled ? 'Orange: modeled weekly allocation' : 'Teal: observed annual cases'}. Brighter = larger count within this view; gray = missing. Two polygon IDs use documented project name crosswalks.`}</p>
    {selection && <p>Selected {selection}: {values[selection] === null ? 'Missing' : values[selection]?.toFixed(2)} cases</p>}
  </div>;
}
