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
 *  - AI coach      → `coach-panel.tsx` (`FREE_COACH_REPLIES_PER_DAY`)
 *  - Analytics     → `progress-screen.tsx` (`RANGES[].pro`)
 *  - Records/1RM   → `progress-screen.tsx` (Records section)
 *  - Achievements  → `progress-screen.tsx` (`FREE_ACHIEVEMENTS`)
 *  - Templates     → `plan-screen.tsx` (`FREE_ROUTINE_TEMPLATES`)
 *  - Export        → `profile-screen.tsx` (CSV)
 */
export const PRO_GATES: ProGate[] = [
  {
    label: 'AI coach',
    free: `${6} replies / day`,
    pro: 'Unlimited',
    icon: 'sparkles',
  },
  {
    label: 'Analytics ranges',
    free: 'Week & month',
    pro: 'Quarter, year & all-time',
    icon: 'line-chart',
  },
  {
    label: 'Personal records & 1RM',
    free: 'Top 3 lifts',
    pro: 'Every lift, full history',
    icon: 'trophy',
  },
  {
    label: 'Achievements wall',
    free: `${3} badges`,
    pro: 'All badges',
    icon: 'medal',
  },
  {
    label: 'Workout templates',
    free: `${3} routines`,
    pro: 'Unlimited',
    icon: 'list-checks',
  },
  {
    label: 'Data export',
    free: 'JSON backup',
    pro: 'JSON + CSV for spreadsheets',
    icon: 'file-down',
  },
];

/**
 * Legacy flat list, kept for the marketing site and the compact upsell cards.
 * Derived from `PRO_GATES` so the two can never disagree.
 */
export const PRO_FEATURES: readonly string[] = PRO_GATES.map((g) => `${g.label}: ${g.pro}`);

/** Free-tier AI coach allowance, per calendar day, on this device. */
export const FREE_COACH_REPLIES_PER_DAY = 6;

/** Free tier shows the top N personal records; Pro shows all of them. */
export const FREE_RECORDS = 3;

/** Free tier shows the first N achievements; Pro shows the whole wall. */
export const FREE_ACHIEVEMENTS = 3;

/** Free tier can save N scheduled slots with an exercise list (templates). */
export const FREE_ROUTINE_TEMPLATES = 3;

/** Length of the trial offered on the paywall, in days. */
export const PRO_TRIAL_DAYS = 7;

export function isPro(state: FitnessState): boolean {
  const pro = state.profile.pro;
  return (
    !!pro &&
    (pro.plan === 'monthly' || pro.plan === 'yearly') &&
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
