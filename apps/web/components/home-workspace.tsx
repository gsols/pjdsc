import type { ReactNode } from 'react';

export default function HomeWorkspace({ children }: { children: ReactNode }) {
  return (
    <main className="sw-home" id="home-main">
      <div className="home-app-bar">
        <div className="home-wordmark">SurgeWise <span>/ Home</span></div>
        <div className="home-app-tools">
          <span className="home-scope">Quezon City <span aria-hidden="true">/</span> Research prototype</span>
        </div>
      </div>
      {children}
    </main>
  );
}
