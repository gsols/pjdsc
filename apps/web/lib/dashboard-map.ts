/** Camera geometry only. Never computes disease demand or hospital capacity. */
export type DashboardMapStatus = 'loading' | 'ready' | 'partial' | 'unavailable';
export type DashboardMapController = {
  focusArea: (area: string) => void;
  zoomIn: () => void;
  zoomOut: () => void;
};
export const areaLabel = (area: string) => area === 'NCR' ? 'National Capital Region'
  : area === 'QUEZON_CITY' ? 'Quezon City'
  : area.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());

export function areaBounds(collection: unknown, area: string): [[number, number], [number, number]] | null {
  if (!collection || typeof collection !== 'object' || !('features' in collection) || !Array.isArray(collection.features)) return null;
  const features = collection.features.filter(f => f && typeof f === 'object'
    && (area === 'NCR' || f.properties?.area_id === area));
  if (!features.length || (area !== 'NCR' && features.length !== 1)) return null;
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  function visit(value: unknown): boolean {
    if (!Array.isArray(value) || value.length === 0) return false;
    if (typeof value[0] === 'number') {
      const [x, y] = value;
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < -180 || x > 180 || y < -90 || y > 90) return false;
      west = Math.min(west, x); east = Math.max(east, x);
      south = Math.min(south, y); north = Math.max(north, y);
      return true;
    }
    return value.every(visit);
  }
  for (const f of features) {
    if (!['Polygon', 'MultiPolygon'].includes(f.geometry?.type) || !visit(f.geometry.coordinates)) return null;
  }
  return Number.isFinite(west) ? [[west, south], [east, north]] : null;
}
