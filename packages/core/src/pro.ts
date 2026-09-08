import type { FitnessState, ProStatus } from './types';

/**
 * SmartFit Pro — the paid tier.
 *
 * The domain only knows *whether* the profile carries a valid subscription
 * stamp and which plan it names; receipt validation and charging live in the
 * billing adapter (`src/lib/billing.ts` on web), so the engine stays pure and
 * testable.
 */

export type ProPlan = ProStatus['plan'];

export interface ProPlanMeta {
  id: ProPlan;
  name: string;
  price: string;
  per: string;
  note?: string;
}

export const PRO_PLANS: ProPlanMeta[] = [
  { id: 'monthly', name: 'Pro Monthly', price: '$6.99', per: '/month' },
  { id: 'yearly', name: 'Pro Yearly', price: '$49.99', per: '/year', note: '2 months free' },
];

/** What the paywall promises — keep in sync with the gates in the web app. */
export const PRO_FEATURES = [
  'Unlimited AI coach replies (free: 6 per day)',
  'Quarter & year analytics ranges',
  'Pro badge on your profile',
  'First access to new gym programs',
] as const;

/** Free-tier AI coach allowance, per calendar day, on this device. */
export const FREE_COACH_REPLIES_PER_DAY = 6;

export function isPro(state: FitnessState): boolean {
  const pro = state.profile.pro;
  return (
    !!pro &&
    (pro.plan === 'monthly' || pro.plan === 'yearly') &&
    typeof pro.since === 'number' &&
    pro.since > 0
  );
}
