/**
 * Tenant metrics — the numbers the owner console shows.
 *
 * Kept in its own module, free of React and Firebase, so it can be unit-tested
 * directly. A wrong MRR is worse than a missing one: an owner who trusts a bad
 * number makes a bad decision, and the UI gives them no way to tell.
 */
import { AT_RISK_DAYS, isAtRisk, type GymMembership } from '@smartfit/core';
import type { GymSlot, InvoiceDoc, MembershipPlanDoc } from '@/lib/firebase/tenant-repo';

export interface TenantMetrics {
  activeMembers: number;
  atRisk: number;
  frozen: number;
  expiringSoon: number;
  /** Monthly recurring revenue in minor units, from active memberships. */
  mrrMinor: number;
  /** Revenue actually invoiced in the last 30 days. */
  collectedMinor: number;
  seatsBooked: number;
  seatCapacity: number;
  occupancyPct: number;
}

export interface MetricsInput {
  roster: GymMembership[];
  slots: GymSlot[];
  invoices: InvoiceDoc[];
  plans: MembershipPlanDoc[];
}

/** Minor units → a readable amount. MAD centimes by default. */
export function formatMoney(minor: number, currency = 'MAD'): string {
  const value = minor / 100;
  return `${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
}

/**
 * Roll the raw collections up into the console's headline numbers.
 *
 * Two judgement calls worth stating, because both change the number:
 *
 *  - **MRR counts only `role: 'member'`.** Staff and the owner sit on the
 *    roster too, and their (often free) plans would otherwise read as revenue.
 *  - **A day pass contributes nothing to MRR.** It is real money but not
 *    recurring; folding it in would inflate the one number an owner steers by.
 *    Pass sales still show up in `collectedMinor`.
 */
export function computeMetrics(state: MetricsInput, now = Date.now()): TenantMetrics {
  const priceByPlan = new Map(state.plans.map((p) => [p.id, p]));

  const monthly = (planId?: string): number => {
    const plan = planId ? priceByPlan.get(planId) : undefined;
    if (!plan) return 0;
    switch (plan.period) {
      case 'month':
        return plan.priceMinor;
      case 'quarter':
        return Math.round(plan.priceMinor / 3);
      case 'year':
        return Math.round(plan.priceMinor / 12);
      case 'pass':
        return 0;
      default:
        return 0;
    }
  };

  // Staff and owner are on the roster but are not customers.
  const members = state.roster.filter((m) => m.role === 'member');
  const active = members.filter((m) => m.status === 'active');
  const mrrMinor = active.reduce((sum, m) => sum + monthly(m.planId), 0);

  const monthAgo = now - 30 * 86_400_000;
  const collectedMinor = state.invoices
    .filter((i) => i.status === 'paid' && i.issuedAt >= monthAgo)
    .reduce((sum, i) => sum + i.amountMinor, 0);

  // Cancelled occurrences have no seats to fill; counting their capacity would
  // quietly deflate occupancy.
  const live = state.slots.filter((s) => !s.cancelled);
  const seatCapacity = live.reduce((sum, s) => sum + s.capacity, 0);
  const seatsBooked = live.reduce((sum, s) => sum + s.booked, 0);

  return {
    activeMembers: active.length,
    atRisk: members.filter((m) => isAtRisk(m, now, AT_RISK_DAYS)).length,
    frozen: members.filter((m) => m.status === 'frozen').length,
    expiringSoon: members.filter((m) => {
      if (m.status !== 'active' || typeof m.expiresAt !== 'number') return false;
      const days = (m.expiresAt - now) / 86_400_000;
      return days >= 0 && days <= 7;
    }).length,
    mrrMinor,
    collectedMinor,
    seatsBooked,
    seatCapacity,
    occupancyPct: seatCapacity === 0 ? 0 : Math.round((seatsBooked / seatCapacity) * 100),
  };
}
