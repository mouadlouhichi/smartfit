import type { Metadata, Viewport } from 'next';
// App typeface (Paperpillar product UI).
import '@fontsource-variable/plus-jakarta-sans';
// Landing typefaces — exact match to the reference landing (SmartJib).
import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './globals.css';
import { AppProviders } from '@/components/app-providers';
import { env } from '@/lib/env';

const appName = env.appName;

export const metadata: Metadata = {
  title: {
    default: `${appName} — Train with intention`,
    template: `%s · ${appName}`,
  },
  description:
    'A private, mobile-first fitness tracker that knows the difference between training hard and training smart. Log workouts, plan your week, and hit every goal.',
  applicationName: appName,
  keywords: ['fitness tracker', 'workout log', 'training plan', 'gym', 'running', 'health'],
  authors: [{ name: 'SmartFit' }],
  openGraph: {
    title: 'SmartFit — Train with intention',
    description: 'Plan, log and understand your training. A calm, private fitness companion.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F2F0EC' },
    { media: '(prefers-color-scheme: dark)', color: '#161313' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
