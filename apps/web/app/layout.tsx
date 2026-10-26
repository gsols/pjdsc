import type { Metadata } from 'next';
import EngineStartup from '@/components/engine-startup';
import './globals.css';
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
      <body><EngineStartup />{children}</body>
    </html>
  );
}
