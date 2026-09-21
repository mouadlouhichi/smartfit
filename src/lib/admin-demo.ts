/**
 * Demo fixtures for the platform-admin console.
 *
 * Same contract as `/api/admin/data`, so the console renders identically in
 * demo and cloud mode — switching to a real project changes the data source
 * and nothing else (the pattern `tenant-demo.ts` set for the tenant tree).
 *
 * The fixture tells one coherent story: a platform that has sold to four
 * gyms, has two applications waiting, and recently suspended a non-payer —
 * enough shape for every section to have something honest to say.
 */
import { DEFAULT_TENANT_PLANS } from '@smartfit/core';
import { contractState } from '@/lib/billing/gym-contract';
import type {
  AdminApplication,
  AdminAuditEntry,
  AdminData,
  AdminGymSummary,
  PlatformInvoice,
} from '@/lib/admin-model';

const DAY = 86_400_000;
const now = Date.now();

export function demoAdminGyms(): AdminGymSummary[] {
  return [
    {
      slug: 'zone-fight',
      name: 'Zone Fight',
      status: 'active',
      tenantPlanId: 'growth',
      ownerUid: 'b2b-owner',
      ownerName: 'Youssef El Amrani',
      createdAt: now - 180 * DAY,
      updatedAt: now - 2 * DAY,
      accentColor: '#8ad200',
      city: 'Casablanca',
      memberCount: 4,
      staffCount: 3,
      classCount: 5,
      memberRevenueMinor: 135_000,
      currency: 'MAD',
      tagline: 'Boxing & functional strength in the heart of Casa',
      phone: '+212 522 44 88 21',
      email: 'hello@zonefight.ma',
      instagram: '@zonefight',
      address: '14 Rue Ibn Batouta, Maârif',
      hours: {
        1: { open: '07:00', close: '23:00' },
        2: { open: '07:00', close: '23:00' },
        3: { open: '07:00', close: '23:00' },
        4: { open: '07:00', close: '23:00' },
        5: { open: '07:00', close: '23:00' },
        6: { open: '09:00', close: '20:00' },
      },
      openDays: 6,
    },
    {
      slug: 'iron-house',
      name: 'Iron House Strength',
      status: 'trial',
      tenantPlanId: 'starter',
      ownerUid: 'demo-iron-owner',
      ownerName: 'Nadia Cherkaoui',
      createdAt: now - 9 * DAY,
      accentColor: '#f97316',
      city: 'Rabat',
      memberCount: 11,
      staffCount: 1,
      classCount: 3,
      memberRevenueMinor: 0,
      currency: 'MAD',
    },
    {
      slug: 'atlas-fit',
      name: 'Atlas Fit Club',
      status: 'past_due',
      tenantPlanId: 'growth',
      ownerUid: 'demo-atlas-owner',
      ownerName: 'Mehdi Alaoui',
      createdAt: now - 300 * DAY,
      updatedAt: now - 6 * DAY,
      accentColor: '#38bdf8',
      city: 'Marrakech',
      memberCount: 62,
      staffCount: 6,
      classCount: 14,
      memberRevenueMinor: 812_000,
      currency: 'MAD',
    },
    {
      slug: 'pilates-co',
      name: 'Pilates & Co',
      status: 'suspended',
      tenantPlanId: 'multi',
      ownerUid: 'demo-pilates-owner',
      ownerName: 'Sara Bennis',
      createdAt: now - 420 * DAY,
      updatedAt: now - 20 * DAY,
      accentColor: '#e879f9',
      city: 'Casablanca',
      memberCount: 30,
      staffCount: 4,
      classCount: 9,
      memberRevenueMinor: 430_000,
      currency: 'MAD',
      tagline: 'Reformer pilates & mobility studio',
      phone: '+212 522 26 17 05',
      instagram: '@pilatesandco',
      openDays: 0,
    },
  ];
}

export function demoApplications(): AdminApplication[] {
  return [
    {
      id: 'app-casaboxing',
      gymName: 'Casablanca Boxing Club',
      slug: 'casa-boxing',
      city: 'Casablanca',
      email: 'contact@casaboxing.ma',
      instagram: '@casaboxing',
      message:
        'Two rings, twelve coaches, running since 2014. We want online booking for our evening classes.',
      status: 'pending',
      createdAt: now - 2 * DAY,
    },
    {
      id: 'app-riadyoga',
      gymName: 'Riad Yoga Studio',
      city: 'Marrakech',
      email: 'hello@riadyoga.ma',
      message: 'Small studio, 20 mats. Mostly tourists and locals on weekly passes.',
      status: 'pending',
      createdAt: now - 5 * DAY,
    },
    {
      id: 'app-fit24',
      gymName: 'Fit24 Express',
      slug: 'fit24',
      city: 'Tanger',
      email: 'ops@fit24.ma',
      message: '24-hour access gym, no classes.',
      status: 'rejected',
      createdAt: now - 20 * DAY,
      decidedAt: now - 18 * DAY,
      decidedBy: 'b2b-admin',
      reason:
        'No class timetable — the product is a poor fit until access-control hardware is supported.',
    },
  ];
}

