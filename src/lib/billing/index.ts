import type { ProPlan } from '@smartfit/core';
import { cmiProvider } from './cmi';
import { sandboxProvider } from './sandbox';
import { stripeLinksProvider } from './stripe-links';
import type { BillingProvider } from './types';

export type { BillingProvider, BillingProviderId, PaidPlan } from './types';
export { CMI_SETUP, cmiProvider } from './cmi';
export { sandboxProvider } from './sandbox';
export { stripeLinksProvider } from './stripe-links';

/** Every known provider, in checkout-preference order. */
export function billingProviders(): BillingProvider[] {
  return [stripeLinksProvider, cmiProvider, sandboxProvider];
}

/** The provider contract the preview paywall would use once billing is live. */
export function activeBillingProvider(): BillingProvider {
  return billingProviders().find((p) => p.available) ?? sandboxProvider;
}

export const BILLING_MODE: 'stripe-links' | 'cmi' | 'sandbox' = activeBillingProvider().id;

/**
 * Checkout URL for a plan via the active provider, or null when checkout
 * is simulated (sandbox) or the plan has no link configured.
 */
export function paymentLinkFor(plan: ProPlan): string | null {
  if (plan === 'trial') return null;
  return activeBillingProvider().checkoutUrl(plan);
}

/** Self-service subscription management URL, when the provider has one. */
export function manageSubscriptionUrl(): string | null {
  return activeBillingProvider().manageUrl();
}
