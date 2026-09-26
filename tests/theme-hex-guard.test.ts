import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * The literal-colour guard.
 *
 * `theme-contrast.test.ts` proves the *tokens* are accessible. This proves
 * nothing quietly bypasses them: every `#rrggbb` in `src/` has to belong to a
 * file on the list below, and every entry has to say why.
 *
 * That why matters more than the count. There are only three legitimate
 * reasons to hard-code a colour in this app:
 *
 *   1. **No CSS is available at the point of use** — canvas 2D drawing, a map
 *      renderer evaluating style expressions in its own worker, an SVG path
 *      baked into a data URL, or the root error page that renders before (and
 *      without) the app's stylesheet.
 *   2. **The value is data, not chrome** — a gym's stored brand colour, the
 *      colour presets we offer them, a chart series palette, the anatomical key
 *      on the muscle map. These are persisted or transmitted as strings; a CSS
 *      variable would not survive the round trip.
 *   3. **It is somebody else's brand** — the Google mark on the sign-in button,
 *      the browser `theme-color` meta tag (read by the OS, not the page).
 *
 * Anything else belongs in `globals.css` as a token. When this test fails, the
 * fix is to add a token — not a filename.
 */

/** file → why it is allowed to hold a literal colour. */
const ALLOWED: Record<string, string> = {
  // ── 1 · no CSS at the point of use ──────────────────────────────────────
  'src/lib/brand-mark.ts':
    'canvas/asset brand constants (the share card and the generated favicons draw these, and a canvas has no cascade)',
  'src/lib/share-card.ts':
    'canvas 2D share-image renderer — `ctx.fillStyle` cannot resolve a CSS variable',
  'src/lib/route-art.ts': 'canvas renderer for the workout receipt, same constraint as share-card',
  'src/components/dashboard/run/run-map.tsx':
    'MapLibre paint expressions are evaluated in the map worker, outside the document — no cascade, no `var()`',
  'src/app/global-error.tsx':
    'renders when the root layout itself failed, so it cannot rely on app styles; its palette is deliberately inline',
  'src/app/layout.tsx':
    'the splash <style> runs before first paint but *can* use tokens — only the browser `theme-color` meta tag and the inline brand mark keep literals (the OS reads those, not the page)',

  // ── 2 · the value is data, not chrome ───────────────────────────────────
  'src/components/tenant/profile-studio.tsx':
    'accent-colour presets offered to gym owners — the chosen value is persisted to Firestore',
  'src/components/admin/workspace.tsx':
    'chart series palette for platform analytics, matched to the exported CSV colours',
  'src/lib/admin-demo.ts': 'demo fixtures — stored data, not presentation',
  'src/lib/tenant-demo.ts': 'demo fixtures — stored data, not presentation',
  'src/lib/gym-profile.ts': 'stored gym profile defaults',
  'src/components/body/muscle-map.tsx':
    'anatomical key: green/blue/yellow are the muscle *legend*, indexed by group name',
  'src/components/body/muscle-map-modal.tsx': 'same anatomical key as muscle-map.tsx',
  'src/components/ui/artwork.tsx': 'illustration palette baked into inline SVG',
  'src/components/landing/animated-sphere.tsx':
    'reads tokens first and keeps hexes only as fallbacks for a not-yet-styled frame',
  'src/components/tenant/brand-media.tsx': 'falls back to a stored tenant accent before paint',

  // ── 3 · somebody else's brand ───────────────────────────────────────────
  'src/app/login/page.tsx':
    "Google's four mark colours — using our tokens would misdraw their logo",

  // ── 4 · not a rendered colour at all ────────────────────────────────────
  'src/components/admin/sections.tsx':
    'a form *hint* ("#8ad200") showing an admin the expected format for a gym accent — the text is the point, nothing paints it',
  /**
   * The token file itself. This is the palette: it is where every value the
   * other files are forbidden from writing down is supposed to live.
   */
  'src/app/globals.css': 'the token file — the one place a raw palette value belongs',
};

const ROOT = new URL('../', import.meta.url);
const SRC = new URL('../src/', import.meta.url);

/** Every file under `src/` with at least one `#rrggbb` literal. */
function filesWithHex(root: URL, prefix = 'src/'): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), root);
    if (entry.isDirectory()) found.push(...filesWithHex(child, `${prefix}${entry.name}/`));
    else if (/\.(tsx?|css)$/.test(entry.name)) {
      const text = fs.readFileSync(child, 'utf8');
      if (/#[0-9a-f]{6}\b/i.test(text)) found.push(`${prefix}${entry.name}`);
    }
  }
  return found.sort();
}

const withHex = filesWithHex(SRC);

test('every literal colour in src/ is on the documented allowlist', () => {
  const unlisted = withHex.filter((f) => !(f in ALLOWED));
  assert.deepEqual(
    unlisted,
    [],
    `these files hard-code a colour and are not on the allowlist:\n  ${unlisted.join('\n  ')}\n` +
      'Add a token in globals.css, or add the file to ALLOWED with the reason it cannot use one.',
  );
});

test('globals.css is the only stylesheet holding raw palette values, and holds them as tokens', () => {
  // The token file is allowed — it *is* the palette. Anywhere else under src/
  // that ships CSS must consume tokens.
  for (const file of withHex) {
    if (!file.endsWith('.css')) continue;
    assert.equal(
      file,
      'src/app/globals.css',
      `${file} holds raw colours; the palette lives in globals.css`,
    );
  }
});

test('the allowlist has no stale entries', () => {
  const stale = Object.keys(ALLOWED).filter((f) => !withHex.includes(f));
  assert.deepEqual(
    stale,
    [],
    `these files no longer hold a literal colour — drop them from ALLOWED:\n  ${stale.join('\n  ')}`,
  );
});

test('every allowlist entry states a reason', () => {
  for (const [file, why] of Object.entries(ALLOWED)) {
    assert.ok(
      why.trim().length > 20,
      `${file} needs a real reason (a category from the header, not a shrug)`,
    );
  }
});

test('the chrome surfaces read tokens, not hexes', () => {
  // A spot-check on the files this guard exists for: the modal chrome, the
  // progress hero and the shell were all pinned to literals once.
  const chrome = [
    'src/components/dashboard/modals/pro-modal.tsx',
    'src/components/dashboard/modals/session-runner-modal.tsx',
    'src/components/dashboard/modals/progress-achievement-modal.tsx',
    'src/components/dashboard/share-sheet.tsx',
    'src/components/dashboard/mobile-nav.tsx',
    'src/components/dashboard/achievement-wall.tsx',
    'src/components/dashboard/screens/overview-screen.tsx',
    'src/components/dashboard/screens/progress-screen.tsx',
  ];
  for (const file of chrome) {
    const text = fs.readFileSync(new URL(file, ROOT), 'utf8');
    const hexes = text.match(/#[0-9a-f]{6}\b/gi) ?? [];
    assert.deepEqual(hexes, [], `${file} should read tokens but still holds ${hexes.join(', ')}`);
  }
});

test('no component stylesheet outside the token file defines colours', () => {
  // Guards the other direction: a new .css file with a hex in it is a token
  // that no theme can reach.
  const cssFiles = filesWithHex(SRC).filter((f) => f.endsWith('.css'));
  assert.deepEqual(cssFiles, ['src/app/globals.css']);
});
