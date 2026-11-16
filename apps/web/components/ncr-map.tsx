'use client';
import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MapType } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Facility, ScenarioResult } from '@/lib/types';
import { areaBounds, type DashboardMapController, type DashboardMapStatus } from '@/lib/dashboard-map';
import { dashboardLayerPaint } from '@/lib/dashboard-map-style';
import { hospitalMarker } from '@/lib/hospital-marker';

type Props = {
  selectedArea: string;
  onAreaSelect: (area: string) => void;
  facilities: Facility[];
  onFacilitySelect: (f: Facility) => void;
  selectedFacilityId?: string;
  showBoundaries?: boolean;
  buildings3d?: boolean;
  activeWeek?: number;
  result?: ScenarioResult | null;
  onReady?: (controller: DashboardMapController | null) => void;
  onStatus?: (status: DashboardMapStatus) => void;
};

export default function NCRMap({ selectedArea, onAreaSelect, facilities, onFacilitySelect,
  selectedFacilityId, showBoundaries = true, buildings3d = false, onReady, onStatus }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapType | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const boundaries = useRef<unknown>(null);
  const callbacks = useRef({ onAreaSelect, onFacilitySelect, onReady, onStatus });
  callbacks.current = { onAreaSelect, onFacilitySelect, onReady, onStatus };
  const selection = useRef({ selectedArea, selectedFacilityId, showBoundaries, buildings3d });
  selection.current = { selectedArea, selectedFacilityId, showBoundaries, buildings3d };
  const applyAppearance = useRef<(() => void) | null>(null);
  const selectedRecord = useRef<Facility | undefined>(undefined);
  // Keep the selected point inspectable even when a filter hides its marker.
  selectedRecord.current = facilities.find(f => f.id === selectedFacilityId) ?? selectedRecord.current;

  useEffect(() => {
    if (!root.current || mapRef.current) return;
    let map: MapType;
    try {
      map = new maplibregl.Map({
        container: root.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [121.05, 14.68], zoom: 11.2,
        maxPitch: 60,
      });
    } catch {
      callbacks.current.onStatus?.('unavailable');
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 95, unit: 'metric' }), 'bottom-left');
    const abort = new AbortController();
    let disposed = false;
    let openingTimeout = 0;
    const duration = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650;
    function focusArea(area: string) {
      const bounds = areaBounds(boundaries.current, area);
      if (bounds) map.fitBounds(bounds, { padding: 65, duration: duration(), maxZoom: 12.4,
        pitch: selection.current.buildings3d ? 50 : 0, bearing: 0 });
    }
    callbacks.current.onReady?.({ focusArea, zoomIn: () => map.zoomIn({ duration: duration() }), zoomOut: () => map.zoomOut({ duration: duration() }) });
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(root.current);
    const timeout = window.setTimeout(() => {
      if (!map.isStyleLoaded()) callbacks.current.onStatus?.('unavailable');
    }, 15000);
    map.on('error', () => {
      if (!map.isStyleLoaded()) callbacks.current.onStatus?.('unavailable');
    });
    // Apply the whole palette before tiles finish painting, rather than leaving
    // the provider's yellow roads, pink land-use and bright blue water in place.
    map.on('style.load', () => {
      for (const layer of map.getStyle().layers) {
        for (const [property, value] of Object.entries(dashboardLayerPaint(layer))) map.setPaintProperty(layer.id, property, value);
        if ('source-layer' in layer && layer['source-layer'] === 'poi') map.setLayoutProperty(layer.id, 'visibility', 'none');
      }
    });
    map.on('load', async () => {
      window.clearTimeout(timeout);
      // These are cartographic buildings from OSM, not hospital facility models.
      if (map.getLayer('building')) {
        map.setLayerZoomRange('building', 13, 24);
      }
      applyAppearance.current = () => {
        const tilt = selection.current.buildings3d;
        if (map.getLayer('building-3d')) map.setLayoutProperty('building-3d', 'visibility', tilt ? 'visible' : 'none');
        if (map.getLayer('building')) map.setLayoutProperty('building', 'visibility', tilt ? 'none' : 'visible');
        map.easeTo({ pitch: tilt ? 50 : 0, bearing: 0, duration: duration() });
      };
      applyAppearance.current();
      try {
        const response = await fetch('/api/boundaries', { signal: abort.signal });
        if (!response.ok) throw Error('Boundary response unavailable');
        const data = await response.json();
        if (disposed) return;
        if (!areaBounds(data, 'QUEZON_CITY')) throw Error('QC geometry unavailable');
        boundaries.current = data;
        map.addSource('ncr-boundaries', { type: 'geojson', data, promoteId: 'area_id' });
        map.addLayer({ id: 'ncr-fill', type: 'fill', source: 'ncr-boundaries',
          layout: { visibility: selection.current.showBoundaries ? 'visible' : 'none' },
          paint: { 'fill-color': ['case', ['==', ['get', 'area_id'], selection.current.selectedArea], '#32a69a', '#8ea5b0'], 'fill-opacity': ['case', ['==', ['get', 'area_id'], selection.current.selectedArea], 0.12, 0.035] } });
        map.addLayer({ id: 'ncr-border', type: 'line', source: 'ncr-boundaries',
          layout: { visibility: selection.current.showBoundaries ? 'visible' : 'none' },
          paint: { 'line-color': '#248e86', 'line-width': ['case', ['==', ['get', 'area_id'], selection.current.selectedArea], 2.2, 0.8] } });
        map.on('click', 'ncr-fill', event => {
          const id = event.features?.[0]?.properties?.area_id;
          if (typeof id === 'string') callbacks.current.onAreaSelect(id);
        });
        map.on('mouseenter', 'ncr-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'ncr-fill', () => { map.getCanvas().style.cursor = ''; });
        focusArea(selection.current.selectedArea);
        let revealed = false;
        const reveal = () => {
          if (disposed || revealed) return;
          revealed = true; window.clearTimeout(openingTimeout); map.off('idle', reveal);
          callbacks.current.onStatus?.('ready');
        };
        map.once('idle', reveal);
        openingTimeout = window.setTimeout(reveal, 8000);
      } catch {
        if (!disposed) callbacks.current.onStatus?.('partial');
      }
    });
    return () => {
      disposed = true; abort.abort(); window.clearTimeout(timeout); window.clearTimeout(openingTimeout); observer.disconnect();
      callbacks.current.onReady?.(null);
      markers.current.forEach(marker => marker.remove()); markers.current = [];
      applyAppearance.current = null; map.remove(); mapRef.current = null; boundaries.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer('ncr-fill')) return;
    map.setPaintProperty('ncr-fill', 'fill-color', ['case', ['==', ['get', 'area_id'], selectedArea], '#32a69a', '#8ea5b0']);
    map.setPaintProperty('ncr-fill', 'fill-opacity', ['case', ['==', ['get', 'area_id'], selectedArea], 0.12, 0.035]);
    map.setPaintProperty('ncr-border', 'line-width', ['case', ['==', ['get', 'area_id'], selectedArea], 2.2, 0.8]);
    const bounds = areaBounds(boundaries.current, selectedArea);
    if (bounds) map.fitBounds(bounds, { padding: 65, maxZoom: 12.4,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650 });
  }, [selectedArea]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const id of ['ncr-fill', 'ncr-border']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', showBoundaries ? 'visible' : 'none');
    }
  }, [showBoundaries]);

  useEffect(() => { applyAppearance.current?.(); }, [buildings3d]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markers.current.forEach(marker => marker.remove());
    markers.current = [];
    for (const f of facilities) {
      if (f.longitude === null || f.latitude === null || !Number.isFinite(f.longitude) || !Number.isFinite(f.latitude)) continue;
      const selected = f.id === selectedFacilityId;
      const element = hospitalMarker(f.name, selected);
      element.addEventListener('click', event => { event.stopPropagation(); callbacks.current.onFacilitySelect(f); });
      markers.current.push(new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat([f.longitude, f.latitude]).addTo(map));
    }
  }, [facilities, selectedFacilityId]);

  useEffect(() => {
    const map = mapRef.current, f = selectedRecord.current;
    if (!map || !selectedFacilityId || f?.id !== selectedFacilityId || f.longitude === null || f.latitude === null) return;
    map.easeTo({ center: [f.longitude, f.latitude], zoom: Math.max(map.getZoom(), selection.current.buildings3d ? 16 : 14.8),
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700 });
  }, [selectedFacilityId]);

  return <div ref={root} className="map db-map" aria-label="NCR geography and provisional QC hospital points" />;
}
