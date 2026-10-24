'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';

type Props = { side: 'left' | 'right'; label: string; children: ReactNode; revealKey?: number };

export default function QCWorkspaceSidebar({ side, label, children, revealKey }: Props) {
  const id = useId();
  const shell = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [measuredWidth, setMeasuredWidth] = useState(side === 'left' ? 265 : 330);
  const [maximum, setMaximum] = useState(420);
  const minimum = side === 'left' ? 220 : 260;
  const direction = side === 'left' ? 1 : -1;
  const Icon = side === 'left'
    ? collapsed ? PanelLeftOpen : PanelLeftClose
    : collapsed ? PanelRightOpen : PanelRightClose;

  useEffect(() => { if (revealKey) setCollapsed(false); }, [revealKey]);

  useEffect(() => {
    const element = shell.current!;
    const observer = new ResizeObserver(() => {
      if (!element.clientWidth) return;
      setMeasuredWidth(Math.round(element.getBoundingClientRect().width));
      setMaximum(Math.round(Math.max(minimum, Math.min(420, element.parentElement!.clientWidth * .32))));
    });
    observer.observe(element);
    observer.observe(element.parentElement!);
    return () => observer.disconnect();
  }, [minimum]);

  function resize(next: number) {
    setWidth(Math.round(Math.max(minimum, Math.min(maximum, next))));
  }
  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, width: shell.current!.getBoundingClientRect().width };
    setResizing(true);
  }
  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current) resize(drag.current.width + (event.clientX - drag.current.x) * direction);
  }
  function stopDrag() {
    drag.current = null;
    setResizing(false);
  }
  function resizeWithKeys(event: KeyboardEvent<HTMLDivElement>) {
    const current = shell.current!.getBoundingClientRect().width;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      resize(current + (event.key === 'ArrowRight' ? 1 : -1) * direction * (event.shiftKey ? 40 : 10));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      resize(event.key === 'Home' ? minimum : maximum);
    }
  }

  return <div ref={shell} className="qc-sidebar-shell" data-side={side} data-collapsed={collapsed} data-resizing={resizing}
    style={width === null ? undefined : { '--qc-sidebar-width': `${width}px` } as CSSProperties}>
    <button type="button" className="qc-sidebar-toggle" aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${label.toLowerCase()}`}
      aria-expanded={!collapsed} aria-controls={id} title={`${collapsed ? 'Expand' : 'Collapse'} ${label.toLowerCase()}`}
      onClick={() => setCollapsed(value => !value)}><Icon size={16} /></button>
    <span className="qc-sidebar-caption" aria-hidden="true">{label}</span>
    <div id={id} className="qc-sidebar-content">{children}</div>
    <div className="qc-sidebar-resize" role="separator" tabIndex={collapsed ? -1 : 0} aria-label={`Resize ${label.toLowerCase()}`}
      aria-orientation="vertical" aria-controls={id} aria-valuemin={minimum} aria-valuemax={maximum}
      aria-valuenow={measuredWidth}
      title="Drag to resize; use arrow keys or Shift + arrow keys. Double-click to reset."
      onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}
      onLostPointerCapture={stopDrag} onKeyDown={resizeWithKeys} onDoubleClick={() => setWidth(null)} />
  </div>;
}
