/**
 * AA-verified brand color data — the one source of truth for every data-driven
 * color the apps render on adaptive (light *and* dark) surfaces.
 *
 * The constraint: a user-chosen category color has to work as an icon, a
 * chart fill, or (on mobile) a text label on both the white-ish light theme
 * and the #1a1a1a dark card. One color cannot hit 4.5:1 on both, so the
 * shared band used here is:
 *
 *   ≥ 3:1 on #ffffff   (WCAG graphics/UI-component bar, light theme)
 *   ≥ 4.5:1 on #1a1a1a (WCAG AA text bar, the dark-first mobile/theme)
 *
 * Every swatch below was verified against that band, and
 * `tests/contrast.test.ts` locks it in CI — extend the palette only through
 * that band (re-run the sweep in the design-system doc).
 */

/** WCAG relative contrast ratio between two hex colors. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lum = (hex: string): number => {
    const n = hex.replace('#', '');
    const v = [0, 2, 4].map((i) => {
      const c = parseInt(n.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const [hi, lo] = [lum(hexA), lum(hexB)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/** Reference surfaces the band is verified against. */
export const CONTRAST_WHITE = '#ffffff';
export const CONTRAST_DARK_CARD = '#1a1a1a';

/**
 * User-pickable category colors, in-band for both themes. Distinct hues so
 * categories stay distinguishable in chips, charts and the muscle map.
 */
export const CATEGORY_SWATCHES = [
  '#8a9a0f', // volt olive (brand lime, deepened)
  '#319b78', // green teal
  '#46949b', // cyan
  '#548fc9', // blue
  '#8c79c3', // violet
  '#ce64b4', // magenta
  '#d06c6c', // red
  '#b27f38', // amber
] as const;

/** Fallback when a category ships no color (imports, legacy data). */
export const CATEGORY_FALLBACK_COLOR: string = '#8a8a8a';
