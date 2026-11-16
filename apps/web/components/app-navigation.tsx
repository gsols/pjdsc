'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, BookOpen, House, Map } from 'lucide-react';
import SurgeWiseMark from '@/components/surgewise-mark';

const DESTINATIONS = [
  { href: '/', label: 'Home', description: 'Your preparedness workspace', Icon: House },
  { href: '/dashboard', label: 'Dashboard', description: 'Geography & historical dengue patterns', Icon: Map },
  { href: '/outbreak-response', label: 'Simulation', description: 'Test hospital surge scenarios', Icon: Activity },
  { href: '/research', label: 'Research', description: 'Data, backtests & explicit assumptions', Icon: BookOpen },
];

export default function AppNavigation() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    function dismiss(event: KeyboardEvent) { if (event.key === 'Escape') setDismissed(true); }
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, []);

  return (
    <aside className="sw-app-rail" aria-label="SurgeWise workspace navigation">
      <Link href="/" className="sw-rail-brand" aria-label="SurgeWise home" prefetch={false}>
        <SurgeWiseMark size={28} variant="on-light" />
      </Link>
      <nav className="sw-app-nav" aria-label="Main navigation" data-dismissed={dismissed}>
        {DESTINATIONS.map(({ href, label, description, Icon }) => {
          const active = pathname === href || (href === '/outbreak-response' && pathname === '/simulate');
          const tooltipId = `sw-nav-${label.toLowerCase()}`;
          return (
            <Link key={href} href={href} prefetch={false} className="sw-nav-link"
              aria-label={label} aria-current={active ? 'page' : undefined} aria-describedby={tooltipId}
              onPointerEnter={() => setDismissed(false)} onFocus={() => setDismissed(false)}>
              <span className="sw-nav-icon"><Icon size={20} strokeWidth={1.65} aria-hidden="true" /></span>
              <span id={tooltipId} className="sw-nav-tooltip" role="tooltip">
                <strong>{label}</strong><small>{description}</small>
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
