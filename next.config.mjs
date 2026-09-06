// Root Next.js config.
//
// Vercel detects the Next.js app from the monorepo *root* (the project's Root
// Directory is the repo root). The real application lives in `apps/web` and is
// built via vercel.json's `pnpm --filter @smartfit/web build` (output in
// `apps/web/.next`). This file exists so Vercel's framework/version detection
// recognises the repo as a Next.js project — it simply re-exports the web app's
// config to keep a single source of truth (mirrors the flousy-app layout, which
// also ships a next.config.mjs at the monorepo root).
export { default } from './apps/web/next.config.mjs';
