import type { Metadata } from 'next';
import EngineStartup from '@/components/engine-startup';
import AppNavigation from '@/components/app-navigation';
import './globals.css';
import './app-shell.css';
export const metadata: Metadata = {
  title: 'SurgeWise',
  description:
    'Map-first dengue forecasting and preparedness research prototype',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <EngineStartup />
        <div className="sw-app-shell">
          <a className="sw-app-skip" href="#sw-app-content">Skip to workspace</a>
          <AppNavigation />
          <div className="sw-app-content" id="sw-app-content" tabIndex={-1}>{children}</div>
        </div>
      </body>
    </html>
  );
}
