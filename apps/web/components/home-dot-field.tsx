'use client';

import { useEffect, useRef } from 'react';

/** Decorative pointer response only; never handles clicks or app navigation. */
export default function HomeDotField() {
  const field = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = field.current;
    const canvas = element?.parentElement;
    if (!element || !canvas) return;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame: number | null = null;
    let pointerX = 0, pointerY = 0;
    function move(event: PointerEvent) {
      if (event.pointerType === 'touch' || !finePointer.matches || reducedMotion.matches) return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const bounds = canvas!.getBoundingClientRect();
        element!.style.setProperty('--dot-x', `${pointerX - bounds.left}px`);
        element!.style.setProperty('--dot-y', `${pointerY - bounds.top}px`);
        element!.dataset.active = 'true';
      });
    }
    function leave() {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      element!.dataset.active = 'false';
    }
    canvas.addEventListener('pointermove', move, { passive: true });
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('pointercancel', leave);
    return () => {
      leave();
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('pointercancel', leave);
    };
  }, []);
  return <div ref={field} className="home-dot-hover" data-active="false" aria-hidden="true" />;
}
