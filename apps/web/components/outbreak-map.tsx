'use client';
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { FeatureCollection, LineString, Point, Polygon } from 'geojson';
import type { MovieContext, MovieDay } from '@/lib/outbreak-types';
import 'maplibre-gl/dist/maplibre-gl.css';
import { caseBand } from '@/lib/case-bands';

type Props = { context: MovieContext | null; snapshot: MovieDay | null; maximum: number; selected: string;
  onSelect: (id: string) => void; onHospital: (id: string) => void; playing: boolean; reducedMotion: boolean; showLinks: boolean;
  view?: 'qc' | 'philippines' };
const empty = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });

export default function OutbreakMap({ context, snapshot, selected, onSelect, onHospital, playing, reducedMotion, showLinks, view = 'qc' }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const onSelectRef = useRef(onSelect), onHospitalRef = useRef(onHospital);
  const routes = useRef<FeatureCollection<LineString>>(empty() as FeatureCollection<LineString>);
  const labels = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  useEffect(() => { onSelectRef.current = onSelect; onHospitalRef.current = onHospital; }, [onSelect, onHospital]);
  useEffect(() => {
    if (!root.current) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({ container: root.current, center: [121.055, 14.675], zoom: 11.25,
        style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0b1c2b' } }] } });
    } catch { setError('Map unavailable. Use hotspot and hospital tables.'); return; }
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl(), 'top-right');
    const controller = new AbortController();
    instance.on('load', async () => {
      try {
        const response = await fetch('/data/qc-barangays.geojson', { signal: controller.signal });
        if (!response.ok) throw Error();
        const data = await response.json();
        if (controller.signal.aborted) return;
        const countryResponse = await fetch('/data/philippines-context.geojson', { signal: controller.signal });
        if (!countryResponse.ok) throw Error();
        const country = await countryResponse.json();
        if (controller.signal.aborted) return;
        instance.addSource('country-context', { type: 'geojson', data: country });
        instance.addLayer({ id: 'country-land', type: 'fill', source: 'country-context', paint: { 'fill-color': '#244b55', 'fill-opacity': .65 } });
        instance.addLayer({ id: 'country-outline', type: 'line', source: 'country-context', paint: { 'line-color': '#638d91', 'line-width': .65 } });
        instance.addSource('qc', { type: 'geojson', data, promoteId: 'ADM4_PCODE' });
        instance.addLayer({ id: 'barangays', type: 'fill', source: 'qc', paint: { 'fill-color': '#20394c', 'fill-opacity': .88, 'fill-color-transition': { duration: 300 } } });
        instance.addLayer({ id: 'boundaries', type: 'line', source: 'qc', paint: { 'line-color': '#65899c', 'line-width': .7, 'line-opacity': .65 } });
        for (const id of ['front', 'proximity', 'placements', 'hospitals', 'hotspots', 'particles']) instance.addSource(id, { type: 'geojson', data: empty() });
        instance.addLayer({ id: 'front-line', type: 'line', source: 'front', paint: { 'line-color': '#ffac68', 'line-width': 2, 'line-opacity': .65, 'line-dasharray': [3, 3] } });
        instance.addLayer({ id: 'proximity-line', type: 'line', source: 'proximity', paint: { 'line-color': '#b4a2fd', 'line-width': 1.4, 'line-dasharray': [2, 3], 'line-opacity': .8 } });
        instance.addLayer({ id: 'placement-line', type: 'line', source: 'placements', paint: {
          'line-color': ['case', ['>', ['get', 'holding'], 0], '#ffb068', '#52e0d2'],
          'line-width': ['interpolate', ['linear'], ['get', 'patients'], 0, 1, 10, 4, 40, 7], 'line-opacity': .6 } });
        instance.addLayer({ id: 'hotspot-halo', type: 'circle', source: 'hotspots', paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'cases'], 0, 5, 10, 13, 100, 26], 'circle-color': '#ff8d52', 'circle-opacity': .17 } });
        instance.addLayer({ id: 'hotspot-dot', type: 'circle', source: 'hotspots', paint: { 'circle-radius': 4, 'circle-color': '#ffd4a8', 'circle-stroke-width': 1, 'circle-stroke-color': '#ff864c' } });
        instance.addLayer({ id: 'hospital-halo', type: 'circle', source: 'hospitals', paint: { 'circle-radius': 10, 'circle-color': ['get', 'color'], 'circle-opacity': .18 } });
        instance.addLayer({ id: 'hospital-dot', type: 'circle', source: 'hospitals', paint: { 'circle-radius': 5, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#edf7ff', 'circle-stroke-width': 1.5 } });
        instance.addLayer({ id: 'moving-demand', type: 'circle', source: 'particles', paint: { 'circle-color': '#dffff8', 'circle-radius': 3, 'circle-opacity': .9 } });
        instance.on('click', 'barangays', event => { const id = event.features?.[0]?.properties?.ADM4_PCODE; if (id) onSelectRef.current(String(id)); });
        instance.on('click', 'hospital-dot', event => { const id = event.features?.[0]?.properties?.id; if (id) onHospitalRef.current(String(id)); });
        for (const id of ['barangays', 'hospital-dot']) {
          instance.on('mouseenter', id, () => { instance.getCanvas().style.cursor = 'pointer'; });
          instance.on('mouseleave', id, () => { instance.getCanvas().style.cursor = ''; });
        }
        instance.fitBounds([[121.0, 14.585], [121.153, 14.782]], { padding: 35, duration: 0 });
        setReady(true);
      } catch { if (!controller.signal.aborted) setError('Geometry could not load. Use the tables beside the map.'); }
    });
    const labelStore = labels;
    return () => { controller.abort(); labelStore.current.forEach(label => label.remove()); instance.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    const instance = map.current;
    const set = (id: string, data: FeatureCollection) => (instance.getSource(id) as maplibregl.GeoJSONSource).setData(data);
    labels.current.forEach(label => label.remove());
    labels.current = [];
    if (!context) {
      for (const id of ['front', 'proximity', 'placements', 'hospitals', 'hotspots', 'particles']) set(id, empty());
      routes.current = empty() as FeatureCollection<LineString>;
      instance.setPaintProperty('barangays', 'fill-color', '#20394c');
      return;
    }
    const values = new Map(snapshot?.barangays.map(b => [b.barangayId, b.cumulativeCases]) ?? []);
    const expression: unknown[] = ['match', ['get', 'ADM4_PCODE'], '__none__', '#20394c'];
    for (const b of context.barangays) {
      const value = values.get(b.id) ?? 0;
      expression.push(b.id, snapshot ? caseBand(value).color : '#20394c');
    }
    expression.push('#20394c');
    instance.setPaintProperty('barangays', 'fill-color', expression as maplibregl.ExpressionSpecification);
    instance.setPaintProperty('barangays', 'fill-color-transition', { duration: reducedMotion ? 0 : 300 });
    instance.setPaintProperty('boundaries', 'line-width', ['case', ['==', ['get', 'ADM4_PCODE'], selected], 3, .7]);
    instance.setPaintProperty('boundaries', 'line-color', ['case', ['==', ['get', 'ADM4_PCODE'], selected], '#fff3da', '#65899c']);
    const hospitalMap = new Map(context.hospitals.map(h => [h.id, h]));
    const barangayMap = new Map(context.barangays.map(b => [b.id, b]));
    const facilityStats = new Map(snapshot?.facilities.map(h => [h.facilityId, h]) ?? []);
    set('hospitals', { type: 'FeatureCollection', features: context.hospitals.map(h => {
      const stat = facilityStats.get(h.id);
      return { type: 'Feature', geometry: { type: 'Point', coordinates: h.coordinates }, properties: { id: h.id,
        color: stat ? stat.holdingCensus > 0 ? '#ff825c' : stat.normalOccupancyPct > 100 ? '#ffc06a' : '#50d7ca' : '#71879a' } };
    }) });
    set('hotspots', { type: 'FeatureCollection', features: (snapshot?.hotspotIds ?? []).map(id => ({ type: 'Feature',
      geometry: { type: 'Point', coordinates: barangayMap.get(id)!.coordinates }, properties: { id, cases: values.get(id) ?? 0 } })) });
    const selectedBarangay = barangayMap.get(selected);
    set('proximity', { type: 'FeatureCollection', features: showLinks && selectedBarangay ? selectedBarangay.nearestHospitals.map(h => ({ type: 'Feature',
      geometry: { type: 'LineString', coordinates: [selectedBarangay.coordinates, hospitalMap.get(h.facilityId)!.coordinates] }, properties: {} })) : [] });
    const visible = new Set(selected ? [selected] : snapshot?.hotspotIds ?? []);
    const lines: FeatureCollection<LineString> = { type: 'FeatureCollection', features: showLinks ? (snapshot?.assignments ?? []).filter(r => visible.has(r.barangayId)).map(r => ({ type: 'Feature',
      geometry: { type: 'LineString', coordinates: [barangayMap.get(r.barangayId)!.coordinates, hospitalMap.get(r.facilityId)!.coordinates] },
      properties: { patients: r.supportedPlacements + r.holdingPlacements, holding: r.holdingPlacements } })) : [] };
    routes.current = lines;
    set('placements', lines);
    const front: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: snapshot?.expansionRing.length ? [{ type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [snapshot.expansionRing] }, properties: {} }] : [] };
    set('front', front);
    set('particles', empty());
    const addLabel = (coordinates: [number, number], text: string, hospitalLabel: boolean, click: () => void) => {
      const button = document.createElement('button');
      button.className = `movie-location-label${hospitalLabel ? ' hospital-location' : ''}`;
      button.textContent = text; button.title = text; button.onclick = click;
      labels.current.push(new maplibregl.Marker({ element: button, anchor: 'bottom', offset: [0, -10] }).setLngLat(coordinates).addTo(instance));
    };
    const namedHotspots = new Set([...(snapshot?.hotspotIds.slice(0, 4) ?? []), ...(selected ? [selected] : [])]);
    for (const id of namedHotspots) {
      const b = barangayMap.get(id);
      if (b) addLabel(b.coordinates, `${b.name} · ${(values.get(id) ?? 0).toFixed(1)}`, false, () => onSelectRef.current(id));
    }
    for (const nearest of selectedBarangay?.nearestHospitals ?? []) {
      const h = hospitalMap.get(nearest.facilityId)!;
      addLabel(h.coordinates, `+ ${h.name}`, true, () => onHospitalRef.current(h.id));
    }
  }, [ready, context, snapshot, selected, showLinks, reducedMotion]);
  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.fitBounds(view === 'philippines' ? [[116.8, 4.3], [126.8, 21.2]] : [[121.0, 14.585], [121.153, 14.782]],
      { padding: view === 'philippines' ? 30 : 35, duration: reducedMotion ? 0 : 650 });
  }, [view, ready, reducedMotion]);
  useEffect(() => {
    if (!ready || !playing || reducedMotion) return;
    let frame = 0, previous = 0;
    const tick = (time: number) => {
      if (map.current && time - previous > 40) {
        previous = time;
        const points: FeatureCollection<Point> = { type: 'FeatureCollection', features: routes.current.features.map((route, i) => {
          const [a, b] = route.geometry.coordinates;
          const fraction = (time / 1800 + i * .17) % 1;
          return { type: 'Feature', geometry: { type: 'Point', coordinates: [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction] }, properties: {} };
        }) };
        (map.current.getSource('particles') as maplibregl.GeoJSONSource)?.setData(points);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); if (map.current?.getSource('particles')) (map.current.getSource('particles') as maplibregl.GeoJSONSource).setData(empty()); };
  }, [ready, playing, reducedMotion]);
  return <div className="outbreak-map" ref={root} aria-label="Animated hypothetical QC burden and hospital placement map">
    {error && <div className="movie-map-error" role="status">{error}</div>}
  </div>;
}
