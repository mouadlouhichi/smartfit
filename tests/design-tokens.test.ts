import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nextTabIndex } from '../src/components/ui/use-tablist';

/*
 * Guards for the 2026-09 UI/UX + contrast pass.
 *
 * 1. Brand-green discipline. The product carries exactly one electric green
 *    (volt #8ad200 + its ramp). An earlier "enhanced" pass introduced two
 *    competing greens — neon #a8ff00 (28 uses) and "growth" #3ac14e — which
 *    broke brand coherence and (for #3ac14e on light surfaces) contrast.
 *    They are gone; this test keeps them out.
 * 2. The tablist keyboard math used by every hand-rolled role="tablist".
 */

function tsxFiles(dir: string): string[] {
  const abs = path.resolve(root, dir);
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const full = `${abs}/${e.name}`;
    if (e.isDirectory()) return tsxFiles(path.relative(root, full));
    return e.name.endsWith('.tsx') ? [full] : [];
  });
}
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('no off-brand greens in components (volt is the one electric green)', () => {
  const forbidden = ['#a8ff00', '#3ac14e'];
  // muscle-map.tsx owns the map's reference data colors (see next test).
  const exempt = new Set(['muscle-map.tsx']);
  for (const file of tsxFiles('src')) {
    if (exempt.has(path.basename(file))) continue;
    const src = fs.readFileSync(file, 'utf8').toLowerCase();
    for (const hex of forbidden) {
      assert.ok(
        !src.includes(hex),
        `${path.relative(root, file)}: ${hex} is off-brand — use the volt tokens (bg-volt / text-volt-soft / --color-volt-dim) instead`,
      );
    }
  }
});

test('the muscle-map figure keeps its reference data colors (allowed list)', () => {
  // The map's green is data (an SVG fill on the near-black figure), not UI —
  // it stays, but only in the map module that owns it.
  const map = fs.readFileSync(path.resolve(root, 'src/components/body/muscle-map.tsx'), 'utf8');
  assert.ok(map.includes("upper: '#3ac14e'"));
});

test('nextTabIndex follows the WAI-ARIA tabs pattern', () => {
  // Horizontal wrap
  assert.equal(nextTabIndex('ArrowRight', 0, 3), 1);
  assert.equal(nextTabIndex('ArrowRight', 2, 3), 0);
  assert.equal(nextTabIndex('ArrowLeft', 0, 3), 2);
  assert.equal(nextTabIndex('ArrowLeft', 1, 3), 0);
  // Vertical aliases
  assert.equal(nextTabIndex('ArrowDown', 1, 3), 2);
  assert.equal(nextTabIndex('ArrowUp', 0, 3), 2);
  // Home / End
  assert.equal(nextTabIndex('Home', 2, 5), 0);
  assert.equal(nextTabIndex('End', 0, 5), 4);
  // Everything else is not navigation
  assert.equal(nextTabIndex('Enter', 0, 3), null);
  assert.equal(nextTabIndex('Tab', 1, 3), null);
  assert.equal(nextTabIndex('x', 0, 3), null);
});

test('nextTabIndex survives single-tab lists', () => {
  assert.equal(nextTabIndex('ArrowRight', 0, 1), 0);
  assert.equal(nextTabIndex('ArrowLeft', 0, 1), 0);
});
