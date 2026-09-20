import type { Metadata, Viewport } from 'next';
// Landing mono typeface (data/terminal accents).
import '@fontsource-variable/jetbrains-mono/wght.css';
import './globals.css';
import { AppProviders } from '@/components/app-providers';
import { DismissAppSplash } from '@/components/app-splash';
import { PwaRegister } from '@/components/pwa-register';
import { Telemetry } from '@/components/telemetry';
import { env } from '@/lib/env';

const appName = env.appName;

/**
 * Launch splash for the installed PWA, inlined into the SSR HTML so it paints
 * on the first frame of a home-screen launch — before any CSS or JS arrives.
 *
 * Scoped to `display-mode: standalone` (browser tabs keep the normal painted
 * page), tinted with the manifest `background_color` so Android's OS splash
 * hands over seamlessly, and removed by <DismissAppSplash> once React
 * hydrates. The trailing timer is a failsafe: if JS never runs, the splash
 * still clears instead of trapping the user.
 */
const SPLASH_CSS = `
#app-splash{display:none;position:fixed;inset:0;z-index:200;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#050404;color:#edebe6;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;transition:opacity .3s ease,visibility .3s ease}
@media all (display-mode:standalone),(display-mode:fullscreen){#app-splash{display:flex}}
/* iOS home-screen apps that predate display-mode support: navigator.standalone */
#app-splash.splash-show{display:flex}
#app-splash.splash-hide{opacity:0;visibility:hidden;pointer-events:none}
#app-splash-mark{display:flex;align-items:center;justify-content:center;width:84px;height:84px;border-radius:24px;background:#8ad200;box-shadow:0 14px 44px rgba(138,210,0,.35)}
#app-splash-mark svg{width:60px;height:60px}
#app-splash-name{font-size:15px;font-weight:800;letter-spacing:.02em}
#app-splash-bar{position:relative;width:118px;height:3px;border-radius:99px;overflow:hidden;background:rgba(237,235,230,.18)}
#app-splash-bar::after{content:'';position:absolute;inset:0;width:42%;border-radius:99px;background:#8ad200;animation:app-splash-slide 1.1s ease-in-out infinite}
@keyframes app-splash-slide{0%{transform:translateX(-110%)}100%{transform:translateX(310%)}}
@media (prefers-reduced-motion:reduce){#app-splash-bar::after{animation:none;width:100%}}
`;

/** The one SmartFit flame (mirrors src/lib/brand-mark.ts), stroked on volt. */
function SplashMark() {
  return (
    <span id="app-splash-mark" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"
          stroke="#101010"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

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
  manifest: '/manifest.webmanifest?v=9',
  appleWebApp: {
    capable: true,
    title: appName,
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/favicon.ico?v=9', sizes: '32x32' },
      { url: '/icon.svg?v=9', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png?v=9', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png?v=9', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: `${appName} — Train with intention`,
    description: 'Plan, log and understand your training. A calm, private fitness companion.',
    type: 'website',
    siteName: appName,
    url: '/',
    images: [
      {
        url: '/og.png?v=9',
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
    images: ['/og.png?v=9'],
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
        {/* Installed-PWA launch splash: paints before any CSS/JS arrives and
            is dismissed by <DismissAppSplash> after hydration (or by the
            failsafe timer below if JS never runs). Hidden in browser tabs. */}
        <div id="app-splash" aria-hidden="true">
          <style dangerouslySetInnerHTML={{ __html: SPLASH_CSS }} />
          <SplashMark />
          <span id="app-splash-name">{appName}</span>
          <span id="app-splash-bar" />
        </div>
        <script
          dangerouslySetInnerHTML={{
            // Show on iOS home-screen launches that predate display-mode;
            // failsafe-hide if JS modules never run. Class-only (never
            // removeChild) — the node belongs to React.
            __html:
              "(function(){var s=document.getElementById('app-splash');if(!s)return;" +
              "if(window.navigator.standalone)s.classList.add('splash-show');" +
              "setTimeout(function(){s.classList.add('splash-hide');},15000);})();",
          }}
        />
        <AppProviders>{children}</AppProviders>
        <DismissAppSplash />
        <PwaRegister />
        <Telemetry />
      </body>
    </html>
  );
}
