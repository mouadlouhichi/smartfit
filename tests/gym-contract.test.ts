/**
 * Gym-contract billing arithmetic.
 *
 * These numbers drive dunning states and membership expiries — both are
 * money-visible, so the edges are pinned: a trial owes nothing, grace is
 * counted from the last payment (not the signup), renewing early never
 * steals paid days, and a day pass buys exactly a day.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTRACT_DUE_SOON_DAYS,
  CONTRACT_GRACE_DAYS,
  contractState,
  extendedExpiry,
  gymStatusAfterPayment,
  membershipAfterPurchase,
  PERIOD_DAYS,
} from '../src/lib/billing/gym-contract';
import type { GymStatus } from '@smartfit/core';

const NOW = Date.parse('2026-09-21T12:00:00Z');
const DAY = 86_400_000;

const pay = (daysAgo: number) => ({ paidAt: NOW - daysAgo * DAY, amountMinor: 129_000 });

test('a trial gym owes nothing — contract state is trial', () => {
  assert.equal(contractState({ status: 'trial', createdAt: NOW - 90 * DAY }, [], NOW), 'trial');
  // Even a trial that never paid and is ancient is still just a trial:
  // the answer is "convert or drop it", not dunning.
  assert.equal(contractState({ status: 'trial', createdAt: NOW - 200 * DAY }, [], NOW), 'trial');
});

test('grace runs from the last payment, not the signup', () => {
  const gym = { status: 'active' as GymStatus, createdAt: NOW - 300 * DAY };
  assert.equal(contractState(gym, [pay(10)], NOW), 'current');
  assert.equal(contractState(gym, [pay(CONTRACT_DUE_SOON_DAYS)], NOW), 'due');
  assert.equal(contractState(gym, [pay(CONTRACT_GRACE_DAYS)], NOW), 'overdue');
  // With no payment at all, the signup date is the anchor.
  assert.equal(contractState(gym, [], NOW), 'overdue');
  assert.equal(contractState({ status: 'active', createdAt: NOW - 5 * DAY }, [], NOW), 'current');
});

test('past_due gyms are dunned like active ones; closed ones are not', () => {
  assert.equal(contractState({ status: 'past_due', createdAt: NOW }, [pay(40)], NOW), 'overdue');
  assert.equal(contractState({ status: 'closed', createdAt: NOW }, [], NOW), 'current');
});

test('a payment converts trial and clears past_due — but never overrides a suspend', () => {
  assert.equal(gymStatusAfterPayment('trial'), 'active');
  assert.equal(gymStatusAfterPayment('past_due'), 'active');
  assert.equal(gymStatusAfterPayment('active'), 'active');
  // Money must not unlock a gym the platform suspended for abuse or non-payment.
  assert.equal(gymStatusAfterPayment('suspended'), 'suspended');
  assert.equal(gymStatusAfterPayment('closed'), 'closed');
});

test('periods extend by their documented lengths', () => {
  assert.equal(PERIOD_DAYS.month, 30);
  assert.equal(PERIOD_DAYS.quarter, 91);
  assert.equal(PERIOD_DAYS.year, 365);
  assert.equal(PERIOD_DAYS.pass, 1);
});

test('renewing early never steals paid days', () => {
  const expiresAt = NOW + 20 * DAY; // 20 days still to run
  const next = extendedExpiry(expiresAt, { period: 'month' }, NOW);
  assert.equal(next, NOW + (20 + 30) * DAY);
});

test('a lapsed or missing expiry extends from now', () => {
  assert.equal(extendedExpiry(NOW - 5 * DAY, { period: 'month' }, NOW), NOW + 30 * DAY);
  assert.equal(extendedExpiry(undefined, { period: 'year' }, NOW), NOW + 365 * DAY);
});

test('a collected purchase activates the membership with the new plan', () => {
  const m = membershipAfterPurchase(
    { status: 'frozen', expiresAt: NOW + 3 * DAY },
    { period: 'quarter', id: 'plan-quarterly' },
    NOW,
  );
  assert.deepEqual(m, {
    planId: 'plan-quarterly',
    status: 'active',
    expiresAt: NOW + (3 + 91) * DAY,
  });

  const fresh = membershipAfterPurchase(null, { period: 'pass', id: 'plan-trial' }, NOW);
  assert.equal(fresh.expiresAt, NOW + 1 * DAY);
  assert.equal(fresh.status, 'active');
});
