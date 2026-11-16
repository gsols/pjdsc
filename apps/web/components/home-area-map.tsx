'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { HOVER, ZOOM, buildField, coverFit, glowTiles, project, unproject, zoomOrigin } from '@/lib/home-city-map';
import { HOSPITAL_BUILDING_SVG, HOSPITAL_PLATFORM_SVG, HOSPITAL_VIEWBOX } from '@/lib/home-hospital';
import { CITY_SHAPES, QC_SHAPE } from '@/lib/home-city-map-data';

const FIELD = buildField(CITY_SHAPES, undefined, QC_SHAPE);
// Without the canvas hospital, the Quezon City tile lights like any other.
const FIELD_ALL_TILES = { ...FIELD, tiles: FIELD.tiles.map(t => ({ ...t, city: false })) };
const SIMULATION = '/outbreak-response';

// Pale greys with thin line-art, like a printed plan; the dark teal of the simulation
// page under the hospital.
const GROUND = '#e3e7e5';
const TOP = ['#f1f3f2', '#f8f9f8', '#ebeeec'] as const;
const LEFT = '#d2d8d5', RIGHT = '#bfc7c3';
// Tile patterns share the light grey of the tile borders.
const EDGE = '#dde2df', LINE = EDGE;
const CITY = '#225d61', CITY_SIDE = '#163f42';
// Hovered tile: stripes inside its city outline, in the outline's own grey (EDGE).
const SHADE = '221,226,223';
const FLOAT = 50; // px the hospital platform floats above its tile
const OVERLAY_WIDTH = 1100; // width of the overlay's drawing box (the model's viewBox)
const BOB = { amplitude: 9, period: 3200 }; // the platform's gentle float: px up and down, ms per cycle
// The building also floats just above its platform, on its own slower rhythm.
const HOVERING = { gap: 12, amplitude: 7, period: 2400 };

/**
 * Isometric tiled field on Home: pale diamond tiles, each with the simplified outline of
 * a real Metro Manila city. Hovering a tile raises it slightly and stripes the inside of
 * its city outline; it settles when the cursor moves on. The hospital floats on its layered platform above the dark teal Quezon City
 * tile, bobbing gently (still under reduced motion); clicking it zooms in, then opens the simulation. Drawn on a canvas hidden from
 * assistive technology; the navigation rail offers every destination accessibly.
 */
/**
 * `hospital`: keep the dark teal Quezon City tile (with its zoom into the simulation); off,
 * that tile shows Quezon City's outline and hovers like any other.
 * `overlay`: content placed over the Quezon City tile instead of the canvas-drawn hospital,
 * scaled to the same size and floating at the same height. Its box is the hospital
 * drawing's 1100 x 720 viewBox (the same isometric projection), so a drawing in that box
 * lines up with the tile.
 */
