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
  GymCheckin,
  GymClass,
  GymSlot,
  InvoiceDoc,
  MembershipPlanDoc,
} from '@/lib/firebase/tenant-repo';

const DAY = 86_400_000;
const now = Date.now();

/**
 * Next occurrence of a weekday at HH:MM — same helper the seed script uses.
 *
 * "Next" has to mean the future. On the slot's own weekday, once the start
 * time has passed, today's occurrence is in the past: the timetable (which
 * lists what is still ahead) dropped it, so the demo gym lost its Wednesday
 * class every Wednesday evening. Roll forward a week instead.
 */
function nextSlot(weekday: number, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 7);
  return d.getTime();
}

export const DEMO_SLUG = 'zone-fight';

/**
 * Who "I" am when exploring a tenant in demo mode.
 *
 * There is no signed-in user without Firebase, so each demo role is bound to a
 * fixture person: picking "Gym owner" *is* Youssef, with his membership row,
 * bookings and visit history. `prospect` is the one persona with no row on the
 * roster — a signed-in visitor who has not joined yet — which is what makes the
 * join flow walkable in the demo. `platform-admin` is deliberately nobody: an
 * operator is not on any gym's roster.
 *
 * This map is Zone Fight's binding; every fixture carries its own (see
 * `demoPersonaUid`) because a person's role at one gym says nothing about
 * their role at another.
 */
export const DEMO_PERSONA_UIDS = {
  'gym-owner': 'demo-owner',
  'gym-staff': 'demo-staff',
  member: 'demo-member-1',
  'platform-admin': null,
  prospect: 'demo-prospect',
} as const;

export type DemoPersonaKey = keyof typeof DEMO_PERSONA_UIDS;

