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

/**
 * Dialog footers stack (`flex-col-reverse`) on mobile. Wrapping the actions in
 * a bare inline element re-introduces a cramped side-by-side row inside that
 * stack and leaves the buttons auto-width, so they read as tiny targets on a
 * phone. Footer action buttons must be full-width until `sm`.
 */
test('modal footer actions are full-width on mobile', () => {
  const modals = tsxFiles('src/components/dashboard/modals');
  for (const file of modals) {
    const src = fs.readFileSync(file, 'utf8');
    if (!src.includes('<DialogFooter')) continue;
    const footer = src.slice(src.indexOf('<DialogFooter'), src.indexOf('</DialogFooter>'));
    assert.ok(
      !/<span className="flex gap-2">/.test(footer),
      `${file}: footer actions must not sit in a bare inline row`,
    );
    for (const attr of footer.match(/className="[^"]*"/g) ?? []) {
      if (!/\bw-full\b/.test(attr) && /text-destructive|w-auto/.test(attr)) {
        assert.ok(
          /w-full/.test(attr),
          `${file}: footer button must be w-full on mobile:\n  ${attr}`,
        );
      }
    }
  }
});

/**
 * The coach lives on its own route and MobileNav hides itself there, so the
 * screen has to provide its own way back or a phone user is trapped.
 */
test('the full-screen coach offers a way back on mobile', () => {
  const src = fs.readFileSync('src/app/dashboard/coach/page.tsx', 'utf8');
  assert.ok(
    src.includes('href="/dashboard"'),
    'coach page must link back to the dashboard (the bottom nav is hidden here)',
  );
});

/**
 * The session runner's exercise navigator belongs at the bottom of the sheet,
 * under the thumb and above the finish bar (matching assets/ui.webp). It is
 * easy to reintroduce it above the stage during a refactor, so pin the order.
 */
test('the runner navigator sits below the exercise stage', () => {
  const src = fs.readFileSync('src/components/dashboard/modals/session-runner-modal.tsx', 'utf8');
  const stage = src.indexOf('Cinematic exercise hero');
  const navigator = src.indexOf('Next-up navigator');
  const finish = src.indexOf('Thumb-zone finish bar');
  assert.ok(stage > 0 && navigator > 0 && finish > 0, 'runner landmarks must all exist');
  assert.ok(navigator > stage, 'the exercise navigator must render after the stage');
  assert.ok(navigator < finish, 'the exercise navigator must sit above the finish bar');
});
