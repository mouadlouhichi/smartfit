/**
 * Shared brand geometry — the one source of truth for the SmartFit flame so
 * the React mark (`components/brand.tsx`), the canvas share-card renderer
 * (`lib/share-card.ts`) and the generated assets (`scripts/gen-brand-assets.mjs`)
 * all draw the exact same shape.
 *
 * The flame lives in a 24×24 box: a tall teardrop body with a curled tip and
 * an inner cutout, drawn as two subpaths. It needs `fill-rule: evenodd` (SVG)
 * or `'evenodd'` (canvas) for the cutout to punch through. The mark itself is
 * a rounded-square "charge cell" in volt (#8AD200) with near-black ink on top.
 */
export const FLAME_PATH =
  'M12.9 1.3 C12.5 0.9 11.8 1.1 11.7 1.7 C11.3 4.6 9.9 6.4 8.2 8.1 C6.2 10.1 4.4 12.3 4.4 15.3 C4.4 19.6 7.8 22.9 12 22.9 C16.2 22.9 19.6 19.6 19.6 15.3 C19.6 11.5 17.6 9.3 15.9 7.2 C14.3 5.2 13.4 3.6 12.9 1.3 Z M12 20.4 C10.1 20.4 8.6 18.9 8.6 17 C8.6 15.2 9.6 14.1 10.6 13 C11.2 12.4 11.8 11.7 12.1 10.8 C12.5 11.9 13.1 12.6 13.7 13.3 C14.6 14.3 15.4 15.3 15.4 17 C15.4 18.9 13.9 20.4 12 20.4 Z';

/** Volt — the brand accent. Near-black ink always sits on top of it. */
export const VOLT = '#8AD200';
/** The ink the brand prints on volt surfaces. */
export const VOLT_INK = '#101010';