/** The Zone Fight gym document (the fixture below owns it). */
export function demoGym(): GymTenant {
  return {
    id: DEMO_SLUG,
    slug: DEMO_SLUG,
    name: 'Zone Fight',
    subdomain: DEMO_SLUG,
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
      email: `hello@${DEMO_SLUG}.smartfit.app`,
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
      role: 'trainer',
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
  const slots = plan.map(([id, classId, weekday, time, booked]) => {
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

  // One class later **today**, so "Today" views (and their attendance rows)
  // have content whatever day the demo is opened on. Clamped to just before
  // midnight so it can never land tomorrow.
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 0, 0);
  const liveStart = Math.min(now + 2 * 3_600_000, endOfToday.getTime() - 5 * 60_000);
  if (liveStart > now) {
    slots.push({
      id: 'slot-live-hiit',
      classId: 'cls-hiit',
      startsAt: liveStart,
      endsAt: liveStart + byId['cls-hiit'].minutes * 60_000,
      capacity: byId['cls-hiit'].capacity,
      booked: 2,
      cancelled: false,
    });
  }
  return slots.sort((a, b) => a.startsAt - b.startsAt);
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
    // The later-today class: two seated, one waiting — the exact rows a
    // front-desk attendance pass works through.
    ['slot-live-hiit', 'demo-member-1', 'booked', 'Amina Rachidi'],
    ['slot-live-hiit', 'demo-member-2', 'booked', 'Omar Tazi'],
    ['slot-live-hiit', 'demo-member-3', 'waitlist', 'Lina Fassi'],
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
      // Referenced by the owner/staff roster rows. Unpublished: staff do not
      // buy memberships, so it must never appear on the public pricing page.
      id: 'plan-staff',
      name: 'Staff',
      priceMinor: 0,
      currency: 'MAD',
      period: 'month',
      published: false,
    },
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

/**
 * Door visits, newest first — the member's own history.
 *
 * Sparse on purpose: the roster counters tell the business story (38 visits for
 * Amina), while this collection is what a member scrolls through, so it only
 * needs enough rows to look lived-in.
 */
export function demoCheckins(): GymCheckin[] {
  const rows: Array<[string, number]> = [
    ['demo-member-1', 0.4],
    ['demo-owner', 1],
    ['demo-member-1', 3],
    ['demo-member-3', 2],
    ['demo-member-1', 5],
    ['demo-trainer', 2],
    ['demo-member-1', 8],
    ['demo-member-1', 12],
    ['demo-member-1', 16],
    ['demo-member-3', 3],
    ['demo-member-2', 26],
  ];
  return rows
    .map(([uid, daysAgo], i) => ({
      id: `chk-demo-${i}`,
      uid,
      at: now - Math.round(daysAgo * DAY),
      by: 'demo-staff',
    }))
    .sort((a, b) => b.at - a.at);
}

/* ── The demo directory ────────────────────────────────────────────
 *
 * Local mode serves a small registry of tenants, not one fixture aliased
 * under every slug: the pivot's definition of done asks for two gyms
 * reachable via `/g/{slug}`, and a URL that renders Zone Fight under a
 * stranger's slug would be a lie. Unknown slugs resolve to no gym, exactly
 * like a missing Firestore doc would. Each fixture mirrors what
 * `scripts/seed-b2b.mjs` writes, and `src/lib/admin-demo.ts` describes the
 * same gyms from the platform's side (statuses, plans, owners) — keep the
 * two in sync when either changes.
 */

/** Who a demo persona is at one gym: their roster uid + switcher label. */
export interface DemoPersonaBinding {
  uid: string | null;
  label: string;
}

/** One demo tenant: every collection the storefront and consoles read. */
export interface DemoTenantFixture {
  gym: GymTenant;
  roster: GymMembership[];
  classes: GymClass[];
  slots: GymSlot[];
  bookings: GymBooking[];
  plans: MembershipPlanDoc[];
  invoices: InvoiceDoc[];
  checkins: GymCheckin[];
  personas: Record<DemoPersonaKey, DemoPersonaBinding>;
}

/** Zone Fight — the original fixture, bound to its own people. */
const ZONE_FIGHT: DemoTenantFixture = {
  gym: demoGym(),
  roster: demoRoster(),
  classes: demoClasses(),
  slots: demoSlots(),
  bookings: demoBookings(),
  plans: demoPlans(),
  invoices: demoInvoices(),
  checkins: demoCheckins(),
  personas: {
    'gym-owner': { uid: DEMO_PERSONA_UIDS['gym-owner'], label: 'Youssef — gym owner' },
    'gym-staff': { uid: DEMO_PERSONA_UIDS['gym-staff'], label: 'Salma — gym staff' },
    member: { uid: DEMO_PERSONA_UIDS.member, label: 'Amina — member' },
    prospect: { uid: DEMO_PERSONA_UIDS.prospect, label: 'A visitor — not a member' },
    'platform-admin': { uid: null, label: 'Platform admin' },
  },
};

/**
 * Iron House Strength — the second demo tenant.
 *
 * A gym nine days into its trial on the Starter plan (mirrored in
 * `admin-demo.ts`): timetable published, roster small, and **no invoices
 * yet** — billing is exactly the cliff this gym is standing on, which makes
 * it the honest counterpart to Zone Fight's lived-in books.
 */
function ironHouse(): DemoTenantFixture {
  const classes: GymClass[] = [
    {
      id: 'ih-cls-strength',
      name: 'Strength Foundations',
      focus: 'strength',
      intensity: 'moderate',
      minutes: 60,
      capacity: 10,
      instructorName: 'Nadia Cherkaoui',
      studio: 'Main Floor',
      createdAt: now - 8 * DAY,
    },
    {
      id: 'ih-cls-power',
      name: 'Powerlifting Basics',
      focus: 'strength',
      intensity: 'high',
      minutes: 75,
      capacity: 8,
      instructorName: 'Mehdi Alaoui',
      studio: 'Platforms',
      createdAt: now - 8 * DAY,
    },
    {
      id: 'ih-cls-conditioning',
      name: 'Conditioning Circuit',
      focus: 'cardio',
      intensity: 'high',
      minutes: 45,
      capacity: 14,
      instructorName: 'Mehdi Alaoui',
      studio: 'Back Room',
      createdAt: now - 6 * DAY,
    },
  ];

  const weekly: Array<[string, string, number, string, number]> = [
    ['ih-slot-mon-strength', 'ih-cls-strength', 1, '18:30', 4],
    ['ih-slot-wed-power', 'ih-cls-power', 3, '19:00', 3],
    ['ih-slot-fri-conditioning', 'ih-cls-conditioning', 5, '18:00', 6],
    ['ih-slot-sat-strength', 'ih-cls-strength', 6, '10:00', 2],
  ];
  const byId = Object.fromEntries(classes.map((c) => [c.id, c]));
  const slots: GymSlot[] = weekly.map(([id, classId, weekday, time, booked]) => {
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

  // One class later **today** — same trick as Zone Fight, so the staff
  // attendance pass has rows to work through whatever day you open the demo.
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 0, 0);
  const liveStart = Math.min(now + 2 * 3_600_000, endOfToday.getTime() - 5 * 60_000);
  if (liveStart > now) {
    slots.push({
      id: 'ih-slot-live-conditioning',
      classId: 'ih-cls-conditioning',
      startsAt: liveStart,
      endsAt: liveStart + byId['ih-cls-conditioning'].minutes * 60_000,
      capacity: byId['ih-cls-conditioning'].capacity,
      booked: 2,
      cancelled: false,
    });
  }
  slots.sort((a, b) => a.startsAt - b.startsAt);

  const bookingRows: Array<[string, string, GymBooking['status'], string]> = [
    ['ih-slot-mon-strength', 'demo-iron-member-1', 'booked', 'Sofia Idrissi'],
    ['ih-slot-mon-strength', 'demo-iron-member-2', 'booked', 'Yassine Berrada'],
    ['ih-slot-wed-power', 'demo-iron-member-1', 'booked', 'Sofia Idrissi'],
    ['ih-slot-live-conditioning', 'demo-iron-member-1', 'booked', 'Sofia Idrissi'],
    ['ih-slot-live-conditioning', 'demo-iron-member-2', 'booked', 'Yassine Berrada'],
    ['ih-slot-live-conditioning', 'demo-iron-member-3', 'waitlist', 'Imane Fatihi'],
  ];

  const checkinRows: Array<[string, number]> = [
    ['demo-iron-member-1', 1],
    ['demo-iron-staff', 1],
    ['demo-iron-owner', 2],
    ['demo-iron-member-1', 3],
    ['demo-iron-member-2', 2],
    ['demo-iron-member-1', 5],
    ['demo-iron-owner', 6],
  ];

  return {
    gym: {
      id: 'iron-house',
      slug: 'iron-house',
      name: 'Iron House Strength',
      subdomain: 'iron-house',
      status: 'trial',
      tenantPlanId: 'starter',
      ownerUid: 'demo-iron-owner',
      createdAt: now - 9 * DAY,
      branding: {
        accentColor: '#f97316',
        tagline: 'Strength first. Everything follows.',
        description:
          'Iron House Strength is a barbell gym in central Rabat: small-group strength classes, powerlifting coaching on the platforms, and conditioning that earns its name. No mirrors-first culture — coaches, chalk and progress.',
      },
      contact: {
        phone: '+212 537-000000',
        email: 'hello@iron-house.smartfit.app',
        instagram: '@ironhouserabat',
      },
      location: { address: '27 Av Mohammed V', city: 'Rabat', country: 'MA' },
      hours: {
        1: { open: '07:00', close: '21:00' },
        2: { open: '07:00', close: '21:00' },
        3: { open: '07:00', close: '21:00' },
        4: { open: '07:00', close: '21:00' },
        5: { open: '07:00', close: '21:00' },
        6: { open: '09:00', close: '14:00' },
        0: null,
      },
    },
    roster: [
      {
        uid: 'demo-iron-owner',
        role: 'owner',
        status: 'active',
        joinedAt: now - 9 * DAY,
        checkins: 17,
        lastVisitAt: now - DAY,
        displayName: 'Nadia Cherkaoui',
        planId: 'ih-plan-staff',
      },
      {
        uid: 'demo-iron-staff',
        role: 'staff',
        status: 'active',
        joinedAt: now - 8 * DAY,
        checkins: 15,
        lastVisitAt: now - DAY,
        displayName: 'Mehdi Alaoui',
        planId: 'ih-plan-staff',
      },
      {
        uid: 'demo-iron-member-1',
        role: 'member',
        status: 'trial',
        joinedAt: now - 6 * DAY,
        checkins: 4,
        lastVisitAt: now - DAY,
        displayName: 'Sofia Idrissi',
        planId: 'ih-plan-trial',
      },
      {
        uid: 'demo-iron-member-2',
        role: 'member',
        status: 'trial',
        joinedAt: now - 2 * DAY,
        checkins: 1,
        lastVisitAt: now - 2 * DAY,
        displayName: 'Yassine Berrada',
        planId: 'ih-plan-trial',
      },
      {
        uid: 'demo-iron-member-3',
        role: 'member',
        status: 'trial',
        joinedAt: now - DAY,
        checkins: 1,
        lastVisitAt: now - DAY,
        displayName: 'Imane Fatihi',
        planId: 'ih-plan-trial',
      },
    ],
    classes,
    slots,
    bookings: bookingRows.map(([slotId, uid, status, memberName], i) => ({
      id: `ih-bk-${i}`,
      slotId,
      uid,
      status,
      memberName,
      createdAt: now - DAY,
    })),
    plans: [
      {
        // Referenced by the owner/staff roster rows; never for sale.
        id: 'ih-plan-staff',
        name: 'Staff',
        priceMinor: 0,
        currency: 'MAD',
        period: 'month',
        published: false,
      },
      {
        id: 'ih-plan-trial',
        name: 'Trial week',
        priceMinor: 7000,
        currency: 'MAD',
        period: 'pass',
        published: true,
      },
      {
        id: 'ih-plan-monthly',
        name: 'Monthly',
        priceMinor: 32000,
        currency: 'MAD',
        period: 'month',
        published: true,
        description: 'Unlimited classes and open-gym access.',
      },
    ],
    invoices: [],
    checkins: checkinRows
      .map(([uid, daysAgo], i) => ({
        id: `ih-chk-${i}`,
        uid,
        at: now - Math.round(daysAgo * DAY),
        by: 'demo-iron-staff',
      }))
      .sort((a, b) => b.at - a.at),
    personas: {
      'gym-owner': { uid: 'demo-iron-owner', label: 'Nadia — gym owner' },
      'gym-staff': { uid: 'demo-iron-staff', label: 'Mehdi — gym staff' },
      member: { uid: 'demo-iron-member-1', label: 'Sofia — member' },
      prospect: { uid: 'demo-prospect', label: 'A visitor — not a member' },
      'platform-admin': { uid: null, label: 'Platform admin' },
    },
  };
}

const FIXTURES: Record<string, DemoTenantFixture> = {
  [DEMO_SLUG]: ZONE_FIGHT,
  'iron-house': ironHouse(),
};

/** The fixture for a slug, or null — the same answer a missing doc gives. */
export function demoFixture(slug: string): DemoTenantFixture | null {
  return FIXTURES[slug] ?? null;
}

/** Live demo tenants for the public directory. */
export function demoGyms(): GymTenant[] {
  return Object.values(FIXTURES).map((f) => f.gym);
}

/**
 * Which fixture person a demo persona is at one gym. Owners and members are
 * per-tenant — Youssef owns Zone Fight, not Iron House — so the mapping has
 * to take the slug. Unknown slugs fall back to Zone Fight's binding; a page
 * that reached this without a fixture renders "not open yet" anyway.
 */
export function demoPersonaUid(slug: string, role: DemoPersonaKey): string | null {
  return demoFixture(slug)?.personas[role].uid ?? ZONE_FIGHT.personas[role].uid;
}

/** Switcher label for a persona at one gym (see `demoPersonaUid`). */
export function demoPersonaLabel(slug: string, role: DemoPersonaKey): string {
  return demoFixture(slug)?.personas[role].label ?? ZONE_FIGHT.personas[role].label;
}

/** Door-visit history for one gym's people (see `demoPersonaUid`). */
export function demoCheckinsFor(slug: string): GymCheckin[] {
  return demoFixture(slug)?.checkins ?? ZONE_FIGHT.checkins;
}
