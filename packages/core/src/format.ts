import { BODY_UNIT_META, GOAL_METRIC_META, PLANS, SEEDED_GOAL_NAMES } from './constants';
import type { BodyUnit, DistanceUnit, UserProfile, WeightUnit } from './types';
import { bodyDisplayUnit, bodyValueToDisplay, fromKg, fromKm } from './units';
import type { Translator } from './i18n';

export function formatMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

export function formatNumber(n: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(n);
}

export function formatCalories(kcal: number): string {
  return `${formatNumber(Math.round(kcal), 0)} kcal`;
}

/**
 * Tonnage: kg under the bar × reps, rendered in the athlete's weight unit.
 * Rolls up to tonnes above 1,000 kg so long histories stay readable
 * ("12.4 t" rather than "12,400 kg").
 */
export function formatVolume(kg: number, unit: WeightUnit = 'kg'): string {
  const display = fromKg(kg, unit);
  // Roll up to tonnes only in metric — "2.2 t" is meaningless to a lb user,
  // who gets a plain grouped number instead.
  if (unit === 'kg' && display >= 1000) return `${formatNumber(display / 1000)} t`;
  return `${formatNumber(Math.round(display), 0)} ${unit}`;
}

/** A single set, the way the runner writes it: "8 × 60 kg" / "45s" / "2 km". */
export function formatSet(
  set: {
    reps?: number;
    weight?: number;
    distance?: number;
    duration?: number;
    kind?: 'working' | 'warmup' | 'drop' | 'failure';
    rpe?: number;
  },
  unit: WeightUnit = 'kg',
): string {
  let value = '—';
  if ((set.weight ?? 0) > 0 && (set.reps ?? 0) > 0) {
    value = `${set.reps} × ${formatWeight(set.weight!, unit)}`;
  } else if ((set.reps ?? 0) > 0) {
    value = `${set.reps} reps`;
  } else if ((set.distance ?? 0) > 0) {
    value = formatSetDistance(set.distance!);
  } else if ((set.duration ?? 0) > 0) {
    value = formatMinutes(set.duration!);
  }

  const kindLabel =
    set.kind === 'warmup'
      ? 'Warm-up'
      : set.kind === 'drop'
        ? 'Drop set'
        : set.kind === 'failure'
          ? 'Failure'
          : '';
  const rpeLabel = set.rpe != null && set.rpe >= 1 && set.rpe <= 10 ? `RPE ${set.rpe}` : '';
  const labels = [kindLabel, rpeLabel].filter(Boolean).join(' · ');
  return labels ? (value === '—' ? labels : `${value} · ${labels}`) : value;
}

/**
 * Distance is stored in kilometres and rendered in the athlete's unit.
 * Pass the profile's `distanceUnit` at every call site — the default only
 * exists so the canonical value can be shown in unit-agnostic contexts.
 */
export function formatDistance(km: number, unit: DistanceUnit = 'km'): string {
  return `${formatNumber(round1(fromKm(km, unit)))} ${unit}`;
}

/**
 * Short, set-scale distances (canonical km) for logs: sub-kilometre efforts
 * read in metres ("400 m"), longer ones in km. Session-level totals keep
 * using `formatDistance` with the athlete's own unit.
 */
export function formatSetDistance(km: number): string {
  if (km > 0 && km < 1) return `${formatNumber(Math.round(km * 1000), 0)} m`;
  return `${formatNumber(round1(km))} km`;
}

/** Body mass is stored in kilograms and rendered in the athlete's unit. */
export function formatWeight(kg: number, unit: WeightUnit = 'kg'): string {
  return `${formatNumber(round1(fromKg(kg, unit)))} ${unit}`;
}

/** Render any body measurement in the athlete's preferred units. */
export function formatBodyValue(
  value: number,
  bodyUnit: BodyUnit,
  profile: Pick<UserProfile, 'weightUnit'>,
  label?: string,
): string {
  const display = bodyValueToDisplay(value, bodyUnit, profile);
  const suffix = bodyUnit === 'custom' ? '' : bodyDisplayUnit(bodyUnit, profile);
  const rounded = formatNumber(round1(display));
  return suffix ? `${rounded} ${suffix}` : `${rounded}${label ? ` ${label}` : ''}`;
}

