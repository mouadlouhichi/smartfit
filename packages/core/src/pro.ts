import type { FitnessState, ProStatus } from './types';

/**
 * SmartFit Pro — the paid tier.
 *
 * The domain only knows *whether* the profile carries a valid subscription
 * stamp and which plan it names; receipt validation and charging live in the
 * billing adapter (`src/lib/billing.ts` on web), so the engine stays pure and
 * testable.
 *
 * Every limit below is **actually enforced** somewhere in the app — the
 * paywall never advertises a gate that does not exist. `PRO_GATES` is the
 * single list both the paywall and the gates read from, so they cannot drift.
 */

export type ProPlan = ProStatus['plan'];

export interface ProPlanMeta {
  id: ProPlan;
  name: string;
  price: string;
  per: string;
  /** Roughly `price / months`, shown on the card so yearly reads as a deal. */
  effective?: string;
  note?: string;
  /** Rendered as the "most popular" ribbon. */
  featured?: boolean;
  /** Percent saved versus paying monthly, for the ribbon copy. */
  savePct?: number;
}

export const PRO_PLANS: ProPlanMeta[] = [
  { id: 'monthly', name: 'Monthly', price: '$6.99', per: '/month' },
  {
    id: 'yearly',
    name: 'Yearly',
    price: '$49.99',
    per: '/year',
    effective: '$4.17/mo',
    note: 'Best value',
    featured: true,
    savePct: 40,
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    price: '$99',
    per: ' once',
    note: 'Pay once, train forever',
  },
];

/** One row of the Free-vs-Pro comparison on the paywall. */
export interface ProGate {
  /** Short feature name. */
  label: string;
  /** What the free tier gets. */
  free: string;
  /** What Pro unlocks. */
  pro: string;
  /** lucide icon key. */
  icon: string;
}

/**
 * The honest comparison table. Each row maps to a real gate in the app:
 *
 *  - AI coach      → `coach-panel.tsx` (`FREE_COACH_REPLIES_PER_DAY`;
 *                    on-device answers are always unlimited — the cap only
 *                    covers replies from a configured AI provider)
 *  - Progression   → `session-runner-modal.tsx` (`progressionTarget`)
 *  - Readiness     → `overview-screen.tsx` (`readiness`: label free, score Pro)
 *  - Analytics     → `progress-screen.tsx` (`RANGES[].pro`)
 *  - Templates     → `ScheduleModal.tsx` (`FREE_ROUTINE_TEMPLATES`)
 *  - Share cards   → `session-runner-modal.tsx` + `route-art.ts` (watermark)
 *
 * Deliberately NOT gated: your own records, earned badges and data export
 * (JSON + CSV) are free forever — the privacy brand cannot hold your own
 * history hostage. Pro sells intelligence (what to do next, how ready you
 * are), not access to your past.
 */
export const PRO_GATES: ProGate[] = [
  {
    label: 'AI coach',
    free: `${6} AI replies / day`,
    pro: 'Unlimited',
    icon: 'sparkles',
  },
  {
    label: 'Smart progression',
    free: 'Last-session pre-fill',
    pro: 'Adaptive targets every set',
    icon: 'trending-up',
  },
  {
    label: 'Readiness score',
    free: 'Daily label',
    pro: 'Score, drivers & load chart',
    icon: 'activity',
  },
  {
    label: 'Analytics ranges',
    free: 'Week & month',
    pro: 'Quarter, year & all-time',
    icon: 'line-chart',
  },
  {
    label: 'Workout templates',
    free: `${3} routines`,
    pro: 'Unlimited',
    icon: 'list-checks',
  },
  {
    label: 'Share cards',
    free: 'Watermarked',
    pro: 'No watermark',
    icon: 'share',
  },
  {
    label: 'Fuel insights',
    free: 'Targets & meal log',
    pro: 'Meal scan & adherence trends',
    icon: 'utensils',
  },
];

/**
 * Legacy flat list, kept for the marketing site and the compact upsell cards.
 * Derived from `PRO_GATES` so the two can never disagree.
 */
export const PRO_FEATURES: readonly string[] = PRO_GATES.map((g) => `${g.label}: ${g.pro}`);

/**
 * Free-tier AI coach allowance, per calendar day, on this device. Only
 * replies from a configured AI provider count — on-device answers are
 * unlimited because they cost nothing to serve.
 */
export const FREE_COACH_REPLIES_PER_DAY = 6;

/** Free tier can save N scheduled slots with an exercise list (templates). */
export const FREE_ROUTINE_TEMPLATES = 3;

/**
 * Length of the free Pro period offered on the paywall. Three months — a
 * full training block plus the next one — is long enough to feel what the
 * adaptive engine does for you; two weeks only ever showed the onboarding.
 * Expressed in whole months so the paywall can promise "3 months free".
 */
export const PRO_TRIAL_MONTHS = 3;
export const PRO_TRIAL_DAYS = PRO_TRIAL_MONTHS * 30;

export function isPro(state: FitnessState): boolean {
  const pro = state.profile.pro;
  return (
    !!pro &&
    (pro.plan === 'monthly' || pro.plan === 'yearly' || pro.plan === 'lifetime') &&
    typeof pro.since === 'number' &&
    pro.since > 0
  );
}

/**
 * True while a trial is running.
 *
 * A trial is a Pro stamp whose `since` is less than `PRO_TRIAL_DAYS` old and
 * whose plan is `trial`. Trials are only ever issued locally by the sandbox
 * billing adapter — a real receipt sets `monthly`/`yearly`, which never expire
 * client-side.
 */
export function isTrialing(state: FitnessState, now = Date.now()): boolean {
  const pro = state.profile.pro;
  if (!pro || pro.plan !== 'trial') return false;
  const elapsed = now - pro.since;
  return elapsed >= 0 && elapsed < PRO_TRIAL_DAYS * 24 * 60 * 60 * 1000;
}

/** Days left on a trial, or 0 when there is none. */
export function trialDaysLeft(state: FitnessState, now = Date.now()): number {
  if (!isTrialing(state, now)) return 0;
  const pro = state.profile.pro!;
  const msLeft = PRO_TRIAL_DAYS * 24 * 60 * 60 * 1000 - (now - pro.since);
  return Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
}

/** Pro or an active trial — the check every gate should use. */
export function hasProAccess(state: FitnessState, now = Date.now()): boolean {
  return isPro(state) || isTrialing(state, now);
}
