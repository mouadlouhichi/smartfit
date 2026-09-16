import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY_FALLBACK_COLOR,
  CATEGORY_SWATCHES,
  CONTRAST_DARK_CARD,
  CONTRAST_WHITE,
  DEFAULT_CATEGORIES,
  INTENSITY_META,
  computeAchievements,
  contrastRatio,
  emptyState,
} from '@smartfit/core';

/**
 * The data-driven color contract (see packages/core/src/colors.ts).
 *
 * Category/intensity colors are rendered on adaptive surfaces — icons and
 * fills on light cards, icons and *text* on the dark theme — so every
 * data-driven color must clear the shared band:
 *
 *   ≥ 3:1  against #ffffff   (WCAG 1.4.11 graphics, light theme)
 *   ≥ 4.5:1 against #1a1a1a  (WCAG 1.4.3 text, dark theme / mobile)
 *
 * If this test fails, a color escaped the band — extend the palette only
 * with colors verified against both reference surfaces.
 */

const WHITE_MIN = 3;
const DARK_MIN = 4.5;

test('category swatches clear the AA band on both themes', () => {
  for (const swatch of CATEGORY_SWATCHES) {
    assert.ok(
      contrastRatio(swatch, CONTRAST_WHITE) >= WHITE_MIN,
      `${swatch} vs white: ${contrastRatio(swatch, CONTRAST_WHITE).toFixed(2)}`,
    );
    assert.ok(
      contrastRatio(swatch, CONTRAST_DARK_CARD) >= DARK_MIN,
      `${swatch} vs dark card: ${contrastRatio(swatch, CONTRAST_DARK_CARD).toFixed(2)}`,
    );
  }
  assert.ok(contrastRatio(CATEGORY_FALLBACK_COLOR, CONTRAST_WHITE) >= WHITE_MIN);
  assert.ok(contrastRatio(CATEGORY_FALLBACK_COLOR, CONTRAST_DARK_CARD) >= DARK_MIN);
});

test('builtin categories only use band colors', () => {
  for (const category of DEFAULT_CATEGORIES) {
    assert.ok(
      contrastRatio(category.color, CONTRAST_WHITE) >= WHITE_MIN &&
        contrastRatio(category.color, CONTRAST_DARK_CARD) >= DARK_MIN,
      `${category.name} (${category.color}) left the AA band`,
    );
  }
});

test('intensity colors work as text on dark and dots on light', () => {
  for (const meta of Object.values(INTENSITY_META)) {
    assert.ok(
      contrastRatio(meta.color, CONTRAST_DARK_CARD) >= DARK_MIN,
      `${meta.label} text on dark: ${contrastRatio(meta.color, CONTRAST_DARK_CARD).toFixed(2)}`,
    );
    assert.ok(
      contrastRatio(meta.color, CONTRAST_WHITE) >= WHITE_MIN,
      `${meta.label} dot on white: ${contrastRatio(meta.color, CONTRAST_WHITE).toFixed(2)}`,
    );
  }
});

test('achievement tints carry readable ink in both polarities', () => {
  // Medals render a near-black icon on the tint; every generated tint must
  // keep that ink ≥ 3:1, and the volt tint ≥ 7:1 (AAA for the icon glyph).
  const ink = '#141414';
  const tints = [...new Set(computeAchievements(emptyState()).map((a) => a.tint))];
  assert.ok(tints.length >= 5, 'achievement tints unexpectedly collapsed');
  for (const tint of tints) {
    assert.ok(
      contrastRatio(ink, tint) >= 3,
      `tint ${tint} too dark for its ink icon (${contrastRatio(ink, tint).toFixed(2)})`,
    );
  }
  assert.ok(contrastRatio(ink, '#9cff00') >= 7, 'ink on volt dropped below AAA');
});

test('contrastRatio sanity: pure black vs pure white is 21:1', () => {
  assert.equal(contrastRatio('#000000', '#ffffff').toFixed(1), '21.0');
});
