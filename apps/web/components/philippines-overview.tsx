'use client';
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';

export default function PhilippinesOverview() {
  const root = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!root.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({ container: root.current, interactive: false, attributionControl: false,
        style: { version: 8, sources: {}, layers: [{ id: 'ocean', type: 'background', paint: { 'background-color': '#102733' } }] } });
    } catch { setError(true); return; }
    const controller = new AbortController();
    map.on('load', async () => {
      try {
        const response = await fetch('/data/philippines-context.geojson', { signal: controller.signal });
        if (!response.ok) throw Error();
        const data = await response.json();
        if (controller.signal.aborted) return;
        map.addSource('ph', { type: 'geojson', data });
        map.addLayer({ id: 'ph-land', type: 'fill', source: 'ph', paint: { 'fill-color': '#477477', 'fill-opacity': .9 } });
        map.addLayer({ id: 'ph-coast', type: 'line', source: 'ph', paint: { 'line-color': '#91afa5', 'line-width': .45 } });
        map.addSource('qc', { type: 'geojson', data: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [121.055, 14.675] }, properties: {} }] } });
        map.addLayer({ id: 'qc-location', type: 'circle', source: 'qc', paint: { 'circle-radius': 4, 'circle-color': '#ffbf70', 'circle-stroke-color': '#fff4dd', 'circle-stroke-width': 1 } });
        map.fitBounds([[116.8, 4.3], [126.8, 21.2]], { padding: 8, duration: 0 });
      } catch { if (!controller.signal.aborted) setError(true); }
    });
    return () => { controller.abort(); map.remove(); };
  }, []);
  return <div className="qc-country-overview"><div ref={root} aria-label="Entire Philippines context with QC highlighted" />
    <span>{error ? 'Philippines overview unavailable' : 'Philippines · QC highlighted'}</span></div>;
}
