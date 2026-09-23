import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LOCALE,
  LOCALES,
  MESSAGES,
  MESSAGE_KEYS,
  catalogGaps,
  createTranslator,
  formatLocaleNumber,
  interpolate,
  isLocale,
  isSingular,
  localeDir,
  resolveLocale,
} from '../src/index';

test('the advertised locales are the supported ones', () => {
  assert.deepEqual(
    LOCALES.map((l) => l.id),
    ['en', 'fr'],
  );
  assert.equal(DEFAULT_LOCALE, 'en');
  for (const l of LOCALES) {
    assert.ok(l.label.length > 0 && l.native.length > 0);
    assert.ok(l.dir === 'ltr' || l.dir === 'rtl');
  }
  assert.equal(localeDir('fr'), 'ltr');
});

test('locale ids are validated, region tags included', () => {
  assert.equal(isLocale('en'), true);
  assert.equal(isLocale('fr'), true);
  assert.equal(isLocale('de'), false);
  assert.equal(isLocale(''), false);
  assert.equal(isLocale(null), false);
  assert.equal(isLocale(42), false);
});

test('the locale resolves from choice, then device, then English', () => {
  // An explicit choice always wins over the device.
  assert.equal(resolveLocale('fr', ['en-US']), 'fr');
  assert.equal(resolveLocale('en', ['fr-FR']), 'en');
  // A region tag matches its base language: fr-MA is French.
  assert.equal(resolveLocale(null, ['fr-MA', 'en-US']), 'fr');
  assert.equal(resolveLocale(undefined, ['fr-CA']), 'fr');
  // An unsupported device language falls through to English.
  assert.equal(resolveLocale(null, ['de-DE', 'es-ES']), 'en');
  assert.equal(resolveLocale(null, []), 'en');
  // A region-tagged stored preference still resolves.
  assert.equal(resolveLocale('fr-MA', ['en-US']), 'fr');
});

test('English is the reference catalog and every key is a real string', () => {
  assert.ok(MESSAGE_KEYS.length > 100, `only ${MESSAGE_KEYS.length} keys defined`);
  for (const key of MESSAGE_KEYS) {
    assert.match(key, /^[a-z][a-zA-Z0-9]*(\.[a-z0-9]+)+$/i, `odd key: ${key}`);
    const message = MESSAGES.en[key];
    if (typeof message === 'string') assert.ok(message.length > 0, `${key} is empty`);
    else {
      assert.ok(message.one.length > 0 && message.other.length > 0, `${key} plural is incomplete`);
    }
  }
});

test('French covers the English catalog without inventing keys', () => {
  const gaps = catalogGaps('fr');
  assert.deepEqual(gaps.missing, [], `untranslated keys: ${gaps.missing.join(', ')}`);
  assert.deepEqual(gaps.extra, [], `keys not in English: ${gaps.extra.join(', ')}`);
});

test('plurals carry the same placeholders in both languages', () => {
  const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of MESSAGE_KEYS) {
    const en = MESSAGES.en[key];
    const fr = MESSAGES.fr[key];
    if (typeof en === 'object' && typeof fr === 'object') {
      assert.deepEqual(vars(fr.one), vars(en.one), `${key}.one placeholders differ`);
      assert.deepEqual(vars(fr.other), vars(en.other), `${key}.other placeholders differ`);
    } else if (typeof en === 'string' && typeof fr === 'string') {
      assert.deepEqual(vars(fr), vars(en), `${key} placeholders differ`);
    } else {
      assert.fail(`${key} is a plural in one language and a string in the other`);
    }
  }
});

test('a missing translation falls back to English, never to a bare key', () => {
  const t = createTranslator('fr');
  assert.equal(t('nav.fuel'), 'Nutrition');
  // A key that does not exist anywhere returns itself — visible, not a crash.
  assert.equal(t('nope.not.a.key'), 'nope.not.a.key');
});

test('interpolation happens and unknown placeholders are left alone', () => {
  const t = createTranslator('en');
  assert.equal(t('xp.level', { level: 4 }), 'Level 4');
  assert.equal(t('xp.level', { other: 'x' }), 'Level {level}');
  assert.equal(interpolate('{a} and {b}', { a: 'x', b: 'y' }, 'en'), 'x and y');
});

test('numbers inside messages are formatted for the locale', () => {
  const t = createTranslator('fr');
  // French uses a narrow no-break space (or a space) as the group separator.
  const rendered = t('xp.total', { xp: 12500 });
  assert.ok(rendered.includes('12'), rendered);
  assert.ok(!rendered.includes('12500'), `not grouped: ${rendered}`);
  assert.equal(formatLocaleNumber(12500, 'en'), '12,500');
});

test('plural selection follows each language’s own rule', () => {
  // English: only 1 is singular. French: 0 and 1 are.
  assert.equal(isSingular('en', 1), true);
  assert.equal(isSingular('en', 0), false);
  assert.equal(isSingular('fr', 1), true);
  assert.equal(isSingular('fr', 0), true, 'French treats zero as singular');

  const en = createTranslator('en');
  const fr = createTranslator('fr');
  assert.equal(en('checkin.session', { count: 1 }), '1 session');
  assert.equal(en('checkin.session', { count: 3 }), '3 sessions');
  assert.equal(fr('checkin.session', { count: 0 }), '0 séance');
  assert.equal(fr('checkin.session', { count: 5 }), '5 séances');
});

/**
 * Strings that are legitimately identical in English and French.
 *
 * This list is the guard, not an excuse: the test asserts the identical set is
 * *exactly* this, so a new string that is silently left in English fails the
 * build and has to be either translated or added here with a reason. That is
 * stricter than a count threshold, which happily absorbs one more copy-paste.
 */
const INTENTIONAL_COGNATES: Record<string, string> = {
  'nav.coach': 'Coach is the word in both languages.',
  'nav.short.plan': '"Plan" is the French word too.',
  'fuel.title': 'Nutrition.',
  'meal.field.date': 'Date.',
  'meal.field.calories': 'Calories (kcal) — the unit is international.',
  'xp.progress': 'Placeholders and the abbreviation XP.',
  'xp.gained': 'Placeholders and the abbreviation XP.',
  'checkin.minutes': 'Placeholders and a unit.',
  'checkin.stat.minutes': 'A unit.',
  'diet.restrictions': 'Restrictions.',
  'diet.rule.halal': 'Halal.',
  'fuel.badge.photo': 'Photo.',
  'fuel.badge.scan': 'Scan — the same word in French.',
};

test('the translations are actually translated, not copied', () => {
  const identical = MESSAGE_KEYS.filter(
    (k) => typeof MESSAGES.en[k] === 'string' && MESSAGES.en[k] === MESSAGES.fr[k],
  ).sort();
  assert.deepEqual(
    identical,
    Object.keys(INTENTIONAL_COGNATES).sort(),
    'an EN/FR string matches but is not a declared cognate — translate it, or add it to INTENTIONAL_COGNATES with a reason',
  );
});
