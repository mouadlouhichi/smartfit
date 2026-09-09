import type { ProPlan } from '@smartfit/core';

/** Plans a provider can sell — `trial` is always issued locally, never sold. */
export type PaidPlan = Exclude<ProPlan, 'trial'>;

export type BillingProviderId = 'stripe-links' | 'cmi' | 'sandbox';

/**
 * One way to take money for SmartFit Pro.
 *
 * The app only talks to this interface: checkout opens `checkoutUrl(plan)`
 * in a new tab, and a paid receipt is provisioned server-side (webhook /
 * callback) before the `profile.pro` stamp is written. Adding a provider
 * (e.g. enabling CMI once the finance setup lands) means implementing this
 * interface and registering it in `./index.ts` — no UI changes needed.
 */
export interface BillingProvider {
  readonly id: BillingProviderId;
  /** Display name for diagnostics and the paywall footnote. */
  readonly label: string;
  /** True when the deployment configured this provider. */
  readonly available: boolean;
  /**
   * Checkout URL for a paid plan, or null when this provider cannot check
   * out (unconfigured, sandbox explicitness, or trial — trials never pay).
   */
  checkoutUrl(plan: ProPlan): string | null;
  /**
   * Self-service subscription management (portal / customer area), or null
   * when the provider has none configured.
   */
  manageUrl(): string | null;
}
