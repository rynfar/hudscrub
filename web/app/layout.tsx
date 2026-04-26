import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { AppBoot } from '@/src/storage/AppBoot';

export const metadata: Metadata = {
  title: 'hudscrub',
  description: 'Review and redact HUD-1 closing documents on your device',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <AppBoot />
        {children}
      </body>
    </html>
  );
}
