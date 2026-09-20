/**
 * Demo tenant fixture.
 *
 * SmartFit runs in **local mode** whenever Firebase is not fully configured
 * (see `src/lib/firebase/config.ts`), which is how previews and offline
 * development work. Tenant features follow the same rule rather than showing a
 * blank screen: this fixture stands in for Firestore so the storefront and the
 * owner/staff consoles are explorable without a project.
 *
 * It is deliberately the same shape `scripts/seed-b2b.mjs` writes, so switching
 * from demo to cloud changes the data source and nothing else.
 */
import type { GymMembership, GymTenant } from '@smartfit/core';
import type {
  GymBooking,
  GymClass,
  GymSlot,
  InvoiceDoc,
  MembershipPlanDoc,
} from '@/lib/firebase/tenant-repo';

const DAY = 86_400_000;
const now = Date.now();

/** Next occurrence of a weekday at HH:MM — same helper the seed script uses. */
function nextSlot(weekday: number, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
  return d.getTime();
}

export const DEMO_SLUG = 'zone-fight';

export function demoGym(slug = DEMO_SLUG): GymTenant {
  return {
    id: slug,
    slug,
    name: 'Zone Fight',
    subdomain: slug,
    status: 'active',
    tenantPlanId: 'growth',
    ownerUid: 'demo-owner',
    createdAt: now - 180 * DAY,
    branding: {
      accentColor: '#8ad200',
      tagline: 'Combat, conditioning and community.',
      description:
        'Zone Fight is a combat-and-conditioning gym: boxing, MMA, HIIT and strength under one roof, with coaches who know your name.',
    },
    contact: {
      phone: '+212 522-000000',
      email: `hello@${slug}.smartfit.app`,
      instagram: '@zonefight',
    },
    location: { address: '12 Bd Anfa', city: 'Casablanca', country: 'MA' },
    hours: {
      1: { open: '06:30', close: '22:30' },
      2: { open: '06:30', close: '22:30' },
      3: { open: '06:30', close: '22:30' },
      4: { open: '06:30', close: '22:30' },
      5: { open: '06:30', close: '22:30' },
      6: { open: '08:00', close: '20:00' },
      0: null,
    },
  };
}

export function demoRoster(): GymMembership[] {
  return [
    {
      uid: 'demo-owner',
      role: 'owner',
      status: 'active',
      joinedAt: now - 180 * DAY,
      checkins: 214,
      lastVisitAt: now - DAY,
      displayName: 'Youssef El Amrani',
      planId: 'plan-staff',
    },
    {
      uid: 'demo-staff',
      role: 'staff',
      status: 'active',
      joinedAt: now - 150 * DAY,
      checkins: 96,
      lastVisitAt: now - DAY,
      displayName: 'Salma Bennani',
      planId: 'plan-staff',
    },
    {
      uid: 'demo-trainer',
      role: 'staff',
      status: 'active',
      joinedAt: now - 140 * DAY,
      checkins: 141,
      lastVisitAt: now - 2 * DAY,
      displayName: 'Karim Idrissi',
      planId: 'plan-staff',
    },
    {
      uid: 'demo-member-1',
      role: 'member',
      status: 'active',
      joinedAt: now - 120 * DAY,
      checkins: 38,
      lastVisitAt: now - 2 * DAY,
      displayName: 'Amina Rachidi',
      planId: 'plan-monthly',
      expiresAt: now + 12 * DAY,
    },
    {
      uid: 'demo-member-2',
      role: 'member',
      status: 'active',
      joinedAt: now - 90 * DAY,
      checkins: 22,
      lastVisitAt: now - 26 * DAY,
      displayName: 'Omar Tazi',
      planId: 'plan-monthly',
      expiresAt: now + 4 * DAY,
      notes: 'Asked about freezing over Ramadan.',
    },
    {
      uid: 'demo-member-3',
      role: 'member',
      status: 'trial',
      joinedAt: now - 3 * DAY,
      checkins: 2,
      displayName: 'Lina Fassi',
      planId: 'plan-trial',
    },
    {
      uid: 'demo-member-4',
      role: 'member',
      status: 'frozen',
      joinedAt: now - 200 * DAY,
      checkins: 61,
      lastVisitAt: now - 40 * DAY,
      displayName: 'Rachid Ouazzani',
      planId: 'plan-monthly',
    },
  ];
}

