// Root-level Next.js marker.
//
// Vercel's framework detection runs against the monorepo root (the project's
// Root Directory is the repo root). The deployed application lives in
// `apps/web` and is built/served via the root `vercel.json`
// (`pnpm --filter @smartfit/web build` → output `apps/web/.next`). This minimal
// root app exists solely so the Next.js framework/version is detected at the
// root — mirroring the flousy-app layout, which also ships `src/app` +
// `next.config.mjs` at the monorepo root. It is not separately built.
import type { ReactNode } from 'react';

export const metadata = {
  title: 'SmartFit',
  description: 'Train hard. Train smart.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
