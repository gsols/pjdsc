'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';

type Position = { x: number; y: number };

function constrain(panel: HTMLDivElement, position: Position): Position {
  const host = panel.parentElement!;
  return {
    x: Math.max(12, Math.min(position.x, host.clientWidth - panel.offsetWidth - 12)),
    y: Math.max(12, Math.min(position.y, host.clientHeight - panel.offsetHeight - 12)),
  };
}

export default function FloatingMapPanel({ children, revealKey }: { children: ReactNode; revealKey?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: Position; panel: Position } | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const contentId = useId();

  useEffect(() => {
    const element = panel.current!;
    const observer = new ResizeObserver(() => setPosition(current => {
      if (!current) return current;
      const next = constrain(element, current);
      return next.x === current.x && next.y === current.y ? current : next;
    }));
    observer.observe(element);
    observer.observe(element.parentElement!);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { if (revealKey) setCollapsed(false); }, [revealKey]);

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.currentTarget.focus();
    const rect = panel.current!.getBoundingClientRect();
    const host = panel.current!.parentElement!.getBoundingClientRect();
    drag.current = { pointer: { x: event.clientX, y: event.clientY }, panel: { x: rect.x - host.x, y: rect.y - host.y } };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }
  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    setPosition(constrain(panel.current!, {
      x: drag.current.panel.x + event.clientX - drag.current.pointer.x,
      y: drag.current.panel.y + event.clientY - drag.current.pointer.y,
    }));
  }
  function stopDrag() { drag.current = null; setDragging(false); }
  function moveWithKeys(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Home') { event.preventDefault(); setPosition(null); return; }
    const vectors: Record<string, Position> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
    const vector = vectors[event.key];
    if (!vector) return;
    event.preventDefault();
    const rect = panel.current!.getBoundingClientRect(), host = panel.current!.parentElement!.getBoundingClientRect();
    const step = event.shiftKey ? 40 : 10;
    setPosition(constrain(panel.current!, { x: rect.x - host.x + vector.x * step, y: rect.y - host.y + vector.y * step }));
  }

  return <div ref={panel} className="dashboard-floating-panel" data-collapsed={collapsed} data-dragging={dragging}
    style={position ? { left: position.x, top: position.y, right: 'auto' } : undefined}>
    <div className="dashboard-panel-bar">
      <button type="button" className="dashboard-panel-drag" aria-label="Move map explorer panel"
        title="Drag to move, or use arrow keys. Home resets position."
        onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag}
        onPointerCancel={stopDrag} onLostPointerCapture={stopDrag} onKeyDown={moveWithKeys}>
        <GripVertical size={16} /><span>Map explorer</span>
      </button>
      <button type="button" className="dashboard-panel-toggle" aria-label={`${collapsed ? 'Expand' : 'Collapse'} map explorer`}
        aria-expanded={!collapsed} aria-controls={contentId} title={`${collapsed ? 'Expand' : 'Collapse'} map explorer`}
        onClick={() => setCollapsed(value => !value)}>{collapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}</button>
    </div>
    <div id={contentId} className="dashboard-panel-content" hidden={collapsed}>{children}</div>
  </div>;
}
