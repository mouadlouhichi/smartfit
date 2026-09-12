/**
 * Shared brand geometry — the one source of truth for the SmartFit bolt so
 * the React mark (`components/brand.tsx`), the canvas share-card renderer
 * (`lib/share-card.ts`) and the generated assets (`scripts/gen-brand-assets.mjs`)
 * all draw the exact same shape.
 *
 * The bolt lives in a 24×24 box, drawn as a closed polygon (sharp, athletic,
 * slightly italic slant). The mark itself is a rounded-square "charge cell"
 * in volt (#F3FF47) with near-black ink on top.
 */
export const BOLT_PATH =
  'M13 2 L4.6 13.2 Q4.2 13.8 4.9 13.8 L10.4 13.8 L8.9 21.2 Q8.8 21.9 9.4 21.3 L19.4 9.6 Q19.9 9 19.1 9 L13.4 9 Z';

/** Volt — the brand accent. Near-black ink always sits on top of it. */
export const VOLT = '#f3ff47';
/** The ink the brand prints on volt surfaces. */
export const VOLT_INK = '#101010';
