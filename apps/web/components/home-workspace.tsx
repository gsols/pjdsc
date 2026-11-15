'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function HomeWorkspace({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  function toggleTheme() {
    setTheme(current => current === 'light' ? 'dark' : 'light');
  }
  const themeLabel = `Use ${theme === 'light' ? 'dark' : 'light'} Home theme`;
  return (
    <main className="sw-home" id="home-main" data-theme={theme}>
      <div className="home-app-bar">
        <div className="home-wordmark">SurgeWise <span>/ Home</span></div>
        <div className="home-app-tools">
          <span className="home-scope">Quezon City <span aria-hidden="true">/</span> Research prototype</span>
          <div className="home-tool">
            <button type="button" className="text-button home-canvas-control" aria-label={themeLabel}
              aria-pressed={theme === 'dark'} onClick={toggleTheme}>
              {theme === 'light' ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}
            </button>
            <span className="home-tool-label" aria-hidden="true">{themeLabel}</span>
          </div>
        </div>
      </div>
      {children}
    </main>
  );
}
