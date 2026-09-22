/**
 * Tenant metrics.
 *
 * These are the numbers a gym owner steers the business by, so the edge cases
 * matter more than the happy path: staff on the roster must not read as
 * revenue, a day pass must not inflate MRR, and a cancelled class must not
 * quietly deflate occupancy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMetrics, formatMoney } from '../src/lib/tenant-metrics';
import type { GymMembership } from '@smartfit/core';
import type { GymSlot, InvoiceDoc, MembershipPlanDoc } from '../src/lib/firebase/tenant-repo';

const DAY = 86_400_000;
const NOW = Date.parse('2026-09-20T12:00:00Z');

const PLANS: MembershipPlanDoc[] = [
  { id: 'month', name: 'Monthly', priceMinor: 39000, currency: 'MAD', period: 'month' },
  { id: 'quarter', name: 'Quarterly', priceMinor: 105000, currency: 'MAD', period: 'quarter' },
  { id: 'year', name: 'Annual', priceMinor: 360000, currency: 'MAD', period: 'year' },
  { id: 'pass', name: 'Day pass', priceMinor: 9000, currency: 'MAD', period: 'pass' },
  { id: 'staff', name: 'Staff', priceMinor: 0, currency: 'MAD', period: 'month' },
];

const member = (uid: string, over: Partial<GymMembership> = {}): GymMembership => ({
  uid,
  role: 'member',
  status: 'active',
  joinedAt: NOW - 90 * DAY,
  checkins: 10,
  lastVisitAt: NOW - 2 * DAY,
  planId: 'month',
  ...over,
});

const slot = (id: string, capacity: number, booked: number, cancelled = false): GymSlot => ({
  id,
  classId: 'cls',
  startsAt: NOW + DAY,
  endsAt: NOW + DAY + 3_600_000,
  capacity,
  booked,
  cancelled,
});

const invoice = (
  id: string,
  amountMinor: number,
  daysAgo: number,
  over: Partial<InvoiceDoc> = {},
): InvoiceDoc => ({
  id,
  memberUid: 'm1',
  amountMinor,
  currency: 'MAD',
  status: 'paid',
  issuedAt: NOW - daysAgo * DAY,
  ...over,
});

const empty = { roster: [], slots: [], invoices: [], plans: PLANS };

test('MRR counts only active members, not the staff sitting on the roster', () => {
  const m = computeMetrics(
    {
      ...empty,
      roster: [
        member('m1'),
        member('m2'),
        // Owner and staff are on the roster but are not customers.
        { ...member('owner'), role: 'owner', planId: 'staff' },
        { ...member('staff'), role: 'staff', planId: 'staff' },
        member('frozen', { status: 'frozen' }),
        member('expired', { status: 'expired' }),
      ],
    },
    NOW,
  );
  assert.equal(m.activeMembers, 2);
  assert.equal(m.mrrMinor, 78000);
  assert.equal(m.frozen, 1);
});

test('MRR normalises quarterly and annual plans to a monthly figure', () => {
  const m = computeMetrics(
    {
      ...empty,
      roster: [
        member('a', { planId: 'quarter' }),
        member('b', { planId: 'year' }),
        member('c', { planId: 'month' }),
      ],
    },
    NOW,
  );
  assert.equal(m.mrrMinor, 35000 + 30000 + 39000);
});

test('a day pass is money but not recurring revenue', () => {
  const m = computeMetrics(
    {
      ...empty,
      roster: [member('a', { planId: 'pass' }), member('b', { planId: 'month' })],
      invoices: [invoice('i1', 9000, 1)],
    },
    NOW,
  );
  // Folding the pass into MRR would inflate the number an owner steers by.
  assert.equal(m.mrrMinor, 39000);
  // It still counts as collected cash.
  assert.equal(m.collectedMinor, 9000);
});

test('an unknown or missing plan contributes nothing rather than throwing', () => {
  const m = computeMetrics(
    { ...empty, roster: [member('a', { planId: 'does-not-exist' }), member('b')] },
    NOW,
  );
  assert.equal(m.mrrMinor, 39000);
});

test('collected revenue is the paid invoices from the last 30 days only', () => {
  const m = computeMetrics(
    {
      ...empty,
      invoices: [
        invoice('recent', 39000, 5),
        invoice('edge', 1000, 30),
        invoice('old', 99999, 31),
        invoice('unpaid', 50000, 2, { status: 'overdue' }),
        invoice('refunded', 50000, 2, { status: 'refunded' }),
      ],
    },
    NOW,
  );
  assert.equal(m.collectedMinor, 39000 + 1000);
});

test('occupancy ignores cancelled occurrences entirely', () => {
  const withCancelled = computeMetrics(
    { ...empty, slots: [slot('a', 20, 10), slot('b', 20, 20, true)] },
    NOW,
  );
  // Counting the cancelled class's capacity would halve the reported occupancy.
  assert.equal(withCancelled.seatCapacity, 20);
  assert.equal(withCancelled.seatsBooked, 10);
  assert.equal(withCancelled.occupancyPct, 50);
});

test('occupancy is 0 rather than NaN when nothing is scheduled', () => {
  const m = computeMetrics({ ...empty, slots: [] }, NOW);
  assert.equal(m.occupancyPct, 0);
  assert.equal(Number.isNaN(m.occupancyPct), false);
});

test('at-risk and expiring-soon are counted from the member list only', () => {
  const m = computeMetrics(
    {
      ...empty,
      roster: [
        member('stale', { lastVisitAt: NOW - 30 * DAY }),
        member('fresh', { lastVisitAt: NOW - 1 * DAY }),
        // No attendance signal at all: new, not at risk.
        member('brand-new', { lastVisitAt: undefined, joinedAt: NOW - 1 * DAY }),
        member('due', { expiresAt: NOW + 3 * DAY }),
        member('later', { expiresAt: NOW + 30 * DAY }),
        member('lapsed', { expiresAt: NOW - 5 * DAY }),
        // A stale staff member is not a win-back target.
        { ...member('staff-stale'), role: 'staff', lastVisitAt: NOW - 60 * DAY },
      ],
    },
    NOW,
  );
  assert.equal(m.atRisk, 1);
  assert.equal(m.expiringSoon, 1);
});

test('formatMoney renders minor units in the given currency', () => {
  assert.equal(formatMoney(39000), '390 MAD');
  assert.equal(formatMoney(39050), '390.5 MAD');
  assert.equal(formatMoney(1234567, 'EUR'), '12,345.67 EUR');
  assert.equal(formatMoney(0), '0 MAD');
});
