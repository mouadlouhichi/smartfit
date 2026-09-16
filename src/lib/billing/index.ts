import type { ProPlan } from '@smartfit/core';
import type { BillingProvider } from './types';
import { sandboxProvider } from './sandbox';
import {
  ALL_BILLING_PROVIDERS,
  assertBillingContracts,
  isBillingProvider,
  validateBillingBehaviour,
  validateBillingProvider,
} from './contract';

export type { BillingProvider, BillingProviderId, PaidPlan } from './types';
export { CMI_SETUP, cmiProvider } from './cmi';
export { sandboxProvider } from './sandbox';
export { stripeLinksProvider } from './stripe-links';

// Contract validation (structural shape + behavioural invariants + CMI setup).
export {
  ALL_BILLING_PROVIDERS,
  assertBillingContracts,
  isBillingProvider,
  validateBillingBehaviour,
  validateBillingProvider,
  type ContractViolation,
} from './contract';

/**
 * Every known provider, in checkout-preference order. The array is owned by
 * `./contract` so the registry and its contract checks can never drift apart.
 */
export function billingProviders(): BillingProvider[] {
  return ALL_BILLING_PROVIDERS;
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
