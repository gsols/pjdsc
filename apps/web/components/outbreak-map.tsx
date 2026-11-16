'use client';
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { FeatureCollection, Polygon } from 'geojson';
import type { MovieContext, MovieDay } from '@/lib/outbreak-types';
import 'maplibre-gl/dist/maplibre-gl.css';
import { caseColor, interpolateCaseValues } from '@/lib/case-bands';
import { mapSelection } from '@/lib/map-selection';
import { simulationConnections, drawSimulationFlow, SIMULATION_LINES, type ConnectionFocus } from '@/lib/simulation-connections';
import { layoutMapMarkers } from '@/lib/marker-layout';
import { dashboardLayerPaint } from '@/lib/dashboard-map-style';
import { areaBounds } from '@/lib/dashboard-map';
import { hospitalMarker } from '@/lib/hospital-marker';
import WorkspaceLoader from '@/components/workspace-loader';
import { simulationMapPadding, selectionMapBounds, type SimulationBounds, type SimulationMapController, type SimulationMapStatus } from '@/lib/simulation-map';

type Props = { context: MovieContext | null; snapshot: MovieDay | null; maximum: number; selected: string;
  onSelect: (id: string) => void; onHospital: (id: string) => void; playing: boolean; reducedMotion: boolean; showLinks: boolean;
  selectedHospital?: string; hotspotIds?: string[]; rankedHotspotIds?: string[]; hospitalHotspot?: { barangayId: string; distanceKm: number } | null;
  caseMetric?: 'daily' | 'cumulative';
  caseColorMaximum?: number; animationDurationMs?: number;
  connectionFocus?: ConnectionFocus; inspectionVersion?: number;
  buildings3d?: boolean; showHospitals?: boolean;
  onReady?: (controller: SimulationMapController | null) => void;
  onStatus?: (status: SimulationMapStatus) => void;
  view?: 'qc' | 'philippines' };
// Fill for barangays that are not high-burden candidates (and before values are shown).
// Keep in sync with the literal in the 'barangays' layer (layer objects are validated as plain literals).
const NEUTRAL_FILL = '#edf1ee';
const empty = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });
// Floating page panels drawn over the map (marked data-map-overlay) are kept free of map icons.
const overlayElements = (mapRoot: HTMLElement | null) => {
  const container =
    mapRoot?.closest('[data-map-fullscreen]') ?? mapRoot?.parentElement;
  return [...(container?.querySelectorAll<HTMLElement>('[data-map-overlay]') ?? [])];
};
const overlayRects = (mapRoot: HTMLElement | null) => {
  const origin = mapRoot?.getBoundingClientRect();
  if (!origin) return [];
  return overlayElements(mapRoot).map(element => element.getBoundingClientRect()).filter(rect => rect.width && rect.height)
    .map(rect => ({ left: rect.left - origin.left - 4, top: rect.top - origin.top - 4, width: rect.width + 8, height: rect.height + 8 }));
};

