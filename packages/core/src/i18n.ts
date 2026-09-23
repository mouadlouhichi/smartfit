/**
 * Internationalisation.
 *
 * The audit's localization line read "0 / 10 — English only, no i18n
 * framework". This is the framework: a typed catalog, a plural-aware
 * translator and a locale resolver, with no runtime dependency and no build
 * step (a heavy i18n library would be a strange thing to add to an app whose
 * whole pitch is that it works offline on a phone in a gym basement).
 *
 * Rules that keep it useful rather than decorative:
 *
 *  1. **`t()` never throws and never shows a key.** A missing translation
 *     falls back to English, then to the key itself — a half-migrated screen
 *     degrades to the old copy instead of leaking `fuel.remaining` at users.
 *  2. **Interpolation is explicit** (`{name}`), so translators can move words
 *     around freely — which is exactly what French needs.
 *  3. **Plurals are data, not string concatenation**: a message may be
 *     `{ one, other }`, selected by the locale's own rule (French counts 0 as
 *     singular, English does not).
 *  4. **Food aliases are not translations.** The scanner needs the *local
 *     word* for a food (`FOOD_ALIASES` in `nutrition.ts`); a translated label
 *     is a different thing and both are needed.
 */

export const LOCALES = [
  { id: 'en', label: 'English', native: 'English', dir: 'ltr' },
  { id: 'fr', label: 'French', native: 'Français', dir: 'ltr' },
] as const;

export type Locale = (typeof LOCALES)[number]['id'];
export type Direction = 'ltr' | 'rtl';

export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALES.some((l) => l.id === value);
}

export function localeDir(locale: Locale): Direction {
  return LOCALES.find((l) => l.id === locale)?.dir ?? 'ltr';
}

/**
 * Which language to show.
 *
 * Order: the athlete's explicit choice → the device's preference (an `fr-MA`
 * browser matches `fr`) → English. An explicit choice always wins: someone who
 * picked French on an English phone meant it.
 */
export function resolveLocale(
  preference?: string | null,
  deviceLanguages: readonly string[] = [],
): Locale {
  if (isLocale(preference)) return preference;
  // A stored region tag ("fr-MA") is still an explicit choice, so it outranks
  // the device — otherwise a French Moroccan on an English phone would be
  // silently pushed back to English on every new device.
  const preferredBase = preference?.split('-')[0];
  if (isLocale(preferredBase)) return preferredBase;
  for (const tag of deviceLanguages) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** A message is either one string or a plural pair. */
export type Message = string | { one: string; other: string };

/** Does this locale treat `count` as singular? French: 0 and 1. */
export function isSingular(locale: Locale, count: number): boolean {
  return locale === 'fr' ? count <= 1 : count === 1;
}

export type Vars = Record<string, string | number>;

/**
 * Replace `{name}` placeholders. Unknown placeholders are left alone (they
 * read as a bug in the copy, which is the honest outcome) and numbers are
 * formatted with the locale's own grouping so "1 250 kcal" is right in French.
 */
export function interpolate(template: string, vars: Vars, locale: Locale): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key];
    if (value === undefined) return match;
    return typeof value === 'number' ? formatLocaleNumber(value, locale) : value;
  });
}

/**
 * Grouping separators only — currency and units stay in `format.ts`, which
 * formats the app's own canonical numbers when no locale is in play. Named
 * distinctly so both can be re-exported from the package root.
 */
export function formatLocaleNumber(value: number, locale: Locale): string {
  try {
    return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
      maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
    }).format(value);
  } catch {
    return String(value);
  }
}

export type Translator = (key: string, vars?: Vars) => string;

/**
 * Build a translator bound to one locale.
 *
 * English is the reference catalog: any key present there exists, and a
 * translation that forgets one silently uses the English string rather than
 * showing a raw key. That is what makes incremental extraction safe — new
 * screens can adopt `t()` one at a time.
 */
export function createTranslator(locale: Locale): Translator {
  const catalog = MESSAGES[locale] ?? {};
  const fallback = MESSAGES[DEFAULT_LOCALE];
  return (key, vars = {}) => {
    const message: Message | undefined = catalog[key] ?? fallback[key];
    if (message === undefined) return key;
    if (typeof message === 'string') return interpolate(message, vars, locale);
    const count = typeof vars.count === 'number' ? vars.count : 0;
    const chosen = isSingular(locale, count) ? message.one : message.other;
    return interpolate(chosen, vars, locale);
  };
}

/**
 * The catalog.
 *
 * Keys are `area.thing`, flat on purpose: a nested structure buys nothing at
 * this size and makes "which keys exist" harder to see at a glance. Anything
 * not yet listed here stays as inline English in the component — see
 * `docs/i18n.md` for the extraction checklist and what remains.
 */
