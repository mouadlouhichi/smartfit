import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * One mark everywhere: the volt flame cell in `components/brand.tsx` is the
 * only logo the product shows — favicon, splash, dashboard header, landing
 * nav and footer. The landing once hand-rolled a dumbbell glyph that drifted
 * from the brand; this pins every surface back to the shared component.
 */
const OLD_DUMBBELL = 'M6.5 8.5v7M17.5 8.5v7M3.5 10.5v3M20.5 10.5v3M6.5 12h11';

const SURFACES = [
  'src/components/landing/navigation.tsx',
  'src/components/landing/footer-section.tsx',
];

test('landing surfaces render the shared brand mark, not a hand-rolled glyph', () => {
  for (const file of SURFACES) {
    const src = readFileSync(file, 'utf8');
    assert.ok(
      !src.includes(OLD_DUMBBELL),
      `${file} still draws the old dumbbell glyph instead of the brand flame`,
    );
    assert.ok(
      src.includes("from '@/components/brand'"),
      `${file} must import the shared mark from components/brand`,
    );
    assert.ok(src.includes('<Logo '), `${file} must render <Logo />`);
  }
});

test('the shared mark is the flame geometry from lib/brand-mark', () => {
  const brand = readFileSync('src/components/brand.tsx', 'utf8');
  assert.match(brand, /FLAME_PATH/, 'Logo must draw FLAME_PATH, the single source of truth');
  const mark = readFileSync('src/lib/brand-mark.ts', 'utf8');
  assert.match(mark, /M12 3q1 4 4 6\.5/, 'FLAME_PATH geometry changed — regenerate brand assets');
});
