import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BILLING_MODE,
  CMI_SETUP,
  activeBillingProvider,
  manageSubscriptionUrl,
  paymentLinkFor,
} from '../src/lib/billing/index.ts';

/**
 * The billing module picks exactly one provider: Stripe links when
 * configured, otherwise the explicitly-labelled sandbox. CMI stays dormant
 * until the finance setup lands — but its contract is pinned here so the
 * integration cannot drift from what the code expects.
 */

function clearBillingEnv() {
  delete process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_MONTHLY;
  delete process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_YEARLY;
  delete process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_LIFETIME;
  delete process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL;
  delete process.env.NEXT_PUBLIC_CMI_ENABLED;
}

test('sandbox is the default: no links, no charges, no portal', () => {
  clearBillingEnv();
  assert.equal(activeBillingProvider().id, 'sandbox');
  assert.equal(paymentLinkFor('monthly'), null);
  assert.equal(paymentLinkFor('lifetime'), null);
  assert.equal(paymentLinkFor('trial'), null);
  assert.equal(manageSubscriptionUrl(), null);
});

test('stripe links activate per plan and reject off-domain URLs', () => {
  clearBillingEnv();
  process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_MONTHLY = 'https://buy.stripe.com/test-monthly';
  process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_YEARLY = 'https://evil.example.com/steal';
  assert.equal(activeBillingProvider().id, 'stripe-links');
  assert.equal(paymentLinkFor('monthly'), 'https://buy.stripe.com/test-monthly');
  assert.equal(paymentLinkFor('yearly'), null);
  assert.equal(paymentLinkFor('lifetime'), null);

  process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL = 'https://billing.stripe.com/session/abc';
  assert.equal(manageSubscriptionUrl(), 'https://billing.stripe.com/session/abc');
  clearBillingEnv();
});

test('BILLING_MODE export matches the resolved provider', () => {
  clearBillingEnv();
  // Module-level const is resolved at import (sandbox in test env).
  assert.equal(BILLING_MODE, 'sandbox');
  assert.equal(activeBillingProvider().id, 'sandbox');
});

test('the CMI contract is fully specified for the finance setup', () => {
  clearBillingEnv();
  assert.equal(activeBillingProvider().id === 'cmi', false);
  assert.ok(CMI_SETUP.serverEnv.includes('CMI_STORE_KEY'));
  assert.ok(CMI_SETUP.serverEnv.every((k) => !k.startsWith('NEXT_PUBLIC_')));
  assert.deepEqual(
    CMI_SETUP.routes.map((r) => r.path),
    ['/api/billing/cmi/checkout', '/api/billing/cmi/callback'],
  );
  assert.deepEqual(CMI_SETUP.plans, ['monthly', 'yearly', 'lifetime']);
});