export default function OutbreakMap({ context, snapshot, selected, selectedHospital = '', hotspotIds, rankedHotspotIds, hospitalHotspot, onSelect, onHospital, reducedMotion, showLinks, connectionFocus = null, inspectionVersion = 0, view = 'qc', caseMetric = 'cumulative', caseColorMaximum = 50, animationDurationMs = 500, buildings3d = false, showHospitals = true, onReady, onStatus }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const onSelectRef = useRef(onSelect), onHospitalRef = useRef(onHospital);
  const labels = useRef<maplibregl.Marker[]>([]);
  const visualMarkers = useRef(new Map<string, maplibregl.Marker>());
  const flowRoot = useRef<SVGSVGElement>(null);
  const flowClock = useRef({ key: '', start: 0 });
  const updateFlow = useRef<(() => void) | null>(null);
  const barangayBounds = useRef(new Map<string, SimulationBounds>());
  const selectionCameraInput = useRef({ context, snapshot, selected, selectedHospital, connectionFocus, hotspotIds, rankedHotspotIds, hospitalHotspot });
  selectionCameraInput.current = { context, snapshot, selected, selectedHospital, connectionFocus, hotspotIds, rankedHotspotIds, hospitalHotspot };
  const displayedCases = useRef(new Map<string, number>());
  const previousMetric = useRef(caseMetric);
  const options = useRef({ view, reducedMotion, buildings3d, showHospitals, onReady, onStatus });
  options.current = { view, reducedMotion, buildings3d, showHospitals, onReady, onStatus };
  const resetCamera = useRef<(() => void) | null>(null);
  const initialCameraReady = useRef(false);
  const initialBounds = useRef<SimulationBounds>([[121.0, 14.585], [121.153, 14.782]]);
  const introducedMarkers = useRef(false);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const [presented, setPresented] = useState(false);
  useEffect(() => { onSelectRef.current = onSelect; onHospitalRef.current = onHospital; }, [onSelect, onHospital]);
  useEffect(() => {
    if (!root.current) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({ container: root.current, center: [121.055, 14.675], zoom: 11.25, pitch: 0, maxPitch: 60,
        style: 'https://tiles.openfreemap.org/styles/liberty' });
    } catch { setError('Map unavailable. Use the result tables.'); options.current.onStatus?.('unavailable'); return; }
    map.current = instance;
    const resizeObserver = new ResizeObserver(() => instance.resize());
    resizeObserver.observe(root.current);
    instance.addControl(new maplibregl.ScaleControl({ maxWidth: 95, unit: 'metric' }), 'bottom-left');
    options.current.onReady?.({ resetView: () => resetCamera.current?.(),
      zoomIn: () => instance.zoomIn({ duration: options.current.reducedMotion ? 0 : 300 }),
      zoomOut: () => instance.zoomOut({ duration: options.current.reducedMotion ? 0 : 300 }) });
    const controller = new AbortController();
    let loaded = false;
    const unavailable = () => {
      if (!loaded) { setError('Map unavailable. Open the result tables.'); options.current.onStatus?.('unavailable'); }
    };
    const timeout = window.setTimeout(unavailable, 15000);
    instance.on('error', unavailable);
    instance.on('style.load', () => {
      for (const layer of instance.getStyle().layers) {
        for (const [property, value] of Object.entries(dashboardLayerPaint(layer))) instance.setPaintProperty(layer.id, property, value);
        if ('source-layer' in layer && layer['source-layer'] === 'poi') instance.setLayoutProperty(layer.id, 'visibility', 'none');
      }
      if (instance.getLayer('building')) instance.setLayerZoomRange('building', 13, 24);
      if (instance.getLayer('building-3d')) instance.setLayoutProperty('building-3d', 'visibility', options.current.buildings3d ? 'visible' : 'none');
      if (instance.getLayer('building')) instance.setLayoutProperty('building', 'visibility', options.current.buildings3d ? 'none' : 'visible');
    });
    instance.on('load', async () => {
      loaded = true; window.clearTimeout(timeout);
      try {
        const response = await fetch('/data/qc-barangays.geojson', { signal: controller.signal });
        if (!response.ok) throw Error();
        const data = await response.json();
        if (controller.signal.aborted) return;
        const bounds = areaBounds(data, 'NCR');
        if (!bounds) throw Error('QC camera geometry unavailable');
        initialBounds.current = bounds;
        for (const feature of data.features) {
          const id = feature.properties?.ADM4_PCODE;
          if (typeof id !== 'string') continue;
          const bounds = areaBounds({ features: [{ geometry: feature.geometry, properties: { area_id: id } }] }, id);
          if (bounds) barangayBounds.current.set(id, bounds);
        }
        const countryResponse = await fetch('/data/philippines-context.geojson', { signal: controller.signal });
        if (!countryResponse.ok) throw Error();
        const country = await countryResponse.json();
        if (controller.signal.aborted) return;
        instance.addSource('country-context', { type: 'geojson', data: country });
        instance.addLayer({ id: 'country-land', type: 'fill', source: 'country-context', paint: { 'fill-color': '#f8fdf7', 'fill-opacity': 0 } });
        instance.addLayer({ id: 'country-outline', type: 'line', source: 'country-context', paint: { 'line-color': '#93aaa2', 'line-width': .65 } });
        instance.addSource('qc', { type: 'geojson', data, promoteId: 'ADM4_PCODE' });
        instance.addLayer({ id: 'barangays', type: 'fill', source: 'qc', paint: { 'fill-color': '#edf1ee', 'fill-opacity': .63, 'fill-color-transition': { duration: 300 } } });
        instance.addLayer({ id: 'boundaries', type: 'line', source: 'qc', paint: { 'line-color': '#a3bcb0', 'line-width': .7, 'line-opacity': .65 } });
        instance.addLayer({ id: 'selected-shadow', type: 'fill', source: 'qc', filter: ['==', 'ADM4_PCODE', ''], paint: { 'fill-color': '#225d61', 'fill-opacity': .07, 'fill-translate': [1, 2] } });
        instance.addLayer({ id: 'selected-raised', type: 'fill-extrusion', source: 'qc', filter: ['==', 'ADM4_PCODE', ''], paint: { 'fill-extrusion-color': '#9c522e', 'fill-extrusion-height': 24, 'fill-extrusion-base': 0, 'fill-extrusion-opacity': .75 } });
        instance.addLayer({ id: 'selected-outline', type: 'line', source: 'qc', filter: ['==', 'ADM4_PCODE', ''], paint: { 'line-color': '#225d61', 'line-width': 1.2 } });
        for (const id of ['front', 'hospitals', 'hotspots']) instance.addSource(id, { type: 'geojson', data: empty() });
        instance.addLayer({ id: 'front-line', type: 'line', source: 'front', paint: { 'line-color': SIMULATION_LINES.front.color, 'line-width': SIMULATION_LINES.front.width, 'line-opacity': .65, 'line-dasharray': [...SIMULATION_LINES.front.dash] } });
        instance.addLayer({ id: 'hotspot-halo', type: 'circle', source: 'hotspots', paint: { 'circle-radius': 0, 'circle-color': '#829b90', 'circle-opacity': 0 } });
        instance.addLayer({ id: 'hotspot-dot', type: 'circle', source: 'hotspots', filter: ['==', 'id', ''], paint: { 'circle-radius': 2, 'circle-color': '#829b90', 'circle-stroke-width': 0 } });
        // Source point layers stay hidden; interaction uses the visible DOM pins.
        // Capacity pressure belongs to the selected hospital's scenario details.
        instance.addLayer({ id: 'hospital-halo', type: 'circle', source: 'hospitals', paint: { 'circle-radius': 0, 'circle-color': '#829b90', 'circle-opacity': 0 } });
        instance.addLayer({ id: 'hospital-dot', type: 'circle', source: 'hospitals', filter: ['==', 'id', ''], paint: { 'circle-radius': 2, 'circle-color': '#829b90', 'circle-stroke-width': 0 } });
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
        setReady(true);
        setError('');
      } catch { if (!controller.signal.aborted) { setError('Geography could not load. Open the result tables.'); options.current.onStatus?.('partial'); } }
    });
    const labelStore = labels;
    return () => { window.clearTimeout(timeout); resizeObserver.disconnect(); controller.abort(); labelStore.current.forEach(label => label.remove()); options.current.onReady?.(null); resetCamera.current = null; instance.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    const instance = map.current;
    const set = (id: string, data: FeatureCollection) => (instance.getSource(id) as maplibregl.GeoJSONSource).setData(data);
    if (!context) {
      for (const id of ['front', 'hospitals', 'hotspots']) set(id, empty());
      for (const id of ['selected-shadow', 'selected-raised', 'selected-outline']) instance.setFilter(id, ['==', 'ADM4_PCODE', '']);
      instance.setPaintProperty('barangays', 'fill-color', NEUTRAL_FILL);
      return;
    }
    const values = new Map(snapshot?.barangays.map(b => [b.barangayId, caseMetric === 'daily' ? b.expectedCases : b.cumulativeCases]) ?? []);
    for (const id of ['selected-shadow', 'selected-raised', 'selected-outline']) instance.setFilter(id, ['==', 'ADM4_PCODE', selected]);
    instance.setPaintProperty('boundaries', 'line-width', ['case', ['==', ['get', 'ADM4_PCODE'], selected], 1.2, .65]);
    instance.setPaintProperty('boundaries', 'line-color', ['case', ['==', ['get', 'ADM4_PCODE'], selected], '#225d61', '#a3bcb0']);
    const barangayMap = new Map(context.barangays.map(b => [b.id, b]));
    const facilityStats = new Map(snapshot?.facilities.map(h => [h.facilityId, h]) ?? []);
    set('hospitals', { type: 'FeatureCollection', features: context.hospitals.map(h => {
      const stat = facilityStats.get(h.id);
      return { type: 'Feature', geometry: { type: 'Point', coordinates: h.coordinates }, properties: { id: h.id, selected: h.id === selectedHospital,
        color: stat ? stat.holdingCensus > 0 ? '#9c522e' : stat.normalOccupancyPct > 100 ? '#deb65d' : '#347d77' : '#adbbbe' } };
    }) });
    const rankedIds = [...new Set(hotspotIds ?? snapshot?.hotspotIds ?? [])].filter(id => barangayMap.has(id));
    set('hotspots', { type: 'FeatureCollection', features: rankedIds.map(id => ({ type: 'Feature',
      geometry: { type: 'Point', coordinates: barangayMap.get(id)!.coordinates }, properties: { id, cases: values.get(id) ?? 0 } })) });
    const front: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: snapshot?.expansionRing.length ? [{ type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [snapshot.expansionRing] }, properties: {} }] : [] };
    set('front', front);
  }, [ready, context, snapshot, selected, selectedHospital, hotspotIds, rankedHotspotIds, hospitalHotspot, showLinks, connectionFocus, showHospitals, reducedMotion, caseMetric]);
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
      const colors: unknown[] = ['match', ['get', 'ADM4_PCODE'], '__none__', NEUTRAL_FILL];
      const radii: unknown[] = ['match', ['get', 'id'], '__none__', 15];
      for (const id of active) {
        const value = values.get(id) ?? 0;
        colors.push(id, snapshot ? caseColor(value, caseColorMaximum) : NEUTRAL_FILL);
        radii.push(id, 15 + 15 * Math.sqrt(Math.min(1, value / caseColorMaximum)));
      }
      colors.push(NEUTRAL_FILL); radii.push(15);
      instance.setPaintProperty('barangays', 'fill-color', colors as maplibregl.ExpressionSpecification);
      instance.setPaintProperty('selected-raised', 'fill-extrusion-color', snapshot && active.has(selected) ? caseColor(values.get(selected) ?? 0, caseColorMaximum) : NEUTRAL_FILL);
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
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    if (instance.getLayer('building-3d')) instance.setLayoutProperty('building-3d', 'visibility', buildings3d ? 'visible' : 'none');
    if (instance.getLayer('building')) instance.setLayoutProperty('building', 'visibility', buildings3d ? 'none' : 'visible');
    for (const id of ['hospital-halo', 'hospital-dot']) instance.setLayoutProperty(id, 'visibility', showHospitals ? 'visible' : 'none');
    instance.easeTo({ pitch: view === 'philippines' ? 0 : buildings3d ? 50 : 0, bearing: 0, duration: reducedMotion ? 0 : 450 });
  }, [ready, buildings3d, showHospitals, reducedMotion, view]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const fit = (immediate = false) => {
      if (!map.current) return;
      map.current.resize();
      const padding = simulationMapPadding(root.current?.clientWidth ?? 320, root.current?.clientHeight ?? 640, overlayRects(root.current));
      map.current.fitBounds(view === 'philippines' ? [[116.8, 4.3], [126.8, 21.2]] : initialBounds.current,
        { padding: view === 'philippines' ? 30 : padding, pitch: view === 'philippines' ? 0 : options.current.buildings3d ? 50 : 0, bearing: 0, duration: immediate || reducedMotion ? 0 : 650 });
    };
    resetCamera.current = fit;
    // Official geometry determines the opening camera independently of engine
    // timing. Fit and resize before constructing any collision-offset markers.
    fit(!initialCameraReady.current);
    initialCameraReady.current = true;
  }, [view, ready, reducedMotion]);
  const markerKey = hotspotIds?.join('|') ?? '';
  const rankKey = rankedHotspotIds?.join('|') ?? '';
  const relatedBarangayKey = context && connectionFocus === 'hospital' && showHospitals
    ? [...new Set(simulationConnections(context, snapshot, { selected, selectedHospital, focus: 'hospital', hotspotIds: rankedHotspotIds ?? hotspotIds, hospitalHotspot, showOverview: false }).map(c => c.barangayId))].join('|') : '';
  useEffect(() => {
    if (!ready || !map.current || !context) return;
    const instance = map.current;
    const barangayMap = new Map(context.barangays.map(b => [b.id, b]));
    const markerStore = visualMarkers.current;
    const ids = [...new Set([...markerKey.split('|').filter(Boolean), ...relatedBarangayKey.split('|').filter(Boolean), ...(connectionFocus === 'barangay' && selected ? [selected] : [])])].filter(id => barangayMap.has(id));
    const ranks = rankKey.split('|').filter(Boolean);
    const entries: { id: string; coordinates: [number, number]; size: number; marker: maplibregl.Marker }[] = [];
    const introduce = !introducedMarkers.current;
    const add = (id: string, coordinates: [number, number], size: number, button: HTMLButtonElement) => {
      button.style.visibility = 'hidden';
      if (introduce) button.className += ' qs-marker-intro';
      const marker = new maplibregl.Marker({ element: button, anchor: 'center' }).setLngLat(coordinates).addTo(instance);
      entries.push({ id, coordinates, size, marker });
      labels.current.push(marker);
      markerStore.set(id, marker);
    };
    for (const id of ids) {
      const b = barangayMap.get(id);
      if (!b) continue;
      const rank = ranks.indexOf(id);
      const button = document.createElement('button');
      button.className = `movie-hotspot-icon${rank < 0 ? ' secondary-hotspot' : ''}`;
      button.dataset.barangayId = id;
      const symbol = document.createElement('span'); symbol.className = 'qs-ranked-symbol';
      symbol.textContent = rank >= 0 ? String(rank + 1) : '•'; symbol.setAttribute('aria-hidden', 'true'); button.append(symbol);
      button.setAttribute('aria-label', `Inspect modeled demand location: ${b.name}`);
      button.setAttribute('aria-pressed', String(id === selected));
      const label = document.createElement('span'); label.className = 'qs-marker-label';
      label.textContent = `${b.name} · annual projected-burden rank ${rank >= 0 ? rank + 1 : 'unranked'}`;
      label.setAttribute('aria-hidden', 'true'); button.append(label);
      button.onclick = event => { event.stopPropagation(); onSelectRef.current(id); };
      add('b-' + id, b.coordinates, rank >= 0 ? 29 : id === selected ? 21 : 16, button);
    }
    for (const h of showHospitals ? context.hospitals : []) {
      const button = hospitalMarker(h.name, h.id === selectedHospital, reducedMotion);
      button.dataset.facilityId = h.id;
      button.onclick = event => { event.stopPropagation(); onHospitalRef.current(h.id); };
      add('h-' + h.id, h.coordinates, 34, button);
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
      }), width, height, [{ left: width - 52, top: 0, width: 52, height: 156 }, ...overlayRects(root.current), { left: 0, top: height - 26, width, height: 26 }]);
      layout.forEach((point, index) => {
        const entry = visibleEntries[index];
        entry.marker.getElement().style.width = `${entry.id.startsWith('h-') ? point.size * 28 / 34 : point.size}px`;
        entry.marker.getElement().style.height = `${point.size}px`;
        entry.marker.getElement().style.fontSize = `${(entry.id.startsWith('h-') ? 19 : entry.size > 20 ? 12 : 10) * point.scale}px`;
        entry.marker.setOffset(view === 'qc' ? [point.offsetX, point.offsetY] : [0, 0]);
      });
      updateFlow.current?.();
    };
    position();
    if (entries.length) introducedMarkers.current = true;
    instance.on('moveend', position); instance.on('resize', position);
    // Re-run the layout when a floating panel is minimized or expanded.
    const overlayObserver = new ResizeObserver(() => position());
    overlayElements(root.current).forEach(element => overlayObserver.observe(element));
    return () => {
      overlayObserver.disconnect();
      instance.off('moveend', position); instance.off('resize', position);
      entries.forEach(entry => entry.marker.remove());
      markerStore.clear();
      labels.current = [];
    };
  }, [ready, context, markerKey, rankKey, relatedBarangayKey, selected, selectedHospital, connectionFocus, view, showHospitals, reducedMotion]);
  useEffect(() => {
    const instance = map.current, svg = flowRoot.current;
    if (!ready || !instance || !svg || !context || (!connectionFocus && !showLinks) || !showHospitals) return;
    const connectionOptions = { selected, selectedHospital, hotspotIds: rankedHotspotIds ?? hotspotIds, hospitalHotspot };
    const connections = [...new Map([
      ...simulationConnections(context, snapshot, { ...connectionOptions, focus: null, showOverview: showLinks }),
      ...(connectionFocus ? simulationConnections(context, snapshot, { ...connectionOptions, focus: connectionFocus, showOverview: false }) : []),
    ].map(connection => [connection.id, connection])).values()];
    const key = `${connectionFocus}:${selected}:${selectedHospital}:${inspectionVersion}:${showLinks}`;
    if (flowClock.current.key !== key) flowClock.current = { key, start: performance.now() };
    const project = (id: string, coordinates: [number, number]) => {
      const point = instance.project(coordinates), offset = visualMarkers.current.get(id)?.getOffset();
      return { x: point.x + (offset?.x ?? 0), y: point.y + (offset?.y ?? 0) };
    };
    const flow = drawSimulationFlow(svg, connections, project, reducedMotion, flowClock.current.start);
    updateFlow.current = flow.update;
    instance.on('move', flow.update); instance.on('moveend', flow.update); instance.on('resize', flow.update);
    return () => { instance.off('move', flow.update); instance.off('moveend', flow.update); instance.off('resize', flow.update); updateFlow.current = null; flow.destroy(); };
  }, [ready, context, snapshot, selected, selectedHospital, connectionFocus, inspectionVersion, rankedHotspotIds, hotspotIds, hospitalHotspot, showHospitals, reducedMotion, view, showLinks]);
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    let disposed = false, revealed = false, frame = 0, timeout = 0;
    const reveal = () => {
      if (disposed || revealed) return;
      revealed = true; window.clearTimeout(timeout); instance.off('idle', reveal);
      setPresented(true);
      options.current.onStatus?.('ready');
    };
    // Idle follows the opening fit, source updates and first marker layout.
    // Do not expose the default camera or partially painted tile transitions.
    instance.once('idle', reveal);
    if (instance.loaded()) frame = requestAnimationFrame(reveal);
    timeout = window.setTimeout(reveal, 8000);
    return () => { disposed = true; instance.off('idle', reveal); cancelAnimationFrame(frame); window.clearTimeout(timeout); };
  }, [ready]);
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !connectionFocus) return;
    // Read the saved day at the click. Playback changes must never recenter the
    // user's camera. Wait one frame for the inspector's layout and map resize.
    const frame = requestAnimationFrame(() => {
      const input = selectionCameraInput.current;
      if (!input.context) return;
      const primary = connectionFocus === 'hospital'
        ? input.context.hospitals.find(h => h.id === selectedHospital)
        : input.context.barangays.find(b => b.id === selected);
      if (!primary) return;
      const connections = options.current.showHospitals ? simulationConnections(input.context, input.snapshot, {
        selected, selectedHospital, focus: connectionFocus, hotspotIds: input.rankedHotspotIds ?? input.hotspotIds,
        hospitalHotspot: input.hospitalHotspot, showOverview: false }) : [];
      const bounds = selectionMapBounds([primary.coordinates, ...connections.flatMap(c => [c.from, c.to])], connectionFocus === 'barangay' ? barangayBounds.current.get(selected) : undefined);
      if (!bounds) return;
      instance.stop(); instance.resize();
      const padding = simulationMapPadding(root.current?.clientWidth ?? 320, root.current?.clientHeight ?? 640, overlayRects(root.current));
      instance.fitBounds(bounds, { padding, maxZoom: 14.5, duration: options.current.reducedMotion ? 0 : 850,
        essential: false, pitch: options.current.view === 'philippines' ? 0 : options.current.buildings3d ? 50 : 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, connectionFocus, selected, selectedHospital, inspectionVersion]);
  return <div className="outbreak-map" ref={root} data-presented={presented || Boolean(error)} aria-busy={!presented && !error} aria-label="QC dated place-forecast allocations and hospital demand map">
    <WorkspaceLoader active={!presented && !error} label="Preparing simulation map" />
    <svg className="qs-flow-overlay" ref={flowRoot} aria-hidden="true" focusable="false" />
    {error && <div className="movie-map-error" role="status">{error}</div>}
  </div>;
}
