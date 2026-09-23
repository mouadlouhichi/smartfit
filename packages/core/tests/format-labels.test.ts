import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BODY_UNIT_KEYS,
  BODY_UNIT_META,
  MESSAGES,
  bodyLabel,
  bodyUnitLabel,
  createTranslator,
  formatDateLabel,
  weekdayLabel,
  weekdayLabels,
} from '../src/index.ts';

/**
 * Dates, weekday names and measurement-type names are the three pieces of
 * copy that never went through the catalogue:
 *
 * - `formatDateLabel` and `weekdayLabels` ask `Intl`, so they need the app
 *   locale handed to them. Without it a French interface still said
 *   "Wed, 3 Sep" and "Sun", because the device locale was doing the talking.
 * - `bodyLabel` returns the English name stored data and the mobile client
 *   use, so the web UI goes through `bodyUnitLabel` instead.
 */

const LOCALES = ['en', 'fr'] as const;

test('every measurement type has a catalogue key and copy in both locales', () => {
  for (const unit of Object.keys(BODY_UNIT_META)) {
    const key = BODY_UNIT_KEYS[unit as keyof typeof BODY_UNIT_KEYS];
    assert.ok(key, `${unit} has no catalogue key`);
    for (const locale of LOCALES) {
      const message = MESSAGES[locale][key];
      assert.equal(typeof message, 'string', `${key} is missing from ${locale}`);
      assert.ok((message as string).trim().length > 0, `${key} is empty in ${locale}`);
    }
  }
});

test('the English copy still matches the labels the mobile client reads', () => {
  // `BODY_UNIT_META[].label` is what the app and the stored data use. If the
  // English catalogue copy drifted from it, the two clients would name the
  // same measurement differently.
  for (const [unit, meta] of Object.entries(BODY_UNIT_META)) {
    const key = BODY_UNIT_KEYS[unit as keyof typeof BODY_UNIT_KEYS];
    assert.equal(MESSAGES.en[key], meta.label, `${key} drifted from BODY_UNIT_META`);
  }
});

test('bodyUnitLabel translates, prefers the athlete’s own label, and never needs a translator', () => {
  const fr = createTranslator('fr');
  const en = createTranslator('en');

  assert.equal(bodyUnitLabel('weight', undefined, fr), 'Poids corporel');
  assert.equal(bodyUnitLabel('weight', undefined, en), 'Body weight');
  // A custom measurement always shows what the athlete typed, in any locale.
  assert.equal(bodyUnitLabel('custom', '  Détente ', fr), 'Détente');
  assert.equal(bodyUnitLabel('custom', '', fr), 'Mesure personnalisée');

  // Core callers (and mobile) get the English label rather than an undefined.
  assert.equal(bodyUnitLabel('weight'), 'Body weight');
  assert.equal(bodyUnitLabel('custom'), 'Measurement');
  assert.equal(bodyUnitLabel('unknown'), 'unknown');
});

test('weekday names follow the passed locale, Sunday first', () => {
  assert.deepEqual(weekdayLabels('en', 'short'), ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  assert.deepEqual(weekdayLabels('en', 'long')[1], 'Monday');
  assert.equal(weekdayLabels('fr', 'long')[0], 'dimanche');
  assert.equal(weekdayLabels('fr', 'long')[1], 'lundi');
  assert.equal(weekdayLabels('fr', 'long').length, 7);
  // Short names are initials and stay distinct in both languages — the grid
  // row labels key off them.
  for (const locale of LOCALES) {
    const short = weekdayLabels(locale, 'short');
    assert.equal(short.length, 7);
    assert.equal(new Set(short).size, 7, `${locale} short names collide: ${short.join()}`);
  }
  // The reference week is fixed and read in UTC, so this cannot depend on the
  // machine's timezone or on the day the suite runs.
  assert.match(
    weekdayLabels('fr', 'long').join(' '),
    /^dimanche lundi mardi mercredi jeudi vendredi samedi$/,
  );
});

test('weekdayLabel indexes by day number and wraps', () => {
  assert.equal(weekdayLabel(0, 'fr'), 'dimanche');
  assert.equal(weekdayLabel(1, 'fr'), 'lundi');
  assert.equal(weekdayLabel(6, 'en'), 'Saturday');
  assert.equal(weekdayLabel(7), weekdayLabel(0), 'a week later is the same weekday');
  assert.equal(weekdayLabel(-1), weekdayLabel(6), 'the day before Sunday is Saturday');
});

test('formatDateLabel uses the interface language, not the device one', () => {
  // The date is fixed; only the language changes.
  assert.equal(formatDateLabel('2026-09-23', 'fr'), 'mer. 23 sept.');
  assert.match(formatDateLabel('2026-09-23', 'en'), /^Wed, Sep 23$/);
  // Without a locale it keeps the old behaviour: whatever the device says.
  assert.ok(formatDateLabel('2026-09-23').length > 0);
});