export const MESSAGES: Record<Locale, Record<string, Message>> = {
  en: {
    // ── shell / navigation ────────────────────────────────────────────────
    'nav.overview': 'Overview',
    'nav.library': 'Library',
    'nav.personalize': 'Personalize',
    'nav.run': 'Run',
    'nav.plan': 'Training plan',
    'nav.goals': 'Goals',
    'nav.progress': 'Progress',
    'nav.body': 'Body',
    'nav.fuel': 'Fuel',
    'nav.profile': 'Profile',
    'nav.coach': 'Coach',
    'nav.short.home': 'Home',
    'nav.short.library': 'Library',
    'nav.short.personalize': 'For you',
    'nav.short.run': 'Run',
    'nav.short.plan': 'Plan',
    'nav.short.goals': 'Goals',
    'nav.short.progress': 'Progress',
    'nav.short.body': 'Body',
    'nav.short.fuel': 'Fuel',
    'nav.short.profile': 'Profile',
    'nav.dashboard': 'Dashboard',
    'nav.training': 'Training',
    'nav.insights': 'Insights',

    // ── common actions ────────────────────────────────────────────────────
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.delete': 'Delete',
    'action.add': 'Add',
    'action.swap': 'Swap',
    'action.log': 'Log',
    'action.close': 'Close',
    'action.retry': 'Try again',
    'action.logMeal': 'Log meal',

    // ── fuel screen ───────────────────────────────────────────────────────
    'fuel.title': 'Nutrition',
    'fuel.subtitle':
      'Calories and protein per meal, measured against a target that follows your body and your goal.',
    'fuel.remaining': 'Remaining',
    'fuel.overTarget': 'Over target',
    'fuel.eaten': 'Eaten',
    'fuel.burned': 'Burned',
    'fuel.target': 'Target',
    'fuel.today': 'Today',
    'fuel.backToToday': 'Back to today',
    'fuel.slot.breakfast': 'Breakfast',
    'fuel.slot.lunch': 'Lunch',
    'fuel.slot.dinner': 'Dinner',
    'fuel.slot.snack': 'Snacks',
    'fuel.plan.title': 'What to eat next',
    'fuel.plan.subtitle':
      'Ranked from the food table against what is left of your day. Tap one to log it, or swap any food you already logged.',
    'fuel.plan.empty':
      'Log a weigh-in first — suggestions follow your targets, and those need one number.',
    'fuel.plan.suggested': 'Suggested for {slot}',
    'fuel.plan.slot': 'Meal slot',
    'fuel.badge.photo': 'Photo',
    'fuel.badge.voice': 'Voice',
    'fuel.badge.scan': 'Scan',
    'fuel.macros': '{calories} kcal · {protein} g protein',
    'fuel.macrosMore': '{calories} kcal · {protein} g protein · {carbs} g carbs · {fat} g fat',
    'action.edit': 'Edit',
    'fuel.plan.fits': '{protein} g protein · {calories} kcal',
    'fuel.plan.logThis': 'Log this',
    'fuel.swap.title': 'Swap for something equivalent',
    'fuel.swap.subtitle': 'Same energy, different food — the day totals barely move.',
    'fuel.swap.none': 'Nothing in the table is a close match for this one.',
    'fuel.swap.applied': 'Swapped',
    'fuel.restrictions': 'Diet',
    'fuel.restrictions.none': 'No restrictions set',
    'fuel.restrictions.edit': 'Edit restrictions',

    // ── meal modal ────────────────────────────────────────────────────────
    'meal.title.log': 'Log a meal',
    'meal.title.edit': 'Edit meal',
    'meal.description':
      'Snap a photo, say it out loud, or type it — the scan does the maths and you stay in control of the numbers.',
    'meal.photo.title': 'Photo scan',
    'meal.photo.cta': 'Add a photo',
    'meal.photo.replace': 'Replace',
    'meal.photo.scanning': 'Reading the plate…',
    'meal.photo.result': 'Recognised {count} item(s) — check the portion before saving.',
    'meal.photo.failed':
      'Could not read that photo. Type it instead — the on-device scan still works offline.',
    'meal.photo.unavailable':
      'Photo scan needs an AI provider configured on this deployment. Typing still works — and works offline.',
    'meal.photo.privacy':
      'The photo is sent once to the configured provider and never stored on the server.',
    'meal.voice.cta': 'Say it',
    'meal.voice.listening': 'Listening…',
    'meal.voice.unsupported':
      'Voice logging needs a browser with speech recognition. Safari and Chrome support it.',
    'meal.voice.heard': 'Heard: “{text}”',
    'meal.scan.title': 'Meal scan',
    'meal.scan.input': 'Describe what you ate',
    'meal.scan.placeholder': 'e.g. “200g grilled chicken with rice and 2 eggs”',
    'meal.scan.cta': 'Scan',
    'meal.scan.empty':
      'Nothing matched the food table yet — add amounts (“200g chicken”) or type the calories directly.',
    'meal.scan.describe': 'Describe the meal first, e.g. “2 eggs, khobz and a latte”.',
    'meal.field.date': 'Date',
    'meal.field.slot': 'Meal',
    'meal.field.name': 'Name',
    'meal.field.calories': 'Calories (kcal)',
    'meal.field.protein': 'Protein (g)',
    'meal.field.carbs': 'Carbs (g) — optional',
    'meal.field.fat': 'Fat (g) — optional',
    'meal.save': 'Save meal',
    'meal.error.name': 'Give the meal a name.',
    'meal.error.calories': 'Enter the calories (or use the scan).',

    // ── progress: XP and levels ───────────────────────────────────────────
    'xp.level': 'Level {level}',
    'xp.title': 'Level {level} · {title}',
    'xp.progress': '{into} / {needed} XP',
    'xp.remaining': '{xp} XP to level {level}',
    'xp.thisWeek': '+{xp} XP this week',
    'xp.howItWorks': 'Where the XP comes from',
    'xp.source.sessions': 'Sessions logged',
    'xp.source.volume': 'Tonnage moved',
    'xp.source.records': 'Personal records',
    'xp.source.streak': 'Best streak',
    'xp.source.meals': 'Meals logged',
    'xp.source.weighIns': 'Weigh-ins',
    'xp.source.checkIns': 'Weekly check-ins',
    'xp.source.badges': 'Badges earned',
    'xp.empty': 'Log a session, a meal or a weigh-in — your first entry starts the count.',
    'xp.total': '{xp} XP total',
    'xp.levelUp': 'Level {level} — {title}',
    'xp.levelUp.body':
      'You just crossed into {title}. Every session, meal and weigh-in got you here.',
    'xp.gained': '+{xp} XP',

    // ── progress: weekly check-in ─────────────────────────────────────────
    'checkin.title': 'Weekly check-in',
    'checkin.subtitle': 'One minute to close the week — the numbers are already filled in.',
    'checkin.due': 'Your week is waiting',
    'checkin.start': 'Review my week',
    'checkin.waiting': 'The week of {week} is ready to review.',
    'checkin.weekOf': 'Week of {week}',
    'checkin.session': { one: '{count} session', other: '{count} sessions' },
    'checkin.minutes': '{count} min',
    'checkin.weight': '{delta} kg versus last week',
    'checkin.weightFlat': 'Weight steady',
    'checkin.goalsHit': 'Targets hit: {list}',
    'checkin.goalsMissed': 'Still open: {list}',
    'checkin.stat.sessions': 'Sessions',
    'checkin.stat.minutes': 'Minutes',
    'checkin.stat.weight': 'Weight',
    'checkin.feeling': 'How did the week feel?',
    'checkin.feeling.1': 'Rough',
    'checkin.feeling.2': 'Below par',
    'checkin.feeling.3': 'Fine',
    'checkin.feeling.4': 'Good',
    'checkin.feeling.5': 'Excellent',
    'checkin.notes': 'Anything worth remembering? (optional)',
    'checkin.notesPlaceholder': 'A tweak, a niggle, something that worked…',
    'checkin.submit': 'Close the week',
    'checkin.nextWeek': 'For next week',
    'checkin.done': 'Checked in — +{xp} XP',
    'checkin.streak': { one: '{count} week in a row', other: '{count} weeks in a row' },
    'checkin.history': 'Past check-ins',
    'checkin.none': 'No check-ins yet.',

    // ── goals: deadlines ──────────────────────────────────────────────────
    'goal.deadline': 'Deadline (optional)',
    'goal.deadline.help':
      'Add a date and the goal reports whether your current pace arrives in time.',
    'goal.deadline.none': 'No deadline',
    'goal.deadline.suggest': 'Suggest',
    'goal.pace.required': 'Needs {value} per week',
    'goal.pace.actual': 'Averaging {value} per week',

    // ── personalize: diet ─────────────────────────────────────────────────
    'diet.title': 'Diet',
    'diet.subtitle':
      'Restrictions filter every suggestion; favourites and dislikes only tilt the ranking.',
    'diet.restrictions': 'Restrictions',
    'diet.restrictionsHint': 'Never suggested, never swapped in.',
    'diet.available': '{allowed} of {total} foods stay available.',
    'diet.sample': 'Tonight that suggests: {name} ({label}).',
    'diet.nothingFits':
      'With these restrictions nothing in the table fits a dinner — loosen one to get suggestions back.',
    'diet.favoriteHint': 'Ranked first when the macros fit.',
    'diet.dislikeHint': 'Never suggested — the same hard filter as a restriction.',
    'diet.rule.vegan': 'Vegan',
    'diet.rule.vegetarian': 'Vegetarian',
    'diet.rule.pescatarian': 'Pescatarian',
    'diet.rule.halal': 'Halal',
    'diet.rule.noPork': 'No pork',
    'diet.rule.noDairy': 'No dairy',
    'diet.rule.noGluten': 'No gluten',
    'diet.rule.noNuts': 'No nuts',
    'diet.rule.noShellfish': 'No shellfish',
    'diet.rule.noEgg': 'No egg',
    'diet.favorites': 'Foods you like',
    'diet.dislikes': 'Foods to avoid',
    'diet.search': 'Search foods',
    'diet.none': 'Nothing selected',
    'diet.selected': '{count} selected',

    // ── language ──────────────────────────────────────────────────────────
    'language.title': 'Language',
    'language.subtitle': 'Interface language. Food names, dates and numbers follow it too.',

    'coach.title': 'Your coach',
    'coach.composer.askPlaceholder': 'Ask your coach anything…',
    'coach.composer.placeholder': 'Type something…',
    'coach.composer.aria': 'Message your coach',
    'coach.send': 'Send',
    'coach.stop': 'Stop',
    'coach.goPro': 'Go Pro',
    'coach.limit': 'Free AI replies used for today ({used}). Pro is unlimited.',
    'coach.thinking.host': 'Asking {host}…',
    'coach.thinking.ai': 'Asking the AI coach…',
    'coach.thinking.log': 'Reading your training log…',
    'coach.thinking.week': 'Checking this week and your goals…',
    'coach.thinking.almost': 'Almost there…',
    'coach.thinking.scan': 'Looking through your log…',
    'coach.thinking.adding': 'Adding up this week…',
    'coach.thinking.slow': 'Still working — the provider is slow…',
    'coach.source.slow':
      'Free AI endpoints can take a while — Stop answers instantly from your own data.',
    'coach.source.summary': 'Using a privacy-limited summary of your stats',
    'coach.source.local': 'Keeping everything on this device',
    'coach.notice.stopped': 'Stopped the AI answer — here is your coach on your own data.',
    'coach.notice.timeout':
      'The AI endpoint timed out — answered from your on-device data instead.',
    'coach.notice.unconfigured':
      'This deployment has no AI provider configured — answered on-device.',
    'coach.notice.quota':
      'The AI provider’s free limit is reached — answered from your on-device data.',
    'coach.notice.unavailable': 'AI unavailable — {detail} Answered from your on-device data.',
    'coach.notice.offline': 'AI unavailable right now — answered from your on-device data.',
    'coach.notice.incompleteStopped': 'Stopped — this answer may be incomplete.',
    'coach.notice.incompleteDrop': 'The AI connection dropped — this answer may be incomplete.',
    'coach.error.empty': 'AI response was empty.',
    // ── overview ──────────────────────────────────────────────────────────
    'overview.title': 'Overview',
    'overview.metrics.title': 'Health Metrics',
    'overview.metrics.aria': 'Health metrics',
    'overview.metrics.activeMinutes': 'Active minutes',
    'overview.metrics.sessions': 'Sessions',
    'overview.metrics.distance': 'Distance',
    'overview.metrics.weeklyGoal': 'Weekly goal',
    'overview.metrics.ofTarget': 'of target',
    'overview.metrics.min': 'min',
    'overview.metrics.workouts': 'workouts',
    'overview.programs.title': 'Workout Programs',
    'overview.programs.aria': 'Workout programs',
    'overview.programs.categoryAria': 'Program category',
    'overview.programs.allTypes': 'All type',
    'overview.today': 'Today',
    'overview.rings.closed': 'All rings closed',
    'overview.rings.detailsAria': "Today's activity details",
    'overview.summary.title': 'Summary',
    'overview.summary.aria': 'Summary',
    'overview.summary.rangeAria': 'Summary range',
    'overview.summary.emptyTitle': 'No workouts yet',
    'overview.summary.emptyBody':
      'Tap the bolt to log your first session. Your streak, volume and distance will appear here.',
    'overview.stat.active': 'Active',
    'overview.stat.sessions': 'Sessions',
    'overview.stat.distance': 'Distance',
    'overview.streakDays': '{days}-day streak',
    'overview.setGoalsHint': ' · set goals to tune these targets',
    'overview.recent': 'Recent activity',
    'overview.done': 'Done',
    'overview.logIt': 'Log it',
    'overview.seeAll': 'See all',
    'overview.quick.logWorkout': 'Log workout',
    'overview.quick.stats': 'Stats',
    'overview.streak.title': 'Training streak',
    'overview.streak.row': { one: '{count} day in a row', other: '{count} days in a row' },
    'overview.streak.summary':
      'Best {best} · {closed}/7 rings this week · {onTarget}/{checked} weeks on target',
    'overview.streak.start': 'Start {title}',
    'overview.streak.startAnother': 'Start another workout',
    'overview.streak.startAria': 'Start a workout',
    'overview.streak.level1': 'day',
    'overview.streak.level2': 'streak',
    'overview.streak.unit': 'Ring run',
    'overview.streak.days': { one: ' day', other: ' days' },
    'overview.streak.best': 'Best',
    'overview.streak.weeks': 'Weeks',
    'overview.streak.historyAria': 'Ring history, last 7 days: {list}.',
    'overview.streak.closed': 'closed',
    'overview.streak.open': 'open',
    'time.weekdays.initials': 'S,M,T,W,T,F,S',
    'overview.fuel.aria': "Today's fuel",
    'overview.fuel.title': 'Today’s fuel',
    'overview.fuel.subtitle': 'In vs out, and your protein',
    'overview.fuel.link': 'Fuel',
    'overview.fuel.over': '{kcal} over',
    'overview.fuel.left': '{kcal} left',
    'overview.fuel.barAria': 'Calories eaten versus target today',
    'overview.fuel.burned': '{kcal} kcal burned',
    'overview.fuel.protein': 'Protein {value}/{target} g',
    'overview.fuel.noTarget':
      'Log your weight once and SmartFit computes your daily calorie & protein targets from your goal and activity.',
    'overview.fuel.logWeight': 'Log weight',
    'overview.fuel.logAnyway': 'Log meal anyway',
    'overview.readiness.aria': 'Readiness',
    'overview.readiness.title': 'Readiness',
    'overview.readiness.subtitle': 'From your training load — no wearable needed',
    'overview.readiness.scoreAria': 'Readiness score {score} of 100',
    'overview.readiness.unlockAria': 'Unlock your readiness score with Pro',
    'overview.readiness.unlockTitle': 'Unlock with Pro',
    'overview.readiness.unlockCta': 'Unlock score & drivers',
    'overview.readiness.loadAria': 'Training load, last 28 days. Acute to chronic ratio {ratio}.',
    'overview.readiness.daysAgo': '28 days ago',
    'overview.readiness.loadRatio': 'Load ratio',
    'overview.readiness.loadNote': 'over 1.3 means back off',
    'overview.readiness.gate1': 'Volume spiked 40% vs your average',
    'overview.readiness.gate2': 'No hard session in 4+ days',
    'overview.suggested.body':
      'Picked from your weight, body fat, waist and recent training — log measurements and these adapt.',
    'overview.suggested.start': 'Start',
    'overview.equipment.pool': 'Pool',
    'overview.equipment.running': 'Running',
    'overview.equipment.gym': 'Gym',
    'overview.measure.distance': 'Distance',
    'overview.measure.strength': 'Strength',
    'overview.rings.move': 'Move',
    'overview.rings.exercise': 'Exercise',
    'overview.rings.sessions': 'Sessions',
    'overview.rings.setGoal': 'set a goal',
    'overview.rings.weekTarget': '{target} this week',
    'overview.body.badge': 'Train by body part',
    'overview.body.line1': 'Touch a muscle.',
    'overview.body.openMap': 'Open the full body map',
    'overview.body.line2': 'Train it today.',
    'overview.body.body':
      'The body map shows this week’s volume for every muscle. Tap any region to see the exercises that hit it and start a focus workout in one tap.',
    'overview.workoutday.aria': 'Workout day',
    'overview.workoutday.setAsToday': 'Set as Today’s workout',
    'overview.suggested.title': 'AI Suggested for you',
    'overview.suggested.badge': 'AI Powered',
    'overview.range.daily': 'Daily',
    'overview.range.weekly': 'Weekly',
    'overview.range.monthly': 'Monthly',
    'time.today': 'Today',
    'time.yesterday': 'Yesterday',
    'time.tomorrow': 'Tomorrow',

    // ── achievements ──────────────────────────────────────────────────────
    // Names and descriptions come from `computeAchievements`, which emits the
    // keys (`ach.<id>.name`) rather than a sentence. Keep the two in step: the
    // core tests fail if a badge has no entry here.
    'ach.first-session.name': 'First Blood',
    'ach.first-session.description': 'Log your very first session.',
    'ach.streak-3.name': 'Warming Up',
    'ach.streak-3.description': 'Train 3 days in a row.',
    'ach.streak-7.name': 'Unbreakable Week',
    'ach.streak-7.description': 'A full 7-day training streak.',
    'ach.streak-14.name': 'Fortnight Forged',
    'ach.streak-14.description': 'Train 14 days in a row.',
    'ach.streak-30.name': 'Iron Month',
    'ach.streak-30.description': 'Train 30 days in a row.',
    'ach.sessions-10.name': 'Double Digits',
    'ach.sessions-10.description': 'Complete 10 sessions.',
    'ach.sessions-50.name': 'Half Century',
    'ach.sessions-50.description': 'Complete 50 sessions.',
    'ach.sessions-100.name': 'Centurion',
    'ach.sessions-100.description': 'Complete 100 sessions.',
    'ach.records-5.name': 'Record Breaker',
    'ach.records-5.description': 'Set personal records on 5 lifts.',
    'ach.hours-10.name': 'Ten Hours In',
    'ach.hours-10.description': 'Accumulate 10 hours of training.',
    'ach.hours-50.name': 'Fifty Hours In',
    'ach.hours-50.description': 'Accumulate 50 hours of training.',
    'ach.tonnage-10t.name': 'Iron Mover',
    'ach.tonnage-10t.description': 'Move 10 tonnes of iron.',
    'ach.tonnage-50t.name': 'Iron Hauler',
    'ach.tonnage-50t.description': 'Move 50 tonnes of iron.',
    'ach.early-bird.name': 'Early Bird',
    'ach.early-bird.description': 'Finish a session before 9am.',
    'ach.weeks-4.name': 'Four Weeks Running',
    'ach.weeks-4.description': 'Train in four weeks in a row.',
    'ach.comeback.name': 'Back In The Ring',
    'ach.comeback.description': 'Return to training after a two-week break.',
    'ach.weekend-warrior.name': 'Weekend Warrior',
    'ach.weekend-warrior.description': 'Train on both Saturday and Sunday of the same week.',
    'ach.body-10.name': 'Steady Scale',
    'ach.body-10.description': 'Log 10 body measurements.',
    'ach.meals-25.name': 'Kitchen Logged',
    'ach.meals-25.description': 'Log 25 meals.',
    'ach.variety-10.name': 'Explorer',
    'ach.variety-10.description': 'Train 10 different exercises.',
    'ach.long-session.name': 'Long Haul',
    'ach.long-session.description': 'Finish a session of 90 minutes or more.',
    'ach.distance-10k.name': 'Ten Kay',
    'ach.distance-10k.description': 'Cover 10 km in a single session.',
    'ach.wall.earned': '{earned} of {total} earned',
    'ach.wall.lockedPro': 'Pro unlocks the rest of the wall.',
    'ach.progress.earned': 'Earned',
    'ach.progress.of': '{value} / {target} {unit}',
    'ach.prefix.longestBreak': 'The longest break so far',
    'ach.prefix.longestSession': 'Longest session',
    'ach.prefix.farthestSession': 'Farthest session',
    // Units pluralise on the *target*, so "7 / 10 sessions" reads right; they
    // are the noun only — the template prints both numbers.
    'unit.days': { one: 'day', other: 'days' },
    'unit.sessions': { one: 'session', other: 'sessions' },
    'unit.lifts': { one: 'lift', other: 'lifts' },
    'unit.hours': { one: 'hour', other: 'hours' },
    'unit.tonnes': { one: 't', other: 't' },
    'unit.weeks': { one: 'week', other: 'weeks' },
    'unit.measurements': { one: 'measurement', other: 'measurements' },
    'unit.meals': { one: 'meal', other: 'meals' },
    'unit.exercises': { one: 'exercise', other: 'exercises' },
    'unit.minutes': { one: 'min', other: 'min' },
    'unit.km': { one: 'km', other: 'km' },
    'unit.ach.hint.earlyBird': 'Train before 9am',
    'unit.ach.hint.weekend': 'Train Saturday + Sunday',

    // ── progress hero ─────────────────────────────────────────────────────
    'progress.title': 'Your Stats',
    'progress.eyebrow': 'Progress',
    'progress.range.aria': 'Stats range',
    'progress.range.daily': 'Daily',
    'progress.range.weekly': 'Weekly',
    'progress.range.monthly': 'Monthly',
    'progress.range.quarter': 'Quarter',
    'progress.range.year': 'Year',
    'progress.range.short.daily': 'Day',
    'progress.range.short.weekly': 'Week',
    'progress.range.short.monthly': 'Month',
    'progress.range.short.quarter': 'Qtr',
    'progress.range.short.year': 'Year',
    'progress.chart.weeklyAria': 'Weekly active minutes data',
    'progress.chart.weekRow': '{label}: {minutes} active minutes, {workouts} sessions',
    'progress.chart.volumeTitle': 'Volume by muscle · last {count} days',
    'progress.chart.volumeAria': 'Muscle volume for the last {count} days',
    'progress.chart.muscleRow': '{label}: {volume}, {sets} sets',
    'progress.sessionsLogged': {
      one: '{count} session logged all-time',
      other: '{count} sessions logged all-time',
    },
    'progress.grade': 'Health Grade',
    'progress.grade.perfect': 'Perfect progress — keep going like this.',
    'progress.grade.solid': 'Solid work — one more session moves the needle.',
    'progress.grade.building': 'Every session counts. Let’s build momentum.',
    'progress.window': 'Last {count} days',
    'progress.window.one': 'Last day',
    'progress.ring.score': '{label}: {value} of 100',
    'progress.ring.scoreFallback': 'Score',
    'progress.ring.exercise': 'Exercise',
    'progress.ring.burned': 'Burned',
    'progress.ring.distance': 'Distance',
    'progress.streak': { one: '{count}-day streak', other: '{count}-day streak' },
    'progress.streak.best': 'best {count}',
    'progress.vs': '{value} vs previous {count}d',
    'progress.vs.aria.more': '{value} more than the previous {count} days',
    'progress.vs.aria.less': '{value} less than the previous {count} days',
    'progress.next.minutes': '{value} min to close the exercise ring',
    'progress.next.calories': '{value} to close the burn ring',
    'progress.next.distance': '{value} to close the distance ring',
    'progress.next.none': 'All three rings closed for this window — hold this pace.',
    'progress.next.rings': 'Burn and distance rings fill once you set a calories or distance goal.',
    'progress.hero.aria': 'Health grade and goal rings',
    'progress.grade.aria': 'Health grade: {value} of 100',
  },

  fr: {
    // ── shell / navigation ────────────────────────────────────────────────
    'nav.overview': 'Aperçu',
    'nav.library': 'Bibliothèque',
    'nav.personalize': 'Personnaliser',
    'nav.run': 'Course',
    'nav.plan': 'Plan d’entraînement',
    'nav.goals': 'Objectifs',
    'nav.progress': 'Progression',
    'nav.body': 'Corps',
    'nav.fuel': 'Nutrition',
    'nav.profile': 'Profil',
    'nav.coach': 'Coach',
    'nav.short.home': 'Accueil',
    'nav.short.library': 'Exos',
    'nav.short.personalize': 'Pour vous',
    'nav.short.run': 'Course',
    'nav.short.plan': 'Plan',
    'nav.short.goals': 'Objectifs',
    'nav.short.progress': 'Progrès',
    'nav.short.body': 'Corps',
    'nav.short.fuel': 'Nutrition',
    'nav.short.profile': 'Profil',
    'nav.dashboard': 'Tableau de bord',
    'nav.training': 'Entraînement',
    'nav.insights': 'Analyses',

    // ── common actions ────────────────────────────────────────────────────
    'action.save': 'Enregistrer',
    'action.cancel': 'Annuler',
    'action.delete': 'Supprimer',
    'action.add': 'Ajouter',
    'action.swap': 'Remplacer',
    'action.log': 'Ajouter',
    'action.close': 'Fermer',
    'action.retry': 'Réessayer',
    'action.logMeal': 'Ajouter un repas',

    // ── fuel screen ───────────────────────────────────────────────────────
    'fuel.title': 'Nutrition',
    'fuel.subtitle':
      'Calories et protéines par repas, mesurées par rapport à un objectif qui suit votre corps et votre but.',
    'fuel.remaining': 'Restant',
    'fuel.overTarget': 'Au-dessus de l’objectif',
    'fuel.eaten': 'Consommé',
    'fuel.burned': 'Brûlé',
    'fuel.target': 'Objectif',
    'fuel.today': 'Aujourd’hui',
    'fuel.backToToday': 'Revenir à aujourd’hui',
    'fuel.slot.breakfast': 'Petit-déjeuner',
    'fuel.slot.lunch': 'Déjeuner',
    'fuel.slot.dinner': 'Dîner',
    'fuel.slot.snack': 'Collations',
    'fuel.plan.title': 'Quoi manger ensuite',
    'fuel.plan.subtitle':
      'Classé à partir de la table alimentaire selon ce qu’il reste de votre journée. Touchez pour ajouter, ou remplacez un aliment déjà enregistré.',
    'fuel.plan.empty':
      'Enregistrez d’abord un poids — les suggestions suivent vos objectifs, et ceux-ci ont besoin d’un chiffre.',
    'fuel.plan.suggested': 'Suggéré pour {slot}',
    'fuel.plan.slot': 'Repas',
    'fuel.badge.photo': 'Photo',
    'fuel.badge.voice': 'Voix',
    'fuel.badge.scan': 'Scan',
    'fuel.macros': '{calories} kcal · {protein} g de protéines',
    'fuel.macrosMore':
      '{calories} kcal · {protein} g de protéines · {carbs} g de glucides · {fat} g de lipides',
    'action.edit': 'Modifier',
    'fuel.plan.fits': '{protein} g de protéines · {calories} kcal',
    'fuel.plan.logThis': 'Ajouter',
    'fuel.swap.title': 'Remplacer par un équivalent',
    'fuel.swap.subtitle': 'Même énergie, autre aliment — le total du jour bouge à peine.',
    'fuel.swap.none': 'Rien dans la table ne correspond vraiment à cet aliment.',
    'fuel.swap.applied': 'Remplacé',
    'fuel.restrictions': 'Alimentation',
    'fuel.restrictions.none': 'Aucune restriction définie',
    'fuel.restrictions.edit': 'Modifier les restrictions',

    // ── meal modal ────────────────────────────────────────────────────────
    'meal.title.log': 'Ajouter un repas',
    'meal.title.edit': 'Modifier le repas',
    'meal.description':
      'Prenez une photo, dictez-le ou tapez-le — l’analyse fait le calcul et vous gardez la main sur les chiffres.',
    'meal.photo.title': 'Analyse photo',
    'meal.photo.cta': 'Ajouter une photo',
    'meal.photo.replace': 'Remplacer',
    'meal.photo.scanning': 'Lecture de l’assiette…',
    'meal.photo.result': '{count} aliment(s) reconnu(s) — vérifiez la portion avant d’enregistrer.',
    'meal.photo.failed':
      'Impossible de lire cette photo. Tapez-la plutôt — l’analyse hors ligne fonctionne toujours.',
    'meal.photo.unavailable':
      'L’analyse photo nécessite un fournisseur IA configuré. La saisie manuelle fonctionne, même hors ligne.',
    'meal.photo.privacy':
      'La photo est envoyée une fois au fournisseur configuré et n’est jamais stockée sur le serveur.',
    'meal.voice.cta': 'Dicter',
    'meal.voice.listening': 'Écoute…',
    'meal.voice.unsupported':
      'La saisie vocale nécessite un navigateur avec reconnaissance vocale (Safari, Chrome).',
    'meal.voice.heard': 'Entendu : « {text} »',
    'meal.scan.title': 'Analyse du repas',
    'meal.scan.input': 'Décrivez ce que vous avez mangé',
    'meal.scan.placeholder': 'ex. « 200g de poulet grillé avec du riz et 2 œufs »',
    'meal.scan.cta': 'Analyser',
    'meal.scan.empty':
      'Rien ne correspond encore — ajoutez les quantités (« 200g de poulet ») ou saisissez les calories.',
    'meal.scan.describe': 'Décrivez d’abord le repas, ex. « 2 œufs, khobz et un café au lait ».',
    'meal.field.date': 'Date',
    'meal.field.slot': 'Repas',
    'meal.field.name': 'Nom',
    'meal.field.calories': 'Calories (kcal)',
    'meal.field.protein': 'Protéines (g)',
    'meal.field.carbs': 'Glucides (g) — facultatif',
    'meal.field.fat': 'Lipides (g) — facultatif',
    'meal.save': 'Enregistrer le repas',
    'meal.error.name': 'Donnez un nom au repas.',
    'meal.error.calories': 'Saisissez les calories (ou utilisez l’analyse).',

    // ── progress: XP and levels ───────────────────────────────────────────
    'xp.level': 'Niveau {level}',
    'xp.title': 'Niveau {level} · {title}',
    'xp.progress': '{into} / {needed} XP',
    'xp.remaining': '{xp} XP avant le niveau {level}',
    'xp.thisWeek': '+{xp} XP cette semaine',
    'xp.howItWorks': 'D’où viennent les XP',
    'xp.source.sessions': 'Séances enregistrées',
    'xp.source.volume': 'Tonnage déplacé',
    'xp.source.records': 'Records personnels',
    'xp.source.streak': 'Meilleure série',
    'xp.source.meals': 'Repas enregistrés',
    'xp.source.weighIns': 'Pesées',
    'xp.source.checkIns': 'Bilans hebdomadaires',
    'xp.source.badges': 'Badges obtenus',
    'xp.empty':
      'Enregistrez une séance, un repas ou une pesée — la première entrée lance le compteur.',
    'xp.total': '{xp} XP au total',
    'xp.levelUp': 'Niveau {level} — {title}',
    'xp.levelUp.body':
      'Vous venez de passer {title}. Chaque séance, repas et pesée vous a amené ici.',
    'xp.gained': '+{xp} XP',

    // ── progress: weekly check-in ─────────────────────────────────────────
    'checkin.title': 'Bilan hebdomadaire',
    'checkin.subtitle': 'Une minute pour clore la semaine — les chiffres sont déjà remplis.',
    'checkin.due': 'Votre semaine vous attend',
    'checkin.start': 'Revoir ma semaine',
    'checkin.waiting': 'La semaine du {week} est prête à être revue.',
    'checkin.weekOf': 'Semaine du {week}',
    'checkin.session': { one: '{count} séance', other: '{count} séances' },
    'checkin.minutes': '{count} min',
    'checkin.weight': '{delta} kg par rapport à la semaine dernière',
    'checkin.weightFlat': 'Poids stable',
    'checkin.goalsHit': 'Objectifs atteints : {list}',
    'checkin.goalsMissed': 'Encore ouverts : {list}',
    'checkin.stat.sessions': 'Séances',
    'checkin.stat.minutes': 'Minutes',
    'checkin.stat.weight': 'Poids',
    'checkin.feeling': 'Comment était la semaine ?',
    'checkin.feeling.1': 'Difficile',
    'checkin.feeling.2': 'Moyenne',
    'checkin.feeling.3': 'Correcte',
    'checkin.feeling.4': 'Bonne',
    'checkin.feeling.5': 'Excellente',
    'checkin.notes': 'Quelque chose à retenir ? (facultatif)',
    'checkin.notesPlaceholder': 'Un ajustement, une gêne, ce qui a marché…',
    'checkin.submit': 'Clore la semaine',
    'checkin.nextWeek': 'Pour la semaine prochaine',
    'checkin.done': 'Bilan fait — +{xp} XP',
    'checkin.streak': { one: '{count} semaine d’affilée', other: '{count} semaines d’affilée' },
    'checkin.history': 'Bilans passés',
    'checkin.none': 'Aucun bilan pour l’instant.',

    // ── goals: deadlines ──────────────────────────────────────────────────
    'goal.deadline': 'Échéance (facultatif)',
    'goal.deadline.help':
      'Ajoutez une date et l’objectif indique si votre rythme actuel arrive à temps.',
    'goal.deadline.none': 'Sans échéance',
    'goal.deadline.suggest': 'Proposer',
    'goal.pace.required': 'Il faut {value} par semaine',
    'goal.pace.actual': 'Moyenne de {value} par semaine',

    // ── personalize: diet ─────────────────────────────────────────────────
    'diet.title': 'Alimentation',
    'diet.subtitle':
      'Les restrictions filtrent toutes les suggestions ; les favoris et les aliments évités ne font que pondérer le classement.',
    'diet.restrictions': 'Restrictions',
    'diet.restrictionsHint': 'Jamais suggéré, jamais proposé en remplacement.',
    'diet.available': '{allowed} aliments sur {total} restent disponibles.',
    'diet.sample': 'Ce soir, cela suggère : {name} ({label}).',
    'diet.nothingFits':
      'Avec ces restrictions, rien dans la table ne convient à un dîner — assouplissez-en une pour retrouver des suggestions.',
    'diet.favoriteHint': 'Classés en premier quand les macros correspondent.',
    'diet.dislikeHint': 'Jamais suggérés — le même filtre dur qu’une restriction.',
    'diet.rule.vegan': 'Végétalien',
    'diet.rule.vegetarian': 'Végétarien',
    'diet.rule.pescatarian': 'Pescétarien',
    'diet.rule.halal': 'Halal',
    'diet.rule.noPork': 'Sans porc',
    'diet.rule.noDairy': 'Sans laitier',
    'diet.rule.noGluten': 'Sans gluten',
    'diet.rule.noNuts': 'Sans fruits à coque',
    'diet.rule.noShellfish': 'Sans crustacés',
    'diet.rule.noEgg': 'Sans œuf',
    'diet.favorites': 'Aliments que vous aimez',
    'diet.dislikes': 'Aliments à éviter',
    'diet.search': 'Rechercher un aliment',
    'diet.none': 'Rien de sélectionné',
    'diet.selected': '{count} sélectionné(s)',

    // ── langues ───────────────────────────────────────────────────────────
    'language.title': 'Langue',
    'language.subtitle':
      'Langue de l’interface. Les aliments, les dates et les nombres la suivent aussi.',
    'coach.title': 'Votre coach',
    'coach.composer.askPlaceholder': 'Demandez ce que vous voulez à votre coach…',
    'coach.composer.placeholder': 'Écrivez quelque chose…',
    'coach.composer.aria': 'Écrire à votre coach',
    'coach.send': 'Envoyer',
    'coach.stop': 'Arrêter',
    'coach.goPro': 'Passer à Pro',
    'coach.limit': 'Réponses IA gratuites utilisées aujourd’hui ({used}). Pro est illimité.',
    'coach.thinking.host': 'Question à {host}…',
    'coach.thinking.ai': 'Question au coach IA…',
    'coach.thinking.log': 'Lecture de votre journal d’entraînement…',
    'coach.thinking.week': 'Vérification de la semaine et de vos objectifs…',
    'coach.thinking.almost': 'Presque terminé…',
    'coach.thinking.scan': 'Parcours de votre journal…',
    'coach.thinking.adding': 'Calcul de la semaine…',
    'coach.thinking.slow': 'Toujours en cours — le fournisseur est lent…',
    'coach.source.slow':
      'Les points d’accès IA gratuits peuvent être lents — Arrêter répond instantanément à partir de vos propres données.',
    'coach.source.summary': 'Utilise un résumé de vos statistiques limité pour la confidentialité',
    'coach.source.local': 'Tout reste sur cet appareil',
    'coach.notice.stopped':
      'Réponse IA arrêtée — voici votre coach à partir de vos propres données.',
    'coach.notice.timeout':
      'Le point d’accès IA a expiré — réponse à partir de vos données locales à la place.',
    'coach.notice.unconfigured':
      'Ce déploiement n’a aucun fournisseur IA configuré — réponse en local.',
    'coach.notice.quota':
      'La limite gratuite du fournisseur IA est atteinte — réponse à partir de vos données locales.',
    'coach.notice.unavailable':
      'IA indisponible — {detail} Réponse à partir de vos données locales.',
    'coach.notice.offline':
      'IA indisponible pour le moment — réponse à partir de vos données locales.',
    'coach.notice.incompleteStopped': 'Arrêté — cette réponse peut être incomplète.',
    'coach.notice.incompleteDrop':
      'La connexion à l’IA a échoué — cette réponse peut être incomplète.',
    'coach.error.empty': 'La réponse de l’IA était vide.',
    // ── vue d’ensemble ────────────────────────────────────────────────────
    'overview.title': 'Vue d’ensemble',
    'overview.metrics.title': 'Santé en chiffres',
    'overview.metrics.aria': 'Indicateurs de santé',
    'overview.metrics.activeMinutes': 'Minutes actives',
    'overview.metrics.sessions': 'Séances',
    'overview.metrics.distance': 'Distance',
    'overview.metrics.weeklyGoal': 'Objectif hebdo',
    'overview.metrics.ofTarget': 'de l’objectif',
    'overview.metrics.min': 'min',
    'overview.metrics.workouts': 'séances',
    'overview.programs.title': 'Programmes d’entraînement',
    'overview.programs.aria': 'Programmes d’entraînement',
    'overview.programs.categoryAria': 'Catégorie de programme',
    'overview.programs.allTypes': 'Tous les types',
    'overview.today': 'Aujourd’hui',
    'overview.rings.closed': 'Tous les anneaux fermés',
    'overview.rings.detailsAria': 'Détail de l’activité du jour',
    'overview.summary.title': 'Résumé',
    'overview.summary.aria': 'Résumé',
    'overview.summary.rangeAria': 'Période du résumé',
    'overview.summary.emptyTitle': 'Aucune séance pour l’instant',
    'overview.summary.emptyBody':
      'Touchez l’éclair pour enregistrer votre première séance. Votre série, votre volume et votre distance apparaîtront ici.',
    'overview.stat.active': 'Actif',
    'overview.stat.sessions': 'Séances',
    'overview.stat.distance': 'Distance',
    'overview.streakDays': '{days} jours d’affilée',
    'overview.setGoalsHint': ' · définissez des objectifs pour ajuster ces cibles',
    'overview.recent': 'Activité récente',
    'overview.done': 'Fait',
    'overview.logIt': 'Noter',
    'overview.seeAll': 'Tout voir',
    'overview.quick.logWorkout': 'Enregistrer une séance',
    'overview.quick.stats': 'Stats',
    'overview.streak.title': 'Série d’entraînement',
    'overview.streak.row': { one: '{count} jour d’affilée', other: '{count} jours d’affilée' },
    'overview.streak.summary':
      'Record {best} · {closed}/7 anneaux cette semaine · {onTarget}/{checked} semaines tenues',
    'overview.streak.start': 'Démarrer {title}',
    'overview.streak.startAnother': 'Démarrer une autre séance',
    'overview.streak.startAria': 'Démarrer une séance',
    'overview.streak.level1': 'jours',
    'overview.streak.level2': 'd’affilée',
    'overview.streak.unit': 'Série d’anneaux',
    'overview.streak.days': { one: ' jour', other: ' jours' },
    'overview.streak.best': 'Record',
    'overview.streak.weeks': 'Semaines',
    'overview.streak.historyAria': 'Historique des anneaux, 7 derniers jours : {list}.',
    'overview.streak.closed': 'fermé',
    'overview.streak.open': 'ouvert',
    'time.weekdays.initials': 'D,L,M,M,J,V,S',
    'overview.fuel.aria': 'Nutrition du jour',
    'overview.fuel.title': 'Nutrition du jour',
    'overview.fuel.subtitle': 'Entrées et dépenses, et vos protéines',
    'overview.fuel.link': 'Nutrition',
    'overview.fuel.over': '{kcal} de trop',
    'overview.fuel.left': '{kcal} restantes',
    'overview.fuel.barAria': 'Calories consommées par rapport à la cible du jour',
    'overview.fuel.burned': '{kcal} kcal brûlées',
    'overview.fuel.protein': 'Protéines {value}/{target} g',
    'overview.fuel.noTarget':
      'Enregistrez votre poids une fois et SmartFit calcule vos cibles quotidiennes de calories et de protéines d’après votre objectif et votre activité.',
    'overview.fuel.logWeight': 'Enregistrer le poids',
    'overview.fuel.logAnyway': 'Enregistrer le repas quand même',
    'overview.readiness.aria': 'Forme du jour',
    'overview.readiness.title': 'Forme du jour',
    'overview.readiness.subtitle': 'D’après votre charge d’entraînement — sans bracelet connecté',
    'overview.readiness.scoreAria': 'Score de forme {score} sur 100',
    'overview.readiness.unlockAria': 'Débloquez votre score de forme avec Pro',
    'overview.readiness.unlockTitle': 'Débloquer avec Pro',
    'overview.readiness.unlockCta': 'Débloquer le score et les facteurs',
    'overview.readiness.loadAria':
      'Charge d’entraînement, 28 derniers jours. Ratio aigu sur chronique {ratio}.',
    'overview.readiness.daysAgo': 'il y a 28 jours',
    'overview.readiness.loadRatio': 'Ratio de charge',
    'overview.readiness.loadNote': 'au-delà de 1,3, levez le pied',
    'overview.readiness.gate1': 'Volume en hausse de 40 % par rapport à votre moyenne',
    'overview.readiness.gate2': 'Aucune séance intense depuis 4 jours ou plus',
    'overview.suggested.body':
      'Choisies d’après votre poids, votre masse grasse, votre tour de taille et vos entraînements récents — enregistrez des mesures et elles s’adaptent.',
    'overview.suggested.start': 'Démarrer',
    'overview.equipment.pool': 'Piscine',
    'overview.equipment.running': 'Course',
    'overview.equipment.gym': 'Salle',
    'overview.measure.distance': 'Distance',
    'overview.measure.strength': 'Force',
    'overview.rings.move': 'Bouger',
    'overview.rings.exercise': 'Exercice',
    'overview.rings.sessions': 'Séances',
    'overview.rings.setGoal': 'définir un objectif',
    'overview.rings.weekTarget': '{target} cette semaine',
    'overview.body.badge': 'Entraînement par zone',
    'overview.body.line1': 'Touchez un muscle.',
    'overview.body.openMap': 'Ouvrir la carte corporelle complète',
    'overview.body.line2': 'Entraînez-le aujourd’hui.',
    'overview.body.body':
      'La carte corporelle affiche le volume de la semaine pour chaque muscle. Touchez une zone pour voir les exercices qui la travaillent et lancer une séance ciblée en un geste.',
    'overview.workoutday.aria': 'Jour d’entraînement',
    'overview.workoutday.setAsToday': 'Définir comme séance du jour',
    'overview.suggested.title': 'Suggestions IA pour vous',
    'overview.suggested.badge': 'Propulsé par l’IA',
    'overview.range.daily': 'Jour',
    'overview.range.weekly': 'Semaine',
    'overview.range.monthly': 'Mois',
    'time.today': 'Aujourd’hui',
    'time.yesterday': 'Hier',
    'time.tomorrow': 'Demain',

    // ── réussites ─────────────────────────────────────────────────────────
    'ach.first-session.name': 'Premier sang',
    'ach.first-session.description': 'Enregistrez votre toute première séance.',
    'ach.streak-3.name': 'Échauffement',
    'ach.streak-3.description': 'Entraînez-vous 3 jours de suite.',
    'ach.streak-7.name': 'Semaine sans faute',
    'ach.streak-7.description': 'Une série complète de 7 jours.',
    'ach.streak-14.name': 'Quinzaine forgée',
    'ach.streak-14.description': 'Entraînez-vous 14 jours de suite.',
    'ach.streak-30.name': 'Mois de fer',
    'ach.streak-30.description': 'Entraînez-vous 30 jours de suite.',
    'ach.sessions-10.name': 'Deux chiffres',
    'ach.sessions-10.description': 'Terminez 10 séances.',
    'ach.sessions-50.name': 'Cinquantaine',
    'ach.sessions-50.description': 'Terminez 50 séances.',
    'ach.sessions-100.name': 'Centurion',
    'ach.sessions-100.description': 'Terminez 100 séances.',
    'ach.records-5.name': 'Briseur de records',
    'ach.records-5.description': 'Battez des records sur 5 mouvements.',
    'ach.hours-10.name': 'Dix heures',
    'ach.hours-10.description': 'Cumulez 10 heures d’entraînement.',
    'ach.hours-50.name': 'Cinquante heures',
    'ach.hours-50.description': 'Cumulez 50 heures d’entraînement.',
    'ach.tonnage-10t.name': 'Déménageur de fer',
    'ach.tonnage-10t.description': 'Déplacez 10 tonnes de fonte.',
    'ach.tonnage-50t.name': 'Transporteur de fer',
    'ach.tonnage-50t.description': 'Déplacez 50 tonnes de fonte.',
    'ach.early-bird.name': 'Lève-tôt',
    'ach.early-bird.description': 'Terminez une séance avant 9 h.',
    'ach.weeks-4.name': 'Quatre semaines de suite',
    'ach.weeks-4.description': 'Entraînez-vous quatre semaines d’affilée.',
    'ach.comeback.name': 'De retour sur le ring',
    'ach.comeback.description': 'Reprenez l’entraînement après une pause de deux semaines.',
    'ach.weekend-warrior.name': 'Guerrier du week-end',
    'ach.weekend-warrior.description':
      'Entraînez-vous le samedi et le dimanche de la même semaine.',
    'ach.body-10.name': 'Balance régulière',
    'ach.body-10.description': 'Enregistrez 10 mesures corporelles.',
    'ach.meals-25.name': 'Cuisine suivie',
    'ach.meals-25.description': 'Enregistrez 25 repas.',
    'ach.variety-10.name': 'Explorateur',
    'ach.variety-10.description': 'Travaillez 10 exercices différents.',
    'ach.long-session.name': 'Longue distance',
    'ach.long-session.description': 'Terminez une séance de 90 minutes ou plus.',
    'ach.distance-10k.name': 'Dix bornes',
    'ach.distance-10k.description': 'Parcourez 10 km en une seule séance.',
    'ach.wall.earned': '{earned} sur {total} obtenus',
    'ach.wall.lockedPro': 'Pro débloque le reste du mur.',
    'ach.progress.earned': 'Obtenu',
    'ach.progress.of': '{value} / {target} {unit}',
    'ach.prefix.longestBreak': 'La plus longue pause à ce jour',
    'ach.prefix.longestSession': 'Séance la plus longue',
    'ach.prefix.farthestSession': 'Séance la plus lointaine',
    'unit.days': { one: 'jour', other: 'jours' },
    'unit.sessions': { one: 'séance', other: 'séances' },
    'unit.lifts': { one: 'mouvement', other: 'mouvements' },
    'unit.hours': { one: 'heure', other: 'heures' },
    'unit.tonnes': { one: 't', other: 't' },
    'unit.weeks': { one: 'semaine', other: 'semaines' },
    'unit.measurements': { one: 'mesure', other: 'mesures' },
    'unit.meals': { one: 'repas', other: 'repas' },
    'unit.exercises': { one: 'exercice', other: 'exercices' },
    'unit.minutes': { one: 'min', other: 'min' },
    'unit.km': { one: 'km', other: 'km' },
    'unit.ach.hint.earlyBird': 'Entraînez-vous avant 9 h',
    'unit.ach.hint.weekend': 'Entraînez-vous samedi + dimanche',

    // ── héros de progression ──────────────────────────────────────────────
    'progress.title': 'Vos statistiques',
    'progress.eyebrow': 'Progression',
    'progress.range.aria': 'Période des statistiques',
    'progress.range.daily': 'Jour',
    'progress.range.weekly': 'Semaine',
    'progress.range.monthly': 'Mois',
    'progress.range.quarter': 'Trimestre',
    'progress.range.year': 'Année',
    'progress.range.short.daily': 'Jour',
    'progress.range.short.weekly': 'Sem.',
    'progress.range.short.monthly': 'Mois',
    'progress.range.short.quarter': 'Trim.',
    'progress.range.short.year': 'Année',
    'progress.chart.weeklyAria': 'Données hebdomadaires de minutes actives',
    'progress.chart.weekRow': '{label} : {minutes} minutes actives, {workouts} séances',
    'progress.chart.volumeTitle': 'Volume par muscle · {count} derniers jours',
    'progress.chart.volumeAria': 'Volume musculaire des {count} derniers jours',
    'progress.chart.muscleRow': '{label} : {volume}, {sets} séries',
    'progress.sessionsLogged': {
      one: '{count} séance enregistrée au total',
      other: '{count} séances enregistrées au total',
    },
    'progress.grade': 'Note de santé',
    'progress.grade.perfect': 'Progression parfaite — continuez comme ça.',
    'progress.grade.solid': 'Du bon travail — une séance de plus fait la différence.',
    'progress.grade.building': 'Chaque séance compte. Prenons de l’élan.',
    'progress.window': '{count} derniers jours',
    'progress.window.one': 'Dernier jour',
    'progress.ring.scoreFallback': 'Score',
    'progress.ring.score': '{label} : {value} sur 100',
    'progress.ring.exercise': 'Exercice',
    'progress.ring.burned': 'Brûlées',
    'progress.ring.distance': 'Distance',
    'progress.streak': { one: 'série de {count} jour', other: 'série de {count} jours' },
    'progress.streak.best': 'record {count}',
    'progress.vs': '{value} vs {count} j précédents',
    'progress.vs.aria.more': '{value} de plus que les {count} jours précédents',
    'progress.vs.aria.less': '{value} de moins que les {count} jours précédents',
    'progress.next.minutes': '{value} min pour fermer l’anneau d’exercice',
    'progress.next.calories': '{value} pour fermer l’anneau de dépense',
    'progress.next.distance': '{value} pour fermer l’anneau de distance',
    'progress.next.none': 'Les trois anneaux sont fermés — tenez ce rythme.',
    'progress.next.rings':
      'Les anneaux de dépense et de distance se remplissent dès que vous fixez un objectif de calories ou de distance.',
    'progress.hero.aria': 'Note de santé et anneaux d’objectifs',
    'progress.grade.aria': 'Note de santé : {value} sur 100',
  },
};

/** Every key the English catalog defines — the extraction checklist. */
export const MESSAGE_KEYS: string[] = Object.keys(MESSAGES.en);

/**
 * Catalog health: which keys are missing from a locale, and which are stale.
 * Used by the i18n test so a half-translated release is visible rather than
 * discovered by a French user.
 */
export function catalogGaps(locale: Locale): { missing: string[]; extra: string[] } {
  const target = MESSAGES[locale] ?? {};
  const reference = MESSAGES[DEFAULT_LOCALE];
  return {
    missing: Object.keys(reference)
      .filter((k) => !(k in target))
      .sort(),
    extra: Object.keys(target)
      .filter((k) => !(k in reference))
      .sort(),
  };
}
