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

    // ── language ──────────────────────────────────────────────────────────
    'language.title': 'Langue',
    'language.subtitle':
      'Langue de l’interface. Les aliments, les dates et les nombres la suivent aussi.',
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
