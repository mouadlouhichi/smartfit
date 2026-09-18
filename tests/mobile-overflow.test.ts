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
 * The runner's bottom chrome must stay below the stage: both the finish bar
 * and the pinned navigator render after the exercise hero, never above it.
 * Their relative order is asserted by the pinning test below.
 */
test('the runner navigator sits below the exercise stage', () => {
  const src = fs.readFileSync('src/components/dashboard/modals/session-runner-modal.tsx', 'utf8');
  const stage = src.indexOf('Cinematic exercise hero');
  const navigator = src.indexOf('Next-up navigator');
  const finish = src.indexOf('── Finish bar');
  assert.ok(stage > 0 && navigator > 0 && finish > 0, 'runner landmarks must all exist');
  assert.ok(navigator > stage, 'the exercise navigator must render after the stage');
  assert.ok(finish > stage, 'the finish bar must render after the stage');
});

/**
 * A percentage-height child (the demo tile is `h-full`) resolves against its
 * parent's *unconstrained* height. Pairing `aspect-[x/y]` with `max-h-*` caps
 * the box but not the child, so the artwork overflowed and painted over the
 * caption band below it, slicing the "SET n / total" eyebrow in half. Any
 * ratio box that caps its height must also clip.
 */
test('aspect-ratio boxes that cap their height also clip their children', () => {
  for (const file of tsxFiles('src')) {
    const src = fs.readFileSync(file, 'utf8');
    for (const attr of src.match(/className="[^"]*"/g) ?? []) {
      const ratio = /\baspect-\[/.test(attr);
      const capped = /\bmax-h-/.test(attr);
      if (ratio && capped) {
        assert.ok(
          /\boverflow-(hidden|clip)\b/.test(attr),
          `${file}: aspect box with max-h must clip so a h-full child cannot overflow:\n  ${attr}`,
        );
      }
    }
  }
});

/**
 * Division of the runner's bottom chrome:
 *  - the next-up navigator is a flex sibling of the scroll column, so it
 *    pins to the sheet floor and Next is always one tap away;
 *  - the finish bar stays inside the column and scrolls, because finishing
 *    is a once-per-session action and two pinned slabs left almost no room
 *    for the exercise stage on a short phone.
 */
test('the navigator pins while the finish bar scrolls', () => {
  const src = fs.readFileSync('src/components/dashboard/modals/session-runner-modal.tsx', 'utf8');
  const scroll = src.indexOf('<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">');
  assert.ok(scroll > 0, 'the live screen scroll container must exist');
  const scrollEnd = src.indexOf('      </div>\n\n      {/* ── Next-up navigator', scroll);
  assert.ok(scrollEnd > scroll, 'the scroll column must close before the navigator');

  const finish = src.indexOf('── Finish bar');
  const navigator = src.indexOf('Next-up navigator');
  assert.ok(
    scroll < finish && finish < scrollEnd,
    'the finish bar must scroll with the content, not hold permanent space',
  );
  assert.ok(
    navigator > scrollEnd,
    'the next-up navigator must sit outside the scroll column so it stays pinned',
  );
});

/**
 * The installed PWA's chrome must match the app, not the accent. `theme_color`
 * tints the status bar and task-switcher card in a standalone window, so a
 * volt value painted a bright green bar above a near-black app.
 */
test('the PWA manifest matches the app canvas', () => {
  const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
  const dark = '#050404';
  assert.equal(manifest.background_color, dark, 'splash must match the dark canvas');
  assert.equal(manifest.theme_color, dark, 'theme_color must not be the volt accent');
});

/**
 * The manifest is precached by the service worker, so shipping a new one
 * without bumping VERSION would leave existing installs on the old colours.
 */
test('the service worker precaches the manifest under a versioned cache', () => {
  const sw = fs.readFileSync('public/sw.js', 'utf8');
  assert.match(sw, /const VERSION = 'smartfit-v(\d+)'/, 'sw must carry a numbered version');
  assert.ok(sw.includes("'/manifest.webmanifest'"), 'manifest should stay precached');
});
