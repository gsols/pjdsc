import type { MovieContext, MovieDay } from './outbreak-types';

/** One visual contract for the SVG, map layers and legend. */
export const SIMULATION_LINES = {
  proximity: { kind: 'proximity', color: '#287c75', dash: [4, 5], label: 'Three nearest + hospitals inside barangay', width: 1.5 },
  placement: { kind: 'placement', color: '#287c75', dash: [], label: 'Modeled placements · selected day', width: 2 },
  holding: { kind: 'holding', color: '#a56434', dash: [], label: 'Placement includes temporary holding', width: 2 },
  'hospital-context': { kind: 'hospital-context', color: '#a77638', dash: [4, 5], label: 'Hospital’s nearest ranked barangay', width: 1.5 },
  front: { kind: 'front', color: '#deb65d', dash: [3, 3], label: 'Assumed expansion boundary', width: 2 },
} as const;

export type ConnectionFocus = 'barangay' | 'hospital' | null;
export type SimulationConnection = {
  id: string; kind: 'proximity' | 'placement' | 'hospital-context';
  barangayId: string; facilityId: string; from: [number, number]; to: [number, number];
  patients: number; holding: number;
};
type Options = {
  selected: string; selectedHospital: string; focus: ConnectionFocus;
  hotspotIds?: string[]; showOverview: boolean; hospitalHotspot?: { barangayId: string } | null;
};

/** Display relationships only. Coordinates, nearest-site rankings and placements
 * come from the approved context/saved day; this does not calculate referrals. */
export function simulationConnections(context: MovieContext, snapshot: MovieDay | null, options: Options): SimulationConnection[] {
  if (!options.focus && !options.showOverview) return [];
  const barangays = new Map(context.barangays.map(b => [b.id, b]));
  const hospitals = new Map(context.hospitals.map(h => [h.id, h]));
  if (options.focus === 'hospital' && !hospitals.has(options.selectedHospital)) return [];
  if (options.focus === 'barangay' && !barangays.has(options.selected)) return [];
  const candidates = new Set(options.hotspotIds ?? snapshot?.hotspotIds ?? []);
  if (options.focus === 'barangay') { candidates.clear(); candidates.add(options.selected); }
  const result = new Map<string, SimulationConnection>();
  const add = (kind: SimulationConnection['kind'], barangayId: string, facilityId: string, patients = 0, holding = 0) => {
    const barangay = barangays.get(barangayId), hospital = hospitals.get(facilityId);
    if (!barangay || !hospital) return;
    const id = `${kind}:${barangayId}:${facilityId}`;
    result.set(id, { id, kind, barangayId, facilityId, from: barangay.coordinates, to: hospital.coordinates, patients, holding });
  };
  for (const id of candidates) {
    const barangay = barangays.get(id);
    if (!barangay) continue;
    const nearby = [...barangay.nearestHospitals.slice(0, 3), ...(barangay.hospitalsWithinBarangay ?? [])];
    for (const link of nearby) if (options.focus !== 'hospital' || link.facilityId === options.selectedHospital) add('proximity', id, link.facilityId);
  }
  if (options.focus === 'hospital' && options.hospitalHotspot) {
    const id = options.hospitalHotspot.barangayId, facilityId = options.selectedHospital;
    if (!result.has(`proximity:${id}:${facilityId}`)) add('hospital-context', id, facilityId);
  }
  for (const row of snapshot?.assignments ?? []) {
    const matches = options.focus === 'hospital' ? row.facilityId === options.selectedHospital : candidates.has(row.barangayId);
    const patients = row.supportedPlacements + row.holdingPlacements;
    if (matches && Number.isFinite(patients) && patients > 0 && row.supportedPlacements >= 0 && row.holdingPlacements >= 0) add('placement', row.barangayId, row.facilityId, patients, row.holdingPlacements);
  }
  return [...result.values()];
}

