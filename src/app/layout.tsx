import type { Metadata, Viewport } from 'next';
// Landing mono typeface (data/terminal accents).
import '@fontsource-variable/jetbrains-mono/wght.css';
import './globals.css';
import { AppProviders } from '@/components/app-providers';
import { PwaRegister } from '@/components/pwa-register';
import { Telemetry } from '@/components/telemetry';
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
  // `?v=` busts the OS/browser icon caches whenever the mark is regenerated
  // (scripts/gen-brand-assets.mjs) — home-screen icons are cached by URL and
  // otherwise survive every deploy. Keep in sync with manifest.webmanifest.
  manifest: '/manifest.webmanifest?v=6',
  appleWebApp: {
    capable: true,
    title: appName,
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/favicon.ico?v=6', sizes: '32x32' },
      { url: '/icon.svg?v=6', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png?v=6', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png?v=6', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: `${appName} — Train with intention`,
    description: 'Plan, log and understand your training. A calm, private fitness companion.',
    type: 'website',
    siteName: appName,
    url: '/',
    images: [
      {
        url: '/og.png?v=6',
        width: 1200,
        height: 630,
        alt: `${appName} — train with intention`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${appName} — Train with intention`,
    description: 'Plan, log and understand your training. A calm, private fitness companion.',
    images: ['/og.png?v=6'],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#edebe6' },
    { media: '(prefers-color-scheme: dark)', color: '#050404' },
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
        <Telemetry />
      </body>
    </html>
  );
}