/** Human label for a body measurement type. */
export function bodyLabel(bodyUnit: BodyUnit, custom?: string): string {
  if (bodyUnit === 'custom') return custom?.trim() || 'Measurement';
  return BODY_UNIT_META[bodyUnit]?.label ?? bodyUnit;
}

/**
 * Catalogue keys for the measurement types, one per `BODY_UNIT_META` entry.
 *
 * A static map, not `body.unit.${unit}`: the key guard needs to see each key
 * in the source it scans, and a test asserts this covers the whole meta table
 * so a new measurement type cannot ship with an English-only name.
 */
export const BODY_UNIT_KEYS: Record<BodyUnit, string> = {
  weight: 'body.unit.weight',
  bodyfat: 'body.unit.bodyfat',
  waist: 'body.unit.waist',
  chest: 'body.unit.chest',
  arms: 'body.unit.arms',
  custom: 'body.unit.custom',
};

/**
 * Weekday names in the interface language, **Sunday first** — the order of
 * `WEEKDAYS` / `WEEKDAYS_LONG` in `constants.ts`, so a call site keeps whatever
 * rotation it already applies.
 *
 * These are not catalogue entries: day names are exactly the copy `Intl` knows,
 * which is the same reason `formatDateLabel` uses it. The reference week is
 * fixed (31 December 2023 was a Sunday) and read in UTC, so the output cannot
 * depend on the machine's timezone or on the day the test runs.
 */
export function weekdayLabels(locale?: string, width: 'short' | 'long' = 'short'): string[] {
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), { weekday: width, timeZone: 'UTC' });
  const days = [
    new Date(Date.UTC(2023, 11, 31)), // Sunday
    ...[1, 2, 3, 4, 5, 6].map((d) => new Date(Date.UTC(2024, 0, d))), // Mon…Sat
  ];
  return days.map((d) => fmt.format(d));
}

/** One weekday by `Date.getDay()` index, wrapping out-of-range values. */
export function weekdayLabel(
  weekday: number,
  locale?: string,
  width: 'short' | 'long' = 'long',
): string {
  const names = weekdayLabels(locale, width);
  return names[((Math.trunc(weekday) % 7) + 7) % 7];
}

/**
 * Catalogue keys for the training plans and the goal metrics, by id.
 *
 * Same arrangement as `BODY_UNIT_KEYS`: the English copy lives in the data
 * (`PLANS`, `GOAL_METRIC_META`) because the mobile client reads it directly,
 * and these keys resolve the localised copy for the web UI.
 */
export const PLAN_KEYS: Record<string, { name: string; description: string }> = {
  ppl: { name: 'plan.ppl.name', description: 'plan.ppl.description' },
  'upper-lower': { name: 'plan.upperLower.name', description: 'plan.upperLower.description' },
  'full-body': { name: 'plan.fullBody.name', description: 'plan.fullBody.description' },
  'cardio-focus': { name: 'plan.cardioFocus.name', description: 'plan.cardioFocus.description' },
};

export const GOAL_METRIC_KEYS: Record<string, { label: string; unit: string }> = {
  workouts: { label: 'goal.metric.workouts', unit: 'goal.metric.workouts.unit' },
  minutes: { label: 'goal.metric.minutes', unit: 'goal.metric.minutes.unit' },
  calories: { label: 'goal.metric.calories', unit: 'goal.metric.calories.unit' },
  distance: { label: 'goal.metric.distance', unit: 'goal.metric.distance.unit' },
};

/**
 * Display name and one-line description of a training plan. Without a
 * translator both fall back to the English data, so core callers, the mobile
 * app and the tests keep reading the same words.
 */
export function planName(planId: string, t?: Translator): string {
  const key = PLAN_KEYS[planId]?.name;
  if (key && t) return t(key);
  return PLANS.find((p) => p.id === planId)?.name ?? PLANS[0].name;
}

