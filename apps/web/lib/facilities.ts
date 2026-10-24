import type { Facility } from './types';

export const FACILITY_DATASET_ID = 'PHIC_QC_HOSP_2026_09_30_GEO_REVIEW_2026_10_24';
export const FACILITY_SHA256 = '929cbeb97a0edffdfeb8257ad5857347b9b56661004dbdaa364f4873fbd620c5';
const provisional = new Set(['PROVISIONAL_OSM', 'PROVISIONAL_HISTORICAL_MATCH', 'PROVISIONAL_THIRD_PARTY']);
type Geometry = { type: string; coordinates: number[][][] | number[][][][] };
function inRing(x: number, y: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function adaptFacilities(value: unknown, geometry: Geometry): Facility[] {
  const fail = () => { throw new Error('Approved QC hospital data failed validation. No legacy fallback.'); };
  if (!Array.isArray(value) || value.length !== 46) return fail();
  if (!['Polygon', 'MultiPolygon'].includes(geometry.type)) return fail();
  const polygons = (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates) as number[][][][];
  const ids = new Set<string>(), points = new Set<string>();
  let beds = 0;
  const facilities = value.map((r) => {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !/^HOSP-(61[4-9]|6[2-4][0-9]|65[0-9])$/.test(r.id) || ids.has(r.id)) return fail();
    ids.add(r.id);
    if (r.city !== 'QUEZON_CITY' || r.datasetRole !== 'QC_HOSPITAL_PRIMARY' || r.facilityType !== 'HOSPITAL_INFIRMARY' || r.sourceAsOf !== '2026-09-30') return fail();
    if (!Number.isSafeInteger(r.accreditedBeds) || r.accreditedBeds < 0) return fail();
    beds += r.accreditedBeds;
    const x = r.longitude, y = r.latitude;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < -180 || x > 180 || y < -90 || y > 90) return fail();
    if (!polygons.some(p => inRing(x, y, p[0]) && !p.slice(1).some(h => inRing(x, y, h)))) return fail();
    const point = `${x},${y}`;
    if (points.has(point)) return fail();
    points.add(point);
    if (!provisional.has(r.coordinateStatus) || r.coordinateIsVerifiedEntrance !== false || r.coordinateVerifiedAt !== null) return fail();
    for (const key of ['authorizedBeds', 'implementedBeds', 'normalStaffedCapacity', 'dengueUsableBeds', 'dengueInpatientEligible']) if (r[key] !== null) return fail();
    for (const key of ['primarySourceUrl', 'coordinateSourceUrl', 'accreditedBedsSource']) if (typeof r[key] !== 'string' || !r[key].startsWith('https://')) return fail();
    for (const key of ['name', 'address', 'ownership', 'philHealthCategory', 'coordinateQualityNote']) if (typeof r[key] !== 'string') return fail();
    return { ...r, coordinateEvidenceStatus: r.coordinateStatus, coordinateStatus: 'PROVISIONAL_HISTORICAL_MATCH' } as Facility;
  });
  if (beds !== 9389) return fail();
  for (const [id, lat, lng] of [['HOSP-626', 14.6705308, 121.0320837], ['HOSP-627', 14.65939, 121.0236], ['HOSP-649', 14.73573, 121.06916]] as const) {
    const r = facilities.find(f => f.id === id);
    if (!r || r.latitude !== lat || r.longitude !== lng) return fail();
  }
  return facilities;
}

export async function loadFacilities(signal?: AbortSignal): Promise<Facility[]> {
  const [response, boundaryResponse] = await Promise.all([
    fetch('/data/qc-philhealth-hospitals.json', { signal, cache: 'no-store' }),
    fetch('/api/boundaries', { signal }),
  ]);
  if (!response.ok || !boundaryResponse.ok) throw new Error('QC hospital registry or QC boundary unavailable. No legacy fallback.');
  const raw = await response.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', raw);
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== FACILITY_SHA256) throw new Error('QC hospital dataset version/checksum mismatch.');
  const boundaries = await boundaryResponse.json();
  const qc = boundaries.features.filter((f: { properties: { area_id: string } }) => f.properties.area_id === 'QUEZON_CITY');
  if (qc.length !== 1) throw new Error('QC boundary unavailable or ambiguous.');
  return adaptFacilities(JSON.parse(new TextDecoder().decode(raw)), qc[0].geometry);
}
