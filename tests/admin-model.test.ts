/**
 * Platform-admin model tests.
 *
 * The overview band is what the operator steers the platform by, so the same
 * edge cases matter as the tenant metrics: a trial gym is not revenue, a
 * suspended gym is not revenue, an unknown plan must not poison the sum, and
 * the 30-day collection window is a window, not "everything".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAdminOverview,
  effectivePlans,
  validateApplication,
  validatePlanPatch,
  type AdminApplication,
  type AdminGymSummary,
  type PlatformInvoice,
} from '../src/lib/admin-model';
import { DEFAULT_TENANT_PLANS, type GymStatus, type TenantPlan } from '@smartfit/core';

const NOW = Date.parse('2026-09-21T12:00:00Z');
const DAY = 86_400_000;

const PLANS: TenantPlan[] = DEFAULT_TENANT_PLANS;

const gym = (slug: string, over: Partial<AdminGymSummary> = {}): AdminGymSummary => ({
  slug,
  name: slug,
  status: 'active',
  tenantPlanId: 'growth',
  ownerUid: `owner-${slug}`,
  createdAt: NOW - 90 * DAY,
  memberCount: 10,
  staffCount: 2,
  classCount: 5,
  memberRevenueMinor: 100_000,
  currency: 'MAD',
  ...over,
});

const app = (id: string, over: Partial<AdminApplication> = {}): AdminApplication => ({
  id,
  gymName: `Gym ${id}`,
  email: `owner${id}@example.com`,
  status: 'pending',
  createdAt: NOW - 2 * DAY,
  ...over,
});

const invoice = (id: string, slug: string, daysAgo: number, amount = 129_000): PlatformInvoice => ({
  id,
  slug,
  amountMinor: amount,
  currency: 'MAD',
  method: 'transfer',
  status: 'paid',
  paidAt: NOW - daysAgo * DAY,
  recordedBy: 'admin',
});

test('MRR counts active and past_due tenants only', () => {
  const gyms = [
    gym('a', { tenantPlanId: 'growth' }), // active → 1290 MAD
    gym('b', { status: 'past_due', tenantPlanId: 'growth' }), // still owed → counts
    gym('c', { status: 'trial', tenantPlanId: 'growth' }), // not bought yet
    gym('d', { status: 'suspended', tenantPlanId: 'multi' }), // cut off
    gym('e', { status: 'closed', tenantPlanId: 'multi' }),
  ];
  const o = computeAdminOverview(gyms, [], [], PLANS, NOW);
  assert.equal(o.platformMrrMinor, 2 * 129_000);
  assert.equal(o.liveGyms, 3); // trial is live but not paying
  assert.equal(o.byStatus.active, 1);
  assert.equal(o.byStatus.suspended, 1);
});

test('an unknown plan contributes zero MRR, not NaN', () => {
  const o = computeAdminOverview(
    [gym('x', { tenantPlanId: 'does-not-exist' })],
    [],
    [],
    PLANS,
    NOW,
  );
  assert.equal(o.platformMrrMinor, 0);
  assert.equal(o.mrrByPlan['does-not-exist'], 0);
});

test('members, staff, classes and the month window roll up', () => {
  const gyms = [
    gym('a', { memberCount: 40, staffCount: 3, classCount: 6 }), // joined ~June
    gym('b', { memberCount: 10, staffCount: 1, classCount: 4, createdAt: NOW - 3 * DAY }), // this month
    gym('c', { createdAt: NOW - 40 * DAY }), // last month
  ];
  const o = computeAdminOverview(gyms, [], [], PLANS, NOW);
  assert.equal(o.membersTotal, 60);
  assert.equal(o.staffTotal, 6);
  assert.equal(o.classesTotal, 15);
  assert.equal(o.newThisMonth, 1);
});

test('collected(30d) is a window, not everything', () => {
  const invoices = [
    invoice('i1', 'a', 5),
    invoice('i2', 'a', 29),
    invoice('i3', 'a', 31), // outside
    invoice('i4', 'a', 90), // outside
  ];
  const o = computeAdminOverview([], [], invoices, PLANS, NOW);
  assert.equal(o.collected30dMinor, 2 * 129_000);
});

test('pending applications are counted, decided ones are not', () => {
  const apps = [
    app('p1'),
    app('p2'),
    app('r1', { status: 'rejected' }),
    app('a1', { status: 'approved' }),
  ];
  const o = computeAdminOverview([], apps, [], PLANS, NOW);
  assert.equal(o.pendingApplications, 2);
});

test('effectivePlans layers overrides over defaults without losing tiers', () => {
  const override = [
    {
      id: 'growth',
      name: 'Growth+',
      monthlyPriceMinor: 149_000,
      currency: 'MAD',
      limits: { ...DEFAULT_TENANT_PLANS[1].limits },
    },
  ];
  const plans = effectivePlans(override);
  assert.equal(plans.find((p) => p.id === 'growth')?.monthlyPriceMinor, 149_000);
  // Untouched tiers survive.
  assert.ok(plans.some((p) => p.id === 'starter'));
  assert.ok(plans.some((p) => p.id === 'multi'));
  // A null/empty override means "ship defaults".
  assert.equal(effectivePlans(null), DEFAULT_TENANT_PLANS);
  assert.equal(effectivePlans([]), DEFAULT_TENANT_PLANS);
});

test('plan patches are bounded and cleaned', () => {
  assert.deepEqual(validatePlanPatch('growth', { monthlyPriceMinor: 150_000 }), {
    ok: true,
    patch: { monthlyPriceMinor: 150_000 },
  });
  assert.deepEqual(
    validatePlanPatch('growth', { limits: { members: 600, customBranding: true } }),
    { ok: true, patch: { limits: { members: 600, customBranding: true } } },
  );
  assert.equal(validatePlanPatch('growth', { monthlyPriceMinor: -5 }).ok, false);
  assert.equal(validatePlanPatch('growth', { monthlyPriceMinor: 1.5 }).ok, false);
  assert.equal(validatePlanPatch('growth', { limits: { members: 0 } }).ok, false);
  assert.equal(validatePlanPatch('growth', { limits: { customBranding: 'yes' } }).ok, false);
  assert.equal(validatePlanPatch('growth', {}).ok, false);
  assert.equal(validatePlanPatch('', {}).ok, false);
});

test('application intake: valid input is normalised', () => {
  const r = validateApplication({
    gymName: '  Casablanca Boxing Club ',
    slug: 'CasaBoxing',
    city: ' Casablanca ',
    email: ' OWNER@example.ma ',
    instagram: '@casaboxing',
    message: '  Two rings, twelve coaches. ',
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.gymName, 'Casablanca Boxing Club');
    assert.equal(r.value.slug, 'casaboxing');
    assert.equal(r.value.city, 'Casablanca');
    assert.equal(r.value.email, 'OWNER@example.ma');
    assert.equal(r.value.message, 'Two rings, twelve coaches.');
  }
});

test('application intake: bad email, short name, long message are refused', () => {
  const bad = validateApplication({
    gymName: 'X',
    slug: '',
    city: '',
    email: 'not-an-email',
    instagram: '',
    message: 'y'.repeat(1001),
  });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.ok(bad.errors.length >= 3);
});

test('application intake: a reserved or junk slug is a clear error, never a silent rewrite', () => {
  const reserved = validateApplication({
    gymName: 'Admin Fitness',
    slug: 'admin',
    city: '',
    email: 'a@b.co',
    instagram: '',
    message: '',
  });
  assert.equal(reserved.ok, false);

  const junk = validateApplication({
    gymName: 'Good Gym',
    slug: '***',
    city: '',
    email: 'a@b.co',
    instagram: '',
    message: '',
  });
  assert.equal(junk.ok, false);

  // Leaving it blank is fine — the platform suggests one at review time.
  const blank = validateApplication({
    gymName: 'Good Gym',
    slug: '',
    city: '',
    email: 'a@b.co',
    instagram: '',
    message: '',
  });
  assert.equal(blank.ok, true);
});