export type FlowPoint = { x: number; y: number };
/** Cosmetic screen-space timing; arrow direction always follows from -> to. */
export function connectionFrame(from: FlowPoint, to: FlowPoint, elapsedMs: number, reducedMotion: boolean) {
  const elapsed = Math.max(0, elapsedMs);
  const mix = (progress: number) => ({ x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress });
  const progress = reducedMotion ? 1 : 1 - (1 - Math.min(1, elapsed / 650)) ** 3;
  const arrowProgress = reducedMotion ? .62 : (elapsed % 2400) / 2400;
  return { end: mix(progress), arrow: mix(arrowProgress), angle: Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI,
    opacity: reducedMotion ? .9 : Math.min(1, arrowProgress * 10, (1 - arrowProgress) * 10) };
}


/** SVG over the canvas lets connections end at the displayed pin, including its
 * overlap offset. Source coordinates remain unchanged. All arrows point b -> h. */
export function drawSimulationFlow(svg: SVGSVGElement, connections: SimulationConnection[], project: (id: string, coordinates: [number, number]) => FlowPoint,
  reducedMotion: boolean, startedAt: number) {
  const ns = 'http://www.w3.org/2000/svg';
  const placements = new Set(connections.filter(c => c.kind === 'placement').map(c => `${c.barangayId}:${c.facilityId}`));
  // A saved placement supersedes the proximity decoration on the same pair.
  const shown = connections.filter(c => c.kind === 'placement' || !placements.has(`${c.barangayId}:${c.facilityId}`));
  const entries = shown.map((connection, index) => {
    const group = document.createElementNS(ns, 'g');
    group.dataset.kind = connection.kind;
    group.dataset.from = connection.barangayId; group.dataset.to = connection.facilityId;
    const style = SIMULATION_LINES[connection.kind === 'placement' && connection.holding > 0 ? 'holding' : connection.kind];
    const color = style.color;
    const width = connection.kind === 'placement' ? Math.min(4, 1.8 + Math.sqrt(connection.patients) * .25) : 1.5;
    const casing = document.createElementNS(ns, 'line');
    casing.setAttribute('stroke', '#fbfdf9'); casing.setAttribute('stroke-width', String(width + 2)); casing.setAttribute('opacity', '.8');
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('stroke', color); line.setAttribute('stroke-width', String(width)); line.setAttribute('stroke-linecap', 'round');
    if (style.dash.length) line.setAttribute('stroke-dasharray', style.dash.join(' '));
    const arrow = document.createElementNS(ns, 'path');
    arrow.setAttribute('d', 'M -5 -3.5 L 0 0 L -5 3.5'); arrow.setAttribute('fill', 'none');
    arrow.setAttribute('stroke', color); arrow.setAttribute('stroke-width', '2.2');
    arrow.setAttribute('stroke-linecap', 'round'); arrow.setAttribute('stroke-linejoin', 'round');
    group.append(casing, line, arrow); svg.append(group);
    return { connection, casing, line, arrow, delay: index * 35 };
  });
  let frame = 0;
  const render = (now: number) => {
    for (const { connection, casing, line, arrow, delay } of entries) {
      const from = project(`b-${connection.barangayId}`, connection.from), to = project(`h-${connection.facilityId}`, connection.to);
      const current = connectionFrame(from, to, now - startedAt - delay, reducedMotion);
      for (const path of [casing, line]) {
        path.setAttribute('x1', String(from.x)); path.setAttribute('y1', String(from.y));
        path.setAttribute('x2', String(current.end.x)); path.setAttribute('y2', String(current.end.y));
      }
      arrow.setAttribute('transform', `translate(${current.arrow.x},${current.arrow.y}) rotate(${current.angle})`);
      arrow.setAttribute('opacity', String(current.opacity));
    }
  };
  const animate = (now: number) => { render(now); frame = requestAnimationFrame(animate); };
  render(performance.now());
  if (!reducedMotion && entries.length) frame = requestAnimationFrame(animate);
  return { update: () => render(performance.now()), destroy: () => { cancelAnimationFrame(frame); svg.replaceChildren(); } };
}
