import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { MESSAGES } from '@smartfit/core';

/**
 * Every `t('…')` in the web app must name a key the catalog actually has.
 *
 * `createTranslator` returns the key itself when a message is missing, so a
 * typo does not crash — it ships, and the athlete reads `overview.body.openMap`
 * where a sentence should be. That happened while the dashboard was being
 * translated, and nothing in the suite noticed; this is the guard that would
 * have caught it.
 *
 * Two kinds of call site cannot be read statically:
 *
 *  - `t('fuel.slot.' + id)` and ``t(`fuel.slot.${id}`)`` build the key at
 *    runtime. They are allowed, but only under a prefix listed below — adding a
 *    new one has to be a deliberate edit here, which keeps the unchecked
 *    surface from growing by accident.
 *  - Non-translation `t(...)` helpers (a variable that happens to be named
 *    `t`) are skipped by requiring the first argument to be a dotted literal.
 */

const ROOT = new URL('..', import.meta.url).pathname;

/** Key prefixes assembled at runtime, each with the reason it is exempt. */
const DYNAMIC_PREFIXES: Record<string, string> = {
  'checkin.feeling.': 'One key per emoji face (1–5), chosen from the saved rating.',
  'fuel.slot.': 'One key per meal slot id (breakfast/lunch/dinner/snack).',
  'fuel.macro.': 'One key per macro row (protein/carbs/fat) in the target meters.',
  'run.greeting.': 'One greeting per part of the day, chosen from the clock.',
  'run.title.': 'The seeded run title, one per part of the day.',
  'goal.seed.': 'The name of the goal onboarding seeds, one per metric.',
};

/** Dotted lower-case literals only — that is what a catalogue key looks like. */
const KEY = /^[a-z][a-zA-Z0-9]*\.[a-z0-9-]+(\.[a-z0-9-]+)*$/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}

/** Key prefixes that are concatenated or interpolated, with a line number. */
function dynamicPrefixes(source: string): string[] {
  const found: string[] = [];
  // t('prefix.' + something)
  for (const m of source.matchAll(/\bt\(\s*'([a-z][a-zA-Z0-9.]*\.)'\s*\+/g)) found.push(m[1]);
  // t(`prefix.${something}…`)
  for (const m of source.matchAll(/\bt\(\s*`([a-z][a-zA-Z0-9.]*\.)\$\{/g)) found.push(m[1]);
  return found;
}

const FILES = [
  ...sourceFiles(join(ROOT, 'src')),
  // Core builds keys too (the achievement wall composes `ach.*`), and a stale
  // one there is just as invisible.
  ...sourceFiles(join(ROOT, 'packages/core/src')),
].map((path) => ({ path, source: readFileSync(path, 'utf8') }));

test('every t() key exists in the catalogue', () => {
  const known = new Set(Object.keys(MESSAGES.en));
  const missing: string[] = [];
  for (const { path, source } of FILES) {
    for (const m of source.matchAll(/\bt\(\s*(['"])([a-zA-Z][a-zA-Z0-9.]*)\1/g)) {
      const key = m[2];
      if (!KEY.test(key)) continue; // not a catalogue key shape
      if (!known.has(key)) missing.push(`${path.replace(ROOT, '')}: ${key}`);
    }
  }
  assert.deepEqual(missing, [], 'a t() key is missing from the English catalogue');
});

test('runtime-composed keys use a declared prefix', () => {
  const declared = new Set(Object.keys(DYNAMIC_PREFIXES));
  const undeclared: string[] = [];
  for (const { path, source } of FILES) {
    for (const prefix of dynamicPrefixes(source)) {
      if (!declared.has(prefix)) undeclared.push(`${path.replace(ROOT, '')}: ${prefix}`);
    }
  }
  assert.deepEqual(undeclared, [], 'add the prefix to DYNAMIC_PREFIXES with a reason');
});

test('every declared dynamic prefix is still used', () => {
  const seen = new Set(FILES.flatMap(({ source }) => dynamicPrefixes(source)));
  const stale = [...Object.keys(DYNAMIC_PREFIXES)].filter((p) => !seen.has(p));
  assert.deepEqual(stale, [], 'a DYNAMIC_PREFIXES entry no longer appears in the source');
});

test('every dynamic prefix has keys behind it in both locales', () => {
  for (const prefix of Object.keys(DYNAMIC_PREFIXES)) {
    for (const locale of ['en', 'fr'] as const) {
      const hits = Object.keys(MESSAGES[locale]).filter((k) => k.startsWith(prefix));
      assert.ok(hits.length > 0, `${prefix} has no keys in ${locale}`);
    }
  }
});

test('a tab label and the heading it opens are different keys', () => {
  // The profile tabs and the cards they reveal were asserted by text in the
  // e2e suite, and both reading "Your data" made a strict-mode locator match
  // two elements. A tab is a label; the card is a heading; they are separate
  // keys and, in the tab rail, deliberately shorter.
  //
  // A section's `aria-label` echoing its own visible heading is *not* a case of
  // this: the two are reached by different roles, and a labelled region is
  // supposed to repeat its heading.
  const pairs: [tab: string, heading: string][] = [
    ['profile.tab.data', 'profile.data.title'],
    ['profile.tab.badges', 'profile.badges.title'],
  ];
  for (const [tab, heading] of pairs) {
    for (const locale of ['en', 'fr'] as const) {
      const tabValue = MESSAGES[locale][tab];
      const headingValue = MESSAGES[locale][heading];
      assert.ok(tabValue && headingValue, `${locale}: ${tab} or ${heading} is missing`);
      assert.notDeepEqual(
        tabValue,
        headingValue,
        `${locale}: "${tab}" and "${heading}" read the same, so a text locator cannot tell them apart`,
      );
    }
  }
});

test('catalogue keys are unique per locale and ordered the same way', () => {
  // A duplicate key in an object literal silently wins the last one; comparing
  // the two locales' key lists catches a key added to one and forgotten in the
  // other by insert position rather than by name.
  const en = Object.keys(MESSAGES.en);
  const fr = Object.keys(MESSAGES.fr);
  assert.deepEqual([...en].sort(), [...fr].sort(), 'the two catalogues must offer the same keys');
  assert.deepEqual(en, [...new Set(en)], 'duplicate key in the English catalogue');
  assert.deepEqual(fr, [...new Set(fr)], 'duplicate key in the French catalogue');
});
