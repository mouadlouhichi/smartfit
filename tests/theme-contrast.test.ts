import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

/**
 * The theme audit, enforced.
 *
 * Both themes claim WCAG contrast in their comments, and comments drift. This
 * reads the real tokens out of `globals.css` and checks the pairs the app
 * actually renders, so a "prettier" colour cannot quietly drop below AA.
 *
 * Thresholds: 4.5:1 for text, 3:1 for the boundaries and graphics that are not
 * text (WCAG 1.4.11), 1.2:1 for hairlines that are purely decorative (a card
 * also carries a shadow, so its border only has to separate, not identify).
 *
 * `scripts/audit-theme.mjs` prints the same table for design work.
 */

const css = fs.readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

/** Pull `--name: #hex;` declarations out of one CSS block. */
function readBlock(startRe: RegExp, endRe: RegExp): Record<string, string> {
  const start = css.search(startRe);
  assert.ok(start >= 0, `block ${startRe} not found`);
  const rest = css.slice(start);
  const end = rest.search(endRe);
  const body = end < 0 ? rest : rest.slice(0, end);
  const tokens: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{3,8})\s*;/gi)) {
    tokens[name] = value;
  }
  return tokens;
}

const THEMES: { name: string; tokens: Record<string, string> }[] = [
  { name: 'light', tokens: readBlock(/:root\s*\{/, /\.dark\s*\{/) },
  { name: 'dark', tokens: readBlock(/\.dark\s*\{/, /@theme/) },
];

function luminance(hex: string): number {
  let h = hex.replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const n = parseInt(h.slice(0, 6), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** [text token, surface token, minimum, description] */
const TEXT_PAIRS: [string, string, number, string][] = [
  ['foreground', 'background', 4.5, 'body text on the canvas'],
  ['foreground', 'card', 4.5, 'body text on a card'],
  ['card-foreground', 'card', 4.5, 'card text'],
  ['muted-foreground', 'background', 4.5, 'secondary text on canvas'],
  ['muted-foreground', 'card', 4.5, 'secondary text on a card'],
  ['muted-foreground', 'muted', 4.5, 'secondary text on a muted chip'],
  ['muted-foreground', 'secondary', 4.5, 'secondary text on a secondary chip'],
  ['muted-foreground', 'field', 4.5, 'placeholder text inside a field'],
  ['primary-foreground', 'primary', 4.5, 'ink on a primary button'],
  ['secondary-foreground', 'secondary', 4.5, 'secondary chip text'],
  ['accent-foreground', 'accent', 4.5, 'accent chip text'],
  ['popover-foreground', 'popover', 4.5, 'menu text'],
  ['destructive-foreground', 'destructive', 4.5, 'ink on a destructive button'],
  ['volt-ink', 'background', 4.5, 'volt text on canvas'],
  ['volt-ink', 'card', 4.5, 'volt text on a card'],
];

/** Non-text information: field boundaries, focus rings, chart strokes. */
const CONTROL_PAIRS: [string, string, number, string][] = [
  ['input', 'card', 3, 'field border on a card'],
  ['input', 'background', 3, 'field border on the canvas'],
  ['input', 'field', 3, 'field border against its own fill'],
  ['ring', 'card', 3, 'focus ring on a card'],
  ['ring', 'background', 3, 'focus ring on the canvas'],
  ['destructive', 'card', 4.5, 'error text on a card'],
  ['destructive', 'background', 4.5, 'error text on the canvas'],
  ['chart-1', 'card', 3, 'chart series 1'],
  ['chart-2', 'card', 3, 'chart series 2'],
  ['chart-5', 'card', 3, 'chart series 5'],
];

/** Decorative only — they must be *visible*, not legible. */
const HAIRLINES: [string, string, number, string][] = [
  ['border', 'background', 1.2, 'hairline on the canvas'],
  ['border', 'card', 1.2, 'hairline on a card'],
];

/**
 * Surface separation, not contrast: how far apart two *fills* are.
 *
 * A control whose fill equals the card behind it is only findable by its
 * border — which is exactly the state this suite found the field surface in.
 * The floor is deliberately low (1.04) because the fill is a secondary cue;
 * the point is that it can never silently become identical again.
 */
const FILL_SEPARATION: [string, string, number, string][] = [
  ['field', 'card', 1.04, 'field fill vs the card behind it'],
  ['field', 'background', 1.04, 'field fill vs the canvas'],
];

for (const theme of THEMES) {
  for (const group of [TEXT_PAIRS, CONTROL_PAIRS, HAIRLINES, FILL_SEPARATION]) {
    for (const [fgName, bgName, min, label] of group) {
      test(`${theme.name}: ${label} clears ${min}:1`, () => {
        const fg = theme.tokens[fgName];
        const bg = theme.tokens[bgName];
        assert.ok(fg, `${theme.name} has no --${fgName}`);
        assert.ok(bg, `${theme.name} has no --${bgName}`);
        const ratio = contrast(fg, bg);
        assert.ok(
          ratio >= min,
          `${theme.name}: --${fgName} on --${bgName} is ${ratio.toFixed(2)}:1, needs ${min}:1 (${label})`,
        );
      });
    }
  }
}

test('both themes define the same tokens', () => {
  // A token present in one theme only is how "it looks right in dark" becomes
  // a bug report about light mode.
  const [light, dark] = [THEMES[0].tokens, THEMES[1].tokens];
  const shared = [
    'background',
    'foreground',
    'card',
    'card-foreground',
    'popover',
    'popover-foreground',
    'primary',
    'primary-foreground',
    'secondary',
    'secondary-foreground',
    'muted',
    'muted-foreground',
    'accent',
    'accent-foreground',
    'destructive',
    'destructive-foreground',
    'border',
    'input',
    'field',
    'ring',
    'volt-ink',
    'chart-1',
    'chart-5',
  ];
  for (const token of shared) {
    assert.ok(light[token], `light is missing --${token}`);
    assert.ok(dark[token], `dark is missing --${token}`);
  }
});

test('every themed token is exposed to Tailwind', () => {
  // `--field` with no `--color-field` is a token nobody can use.
  for (const token of ['field', 'input', 'ring', 'border']) {
    assert.match(css, new RegExp(`--color-${token}:\\s*var\\(--${token}\\)`), `--color-${token}`);
  }
});
