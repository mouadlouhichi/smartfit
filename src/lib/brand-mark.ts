/**
 * Shared brand geometry — the one source of truth for the SmartFit flame so
 * the React mark (`components/brand.tsx`), the canvas share-card renderer
 * (`lib/share-card.ts`) and the generated assets (`scripts/gen-brand-assets.mjs`)
 * all draw the exact same shape.
 *
 * This is Lucide's `flame` glyph (ISC, lucide-react v0.468.0) in its native
 * 24×24 box, so the brand mark is the same flame the app already uses in the
 * UI. Lucide ships it as a stroke icon; the mark fills it instead, which
 * gives the solid silhouette the icon needs at favicon sizes. It is a single
 * closed subpath, so no fill-rule is required.
 */
export const FLAME_PATH =
  'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z';

/** Volt — the brand accent. Near-black ink always sits on top of it. */
export const VOLT = '#8AD200';
/** The ink the brand prints on volt surfaces. */
export const VOLT_INK = '#101010';
