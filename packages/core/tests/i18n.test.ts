import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAchievements,
  emptyState,
  translateAchievements,
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
    // Segments may carry a hyphen: badge keys embed their id (`ach.streak-14.name`).
    assert.match(key, /^[a-z][a-zA-Z0-9]*\.[a-z0-9-]+(\.[a-z0-9-]+)*$/i, `odd key: ${key}`);
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
  'ach.progress.of':
    'A pure placeholder template ("{value} / {target} {unit}") — the words it renders come from the unit keys.',
  'progress.ring.distance': 'Distance.',
  'ach.sessions-100.name': '"Centurion" is the same word in both languages.',
  'overview.metrics.distance': 'Distance.',
  'overview.stat.distance': 'Distance.',
  'overview.measure.distance': 'Distance.',
  'overview.metrics.min': 'The abbreviation for minutes.',
  'overview.quick.stats': '"Stats" is idiomatic French too, and the tile is tiny.',
  'progress.ring.scoreFallback': 'Score is the word in both languages.',
  'profile.pro.title': '“SmartFit Pro” is the product name.',
  'profile.field.weightUnitHintKg': '“cm” is the unit symbol.',
  'profile.unit.miles': '“Miles” is the French word for miles.',
  'library.muscle.biceps': 'Biceps — the muscle keeps its Latin name in French.',
  'library.muscle.triceps': 'Triceps — same.',
  'library.equipment.machine': '“Machine” is the French word here.',
  'library.equipment.kettlebell': 'The loanword is what French gyms say.',
  // Field labels and units: the same word or symbol on both sides.
  'modal.field.date': 'Date.',
  'modal.field.type': 'Type.',
  'modal.field.minutes': 'Minutes.',
  'modal.field.notes': 'Notes.',
  'modal.detail.notes': 'Notes.',
  'modal.detail.distance': 'Distance.',
  'modal.workout.kcal': 'The unit symbol.',
  'library.sort.az': '“A–Z” is the sorting convention in both languages.',
  'modal.schedule.routine': '“Routine” is the French word too.',
  // The gym floor is the same word in both languages.
  'runner.pause': 'Pause.',
  'runner.stat.calories': 'The unit name.',
  'runner.stat.distance': 'Distance.',
  'runner.stat.volume': 'Volume.',
  'runner.distanceColumn': '“Distance (m)” — the unit symbol carries it.',
  // Run recorder: units, symbols and words French shares with English.
  'run.pause': 'Pause.',
  'run.stat.calories': 'The unit name.',
  'run.stat.distance': 'Distance.',
  'run.field.notes': 'Notes.',
  'run.split.index': '“KM 3” — the unit is the label.',
  'run.split.partial': 'A bare metre figure.',
  'run.eyebrow': '“Cardio” — the loanword is the French word here.',
  'run.tab.records': '“Records” — the loanword is the French word here.',
  'run.total.distance': 'Distance.',
  'share.style': '“Style” is the French word too.',
  'share.format.story': '“Story” is what Instagram calls it in both languages.',
  'share.style.transparent': '“Transparent” is the French word too.',
  'share.style.volt': 'Brand name for the dark card style.',
  'pro.table.pro': 'The product tier name.',
  'pro.status.plan': 'The product tier name.',
  // Measurement units are symbols: French writes them exactly as English does,
  // and "Distance" is the same word in both languages — a translated unit
  // would be wrong, not missing.
  'goal.metric.minutes.unit': 'min — a unit symbol.',
  'goal.metric.calories.unit': 'kcal — a unit symbol.',
  'goal.metric.distance': 'Distance — the same word in French.',
  // Placeholders in the "list your gym" form: a proper noun, a brand and the
  // example address a Moroccan gym owner would actually type.
  'gym.apply.namePlaceholder': 'Casablanca Boxing Club — a proper noun.',
  'gym.apply.cityPlaceholder': 'Casablanca — the city the app is built in.',
  'gym.apply.slugPlaceholder': 'casa-boxing — an address, not a phrase.',
  'gym.apply.instagram': 'Instagram — a brand name.',
  'goal.metric.distance.unit': 'km — a unit symbol.',
  // Latin-derived statistical nouns French borrowed unchanged; "Calories"
  // would need a locale explanation, the others are simply the same word.
  'progress.stat.calories': 'Calories — the word is the same in French.',
  'progress.stat.distance': 'Distance.',
  'progress.mix.total': '“total” is the French word too.',
  'landing.nav.guides': '“Guides” is the French word too.',
  // The gym's own taxonomy. Three of the six class types are the words French
  // gyms actually use, and the other two are a unit and a loanword — a
  // "translated" version of any of them would be wrong, not missing.
  'gym.focus.combat': 'Combat — boxing gyms say it in both languages.',
  'gym.focus.hiit': 'HIIT — the acronym is used untranslated.',
  'gym.focus.cardio': 'Cardio — the loanword is the French word here.',
  'gym.store.class.minutes': 'A duration and its unit symbol.',
  'gym.console.method.cmi': 'CMI — the Moroccan card network keeps its name.',
  'gym.console.method.stripe': 'Stripe — a brand name.',
  'plan.period.pass': '“pass” is what a French gym calls a single-visit pass.',
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
/** Two weeks of sessions ending 2026-03-15, for the streak tiers. */
function withFortnight() {
  const base = emptyState();
  return {
    ...base,
    sessions: Array.from({ length: 14 }, (_, i) => {
      const d = new Date('2026-03-02T12:00:00');
      d.setDate(d.getDate() + i);
      const pad = (n: number) => String(n).padStart(2, '0');
      return {
        id: `s-${i}`,
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        categoryId: 'cat-strength',
        title: 'Session',
        durationMin: 45,
        intensity: 'moderate' as const,
        calories: 300,
        exercises: [],
        createdAt: d.getTime(),
      };
    }),
  };
}

