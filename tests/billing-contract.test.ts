import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_BILLING_PROVIDERS,
  assertBillingContracts,
  isBillingProvider,
  validateBillingBehaviour,
  validateBillingProvider,
} from '../src/lib/billing/contract.ts';

/**
 * The billing module is a *contract*, not a single implementation. Live,
 * dormant and sandbox providers all sit behind one `BillingProvider`
 * interface, so we validate the shape and behaviour at runtime — not just the
 * types — and pin the CMI integration spec the finance team will implement.
 */

test('every registered provider satisfies the BillingProvider contract', () => {
  assert.ok(ALL_BILLING_PROVIDERS.length >= 1, 'registry must not be empty');
  for (const p of ALL_BILLING_PROVIDERS) {
    const issues = validateBillingProvider(p);
    assert.deepEqual(
      issues,
      [],
      `provider "${p.id}" violated the contract:\n${issues.map((i) => `  - ${i.issue}`).join('\n')}`,
    );
    assert.ok(isBillingProvider(p), `"${p.id}" should be recognised as a billing provider`);
  }
});

test('provider ids are unique', () => {
  const ids = ALL_BILLING_PROVIDERS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate provider ids: ${ids.join(', ')}`);
});

test('trials are never sold — checkoutUrl("trial") is always null', () => {
  for (const p of ALL_BILLING_PROVIDERS) {
    assert.deepEqual(validateBillingBehaviour(p), [], `"${p.id}" behaves incorrectly`);
    assert.equal(p.checkoutUrl('trial'), null, `"${p.id}" must not sell trials`);
  }
});

test('a structurally broken provider is rejected by the contract', () => {
  const missingMethods = validateBillingProvider({ id: 'broken', label: 'Broken' });
  assert.ok(missingMethods.length > 0, 'missing methods should be reported');

  const wrongReturnObject = {
    id: 'wrong',
    label: 'Wrong',
    available: true,
    checkoutUrl: () => 42,
    manageUrl: () => null,
  } as unknown as Parameters<typeof validateBillingProvider>[0];
  const wrongReturn = validateBillingProvider(wrongReturnObject);
  assert.ok(
    wrongReturn.some((v) => v.issue.includes('checkoutUrl')),
    `wrong checkoutUrl return type should be reported, got: ${JSON.stringify(wrongReturn)}`,
  );

  assert.equal(isBillingProvider({ id: 'x' }), false, 'non-object must fail the guard');
});

test('assertBillingContracts passes for the shipped registry', () => {
  assert.doesNotThrow(() => assertBillingContracts());
});
