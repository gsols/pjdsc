'use client';
import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MapType } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Facility, ScenarioResult } from '@/lib/types';
type Props = {
  selectedArea: string;
  onAreaSelect: (area: string) => void;
  facilities: Facility[];
  onFacilitySelect: (f: Facility) => void;
  activeWeek: number;
  result: ScenarioResult | null;
};
const BOUNDARIES = '/api/boundaries';
function cityName(p: Record<string, unknown>): string {
  return String(
    p.NAME_2 ||
      p.MUNICITY ||
      p.name ||
      p.NAME_1 ||
      p.city ||
      p.ADM3_EN ||
      'Unknown city'
  );
}
function normalize(n: string) {
  return n
    .toUpperCase()
    .replace(/^(CITY OF |CITY OF THE )/, '')
    .replace(/ CITY$/, '')
    .trim();
}
export default function NCRMap({
  selectedArea,
  onAreaSelect,
  facilities,
  onFacilitySelect,
  activeWeek,
  result,
}: Props) {
  const root = useRef<HTMLDivElement>(null),
    mapRef = useRef<MapType | null>(null),
    markers = useRef<maplibregl.Marker[]>([]);
  const onArea = useRef(onAreaSelect);
  const onFacility = useRef(onFacilitySelect);
  useEffect(() => {
    onArea.current = onAreaSelect;
    onFacility.current = onFacilitySelect;
  }, [onAreaSelect, onFacilitySelect]);
  useEffect(() => {
    if (!root.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: root.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [121.03, 14.64],
      zoom: 10.1,
    });
    map.addControl(new maplibregl.NavigationControl(), 'bottom-left');
    map.on('load', async () => {
      try {
        const response = await fetch(BOUNDARIES);
        if (!response.ok) throw Error('Boundaries not available');
        const data = await response.json();
        map.addSource('ncr-boundaries', {
          type: 'geojson',
          data,
          promoteId: 'area_id',
        });
        map.addLayer({
          id: 'ncr-fill',
          type: 'fill',
          source: 'ncr-boundaries',
          paint: {
            'fill-color': [
              'case',
              ['==', ['get', 'area_id'], 'QUEZON_CITY'],
              '#2c9e91',
              '#566a7a',
            ],
            'fill-opacity': 0.24,
          },
        });
        map.addLayer({
          id: 'ncr-border',
          type: 'line',
          source: 'ncr-boundaries',
          paint: { 'line-color': '#b8dfe3', 'line-width': 1.25 },
        });
        map.on('click', 'ncr-fill', (e) => {
          const p = e.features?.[0]?.properties;
          if (!p) return;
          onArea.current(p.area_id || normalize(cityName(p)));
        });
        map.on(
          'mouseenter',
          'ncr-fill',
          () => (map.getCanvas().style.cursor = 'pointer')
        );
        map.on(
          'mouseleave',
          'ncr-fill',
          () => (map.getCanvas().style.cursor = '')
        );
      } catch (e) {
        console.warn('NCR boundaries unavailable', e);
      }
    });
    mapRef.current = map;
    return () => {
      markers.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      if (map.getLayer('ncr-fill'))
        map.setPaintProperty('ncr-fill', 'fill-color', [
          'case',
          ['==', ['get', 'area_id'], selectedArea],
          '#2ac8b0',
          ['==', ['get', 'area_id'], 'QUEZON_CITY'],
          '#2c9e91',
          '#566a7a',
        ]);
    };
    if (map.isStyleLoaded()) update();
    else map.once('load', update);
  }, [selectedArea]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    for (const f of facilities) {
      if (
        f.longitude === null ||
        f.latitude === null ||
        !Number.isFinite(f.longitude) ||
        !Number.isFinite(f.latitude)
      )
        continue;
      const res = result?.facilityResults.find(
        (r) => r.facilityId === f.id && r.week === activeWeek
      );
      const color =
        f.coordinateStatus === 'PROVISIONAL_HISTORICAL_MATCH'
          ? '#ffb45d'
          : res?.capacityGap && res.capacityGap > 0
            ? '#ef6666'
            : res?.availablePct !== null &&
                res?.availablePct !== undefined &&
                res.availablePct <= 20
              ? '#f6ad55'
              : '#51d0bb';
      const el = document.createElement('button');
      el.type = 'button';
      el.title = f.name;
      el.setAttribute('aria-label', f.name);
      Object.assign(el.style, {
        width: '15px',
        height: '15px',
        borderRadius: '50%',
        background: color,
        border: '2px solid #ffffff',
        boxShadow: '0 2px 10px #111b29',
      });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onFacility.current(f);
      });
      markers.current.push(
        new maplibregl.Marker({ element: el })
          .setLngLat([f.longitude, f.latitude])
          .addTo(map)
      );
    }
  }, [facilities, result, activeWeek]);
  return (
    <div
      ref={root}
      className="map"
      aria-label="Map of National Capital Region"
    />
  );
}
