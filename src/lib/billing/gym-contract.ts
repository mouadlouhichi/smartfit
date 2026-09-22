/**
 * Gym-contract billing — how money moves between the three parties.
 *
 * This module sits alongside the Pro `BillingProvider` (which sells SmartFit
 * Pro to an individual) and answers the two B2B questions that provider
 * cannot express:
 *
 *  1. **Platform → gym (the contract).** A gym pays a monthly platform fee.
 *     Offline is the norm here — bank transfer and cash — so the path is
 *     *recorded* payments plus dunning-lite states, not a checkout URL. The
 *     states drive the admin console: when a gym is overdue it is shown red
 *     and a suspend is one click away.
 *  2. **Member → gym (a membership).** A member picks a published plan online,
 *     which records a **draft** invoice; money changes hands at the desk,
 *     where collecting it marks the invoice paid **and** applies the plan to
 *     the membership (status, planId, expiry). The online half is a request,
 *     never a receipt — the client cannot mint a paid invoice, by rules and
 *     by route design.
 *
 * Pure on purpose: the route handlers, the consoles and the tests all call
 * the same arithmetic, so "how long is a quarter" has exactly one answer.
 */
import type { GymStatus } from '@smartfit/core';
import type { MembershipPlanDoc } from '@/lib/firebase/tenant-repo';

// ── Platform → gym contract ──────────────────────────────────────────────────

/** How each membership period extends an expiry. Documented, not guessed. */
export const PERIOD_DAYS: Record<MembershipPlanDoc['period'], number> = {
  month: 30,
  quarter: 91,
  year: 365,
  pass: 1,
};

/** A paid platform invoice — the shape `/api/admin/payment` records. */
export interface ContractPayment {
  paidAt: number;
  amountMinor: number;
}

export type ContractState = 'trial' | 'current' | 'due' | 'overdue';

/** Days after the last payment before a gym counts as overdue (grace included). */
export const CONTRACT_GRACE_DAYS = 35;
/** Days after the last payment at which the "due soon" nudge appears. */
export const CONTRACT_DUE_SOON_DAYS = 28;

/**
 * Where a gym stands on its platform contract.
 *
 * `trial` gyms owe nothing yet (they have not bought anything — MRR excludes
 * them for the same reason). Once a first payment lands the gym is expected
 * to pay roughly monthly: `current` → `due` (nudge) → `overdue` (act).
 */
export function contractState(
  gym: { status: GymStatus; createdAt: number },
  payments: readonly ContractPayment[],
  now = Date.now(),
): ContractState {
  if (gym.status === 'trial' || gym.status === 'pending') return 'trial';
  if (gym.status === 'closed') return 'current'; // closed gyms owe nothing going forward

  const lastPaidAt = payments.reduce<number | null>(
    (max, p) => (max === null || p.paidAt > max ? p.paidAt : max),
    null,
  );
  const anchor = lastPaidAt ?? gym.createdAt;
  const daysSince = (now - anchor) / 86_400_000;

  if (daysSince >= CONTRACT_GRACE_DAYS) return 'overdue';
  if (daysSince >= CONTRACT_DUE_SOON_DAYS) return 'due';
  return 'current';
}

/**
 * The gym-status transition a recorded payment implies.
 *
 * A first payment converts a trial into a paying customer, and a payment
 * clears `past_due`. Everything else (suspend, close) stays a human decision
 * — money arriving must never unlock a gym the platform suspended for abuse.
 */
export function gymStatusAfterPayment(current: GymStatus): GymStatus {
  if (current === 'trial' || current === 'past_due') return 'active';
  return current;
}

// ── Member → gym membership ──────────────────────────────────────────────────

/**
 * The new expiry after buying `plan`.
 *
 * Extension runs from the *later* of now and the current expiry, so renewing
 * early never steals paid days — the standard gym-counter convention, pinned
 * here so the desk and the member's card always agree.
 */
export function extendedExpiry(
  currentExpiresAt: number | undefined,
  plan: Pick<MembershipPlanDoc, 'period'>,
  now = Date.now(),
): number {
  const base = typeof currentExpiresAt === 'number' ? Math.max(now, currentExpiresAt) : now;
  return base + PERIOD_DAYS[plan.period] * 86_400_000;
}

/** The membership patch a collected plan payment implies. */
export function membershipAfterPurchase(
  membership: { status: string; expiresAt?: number } | null,
  plan: Pick<MembershipPlanDoc, 'period' | 'id'>,
  now = Date.now(),
): { planId: string; status: 'active'; expiresAt: number } {
  return {
    planId: plan.id,
    status: 'active',
    expiresAt: extendedExpiry(membership?.expiresAt, plan, now),
  };
}
