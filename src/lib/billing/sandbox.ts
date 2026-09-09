import type { BillingProvider } from './types';

/**
 * Sandbox — the default when no provider is configured. Checkout is
 * simulated locally so the entire paywall → activation → gating flow is
 * testable end-to-end without a merchant account. The paywall labels this
 * clearly; it never pretends to charge.
 */
export const sandboxProvider: BillingProvider = {
  id: 'sandbox',
  label: 'Sandbox',
  available: true,
  checkoutUrl: () => null,
  manageUrl: () => null,
};
