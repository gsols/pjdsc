'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import './workspace-select.css';

type Option = { value: string; label: string };

/** Select-only combobox: focus stays on the trigger while arrows preview options. */
export default function WorkspaceSelect({ label, value, options, onChange, icon, className = '', disabled = false, id: triggerId }: {
  label: string; value: string; options: Option[]; onChange: (value: string) => void;
  icon?: ReactNode; className?: string; disabled?: boolean; id?: string;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState({ above: false, height: 220 });
  const typeahead = useRef({ text: '', time: 0 });
  const selected = Math.max(0, options.findIndex(option => option.value === value));
  useEffect(() => {
    if (!open) return;
    const bounds = trigger.current?.getBoundingClientRect();
    if (bounds) {
      let top = 8, bottom = window.innerHeight - 8;
      for (let parent = root.current?.parentElement; parent; parent = parent.parentElement) {
        if (/auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflowY)) {
          const clip = parent.getBoundingClientRect(); top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom);
        }
      }
      const below = bottom - bounds.bottom - 8, above = bounds.top - top - 8;
      const flip = below < Math.min(220, options.length * 42 + 10) && above > below;
      setPlacement({ above: flip, height: Math.max(45, Math.min(220, flip ? above : below)) });
    }
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open, options.length]);
  useEffect(() => {
    if (open) root.current?.querySelector(`#${CSS.escape(id)}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, id]);
  function choose(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false); trigger.current?.focus();
  }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) { setActive(event.key === 'End' ? options.length - 1 : event.key === 'Home' ? 0 : selected); setOpen(true); }
      else setActive(current => event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
        : Math.max(0, Math.min(options.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(active); else { setActive(selected); setOpen(true); }
    } else if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false);
    } else if (event.key === 'Tab') setOpen(false);
    else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = Date.now(), previous = typeahead.current;
      const text = now - previous.time < 600 ? previous.text + event.key.toLowerCase() : event.key.toLowerCase();
      typeahead.current = { text, time: now };
      const found = options.findIndex(option => option.label.toLowerCase().startsWith(text));
      if (found >= 0) { event.preventDefault(); setActive(found); setOpen(true); }
    }
  }
  return <div ref={root} className={`ws-select ${className}`} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button ref={trigger} id={triggerId} disabled={disabled} className="text-button ws-select-trigger" type="button" role="combobox"
      aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-listbox`}
      aria-activedescendant={open ? `${id}-option-${active}` : undefined}
      onKeyDown={keyDown} onClick={() => { setActive(selected); setOpen(current => !current); }}>
      {icon}<span>{options[selected]?.label ?? value}</span><ChevronDown size={14} aria-hidden="true" />
    </button>
    {open && <ul id={`${id}-listbox`} className="ws-select-options" role="listbox" aria-label={label}
      data-above={placement.above} style={{ maxHeight: placement.height }}>
      {options.map((option, index) => <li id={`${id}-option-${index}`} key={option.value}
        role="option" aria-selected={option.value === value} data-active={index === active}
        onPointerMove={() => setActive(index)} onPointerDown={event => event.preventDefault()}
        onClick={() => choose(index)}>
        <span>{option.label}</span>{option.value === value && <Check size={14} aria-hidden="true" />}
      </li>)}
    </ul>}
  </div>;
}
