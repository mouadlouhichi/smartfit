#!/usr/bin/env node
/**
 * Theme contrast audit.
 *
 * Reads the real tokens out of `src/app/globals.css` and computes WCAG contrast
 * ratios for the text/surface pairs the app actually renders, so "is the light
 * theme dark enough here?" is a number rather than an opinion.
 *
 * Usage: node scripts/audit-theme.mjs
 *
 * The permanent version of this audit is `tests/theme-contrast.test.ts`, which
 * runs in CI and fails on a regression. This script is the same maths with a
 * full table for eyeballing during design work.
 */
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

/** Pull `--name: #hex;` declarations out of one CSS block. */
function readBlock(startRe, endRe) {
  const start = css.search(startRe);
  if (start < 0) throw new Error('block not found');
  const rest = css.slice(start);
  const end = rest.search(endRe);
  const body = end < 0 ? rest : rest.slice(0, end);
  const tokens = {};
  for (const [, name, value] of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{3,8})\s*;/gi)) {
    tokens[name] = value;
  }
  return tokens;
}

const light = readBlock(/:root\s*\{/, /\.dark\s*\{/);
const dark = readBlock(/\.dark\s*\{/, /@theme/);

function rgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex) {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** [text token, surface token, minimum, what it is] */
const PAIRS = [
  ['foreground', 'background', 4.5, 'body text on the canvas'],
  ['foreground', 'card', 4.5, 'body text on a card'],
  ['card-foreground', 'card', 4.5, 'card text'],
  ['muted-foreground', 'background', 4.5, 'secondary text on canvas'],
  ['muted-foreground', 'card', 4.5, 'secondary text on a card'],
  ['muted-foreground', 'muted', 4.5, 'secondary text on a muted chip'],
  ['muted-foreground', 'secondary', 4.5, 'secondary text on a secondary chip'],
  ['primary-foreground', 'primary', 4.5, 'ink on a primary button'],
  ['secondary-foreground', 'secondary', 4.5, 'secondary chip text'],
  ['accent-foreground', 'accent', 4.5, 'accent chip text'],
  ['popover-foreground', 'popover', 4.5, 'menu text'],
  ['destructive-foreground', 'destructive', 4.5, 'ink on a destructive button'],
  // --volt-ink is rendered as *text* (eyebrows, stat deltas), so it is a 4.5 pair.
  ['volt-ink', 'background', 4.5, 'volt text on canvas'],
  ['volt-ink', 'card', 4.5, 'volt text on a card'],
  // Control boundaries: 3:1 so a field is identifiable as a field (WCAG 1.4.11).
  ['input', 'card', 3, 'input border on a card'],
  ['input', 'background', 3, 'input border on canvas'],
  ['input', 'field', 3, 'input border against its own field'],
  ['border', 'background', 1.2, 'hairline borders (decorative)'],
  // The field fill is a *secondary* cue, so 1.04 is the floor — the number
  // that matters is that it is not identical to the card. It was, once, which
  // is how a whole design-system pass ended up with invisible fields.
  ['field', 'card', 1.04, 'field fill vs the card behind it'],
  ['field', 'background', 1.04, 'field fill vs the canvas'],
];

let failures = 0;
for (const [theme, tokens] of [
  ['light', light],
  ['dark', dark],
]) {
  console.log(`\n── ${theme} ${'─'.repeat(58)}`);
  for (const [fgName, bgName, min, label] of PAIRS) {
    const fg = tokens[fgName];
    const bg = tokens[bgName];
    if (!fg || !bg) {
      console.log(`  ?  ${label}: missing token (${fgName} / ${bgName})`);
      continue;
    }
    const ratio = contrast(fg, bg);
    const ok = ratio >= min;
    if (!ok) failures++;
    console.log(
      `  ${ok ? '✓' : '✗'}  ${ratio.toFixed(2).padStart(5)}:1  (min ${min})  ${label}  ${fg} on ${bg}`,
    );
  }
}

console.log(`\n${failures === 0 ? '✓ all pairs pass' : `✗ ${failures} pair(s) below target`}\n`);
process.exit(failures === 0 ? 0 : 1);
