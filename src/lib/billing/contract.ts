import type { ProPlan } from '@smartfit/core';
import type { BillingProvider } from './types';
import { cmiProvider } from './cmi';
import { sandboxProvider } from './sandbox';
import { stripeLinksProvider } from './stripe-links';
import { CMI_SETUP } from './cmi';

/**
 * The single source of truth for the provider registry. `index.ts` re-exports
 * it through `billingProviders()`, so checkout-preference order lives here and
 * the contract checks below validate exactly what the app ships. Importing the
 * concrete providers directly (not `./index`) keeps this file free of a
 * circular dependency.
 */
export const ALL_BILLING_PROVIDERS: BillingProvider[] = [
  stripeLinksProvider,
  cmiProvider,
  sandboxProvider,
];

export interface ContractViolation {
  provider: string;
  issue: string;
}

/**
 * Runtime structural check that a value satisfies the `BillingProvider`
 * contract — the *only* surface the app talks to for taking money. A provider
 * can typecheck fine and still break checkout at runtime (missing method,
 * wrong return shape), so we assert the shape too, not just the compiler.
 *
 * Returns the list of violations; empty means the candidate is contract-clean.
 */
export function validateBillingProvider(candidate: unknown): ContractViolation[] {
  const issues: ContractViolation[] = [];
  const obj = candidate as Record<string, unknown> | null;
  const name = (obj?.id as string) ?? '<anonymous>';

  if (!obj || typeof obj !== 'object') {
    return [{ provider: name, issue: 'provider is not an object' }];
  }

  if (typeof obj.id !== 'string') issues.push({ provider: name, issue: '`id` must be a string' });
  if (typeof obj.label !== 'string')
    issues.push({ provider: name, issue: '`label` must be a string' });
  if (typeof obj.available !== 'boolean')
    issues.push({ provider: name, issue: '`available` must be a boolean' });

  if (typeof obj.checkoutUrl !== 'function') {
    issues.push({ provider: name, issue: '`checkoutUrl` must be a function' });
  } else {
    const sample = (obj.checkoutUrl as (p: ProPlan) => unknown)('monthly');
    if (sample !== null && typeof sample !== 'string')
      issues.push({ provider: name, issue: '`checkoutUrl` must return string | null' });
  }

  if (typeof obj.manageUrl !== 'function') {
    issues.push({ provider: name, issue: '`manageUrl` must be a function' });
  } else {
    const sample = (obj.manageUrl as () => unknown)();
    if (sample !== null && typeof sample !== 'string')
      issues.push({ provider: name, issue: '`manageUrl` must return string | null' });
  }

  return issues;
}

/** Type guard: a candidate is a usable billing provider iff it has no violations. */
export function isBillingProvider(candidate: unknown): candidate is BillingProvider {
  return validateBillingProvider(candidate).length === 0;
}

/**
 * Behavioural invariants that hold for every well-formed provider, regardless
 * of its shape: trials are always free (the client never sells them), and the
 * CMI integration contract stays server-only and clearly specified.
 */
export function validateBillingBehaviour(provider: BillingProvider): ContractViolation[] {
  const issues: ContractViolation[] = [];
  if (provider.checkoutUrl('trial') !== null)
    issues.push({
      provider: provider.id,
      issue: '`checkoutUrl("trial")` must return null (trials never pay)',
    });
  return issues;
}

/**
 * Validate the full shipped provider registry *and* the CMI setup contract.
 * Throws on the first violation so CI fails fast instead of shipping a
 * provider that silently breaks checkout. Returns void when everything holds.
 */
export function assertBillingContracts(): void {
  const violations: ContractViolation[] = [];

  for (const p of ALL_BILLING_PROVIDERS) {
    for (const v of validateBillingProvider(p)) violations.push({ ...v, provider: p.id });
    for (const v of validateBillingBehaviour(p)) violations.push({ ...v, provider: p.id });
  }

  // CMI setup contract: the merchant secret must never reach the browser, and
  // the two server routes it needs are POST handlers.
  if (!CMI_SETUP.serverEnv.every((k) => !k.startsWith('NEXT_PUBLIC_')))
    violations.push({
      provider: 'cmi',
      issue: 'CMI server env must not include NEXT_PUBLIC_ keys',
    });
  if (!CMI_SETUP.routes.every((r) => r.method === 'POST'))
    violations.push({ provider: 'cmi', issue: 'CMI routes must be POST handlers' });
  if (!Array.isArray(CMI_SETUP.plans) || CMI_SETUP.plans.length === 0)
    violations.push({ provider: 'cmi', issue: 'CMI must declare at least one plan' });

  if (violations.length > 0) {
    const lines = violations.map((v) => `  - ${v.provider}: ${v.issue}`).join('\n');
    throw new Error(`Billing provider contract violated:\n${lines}`);
  }
}