export function demoAuditEntries(): AdminAuditEntry[] {
  const rows: Array<[string, string, string, number, Record<string, unknown>?]> = [
    [
      'b2b-admin',
      'payment:record',
      'zone-fight',
      0.2,
      { amountMinor: 129_000, method: 'transfer' },
    ],
    ['b2b-admin', 'gym:view-as', 'atlas-fit', 0.5, { mode: 'read-only' }],
    ['b2b-admin', 'gym:suspend', 'pilates-co', 6, { status: 'suspended' }],
    ['b2b-admin', 'payment:record', 'atlas-fit', 8, { amountMinor: 129_000, method: 'cash' }],
    ['b2b-admin', 'application:approve', 'app-iron-house', 9, { slug: 'iron-house' }],
    ['b2b-admin', 'application:reject', 'app-fit24', 18, { gymName: 'Fit24 Express' }],
    ['b2b-admin', 'role:grant', 'b2b-admin', 60, { claim: 'sfRole' }],
  ];
  return rows
    .map(([actorUid, action, target, daysAgo, meta], i) => ({
      id: `audit-demo-${i}`,
      actorUid,
      action,
      target,
      at: now - Math.round(daysAgo * DAY),
      ...(meta ? { meta } : {}),
    }))
    .sort((a, b) => b.at - a.at);
}

export function demoPlatformInvoices(): PlatformInvoice[] {
  const rows: Array<[string, string, number, PlatformInvoice['method'], number]> = [
    ['zone-fight', 'growth', 129_000, 'transfer', 0.2],
    ['atlas-fit', 'growth', 129_000, 'cash', 8],
    ['zone-fight', 'growth', 129_000, 'cmi', 31],
    ['pilates-co', 'multi', 299_000, 'transfer', 38],
    ['atlas-fit', 'growth', 129_000, 'cmi', 61],
    ['zone-fight', 'growth', 129_000, 'cmi', 62],
    ['atlas-fit', 'growth', 129_000, 'transfer', 92],
    ['pilates-co', 'multi', 299_000, 'cash', 100],
    ['zone-fight', 'growth', 129_000, 'transfer', 93],
    ['atlas-fit', 'growth', 129_000, 'transfer', 122],
    ['zone-fight', 'growth', 129_000, 'cash', 123],
    ['atlas-fit', 'growth', 129_000, 'cmi', 152],
    ['zone-fight', 'growth', 129_000, 'transfer', 153],
    ['atlas-fit', 'growth', 129_000, 'transfer', 183],
  ];
  return rows.map(([slug, planId, amountMinor, method, daysAgo], i) => ({
    id: `pinv-demo-${i}`,
    slug,
    amountMinor,
    currency: 'MAD',
    method,
    status: 'paid' as const,
    paidAt: now - Math.round(daysAgo * DAY),
    recordedBy: 'b2b-admin',
    note: planId === 'multi' ? 'Multi-site plan, quarterly billing cycle.' : undefined,
  }));
}

/** The whole demo payload — the same shape `/api/admin/data` returns. */
export function demoAdminData(): AdminData {
  const invoices = demoPlatformInvoices();
  // Contract state is *derived* here exactly as the cloud route derives it,
  // so the demo badge and the real badge can never disagree by construction.
  const paymentsBySlug = new Map<string, { paidAt: number; amountMinor: number }[]>();
  for (const i of invoices) {
    const list = paymentsBySlug.get(i.slug) ?? [];
    list.push({ paidAt: i.paidAt, amountMinor: i.amountMinor });
    paymentsBySlug.set(i.slug, list);
  }
  const gyms = demoAdminGyms().map((g) => {
    const payments = paymentsBySlug.get(g.slug) ?? [];
    return {
      ...g,
      contract: contractState(g, payments, now),
      lastPaymentAt: payments.length > 0 ? Math.max(...payments.map((p) => p.paidAt)) : undefined,
    };
  });
  return {
    mode: 'demo',
    gyms,
    applications: demoApplications(),
    audit: demoAuditEntries(),
    invoices,
    plans: DEFAULT_TENANT_PLANS,
  };
}
