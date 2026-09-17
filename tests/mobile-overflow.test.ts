import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Horizontal-overflow guard.
 *
 * A scrolling rail (`overflow-x-auto` + `flex`) still reports its full
 * min-content width to its parent unless it is allowed to shrink. Inside a
 * grid/flex item (default `min-width:auto`) that width stretches the whole
 * column, and the dashboard shell's `overflow-x-clip` then *hides* the
 * excess instead of scrolling it — the page silently loses its right edge
 * on a phone. Every horizontal rail must therefore carry `min-w-0`.
 */
function tsxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = `${dir}/${e.name}`;
    if (e.isDirectory()) return tsxFiles(full);
    return e.name.endsWith('.tsx') ? [full] : [];
  });
}
const RAILS = tsxFiles('src');

test('every horizontal scroll rail can shrink below its content width', () => {
  for (const file of RAILS) {
    const src = fs.readFileSync(file, 'utf8');
    const classAttrs = src.match(/className="[^"]*"/g) ?? [];
    for (const attr of classAttrs) {
      const isRail = attr.includes('overflow-x-auto') && /\bflex\b/.test(attr);
      if (!isRail) continue;
      assert.ok(
        attr.includes('min-w-0'),
        `${file}: horizontal rail must include min-w-0 to avoid stretching its column:\n  ${attr}`,
      );
    }
  }
});
