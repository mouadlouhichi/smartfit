import type { ProPlan } from '@smartfit/core';

/**
 * Billing adapter for SmartFit Pro.
 *
 * Two modes, chosen at build time from env:
 *
 * 1. **Stripe Payment Links** (real money, zero backend): set
 *    `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_MONTHLY` / `_YEARLY` to links created in
 *    your Stripe dashboard (with the metadata `uid` passed via client
 *    reference on the return URL). Checkout opens in a new tab; on return,
 *    the webhook-provisioned receipt flips `profile.pro`.
 * 2. **Sandbox** (default): checkout is simulated locally so the entire
 *    paywall → activation → gating flow is testable end-to-end without a
 *    merchant account. The UI labels this clearly — no silent fake charges.
 */
const MONTHLY_LINK = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_MONTHLY;
const YEARLY_LINK = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_YEARLY;

const STRIPE_LINK = /^https:\/\/(buy\.stripe\.com|checkout\.stripe\.com)\//;

export function paymentLinkFor(plan: ProPlan): string | null {
  const link = plan === 'monthly' ? MONTHLY_LINK : YEARLY_LINK;
  return link && STRIPE_LINK.test(link) ? link : null;
}

export const BILLING_MODE: 'stripe-links' | 'sandbox' =
  paymentLinkFor('monthly') || paymentLinkFor('yearly') ? 'stripe-links' : 'sandbox';
