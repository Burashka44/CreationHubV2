import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'CreationHub V2',
  description: 'Server infrastructure management dashboard',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.ico' },
};

export const viewport: Viewport = {
  themeColor: '#0d0f17',
  width: 'device-width',
  initialScale: 1,
};

import dynamic from 'next/dynamic';

const Burashka = dynamic(() => import('@/components/dashboard/Burashka'), { ssr: false });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-theme="dark" data-scale="100" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        <Burashka />
      </body>
    </html>
  );
}
