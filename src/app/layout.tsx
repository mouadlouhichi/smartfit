import type { Metadata, Viewport } from 'next';
// App typeface (Paperpillar product UI).
import '@fontsource-variable/plus-jakarta-sans';
// Landing typefaces — exact match to the reference landing (SmartJib).
import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './globals.css';
import { AppProviders } from '@/components/app-providers';
import { PwaRegister } from '@/components/pwa-register';
import { env } from '@/lib/env';

const appName = env.appName;

export const metadata: Metadata = {
  // Absolute URLs for canonical/OG tags. Without this Next emits a bare "/"
  // for og:url and canonical, which crawlers and social scrapers reject.
  metadataBase: new URL(env.siteUrl),
  title: {
    default: `${appName} — Train with intention`,
    template: `%s · ${appName}`,
  },
  description:
    'A private, mobile-first fitness tracker that knows the difference between training hard and training smart. Log workouts, plan your week, and hit every goal.',
  applicationName: appName,
  keywords: ['fitness tracker', 'workout log', 'training plan', 'gym', 'running', 'health'],
  authors: [{ name: appName }],
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: appName,
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: `${appName} — Train with intention`,
    description: 'Plan, log and understand your training. A calm, private fitness companion.',
    type: 'website',
    siteName: appName,
    url: '/',
    images: [
      { url: '/og.png', width: 1200, height: 630, alt: `${appName} — train with intention` },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${appName} — Train with intention`,
    description: 'Plan, log and understand your training. A calm, private fitness companion.',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#efedea' },
    { media: '(prefers-color-scheme: dark)', color: '#161313' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <AppProviders>{children}</AppProviders>
        <PwaRegister />
      </body>
    </html>
  );
}
