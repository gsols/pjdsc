'use client';

import { useEffect, useState, type ReactNode } from 'react';
import WorkspaceLoader from '@/components/workspace-loader';

export default function HomeWorkspace({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<'loading' | 'revealing' | 'ready'>('loading');
  useEffect(() => {
    let disposed = false;
    const timers: number[] = [];
    const delay = (ms: number) => new Promise<void>(resolve => { timers.push(window.setTimeout(resolve, ms)); });
    // A brief first impression, with a bounded wait for font/layout readiness.
    void Promise.all([delay(320), Promise.race([document.fonts.ready.catch(() => {}), delay(1200)])]).then(() => {
      if (disposed) return;
      setPhase('revealing');
      timers.push(window.setTimeout(() => { if (!disposed) setPhase('ready'); }, 200));
    });
    return () => { disposed = true; timers.forEach(id => window.clearTimeout(id)); };
  }, []);
  const entered = phase === 'ready';
  return (
    <main className="sw-home" id="home-main" aria-busy={!entered}>
      <WorkspaceLoader active={phase === 'loading'} label="Opening SurgeWise" />
      <div className="home-reveal-content" data-ready={entered} inert={!entered || undefined} aria-hidden={!entered || undefined}>
      <div className="home-app-bar">
        <div className="home-wordmark">SurgeWise <span>/ Home</span></div>
        <div className="home-app-tools">
          <span className="home-scope">Quezon City <span aria-hidden="true">/</span> Research prototype</span>
        </div>
      </div>
      {children}
      </div>
    </main>
  );
}