export function demoClasses(): GymClass[] {
  return [
    {
      id: 'cls-boxing',
      name: 'Boxing Fundamentals',
      focus: 'combat',
      intensity: 'high',
      minutes: 60,
      capacity: 16,
      instructorName: 'Karim Idrissi',
      studio: 'Ring 1',
      createdAt: now - 180 * DAY,
    },
    {
      id: 'cls-hiit',
      name: 'HIIT 45',
      focus: 'hiit',
      intensity: 'high',
      minutes: 45,
      capacity: 20,
      instructorName: 'Karim Idrissi',
      studio: 'Studio A',
      createdAt: now - 180 * DAY,
    },
    {
      id: 'cls-strength',
      name: 'Strength Foundations',
      focus: 'strength',
      intensity: 'moderate',
      minutes: 50,
      capacity: 12,
      instructorName: 'Youssef El Amrani',
      studio: 'Floor',
      createdAt: now - 180 * DAY,
    },
    {
      id: 'cls-mobility',
      name: 'Mobility & Recovery',
      focus: 'mind',
      intensity: 'low',
      minutes: 40,
      capacity: 18,
      instructorName: 'Salma Bennani',
      studio: 'Studio B',
      createdAt: now - 180 * DAY,
    },
    {
      id: 'cls-cardio',
      name: 'Cardio Burn',
      focus: 'cardio',
      intensity: 'moderate',
      minutes: 45,
      capacity: 22,
      instructorName: 'Salma Bennani',
      studio: 'Studio A',
      createdAt: now - 180 * DAY,
    },
  ];
}

export function demoSlots(): GymSlot[] {
  const plan: Array<[string, string, number, string, number]> = [
    ['slot-mon-boxing', 'cls-boxing', 1, '18:00', 3],
    ['slot-tue-hiit', 'cls-hiit', 2, '07:00', 2],
    ['slot-wed-strength', 'cls-strength', 3, '19:00', 1],
    ['slot-thu-boxing', 'cls-boxing', 4, '18:00', 3],
    ['slot-fri-mobility', 'cls-mobility', 5, '17:30', 18],
    ['slot-sat-cardio', 'cls-cardio', 6, '10:00', 0],
  ];
  const byId = Object.fromEntries(demoClasses().map((c) => [c.id, c]));
  return plan.map(([id, classId, weekday, time, booked]) => {
    const startsAt = nextSlot(weekday, time);
    return {
      id,
      classId,
      startsAt,
      endsAt: startsAt + byId[classId].minutes * 60_000,
      capacity: byId[classId].capacity,
      booked,
      cancelled: false,
    };
  });
}

export function demoBookings(): GymBooking[] {
  const rows: Array<[string, string, GymBooking['status'], string]> = [
    ['slot-mon-boxing', 'demo-member-1', 'booked', 'Amina Rachidi'],
    ['slot-mon-boxing', 'demo-member-2', 'booked', 'Omar Tazi'],
    ['slot-mon-boxing', 'demo-trainer', 'booked', 'Karim Idrissi'],
    ['slot-tue-hiit', 'demo-member-1', 'booked', 'Amina Rachidi'],
    ['slot-tue-hiit', 'demo-member-3', 'booked', 'Lina Fassi'],
    ['slot-wed-strength', 'demo-member-2', 'booked', 'Omar Tazi'],
    ['slot-thu-boxing', 'demo-member-1', 'booked', 'Amina Rachidi'],
    ['slot-thu-boxing', 'demo-member-2', 'booked', 'Omar Tazi'],
    ['slot-thu-boxing', 'demo-member-3', 'booked', 'Lina Fassi'],
    ['slot-fri-mobility', 'demo-member-3', 'waitlist', 'Lina Fassi'],
  ];
  return rows.map(([slotId, uid, status, memberName], i) => ({
    id: `bk-demo-${i}`,
    slotId,
    uid,
    status,
    memberName,
    createdAt: now - 2 * DAY,
  }));
}

export function demoPlans(): MembershipPlanDoc[] {
  return [
    {
      id: 'plan-monthly',
      name: 'Monthly',
      priceMinor: 39000,
      currency: 'MAD',
      period: 'month',
      joinFeeMinor: 10000,
      published: true,
      description: 'Unlimited classes, one month.',
    },
    {
      id: 'plan-quarterly',
      name: 'Quarterly',
      priceMinor: 105000,
      currency: 'MAD',
      period: 'quarter',
      published: true,
      description: 'Three months, save 10%.',
    },
    {
      id: 'plan-annual',
      name: 'Annual',
      priceMinor: 380000,
      currency: 'MAD',
      period: 'year',
      published: true,
      description: 'Twelve months, two free.',
    },
    {
      id: 'plan-trial',
      name: 'Trial week',
      priceMinor: 9000,
      currency: 'MAD',
      period: 'pass',
      published: true,
    },
  ];
}

export function demoInvoices(): InvoiceDoc[] {
  const rows: Array<[string, string, number, InvoiceDoc['method'], number]> = [
    ['demo-member-1', 'plan-monthly', 39000, 'cmi', 18],
    ['demo-member-2', 'plan-monthly', 39000, 'cash', 26],
    ['demo-member-3', 'plan-trial', 9000, 'card', 3],
    ['demo-member-1', 'plan-monthly', 39000, 'cmi', 48],
    ['demo-member-4', 'plan-monthly', 39000, 'transfer', 70],
  ];
  return rows.map(([memberUid, planId, amountMinor, method, daysAgo], i) => ({
    id: `inv-demo-${i}`,
    memberUid,
    planId,
    amountMinor,
    currency: 'MAD',
    status: 'paid' as const,
    method,
    issuedAt: now - daysAgo * DAY,
    paidAt: now - daysAgo * DAY,
    issuedBy: 'demo-staff',
  }));
}
