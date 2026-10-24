'use client';
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { FeatureCollection, LineString, Polygon } from 'geojson';
import type { MovieContext, MovieDay } from '@/lib/outbreak-types';
import 'maplibre-gl/dist/maplibre-gl.css';
import { caseColor, interpolateCaseValues } from '@/lib/case-bands';
import { mapSelection } from '@/lib/map-selection';
import { hospitalConnections } from '@/lib/hospital-links';
import { layoutMapMarkers } from '@/lib/marker-layout';

type Props = { context: MovieContext | null; snapshot: MovieDay | null; maximum: number; selected: string;
  onSelect: (id: string) => void; onHospital: (id: string) => void; playing: boolean; reducedMotion: boolean; showLinks: boolean;
  selectedHospital?: string; hotspotIds?: string[]; rankedHotspotIds?: string[]; hospitalHotspot?: { barangayId: string; distanceKm: number } | null;
  caseMetric?: 'daily' | 'cumulative';
  caseColorMaximum?: number; animationDurationMs?: number;
  view?: 'qc' | 'philippines' };
const empty = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });

export default function OutbreakMap({ context, snapshot, selected, selectedHospital = '', hotspotIds, rankedHotspotIds, hospitalHotspot, onSelect, onHospital, reducedMotion, showLinks, view = 'qc', caseMetric = 'cumulative', caseColorMaximum = 50, animationDurationMs = 500 }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const onSelectRef = useRef(onSelect), onHospitalRef = useRef(onHospital);
  const labels = useRef<maplibregl.Marker[]>([]);
  const displayedCases = useRef(new Map<string, number>());
  const previousMetric = useRef(caseMetric);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  useEffect(() => { onSelectRef.current = onSelect; onHospitalRef.current = onHospital; }, [onSelect, onHospital]);
  useEffect(() => {
    if (!root.current) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({ container: root.current, center: [121.055, 14.675], zoom: 11.25, pitch: 30,
        style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0b1c2b' } }] } });
    } catch { setError('Map unavailable. Use hotspot and hospital tables.'); return; }
    map.current = instance;
    const resizeObserver = new ResizeObserver(() => instance.resize());
    resizeObserver.observe(root.current);
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
        instance.addLayer({ id: 'selected-shadow', type: 'fill', source: 'qc', filter: ['==', 'ADM4_PCODE', ''], paint: { 'fill-color': '#000000', 'fill-opacity': .55, 'fill-translate': [5, 9] } });
        instance.addLayer({ id: 'selected-raised', type: 'fill-extrusion', source: 'qc', filter: ['==', 'ADM4_PCODE', ''], paint: { 'fill-extrusion-color': '#e89a5c', 'fill-extrusion-height': 160, 'fill-extrusion-base': 20, 'fill-extrusion-opacity': .95 } });
        instance.addLayer({ id: 'selected-outline', type: 'line', source: 'qc', filter: ['==', 'ADM4_PCODE', ''], paint: { 'line-color': '#fff4cf', 'line-width': 4, 'line-translate': [0, -3] } });
        for (const id of ['front', 'proximity', 'placements', 'hospital-link', 'hospitals', 'hotspots', 'particles', 'marker-leaders']) instance.addSource(id, { type: 'geojson', data: empty() });
        instance.addLayer({ id: 'marker-leader-line', type: 'line', source: 'marker-leaders', paint: { 'line-color': '#b8c9ce', 'line-width': 1, 'line-opacity': .65 } });
        instance.addLayer({ id: 'front-line', type: 'line', source: 'front', paint: { 'line-color': '#ffac68', 'line-width': 2, 'line-opacity': .65, 'line-dasharray': [3, 3] } });
        instance.addLayer({ id: 'proximity-casing', type: 'line', source: 'proximity', paint: { 'line-color': '#08131f', 'line-width': ['case', ['get', 'selected'], 9, 5], 'line-opacity': .9 } });
        instance.addLayer({ id: 'placement-casing', type: 'line', source: 'placements', paint: { 'line-color': '#071822', 'line-width': ['case', ['get', 'selected'], 10, 6], 'line-opacity': .85 } });
        instance.addLayer({ id: 'placement-line', type: 'line', source: 'placements', paint: {
          'line-color': ['case', ['>', ['get', 'holding'], 0], '#ffb068', '#52e0d2'],
          'line-width': ['+', ['case', ['get', 'selected'], 3, 0], ['interpolate', ['linear'], ['get', 'patients'], 0, 2, 10, 4, 40, 7]], 'line-opacity': .9 } });
        instance.addLayer({ id: 'proximity-line', type: 'line', source: 'proximity', paint: { 'line-color': '#c9b4ff', 'line-width': ['case', ['get', 'selected'], 5, 2.5], 'line-dasharray': [2, 1.4], 'line-opacity': ['case', ['get', 'selected'], 1, .7] } });
        instance.addLayer({ id: 'hospital-link-casing', type: 'line', source: 'hospital-link', paint: { 'line-color': '#101820', 'line-width': 10 } });
        instance.addLayer({ id: 'hospital-link-line', type: 'line', source: 'hospital-link', paint: { 'line-color': '#ffe09a', 'line-width': 5, 'line-dasharray': [1, 1] } });
        instance.addLayer({ id: 'hotspot-halo', type: 'circle', source: 'hotspots', paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'cases'], 0, 15, 10, 20, 100, 30], 'circle-color': '#ff8d52', 'circle-opacity': .3 } });
        instance.addLayer({ id: 'hotspot-dot', type: 'circle', source: 'hotspots', paint: { 'circle-radius': 8, 'circle-color': '#ff8d52', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff3dd' } });
        instance.addLayer({ id: 'hospital-halo', type: 'circle', source: 'hospitals', paint: { 'circle-radius': ['case', ['get', 'selected'], 18, 10], 'circle-color': ['get', 'color'], 'circle-opacity': .3 } });
        instance.addLayer({ id: 'hospital-dot', type: 'circle', source: 'hospitals', paint: { 'circle-radius': ['case', ['get', 'selected'], 8, 6], 'circle-color': ['get', 'color'], 'circle-stroke-color': '#edf7ff', 'circle-stroke-width': ['case', ['get', 'selected'], 3, 1.5] } });
        instance.addLayer({ id: 'moving-demand', type: 'circle', source: 'particles', paint: { 'circle-color': '#dffff8', 'circle-radius': 3, 'circle-opacity': .9 } });
        instance.on('click', event => {
          const features = instance.queryRenderedFeatures(event.point, { layers: ['hospital-dot', 'hotspot-dot', 'selected-raised', 'barangays'] });
          const selection = mapSelection(features);
          if (selection?.kind === 'hospital') onHospitalRef.current(selection.id);
          if (selection?.kind === 'barangay') onSelectRef.current(selection.id);
        });
        for (const id of ['barangays', 'selected-raised', 'hospital-dot', 'hotspot-dot']) {
          instance.on('mouseenter', id, () => { instance.getCanvas().style.cursor = 'pointer'; });
          instance.on('mouseleave', id, () => { instance.getCanvas().style.cursor = ''; });
        }
        instance.fitBounds([[121.0, 14.585], [121.153, 14.782]], { padding: 35, duration: 0 });
        setReady(true);
      } catch { if (!controller.signal.aborted) setError('Geometry could not load. Use the tables beside the map.'); }
    });
    const labelStore = labels;
    return () => { resizeObserver.disconnect(); controller.abort(); labelStore.current.forEach(label => label.remove()); instance.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    const instance = map.current;
    const set = (id: string, data: FeatureCollection) => (instance.getSource(id) as maplibregl.GeoJSONSource).setData(data);
    if (!context) {
      for (const id of ['front', 'proximity', 'placements', 'hospital-link', 'hospitals', 'hotspots', 'particles', 'marker-leaders']) set(id, empty());
      for (const id of ['selected-shadow', 'selected-raised', 'selected-outline']) instance.setFilter(id, ['==', 'ADM4_PCODE', '']);
      instance.setPaintProperty('barangays', 'fill-color', '#20394c');
      return;
    }
    const values = new Map(snapshot?.barangays.map(b => [b.barangayId, caseMetric === 'daily' ? b.expectedCases : b.cumulativeCases]) ?? []);
    for (const id of ['selected-shadow', 'selected-raised', 'selected-outline']) instance.setFilter(id, ['==', 'ADM4_PCODE', selected]);
    instance.setPaintProperty('boundaries', 'line-width', ['case', ['==', ['get', 'ADM4_PCODE'], selected], 3, .7]);
    instance.setPaintProperty('boundaries', 'line-color', ['case', ['==', ['get', 'ADM4_PCODE'], selected], '#fff3da', '#65899c']);
    const hospitalMap = new Map(context.hospitals.map(h => [h.id, h]));
    const barangayMap = new Map(context.barangays.map(b => [b.id, b]));
    const facilityStats = new Map(snapshot?.facilities.map(h => [h.facilityId, h]) ?? []);
    set('hospitals', { type: 'FeatureCollection', features: context.hospitals.map(h => {
      const stat = facilityStats.get(h.id);
      return { type: 'Feature', geometry: { type: 'Point', coordinates: h.coordinates }, properties: { id: h.id, selected: h.id === selectedHospital,
        color: stat ? stat.holdingCensus > 0 ? '#ff825c' : stat.normalOccupancyPct > 100 ? '#ffc06a' : '#50d7ca' : '#71879a' } };
    }) });
    const rankedIds = [...new Set(hotspotIds ?? snapshot?.hotspotIds ?? [])].filter(id => barangayMap.has(id));
    set('hotspots', { type: 'FeatureCollection', features: rankedIds.map(id => ({ type: 'Feature',
      geometry: { type: 'Point', coordinates: barangayMap.get(id)!.coordinates }, properties: { id, cases: values.get(id) ?? 0 } })) });
    const visible = new Set([...(rankedHotspotIds ?? snapshot?.hotspotIds ?? []), ...(selected ? [selected] : [])]);
    const proximity: FeatureCollection<LineString> = { type: 'FeatureCollection', features: [] };
    if (showLinks) for (const id of visible) {
      const b = barangayMap.get(id);
      const candidates = b ? hospitalConnections(b) : [];
      for (const h of candidates) if (b && hospitalMap.has(h.facilityId)) {
        proximity.features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [b.coordinates, hospitalMap.get(h.facilityId)!.coordinates] }, properties: { selected: id === selected } });
      }
    }
    // Draw selected connections last so other hotspot lines cannot obscure them.
    proximity.features.sort((a, b) => Number(a.properties?.selected) - Number(b.properties?.selected));
    set('proximity', proximity);
    const clickedHospital = hospitalMap.get(selectedHospital), clickedHotspot = barangayMap.get(hospitalHotspot?.barangayId ?? '');
    set('hospital-link', { type: 'FeatureCollection', features: showLinks && clickedHospital && clickedHotspot ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [clickedHospital.coordinates, clickedHotspot.coordinates] }, properties: {} }] : [] });
    const lines: FeatureCollection<LineString> = { type: 'FeatureCollection', features: showLinks ? (snapshot?.assignments ?? []).filter(r => visible.has(r.barangayId)).map(r => ({ type: 'Feature',
      geometry: { type: 'LineString', coordinates: [barangayMap.get(r.barangayId)!.coordinates, hospitalMap.get(r.facilityId)!.coordinates] },
      properties: { patients: r.supportedPlacements + r.holdingPlacements, holding: r.holdingPlacements, selected: r.barangayId === selected } })) : [] };
    set('placements', lines);
    const front: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: snapshot?.expansionRing.length ? [{ type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [snapshot.expansionRing] }, properties: {} }] : [] };
    set('front', front);
    set('particles', empty());
  }, [ready, context, snapshot, selected, selectedHospital, hotspotIds, rankedHotspotIds, hospitalHotspot, showLinks, reducedMotion, caseMetric]);
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance?.getLayer('barangays')) return;
    const active = new Set(rankedHotspotIds ?? hotspotIds ?? snapshot?.hotspotIds ?? []);
    const target = new Map(snapshot?.barangays.map(b => [b.barangayId, caseMetric === 'daily' ? b.expectedCases : b.cumulativeCases]) ?? []);
    const start = new Map(displayedCases.current);
    const changedMeasure = previousMetric.current !== caseMetric;
    previousMetric.current = caseMetric;
    const duration = !snapshot || reducedMotion || changedMeasure ? 0 : animationDurationMs;
    let frame = 0, started: number | undefined;
    instance.setPaintProperty('barangays', 'fill-color-transition', { duration: 0 });
    instance.setPaintProperty('selected-raised', 'fill-extrusion-color-transition', { duration: 0 });
    instance.setPaintProperty('hotspot-halo', 'circle-radius-transition', { duration: 0 });
    const draw = (fraction: number) => {
      const values = interpolateCaseValues(start, target, fraction);
      displayedCases.current = values;
      const colors: unknown[] = ['match', ['get', 'ADM4_PCODE'], '__none__', '#20394c'];
      const radii: unknown[] = ['match', ['get', 'id'], '__none__', 15];
      for (const id of active) {
        const value = values.get(id) ?? 0;
        colors.push(id, snapshot ? caseColor(value, caseColorMaximum) : '#20394c');
        radii.push(id, 15 + 15 * Math.sqrt(Math.min(1, value / caseColorMaximum)));
      }
      colors.push('#20394c'); radii.push(15);
      instance.setPaintProperty('barangays', 'fill-color', colors as maplibregl.ExpressionSpecification);
      instance.setPaintProperty('selected-raised', 'fill-extrusion-color', snapshot && active.has(selected) ? caseColor(values.get(selected) ?? 0, caseColorMaximum) : '#20394c');
      instance.setPaintProperty('hotspot-halo', 'circle-radius', radii as maplibregl.ExpressionSpecification);
    };
    if (!context || !snapshot || !duration) { draw(1); return; }
    const tick = (time: number) => {
      started ??= time;
      const fraction = Math.min(1, (time - started) / duration);
      draw(fraction * fraction * (3 - 2 * fraction));
      if (fraction < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, context, snapshot, selected, caseMetric, caseColorMaximum, rankedHotspotIds, hotspotIds, reducedMotion, animationDurationMs]);
  const markerKey = hotspotIds?.join('|') ?? '';
  const rankKey = rankedHotspotIds?.join('|') ?? '';
  useEffect(() => {
    if (!ready || !map.current || !context) return;
    const instance = map.current;
    const barangayMap = new Map(context.barangays.map(b => [b.id, b]));
    const ids = [...new Set(markerKey.split('|').filter(Boolean))].filter(id => barangayMap.has(id));
    const ranks = rankKey.split('|').filter(Boolean);
    const entries: { id: string; coordinates: [number, number]; size: number; marker: maplibregl.Marker }[] = [];
    const add = (id: string, coordinates: [number, number], size: number, button: HTMLButtonElement) => {
      const marker = new maplibregl.Marker({ element: button, anchor: 'center' }).setLngLat(coordinates).addTo(instance);
      entries.push({ id, coordinates, size, marker });
      labels.current.push(marker);
    };
    for (const id of ids) {
      const b = barangayMap.get(id);
      if (!b) continue;
      const rank = ranks.indexOf(id);
      const button = document.createElement('button');
      button.className = `movie-hotspot-icon${rank < 0 && id !== selected ? ' secondary-hotspot' : ''}`;
      button.textContent = rank >= 0 ? String(rank + 1) : '•';
      button.setAttribute('aria-label', `Inspect modeled demand location: ${b.name}`);
      button.setAttribute('aria-pressed', String(id === selected));
      button.title = 'Modeled hotspot · click for cases and nearest hospital';
      button.onclick = event => { event.stopPropagation(); onSelectRef.current(id); };
      add('b-' + id, b.coordinates, rank >= 0 || id === selected ? 29 : 16, button);
    }
    for (const h of context.hospitals) {
      const button = document.createElement('button');
      button.className = `movie-hospital-icon${h.id === selectedHospital ? ' selected-hospital' : ''}`;
      button.textContent = '✚';
      button.setAttribute('aria-label', `Inspect hospital: ${h.name}`);
      button.setAttribute('aria-pressed', String(h.id === selectedHospital));
      button.title = 'Hospital · click for capacity and nearest hotspot';
      button.onclick = event => { event.stopPropagation(); onHospitalRef.current(h.id); };
      add('h-' + h.id, h.coordinates, h.id === selectedHospital ? 31 : 25, button);
    }
    const position = () => {
      const width = instance.getContainer().clientWidth, height = instance.getContainer().clientHeight;
      if (!width || !height) return;
      const visibleEntries = entries.filter(entry => {
        const point = instance.project(entry.coordinates);
        const visible = point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height;
        entry.marker.getElement().style.visibility = visible ? 'visible' : 'hidden';
        return visible;
      });
      const layout = layoutMapMarkers(visibleEntries.map(entry => {
        const point = instance.project(entry.coordinates);
        return { id: entry.id, x: point.x, y: point.y, size: entry.size };
      }), width, height, [{ left: width - 52, top: 0, width: 52, height: 116 }, { left: 0, top: height - 26, width, height: 26 }]);
      const stems: FeatureCollection<LineString> = { type: 'FeatureCollection', features: [] };
      layout.forEach((point, index) => {
        const entry = visibleEntries[index];
        entry.marker.getElement().style.width = `${point.size}px`;
        entry.marker.getElement().style.height = `${point.size}px`;
        entry.marker.getElement().style.fontSize = `${(entry.id.startsWith('h-') ? 19 : entry.size > 20 ? 12 : 10) * point.scale}px`;
        entry.marker.setOffset(view === 'qc' ? [point.offsetX, point.offsetY] : [0, 0]);
        if (view === 'qc' && Math.hypot(point.offsetX, point.offsetY) > 2) stems.features.push({ type: 'Feature',
          geometry: { type: 'LineString', coordinates: [entry.coordinates, instance.unproject([point.x, point.y]).toArray()] }, properties: {} });
      });
      (instance.getSource('marker-leaders') as maplibregl.GeoJSONSource).setData(stems);
    };
    position();
    instance.on('moveend', position); instance.on('resize', position);
    return () => {
      instance.off('moveend', position); instance.off('resize', position);
      entries.forEach(entry => entry.marker.remove());
      labels.current = [];
    };
  }, [ready, context, markerKey, rankKey, selected, selectedHospital, view]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const points = context ? [...context.barangays, ...context.hospitals].map(place => place.coordinates) : [];
    const bounds: [[number, number], [number, number]] = points.length ? [
      [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1]))],
      [Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))],
    ] : [[121.0, 14.585], [121.153, 14.782]];
    map.current.fitBounds(view === 'philippines' ? [[116.8, 4.3], [126.8, 21.2]] : bounds,
      { padding: view === 'philippines' ? 30 : 50, pitch: view === 'philippines' ? 0 : 30, duration: reducedMotion ? 0 : 650 });
  }, [view, ready, reducedMotion, context]);
  return <div className="outbreak-map" ref={root} aria-label="QC dated place-forecast allocations and hospital demand map">
    {error && <div className="movie-map-error" role="status">{error}</div>}
  </div>;
}
