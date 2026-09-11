import type { ProPlan } from '@smartfit/core';
import type { BillingProvider } from './types';

/**
 * Stripe Payment Links — a future checkout contract. Real money stays disabled
 * until a verified server webhook provisions and manages entitlements.
 *
 * Set `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_MONTHLY` / `_YEARLY` /
 * `_LIFETIME` only as part of the future launch setup. A webhook (see
 * `docs/billing.md`) must provision `profile.pro` server-side — the client
 * never writes its own paid receipt.
 */
const STRIPE_LINK = /^https:\/\/(buy\.stripe\.com|checkout\.stripe\.com)\//;

function stripeLinkFor(plan: ProPlan): string | null {
  const raw =
    plan === 'monthly'
      ? process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_MONTHLY
      : plan === 'yearly'
        ? process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_YEARLY
        : plan === 'lifetime'
          ? process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_LIFETIME
          : undefined;
  return raw && STRIPE_LINK.test(raw.trim()) ? raw.trim() : null;
}

function stripePortalUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL;
  return raw && raw.startsWith('https://') ? raw.trim() : null;
}

export const stripeLinksProvider: BillingProvider = {
  id: 'stripe-links',
  label: 'Stripe',
  get available() {
    return (
      stripeLinkFor('monthly') !== null ||
      stripeLinkFor('yearly') !== null ||
      stripeLinkFor('lifetime') !== null
    );
  },
  checkoutUrl: (plan) => stripeLinkFor(plan),
  manageUrl: () => stripePortalUrl(),
};
