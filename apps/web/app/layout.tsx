import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/app-shell';
export const metadata: Metadata = {
  title: 'PJDSC | NCR Dengue Intelligence',
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
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
