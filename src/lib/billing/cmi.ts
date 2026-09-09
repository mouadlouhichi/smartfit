import type { BillingProvider } from './types';

/**
 * CMI (Centre Monétique Interbancaire) — Morocco's card gateway.
 *
 * NOT ACTIVE YET — this module is the integration contract so the finance
 * setup can land without touching product code. CMI differs from Stripe
 * Payment Links in one decisive way: the merchant secret (`storeKey`) must
 * never ship to the browser, so CMI checkout requires two small server
 * routes (see `docs/billing.md` § CMI):
 *
 *  - `POST /api/billing/cmi/checkout` — builds the signed payment form /
 *    redirect from `{ plan, uid, email }` using the server-side secret.
 *  - `POST /api/billing/cmi/callback` — validates CMI's response hash and
 *    stamps `profile.pro` via the Firebase Admin SDK (the client never
 *    writes its own receipt).
 *
 * When those routes exist, flip `available` (or gate it on a server-set
 * flag) and point `checkoutUrl` at the checkout route — the paywall,
 * gates and trial logic need no changes.
 */
export interface CmiSetupSpec {
  /** Env the server routes require (never `NEXT_PUBLIC_`). */
  serverEnv: string[];
  /** Same-origin routes the provider will call once implemented. */
  routes: { method: 'POST'; path: string; purpose: string }[];
  /** Plans CMI will sell (MAD pricing is configured in the CMI backoffice). */
  plans: string[];
}

export const CMI_SETUP: CmiSetupSpec = {
  serverEnv: ['CMI_STORE_ID', 'CMI_STORE_KEY', 'CMI_GATEWAY_URL', 'CMI_OK_URL', 'CMI_FAIL_URL'],
  routes: [
    {
      method: 'POST',
      path: '/api/billing/cmi/checkout',
      purpose: 'Sign { plan, uid, email } and return the CMI redirect',
    },
    {
      method: 'POST',
      path: '/api/billing/cmi/callback',
      purpose: 'Validate the CMI response hash, stamp profile.pro server-side',
    },
  ],
  plans: ['monthly', 'yearly', 'lifetime'],
};

export const cmiProvider: BillingProvider = {
  id: 'cmi',
  label: 'CMI',
  // The finance setup flips this once the server routes above exist.
  available: process.env.NEXT_PUBLIC_CMI_ENABLED === '1',
  checkoutUrl: () => null, // wired to /api/billing/cmi/checkout when live
  manageUrl: () => null,
};
