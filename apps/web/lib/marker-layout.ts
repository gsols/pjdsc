type MarkerPoint = { id: string; x: number; y: number; size: number };

/** Screen-space offsets only. Source coordinates are never moved or rewritten. */
export function layoutMapMarkers(points: MarkerPoint[], width: number, height: number,
  blocked: { left: number; top: number; width: number; height: number }[] = []) {
  const availableArea = Math.max(1, width * height - blocked.reduce((sum, rect) => sum + rect.width * rect.height, 0));
  const footprint = points.reduce((sum, point) => sum + (point.size + 4) ** 2, 0);
  const scale = Math.min(1, Math.sqrt(availableArea * .6 / Math.max(1, footprint)));
  points = points.map(point => ({ ...point, size: point.size * scale }));
  const buckets = new Map<string, { x: number; y: number; size: number }[]>();
  const cellSize = 32, maxSize = Math.max(0, ...points.map(point => point.size));
  const result = new Map<string, { id: string; x: number; y: number; offsetX: number; offsetY: number; overlaps: boolean; size: number; scale: number }>();
  // Reserve space for larger icons first, then fit the smaller demand dots in gaps.
  for (const point of [...points].sort((a, b) => b.size - a.size)) {
    const radius = point.size / 2 + 3;
    const clampX = (x: number) => Math.max(radius, Math.min(width - radius, x));
    const clampY = (y: number) => Math.max(radius, Math.min(height - radius, y));
    const fits = (x: number, y: number) => {
      if (blocked.some(rect => x + point.size / 2 > rect.left && x - point.size / 2 < rect.left + rect.width
        && y + point.size / 2 > rect.top && y - point.size / 2 < rect.top + rect.height)) return false;
      const cx = Math.floor(x / cellSize), cy = Math.floor(y / cellSize);
      const reach = Math.ceil(((maxSize + point.size) / 2 + 4) / cellSize);
      for (let ix = cx - reach; ix <= cx + reach; ix++) for (let iy = cy - reach; iy <= cy + reach; iy++) {
        for (const other of buckets.get(`${ix},${iy}`) ?? []) {
          if (Math.hypot(other.x - x, other.y - y) < (other.size + point.size) / 2 + 4) return false;
        }
      }
      return true;
    };
    let x = clampX(point.x), y = clampY(point.y), found = fits(x, y);
    const limit = Math.ceil(Math.hypot(width, height) / 10);
    for (let ring = 1; !found && ring <= limit; ring++) {
      const steps = Math.max(8, Math.ceil(2 * Math.PI * ring));
      for (let step = 0; step < steps; step++) {
        const angle = step / steps * 2 * Math.PI;
        const candidateX = clampX(point.x + Math.cos(angle) * ring * 10);
        const candidateY = clampY(point.y + Math.sin(angle) * ring * 10);
        if (fits(candidateX, candidateY)) { x = candidateX; y = candidateY; found = true; break; }
      }
    }
    // A fine scan catches narrow free slots missed by the circular search.
    if (!found) for (let cy = radius; !found && cy <= height - radius; cy += 3) {
      for (let cx = radius; cx <= width - radius; cx += 3) {
        if (fits(cx, cy)) { x = cx; y = cy; found = true; break; }
      }
    }
    const key = `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push({ x, y, size: point.size }); buckets.set(key, bucket);
    result.set(point.id, { id: point.id, x, y, offsetX: x - point.x, offsetY: y - point.y, overlaps: !found, size: point.size, scale });
  }
  return points.map(point => result.get(point.id)!);
}