export function planDescription(planId: string, t?: Translator): string {
  const key = PLAN_KEYS[planId]?.description;
  if (key && t) return t(key);
  return PLANS.find((p) => p.id === planId)?.description ?? '';
}

/**
 * The human name of a goal metric ("Active minutes") and the unit it is
 * counted in ("min"). The unit is a symbol — `km`, `kcal`, `min` — which is
 * why the French catalogue repeats it rather than inventing a word.
 */
export function goalMetricLabel(metric: string, t?: Translator): string {
  const key = GOAL_METRIC_KEYS[metric]?.label;
  if (key && t) return t(key);
  return GOAL_METRIC_META[metric]?.label ?? metric;
}

export function goalMetricUnit(metric: string, t?: Translator): string {
  const key = GOAL_METRIC_KEYS[metric]?.unit;
  if (key && t) return t(key);
  return GOAL_METRIC_META[metric]?.unit ?? '';
}

/**
 * The stored name for a goal created during onboarding, in canonical English.
 * The onboarding flow writes this rather than a translated string, so a goal
 * created in French reads correctly after the athlete switches to English.
 */
export function seededGoalName(metric: string): string {
  return SEEDED_GOAL_NAMES[metric] ?? SEEDED_GOAL_NAMES.workouts;
}

/**
 * The name to show for a goal.
 *
 * The two names onboarding seeds were written by us, so they translate; every
 * other name is the athlete's own words and passes through untouched — which
 * is also why the seeded ones cannot be detected by anything but their stored
 * value.
 */
export function goalDisplayName(name: string, t?: Translator): string {
  if (!t) return name;
  const seeded = Object.keys(SEEDED_GOAL_NAMES).find((m) => SEEDED_GOAL_NAMES[m] === name);
  if (seeded) return t(`goal.seed.${seeded}`);
  // A goal the athlete created without naming it is stored as "<metric> goal".
  const unnamed = Object.keys(GOAL_METRIC_META).find(
    (m) => `${GOAL_METRIC_META[m].label} goal` === name,
  );
  if (unnamed) return t('goal.defaultName', { metric: goalMetricLabel(unnamed, t) });
  return name;
}

/**
 * Display name for a measurement type.
 *
 * `bodyLabel` above is the English name the mobile client and the stored data
 * use; this resolves the translated copy when a translator is passed and falls
 * back to `bodyLabel` when there is none (core callers, tests, mobile).
 * A custom measurement always shows the athlete's own label.
 */
export function bodyUnitLabel(
  bodyUnit: BodyUnit | string,
  custom?: string,
  t?: Translator,
): string {
  if (bodyUnit === 'custom')
    return custom?.trim() || (t ? t(BODY_UNIT_KEYS.custom) : 'Measurement');
  const key = BODY_UNIT_KEYS[bodyUnit as BodyUnit];
  if (key && t) return t(key);
  return bodyLabel(bodyUnit as BodyUnit, custom);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * BCP-47 tag for `Intl`: 'fr' → 'fr-FR', anything else → the device default.
 *
 * Month, weekday and number formatting is the one part of localisation `Intl`
 * already does, so handing the app locale over is all it takes.
 */
function intlLocale(locale?: string): string | undefined {
  return locale === 'fr' ? 'fr-FR' : undefined;
}

/**
 * "Mon, 3 Mar"-style label. The month and weekday names are the one piece of
 * copy `Intl` can translate for us, so the locale is the only thing to pass —
 * the pattern itself is fine in both languages.
 */
export function formatDateLabel(iso: string, locale?: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(intlLocale(locale), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function relativeDay(iso: string, now = new Date(), t?: Translator): string {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return t?.('time.today') ?? 'Today';
  if (diff === -1) return t?.('time.yesterday') ?? 'Yesterday';
  if (diff === 1) return t?.('time.tomorrow') ?? 'Tomorrow';
  return formatDateLabel(iso);
}
