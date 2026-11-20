export type SimulationMapController = { resetView: () => void; zoomIn: () => void; zoomOut: () => void };
export type SimulationMapStatus = 'loading' | 'ready' | 'partial' | 'unavailable';
export type SimulationBounds = [[number, number], [number, number]];

/** Camera extent only; include the whole selected boundary, not just its point. */
export function selectionMapBounds(points: [number, number][], polygonBounds?: SimulationBounds): SimulationBounds | null {
  const coordinates = polygonBounds ? [...points, ...polygonBounds] : points;
  if (!coordinates.length || coordinates.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 180 || Math.abs(y) > 90)) return null;
  return [[Math.min(...coordinates.map(p => p[0])), Math.min(...coordinates.map(p => p[1]))],
    [Math.max(...coordinates.map(p => p[0])), Math.max(...coordinates.map(p => p[1]))]];
}

/** Camera padding only: wide top/bottom overlays must not consume the left edge. */
export function simulationMapPadding(width: number, height: number, overlays: Array<{left: number; top: number; width: number; height: number}>) {
  let top = 65, bottom = 55, left = 35, right = 65;
  for (const rect of overlays) {
    if (rect.width > width * 0.55) {
      if (rect.top < height / 2) top = Math.max(top, rect.top + rect.height + 12);
      else bottom = Math.max(bottom, height - rect.top + 12);
    } else if (rect.left < width * 0.3 && rect.top < height * 0.6) {
      top = Math.max(top, rect.top + rect.height + 12);
    } else if (rect.left + rect.width > width * 0.75) right = Math.max(right, width - rect.left + 12);
  }
  top = Math.min(top, Math.max(12, height * 0.3)); bottom = Math.min(bottom, Math.max(12, height * 0.25));
  left = Math.min(left, width * 0.2); right = Math.min(right, width * 0.25);
  return { top, bottom, left, right };
}