export default function HomeAreaMap({ hospital = true, overlay }: { hospital?: boolean; overlay?: ReactNode } = {}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [overlayBox, setOverlayBox] = useState<{ left: number; top: number; width: number } | null>(null);
  const drawsHospital = hospital && !overlay;
  const zoomRef = useRef(false);

  useEffect(() => {
    router.prefetch(SIMULATION);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const { n, tiles, city } = FIELD;
    const count = tiles.length;
    const lift = new Float32Array(count), heat = new Float32Array(count);
    const pointer = { x: 0, y: 0, inside: false };
    // Lit tiles and when each starts rising (ms timestamps), staggered.
    let hovered = -1;
    const litFrom = new Map<number, number>();
    let box = { w: 0, h: 0 }, fit = coverFit(FIELD.width, FIELD.height, 1, 1), frame = 0, timer = 0;
    let bob = 0, rise = HOVERING.gap, floatFrame = 0, lifted = false;
    // While no tile is raised the field is static: paint it once into a cache, then each
    // floating frame only copies the cache and redraws the hospital.
    const cache = document.createElement('canvas'), cacheCtx = cache.getContext('2d');
    let cacheValid = false;
    let g: CanvasRenderingContext2D = ctx; // the context the tile painters draw into

    const image = (svg: string) => {
      const img = new Image();
      img.onload = () => draw();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      return img;
    };
    const platform = image(HOSPITAL_PLATFORM_SVG), building = image(HOSPITAL_BUILDING_SVG);
    const ready = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0;
    const vb = HOSPITAL_VIEWBOX;
    const k = (0.92 * FIELD.a) / (25 * vb.siteUnits); // platform about the tile's width
    const cityIndex = city.row * n + city.col;
    const hospitalBox = () => {
      const c = project(FIELD, city.col + 0.5, city.row + 0.5, lift[cityIndex] + FLOAT + bob);
      return { x: c.x - (vb.anchorX - vb.x) * k, y: c.y - (vb.anchorY - vb.y) * k, w: vb.width * k, h: vb.height * k };
    };

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      box = { w: rect.width, h: rect.height };
      canvas!.width = Math.round(rect.width * dpr);
      canvas!.height = Math.round(rect.height * dpr);
      fit = coverFit(FIELD.width, FIELD.height, rect.width, rect.height);
      ctx!.setTransform(dpr * fit.scale, 0, 0, dpr * fit.scale, dpr * fit.x, dpr * fit.y);
      if (overlayRef.current) {
        // Same placement as the canvas hospital: the platform's bottom centre FLOAT px above
        // the Quezon City tile's centre, scaled so the platform is about a tile wide.
        const c = project(FIELD, city.col + 0.5, city.row + 0.5, FLOAT), scale = k * fit.scale;
        setOverlayBox({ left: fit.x + c.x * fit.scale - vb.anchorX * scale, top: fit.y + c.y * fit.scale - vb.anchorY * scale, width: OVERLAY_WIDTH * scale });
      }
      cacheValid = false;
      draw();
    }

    const path = (corners: { x: number; y: number }[]) => {
      g.beginPath();
      g.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < corners.length; i++) g.lineTo(corners[i].x, corners[i].y);
      g.closePath();
    };

    // Diagonal stripes inside a tile's city outline, ruled in the tile's own plane
    // (1000 units per tile side), clipped to the outline.
    function stripesInside(t: (typeof tiles)[number], h: number, style: string) {
      const so = project(FIELD, t.col, t.row, h);
      g.save();
      g.beginPath();
      for (const d of t.doodles) {
        for (let p = 0; p < d.pts.length; p += 2) {
          const q = project(FIELD, t.col + d.pts[p], t.row + d.pts[p + 1], h);
          if (p) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y);
        }
        g.closePath();
      }
      g.clip('evenodd');
      g.transform(FIELD.a / 1000, FIELD.b / 1000, -FIELD.a / 1000, FIELD.b / 1000, so.x, so.y);
      g.strokeStyle = style;
      g.lineWidth = 12;
      g.beginPath();
      for (let k = -1000; k <= 2000; k += 55) { g.moveTo(k, 0); g.lineTo(k - 1000, 1000); }
      g.stroke();
      g.restore();
    }

    function drawTile(i: number) {
      const t = tiles[i], c = t.col, r = t.row, h = lift[i];
      const isHospitalTile = t.city && hospital;
      const glow = isHospitalTile ? 0 : heat[i];
      const top = [project(FIELD, c, r, h), project(FIELD, c + 1, r, h), project(FIELD, c + 1, r + 1, h), project(FIELD, c, r + 1, h)];
      if (h > 0.3) {
        // Visible sides: the two lower edges of the diamond, extruded down to the ground.
        path([top[3], top[2], project(FIELD, c + 1, r + 1), project(FIELD, c, r + 1)]);
        g.fillStyle = isHospitalTile ? CITY_SIDE : LEFT;
        g.fill();
        path([top[2], top[1], project(FIELD, c + 1, r), project(FIELD, c + 1, r + 1)]);
        g.fillStyle = isHospitalTile ? CITY_SIDE : RIGHT;
        g.fill();
      }
      path(top);
      g.fillStyle = isHospitalTile ? CITY : TOP[t.tone];
      g.fill();
      g.strokeStyle = EDGE;
      g.lineWidth = 2;
      g.stroke();
      if (isHospitalTile) {
        // Quezon City's outline and name, lying on the dark teal tile (user request).
        stripesInside(t, h, 'rgba(241,250,238,0.28)');
        g.save();
        g.strokeStyle = 'rgba(241,250,238,0.5)';
        g.lineWidth = 2.4;
        g.lineJoin = 'round';
        for (const d of t.doodles) {
          g.beginPath();
          for (let p = 0; p < d.pts.length; p += 2) {
            const q = project(FIELD, c + d.pts[p], r + d.pts[p + 1], h);
            if (p) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y);
          }
          g.closePath();
          g.stroke();
        }
        // Text in the tile's own plane: 1000 units per tile side along the grid axes.
        const o = project(FIELD, c, r, h);
        g.transform(FIELD.a / 1000, FIELD.b / 1000, -FIELD.a / 1000, FIELD.b / 1000, o.x, o.y);
        g.fillStyle = 'rgba(241,250,238,0.85)';
        g.font = "700 46px 'DM Sans', sans-serif";
        g.textAlign = 'right';
        g.fillText('QUEZON CITY', 940, 955);
        g.restore();
      }
      if (t.doodles.length && !isHospitalTile) {
        // Hovered: striped shade inside the city outline (user request), not the whole tile.
        if (glow > 0.01) stripesInside(t, h, `rgba(${SHADE},${glow.toFixed(3)})`);
        g.strokeStyle = LINE;
        g.lineWidth = 2.8;
        g.lineJoin = 'round';
        for (const d of t.doodles) {
          g.beginPath();
          for (let p = 0; p < d.pts.length; p += 2) {
            const q = project(FIELD, c + d.pts[p], r + d.pts[p + 1], h);
            if (p) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y);
          }
          if (d.closed) g.closePath();
          g.stroke();
        }
      }
    }

    function drawHospital() {
      if (!ready(platform) || !ready(building)) return;
      // A soft shadow on the teal tile, fainter as the platform floats higher.
      const ground = project(FIELD, city.col + 0.5, city.row + 0.5, lift[cityIndex]);
      g.save();
      g.globalAlpha = 0.22 - bob * 0.011;
      g.fillStyle = '#0b2224';
      g.beginPath();
      g.ellipse(ground.x, ground.y, FIELD.a * 0.55, FIELD.b * 0.55, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      const hb = hospitalBox();
      g.drawImage(platform, hb.x, hb.y, hb.w, hb.h);
      // The building's own shadow on the platform, softer the higher it floats.
      const fx = hb.x + (vb.footX - vb.x) * k, fy = hb.y + (vb.footY - vb.y) * k;
      g.save();
      g.globalAlpha = 0.3 - rise * 0.011;
      g.fillStyle = '#4c6460';
      g.beginPath();
      g.ellipse(fx, fy, FIELD.a * 0.3, FIELD.b * 0.3, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.drawImage(building, hb.x, hb.y - rise, hb.w, hb.h);
    }

    // The whole field, back to front along the diagonals so nearer tiles cover the sides of
    // those behind; the hospital is painted right after its own diagonal.
    function paintField(target: CanvasRenderingContext2D, withHospital: boolean) {
      g = target;
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = GROUND;
      g.fillRect(0, 0, target.canvas.width, target.canvas.height);
      g.restore();
      const citySum = city.col + city.row;
      for (let sum = 0; sum <= 2 * (n - 1); sum++) {
        for (let c = Math.max(0, sum - n + 1); c <= Math.min(n - 1, sum); c++) drawTile((sum - c) * n + c);
        if (withHospital && drawsHospital && sum === citySum) drawHospital();
      }
    }

    function draw() {
      if (!lifted && cacheCtx) {
        if (!cacheValid) {
          cache.width = canvas!.width;
          cache.height = canvas!.height;
          cacheCtx.setTransform(ctx!.getTransform());
          paintField(cacheCtx, false);
          cacheValid = true;
        }
        ctx!.save();
        ctx!.setTransform(1, 0, 0, 1, 0, 0);
        ctx!.drawImage(cache, 0, 0);
        ctx!.restore();
        g = ctx!;
        if (drawsHospital) drawHospital(); // nothing is raised, so nothing in front can cover it
      } else {
        cacheValid = false;
        paintField(ctx!, true);
      }
      if (pointer.inside && !zoomRef.current) {
        const p = unproject(FIELD, pointer.x, pointer.y), i = indexAt(p.c, p.r);
        ctx!.beginPath();
        ctx!.arc(pointer.x, pointer.y - (i >= 0 ? lift[i] : 0), 6, 0, Math.PI * 2);
        ctx!.fillStyle = '#e63946';
        ctx!.fill();
      }
    }

    function indexAt(c: number, r: number) {
      const ci = Math.floor(c), ri = Math.floor(r);
      return ci >= 0 && ci < n && ri >= 0 && ri < n ? ri * n + ci : -1;
    }

    // Ease every tile towards the bump under the cursor; stop once everything settles.
    function step() {
      frame = 0;
      let moving = false, raised = false;
      const now = performance.now();
      for (let i = 0; i < count; i++) {
        const start = litFrom.get(i);
        if (start !== undefined && now < start) moving = true; // still waiting for its turn
        const kk = start !== undefined && now >= start && !zoomRef.current ? 1 : 0;
        const target = kk * HOVER.lift;
        if (reduce) { lift[i] = target; heat[i] = kk; } else {
          lift[i] += (target - lift[i]) * HOVER.ease;
          heat[i] += (kk - heat[i]) * HOVER.ease;
          if (Math.abs(target - lift[i]) > 0.05 || Math.abs(kk - heat[i]) > 0.002) moving = true;
        }
        if (lift[i] > 0.05 || heat[i] > 0.002) raised = true;
      }
      lifted = raised;
      draw();
      if (moving) frame = requestAnimationFrame(step);
    }
    const kick = () => { if (!frame) frame = requestAnimationFrame(step); };

    // The hospital's float: a slow sine bob, redrawn every frame unless the hover loop
    // is already drawing. Off under reduced motion.
    function floatTick(now: number) {
      bob = Math.sin((now / BOB.period) * Math.PI * 2) * BOB.amplitude;
      rise = HOVERING.gap + Math.sin((now / HOVERING.period) * Math.PI * 2 + 1.1) * HOVERING.amplitude;
      if (!frame) draw();
      floatFrame = requestAnimationFrame(floatTick);
    }
    if (!reduce && drawsHospital) floatFrame = requestAnimationFrame(floatTick);

    function toField(event: PointerEvent | MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      return { x: (event.clientX - rect.left - fit.x) / fit.scale, y: (event.clientY - rect.top - fit.y) / fit.scale };
    }
    const overCity = (p: { x: number; y: number }) => {
      if (!hospital) return false;
      const at = unproject(FIELD, p.x, p.y), b = hospitalBox();
      if (!drawsHospital) return indexAt(at.c, at.r) === cityIndex;
      return indexAt(at.c, at.r) === cityIndex || (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
    };
    function light(index: number) {
      if (index === hovered) return;
      hovered = index;
      litFrom.clear();
      const now = performance.now();
      glowTiles(hospital ? FIELD : FIELD_ALL_TILES, index).forEach((i, k) => litFrom.set(i, now + k * HOVER.stagger));
    }
    const onMove = (event: PointerEvent) => {
      Object.assign(pointer, toField(event), { inside: true });
      canvas!.style.cursor = overCity(pointer) ? 'pointer' : 'default';
      const at = unproject(FIELD, pointer.x, pointer.y);
      light(indexAt(at.c, at.r));
      kick();
    };
    const onLeave = () => { pointer.inside = false; hovered = -1; litFrom.clear(); kick(); };
    const onClick = (event: MouseEvent) => {
      if (!overCity(toField(event)) || zoomRef.current) return;
      if (reduce) { router.push(SIMULATION); return; }
      zoomRef.current = true;
      kick();
      const b = hospitalBox();
      setZoom(zoomOrigin(b.x + b.w / 2, b.y + b.h * 0.55, FIELD.width, FIELD.height, box.w, box.h));
      timer = window.setTimeout(() => router.push(SIMULATION), ZOOM.ms);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('click', onClick);
    resize();
    return () => {
      observer.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('click', onClick);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(floatFrame);
      window.clearTimeout(timer);
    };
  }, [router, hospital, drawsHospital]);

  const zoomStyle = zoom ? { transformOrigin: `${zoom.x}px ${zoom.y}px`, '--zoom-scale': ZOOM.scale, '--zoom-ms': `${ZOOM.ms}ms` } as CSSProperties : undefined;
  return (
    <>
      <canvas ref={canvasRef} className="home-map" aria-hidden="true" data-zooming={Boolean(zoom)} style={zoomStyle} />
      {overlay && (
        <div ref={overlayRef} className="home-map-overlay" data-placed={Boolean(overlayBox)}
          style={overlayBox ? { left: overlayBox.left, top: overlayBox.top, width: overlayBox.width } : undefined}>
          {overlay}
        </div>
      )}
    </>
  );
}