test('the achievement wall has copy in both locales, and core emits the keys', () => {
  const wall = computeAchievements(emptyState());
  const en = createTranslator('en');
  const fr = createTranslator('fr');

  for (const a of wall) {
    // Core carries the keys…
    assert.match(a.nameKey, /^ach\.[a-z0-9-]+\.name$/);
    assert.match(a.descriptionKey, /^ach\.[a-z0-9-]+\.description$/);
    // …and both catalogues carry the copy, or `t` would hand back the key.
    assert.notEqual(en(a.nameKey), a.nameKey, `en is missing ${a.nameKey}`);
    assert.notEqual(fr(a.nameKey), a.nameKey, `fr is missing ${a.nameKey}`);
    assert.notEqual(en(a.descriptionKey), a.descriptionKey, `en is missing ${a.descriptionKey}`);
    assert.notEqual(fr(a.descriptionKey), a.descriptionKey, `fr is missing ${a.descriptionKey}`);
    // The progress line's unit and prefix keys resolve too.
    if (a.progressDetail.unitKey) {
      assert.notEqual(fr(a.progressDetail.unitKey), a.progressDetail.unitKey);
    }
    if (a.progressDetail.prefixKey) {
      assert.notEqual(fr(a.progressDetail.prefixKey), a.progressDetail.prefixKey);
    }
  }
});

test('translateAchievements renders the wall in the active locale', () => {
  const earned = translateAchievements(
    computeAchievements(withFortnight(), new Date('2026-03-15T20:00:00')),
    createTranslator('fr'),
  );
  const streak = earned.find((a) => a.id === 'streak-14')!;
  // French copy, French plural agreement, and no leftover catalogue key.
  assert.equal(streak.name, 'Quinzaine forgée');
  assert.equal(streak.progressLabel, 'Obtenu');
  const locked = earned.find((a) => a.id === 'streak-30')!;
  assert.equal(locked.progressLabel, '14 / 30 jours');
  const long = earned.find((a) => a.id === 'long-session')!;
  // The fixture's sessions are 45 minutes, so this tier is half-reached.
  assert.equal(long.progressLabel, 'Séance la plus longue: 45 / 90 min');
  // The *rendered* fields must be copy; `progressDetail` keeps its keys on
  // purpose, since that is what the next surface translates from.
  for (const a of earned) {
    for (const field of [a.name, a.description, a.progressLabel]) {
      assert.ok(!field.includes('ach.'), `a catalogue key leaked into "${field}"`);
      assert.ok(!field.includes('unit.'), `a unit key leaked into "${field}"`);
    }
  }
});

test('a unit pluralises on its target, not on the value', () => {
  const en = createTranslator('en');
  const fr = createTranslator('fr');
  // The unit is the noun; the numbers come from the template around it.
  assert.equal(en('unit.days', { count: 1 }), 'day');
  assert.equal(en('unit.days', { count: 14 }), 'days');
  assert.equal(fr('unit.days', { count: 1 }), 'jour');
  assert.equal(fr('unit.days', { count: 30 }), 'jours');
  assert.equal(fr('ach.progress.of', { value: 14, target: 30, unit: 'jours' }), '14 / 30 jours');
});
