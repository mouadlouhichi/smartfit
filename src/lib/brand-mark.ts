/**
 * Shared brand geometry — the one source of truth for the SmartFit flame so
 * the React mark (`components/brand.tsx`), the canvas share-card renderer
 * (`lib/share-card.ts`) and the generated assets (`scripts/gen-brand-assets.mjs`)
 * all draw the exact same shape.
 *
 * This is Lucide's `flame` glyph (ISC, lucide-react v1.47.0 — the artwork
 * lucide.dev ships today) in its native 24×24 box, so the brand mark is the
 * same flame the app already uses in the UI. Lucide draws it as a stroke
 * icon, and the mark keeps that: a 2-unit round stroke, exactly as the icon
 * page renders it, on every surface (React, canvas, generated assets).
 */
export const FLAME_PATH =
  'M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4';

/**
 * Lucide's stroke weight in 24-box units, with round caps and joins. The
 * generated favicon rasters widen it optically at tiny sizes — see
 * `scripts/gen-brand-assets.mjs`.
 */
export const FLAME_STROKE = 2;

/** Volt — the brand accent. Near-black ink always sits on top of it. */
export const VOLT = '#8AD200';
/** The ink the brand prints on volt surfaces. */
export const VOLT_INK = '#101010';
