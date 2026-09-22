#!/usr/bin/env node
/**
 * Seed the B2B demo: a platform admin, a gym owner, gym staff, members, and a
 * fully populated tenant.
 *
 * The production app ships with NO tenants — a gym exists only once the
 * platform approves an application. This script is the supported way to stand
 * up a realistic tenant in a demo or staging project so the admin console, the
 * owner console, the staff console and the member app all render with data.
 *
 * Usage:
 *   FIREBASE_PROJECT_ID=... \
 *   FIREBASE_CLIENT_EMAIL=... \
 *   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END KEY-----\n" \
 *   B2B_PASSWORD='ChangeMe!234' \
 *   node scripts/seed-b2b.mjs
 *
 * Env:
 *   FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
 *       Service-account credentials. The repo's .env is loaded automatically
 *       (real env wins), and the app-side FIREBASE_ADMIN_* names (or one
 *       FIREBASE_ADMIN_SERVICE_ACCOUNT JSON blob) are accepted too.
 *       NEVER prefix with NEXT_PUBLIC_.
 *   B2B_PASSWORD     password for every seeded account (default SmartFit!234)
 *   B2B_GYM_SLUG     tenant slug / subdomain (default zone-fight)
 *   B2B_ADMIN_EMAIL  platform admin address (default admin@smartfit.app)
 *   B2B_FORCE        set to "1" to reset passwords on existing accounts
 *
 * Idempotent: re-running updates documents in place rather than duplicating
 * them, because every write targets a deterministic document id.
 */
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { scriptCreds } from './lib/load-env.mjs';

// Reads the environment *and* the repo .env (loaded automatically); accepts
// the FIREBASE_ADMIN_* names and a FIREBASE_ADMIN_SERVICE_ACCOUNT blob too.
const { projectId, clientEmail, privateKey } = scriptCreds();

if (!projectId) {
  console.error('✖ Missing FIREBASE_PROJECT_ID. See scripts/README.md for required env vars.');
  process.exit(1);
}

const PASSWORD = process.env.B2B_PASSWORD || 'SmartFit!234';
const SLUG = process.env.B2B_GYM_SLUG || 'zone-fight';
const ADMIN_EMAIL = process.env.B2B_ADMIN_EMAIL || 'admin@smartfit.app';
const FORCE = process.env.B2B_FORCE === '1';

const app = initializeApp({
  credential:
    privateKey && clientEmail ? cert({ projectId, clientEmail, privateKey }) : applicationDefault(),
});
const auth = getAuth(app);
const db = getFirestore(app);

const now = Date.now();
const DAY = 86_400_000;

/** Accounts to create. `claim` is the platform-level role, if any. */
const PEOPLE = [
  {
    uid: 'b2b-admin',
    email: ADMIN_EMAIL,
    name: 'Platform Admin',
    claim: 'platform-admin',
  },
  {
    uid: 'b2b-owner',
    email: `owner@${SLUG}.smartfit.app`,
    name: 'Youssef El Amrani',
  },
  {
    uid: 'b2b-staff',
    email: `staff@${SLUG}.smartfit.app`,
    name: 'Salma Bennani',
  },
  {
    uid: 'b2b-editor',
    email: 'content@smartfit.app',
    name: 'Content Manager',
    claim: 'content-manager',
  },
  {
    uid: 'b2b-support',
    email: 'support@smartfit.app',
    name: 'Support Agent',
    claim: 'support-agent',
  },
  { uid: 'b2b-trainer', email: `trainer@${SLUG}.smartfit.app`, name: 'Karim Idrissi' },
  { uid: 'b2b-member-1', email: `member1@${SLUG}.smartfit.app`, name: 'Amina Rachidi' },
  { uid: 'b2b-member-2', email: `member2@${SLUG}.smartfit.app`, name: 'Omar Tazi' },
  { uid: 'b2b-member-3', email: `member3@${SLUG}.smartfit.app`, name: 'Lina Fassi' },
];

/** Create or update an Auth user, setting the password only when asked. */
async function ensureUser({ uid, email, name, claim }) {
  const existing = await auth.getUser(uid).catch(() => null);
  if (!existing) {
    await auth.createUser({
      uid,
      email,
      password: PASSWORD,
      displayName: name,
      emailVerified: true,
    });
    console.log(`  + created ${email}`);
  } else if (FORCE) {
    await auth.updateUser(uid, { password: PASSWORD, displayName: name });
    console.log(`  ~ reset password for ${email}`);
  } else {
    console.log(`  = exists  ${email} (B2B_FORCE=1 to reset its password)`);
  }

  // Claims are additive: never clobber unrelated ones.
  const user = await auth.getUser(uid);
  const claims = { ...(user.customClaims ?? {}) };
  if (claim) claims.sfRole = claim;
  else delete claims.sfRole;
  await auth.setCustomUserClaims(uid, claims);
}

async function main() {
  console.log('\n▸ Ensuring accounts');
  for (const person of PEOPLE) await ensureUser(person);

  // A platform admin is an operator, not a member-in-waiting: without a
  // completed profile the app would walk them through member onboarding
  // (weight, plan, gym, goal) on first sign-in. Seed a minimal done profile;
  // the login gateway sends them to /admin regardless, but this keeps the
  // dashboard coherent too if they ever wander in.
  for (const person of PEOPLE.filter((p) => p.claim === 'platform-admin')) {
    await db.doc(`users/${person.uid}`).set(
      {
        profile: {
          name: person.name,
          weightUnit: 'kg',
          distanceUnit: 'km',
          weeklyRestDays: 2,
          planId: 'full-body',
          onboardingDone: true,
        },
        updatedAt: now,
      },
      { merge: true },
    );
    console.log(`  + users/${person.uid} profile (onboarding done)`);
  }

  console.log('\n▸ Ensuring tenant');
  // The document id IS the slug — that is what makes subdomains unique.
  const gymRef = db.doc(`gyms/${SLUG}`);
  await gymRef.set(
    {
      slug: SLUG,
      name: 'Zone Fight',
      status: 'active',
      tenantPlanId: 'growth',
      ownerUid: 'b2b-owner',
      createdAt: now - 180 * DAY,
      updatedAt: now,
      branding: {
        accentColor: '#8ad200',
        tagline: 'Combat, conditioning and community in Casablanca.',
        description:
          'Zone Fight is a combat-and-conditioning gym: boxing, MMA, HIIT and strength under one roof, with coaches who know your name.',
      },
      contact: {
        phone: '+212 522-000000',
        email: `hello@${SLUG}.smartfit.app`,
        instagram: '@zonefight',
      },
      location: {
        address: '12 Bd Anfa',
        city: 'Casablanca',
        country: 'MA',
        lat: 33.5896,
        lng: -7.6192,
      },
      hours: {
        1: { open: '06:30', close: '22:30' },
        2: { open: '06:30', close: '22:30' },
        3: { open: '06:30', close: '22:30' },
        4: { open: '06:30', close: '22:30' },
        5: { open: '06:30', close: '22:30' },
        6: { open: '08:00', close: '20:00' },
        0: null,
      },
    },
    { merge: true },
  );
  console.log(`  + gyms/${SLUG}`);

  // ── Roster ──────────────────────────────────────────────────────────────
  console.log('\n▸ Ensuring roster');
  const roster = [
    {
      uid: 'b2b-owner',
      role: 'owner',
      status: 'active',
      checkins: 214,
      lastVisitAt: now - 1 * DAY,
      planId: 'plan-staff',
      displayName: 'Youssef El Amrani',
      joinedAt: now - 180 * DAY,
    },
    {
      uid: 'b2b-staff',
      role: 'staff',
      status: 'active',
      checkins: 96,
      lastVisitAt: now - 1 * DAY,
      planId: 'plan-staff',
      displayName: 'Salma Bennani',
      joinedAt: now - 150 * DAY,
    },
    {
      uid: 'b2b-trainer',
      role: 'trainer',
      status: 'active',
      checkins: 141,
      lastVisitAt: now - 2 * DAY,
      planId: 'plan-staff',
      displayName: 'Karim Idrissi',
      joinedAt: now - 140 * DAY,
    },
    {
      uid: 'b2b-member-1',
      role: 'member',
      status: 'active',
      checkins: 38,
      lastVisitAt: now - 2 * DAY,
      planId: 'plan-monthly',
      displayName: 'Amina Rachidi',
      joinedAt: now - 120 * DAY,
      expiresAt: now + 12 * DAY,
    },
    {
      uid: 'b2b-member-2',
      role: 'member',
      status: 'active',
      checkins: 22,
      lastVisitAt: now - 26 * DAY,
      planId: 'plan-monthly',
      displayName: 'Omar Tazi',
      joinedAt: now - 90 * DAY,
      expiresAt: now + 4 * DAY,
      notes: 'Asked about freezing over Ramadan.',
    },
    {
      uid: 'b2b-member-3',
      role: 'member',
      status: 'trial',
      checkins: 2,
      planId: 'plan-trial',
      displayName: 'Lina Fassi',
      joinedAt: now - 3 * DAY,
    },
  ];
  for (const m of roster) {
    await db.doc(`gyms/${SLUG}/members/${m.uid}`).set(m, { merge: true });
    console.log(`  + members/${m.uid} (${m.role}/${m.status})`);
  }

  // ── Classes & this week's slots ─────────────────────────────────────────
  console.log('\n▸ Ensuring classes and slots');
  const classes = [
    {
      id: 'cls-boxing',
      name: 'Boxing Fundamentals',
      focus: 'combat',
      intensity: 'high',
      minutes: 60,
      capacity: 16,
      instructorUid: 'b2b-trainer',
      instructorName: 'Karim Idrissi',
      studio: 'Ring 1',
    },
    {
      id: 'cls-hiit',
      name: 'HIIT 45',
      focus: 'hiit',
      intensity: 'high',
      minutes: 45,
      capacity: 20,
      instructorUid: 'b2b-trainer',
      instructorName: 'Karim Idrissi',
      studio: 'Studio A',
    },
    {
      id: 'cls-strength',
      name: 'Strength Foundations',
      focus: 'strength',
      intensity: 'moderate',
      minutes: 50,
      capacity: 12,
      instructorUid: 'b2b-owner',
      instructorName: 'Youssef El Amrani',
      studio: 'Floor',
    },
    {
      id: 'cls-mobility',
      name: 'Mobility & Recovery',
      focus: 'mind',
      intensity: 'low',
      minutes: 40,
      capacity: 18,
      instructorUid: 'b2b-staff',
      instructorName: 'Salma Bennani',
      studio: 'Studio B',
    },
    {
      id: 'cls-cardio',
      name: 'Cardio Burn',
      focus: 'cardio',
      intensity: 'moderate',
      minutes: 45,
      capacity: 22,
      instructorUid: 'b2b-staff',
      instructorName: 'Salma Bennani',
      studio: 'Studio A',
    },
  ];
  for (const c of classes) {
    await db
      .doc(`gyms/${SLUG}/classes/${c.id}`)
      .set({ ...c, createdAt: now - 180 * DAY }, { merge: true });
    console.log(`  + classes/${c.id}`);
  }

  /** Next occurrence of a weekday at HH:MM, local time. */
  function nextSlot(weekday, hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    const delta = (weekday - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + delta);
    return d.getTime();
  }

  const slots = [
    { id: 'slot-mon-boxing', classId: 'cls-boxing', weekday: 1, time: '18:00' },
    { id: 'slot-tue-hiit', classId: 'cls-hiit', weekday: 2, time: '07:00' },
    { id: 'slot-wed-strength', classId: 'cls-strength', weekday: 3, time: '19:00' },
    { id: 'slot-thu-boxing', classId: 'cls-boxing', weekday: 4, time: '18:00' },
    { id: 'slot-fri-mobility', classId: 'cls-mobility', weekday: 5, time: '17:30' },
    { id: 'slot-sat-cardio', classId: 'cls-cardio', weekday: 6, time: '10:00' },
  ];
  const classById = Object.fromEntries(classes.map((c) => [c.id, c]));
  for (const s of slots) {
    const startsAt = nextSlot(s.weekday, s.time);
    const endsAt = startsAt + classById[s.classId].minutes * 60_000;
    await db.doc(`gyms/${SLUG}/slots/${s.id}`).set(
      {
        classId: s.classId,
        startsAt,
        endsAt,
        capacity: classById[s.classId].capacity,
        booked: 0,
        cancelled: false,
      },
      { merge: true },
    );
    console.log(`  + slots/${s.id} (${new Date(startsAt).toLocaleString()})`);
  }

  // One class later today (clamped before midnight), so the staff "Today"
  // view has attendance rows whatever day the seed runs.
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 0, 0);
  const liveStart = Math.min(now + 2 * 3_600_000, endOfToday.getTime() - 5 * 60_000);
  if (liveStart > now) {
    await db.doc(`gyms/${SLUG}/slots/slot-live-hiit`).set(
      {
        classId: 'cls-hiit',
        startsAt: liveStart,
        endsAt: liveStart + classById['cls-hiit'].minutes * 60_000,
        capacity: classById['cls-hiit'].capacity,
        booked: 0,
        cancelled: false,
      },
      { merge: true },
    );
    console.log(`  + slots/slot-live-hiit (${new Date(liveStart).toLocaleString()})`);
  }

  // ── Bookings (with seat counts kept consistent) ─────────────────────────
  console.log('\n▸ Ensuring bookings');
  const bookingPlan = [
    ['slot-mon-boxing', ['b2b-member-1', 'b2b-member-2', 'b2b-trainer'], 'booked'],
    ['slot-tue-hiit', ['b2b-member-1', 'b2b-member-3'], 'booked'],
    ['slot-wed-strength', ['b2b-member-2'], 'booked'],
    ['slot-thu-boxing', ['b2b-member-1', 'b2b-member-2', 'b2b-member-3'], 'booked'],
    ['slot-fri-mobility', ['b2b-member-3'], 'waitlist'],
    ['slot-live-hiit', ['b2b-member-1', 'b2b-member-2'], 'booked'],
    ['slot-live-hiit', ['b2b-member-3'], 'waitlist'],
  ];
  const nameByUid = Object.fromEntries(PEOPLE.map((p) => [p.uid, p.name]));
  const seatedBySlot = {};
  for (const [slotId, uids, status] of bookingPlan) {
    for (const uid of uids) {
      await db
        .doc(`gyms/${SLUG}/bookings/bk-${slotId}-${uid}`)
        .set(
          { slotId, uid, status, createdAt: now - 2 * DAY, memberName: nameByUid[uid] },
          { merge: true },
        );
    }
    // Accumulate: several plan rows can target the same slot (seated plus
    // waitlist), and the counter must reflect them all.
    seatedBySlot[slotId] = (seatedBySlot[slotId] ?? 0) + (status === 'booked' ? uids.length : 0);
    console.log(`  + bookings for ${slotId}: ${uids.length} (${status})`);
  }
  // The counter must agree with the bookings, or the class looks full when it
  // is not — the transaction in tenant-repo.ts keeps these in step at runtime;
  // the seed has to do it by hand.
  for (const [slotId, seated] of Object.entries(seatedBySlot)) {
    await db.doc(`gyms/${SLUG}/slots/${slotId}`).set({ booked: seated }, { merge: true });
  }

  // ── Door visits ─────────────────────────────────────────────────────────
  // The roster rows above carry the counters; these records are what a member
  // scrolls through in "Visits". Deterministic ids keep re-runs idempotent.
  console.log('\n▸ Ensuring check-ins');
  const visitPlan = [
    ['b2b-member-1', 0.4],
    ['b2b-owner', 1],
    ['b2b-member-1', 3],
    ['b2b-member-3', 2],
    ['b2b-member-1', 5],
    ['b2b-trainer', 2],
    ['b2b-member-1', 8],
    ['b2b-member-1', 12],
    ['b2b-member-2', 26],
  ];
  for (let i = 0; i < visitPlan.length; i++) {
    const [uid, daysAgo] = visitPlan[i];
    await db
      .doc(`gyms/${SLUG}/checkins/chk-seed-${i}`)
      .set({ uid, at: now - Math.round(daysAgo * DAY), by: 'b2b-staff' }, { merge: true });
  }
  console.log(`  + ${visitPlan.length} door visits`);

  // ── Membership plans ────────────────────────────────────────────────────
  console.log('\n▸ Ensuring membership plans');
  const plans = [
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
    {
      id: 'plan-staff',
      name: 'Staff',
      priceMinor: 0,
      currency: 'MAD',
      period: 'month',
      published: false,
    },
  ];
  for (const p of plans) {
    await db.doc(`gyms/${SLUG}/plans/${p.id}`).set(p, { merge: true });
    console.log(`  + plans/${p.id}`);
  }

  // ── Invoices ────────────────────────────────────────────────────────────
  console.log('\n▸ Ensuring invoices');
  const invoices = [
    {
      id: 'inv-1',
      memberUid: 'b2b-member-1',
      amountMinor: 39000,
      status: 'paid',
      method: 'cmi',
      daysAgo: 18,
      planId: 'plan-monthly',
    },
    {
      id: 'inv-2',
      memberUid: 'b2b-member-2',
      amountMinor: 39000,
      status: 'paid',
      method: 'cash',
      daysAgo: 26,
      planId: 'plan-monthly',
    },
    {
      id: 'inv-3',
      memberUid: 'b2b-member-3',
      amountMinor: 9000,
      status: 'paid',
      method: 'card',
      daysAgo: 3,
      planId: 'plan-trial',
    },
    {
      id: 'inv-4',
      memberUid: 'b2b-member-1',
      amountMinor: 10000,
      status: 'paid',
      method: 'cash',
      daysAgo: 120,
      note: 'Join fee',
    },
  ];
  for (const inv of invoices) {
    const { daysAgo, ...rest } = inv;
    await db.doc(`gyms/${SLUG}/invoices/${inv.id}`).set(
      {
        ...rest,
        currency: 'MAD',
        issuedAt: now - daysAgo * DAY,
        paidAt: now - daysAgo * DAY,
        issuedBy: 'b2b-staff',
      },
      { merge: true },
    );
    console.log(`  + invoices/${inv.id}`);
  }

  // ── Private settings + audit ────────────────────────────────────────────
  await db.doc(`gyms/${SLUG}/settings/settings`).set(
    {
      timezone: 'Africa/Casablanca',
      currency: 'MAD',
      taxPct: 20,
      noShowPolicy: 'Two no-shows in a month suspends online booking for a week.',
      waiverText: 'Training involves physical risk. Members train at their own risk.',
      flags: { bookings: true, waitlist: true, checkinQr: false },
    },
    { merge: true },
  );
  console.log('  + settings/settings');

  await db
    .doc(`gyms/${SLUG}/audit/au-seed`)
    .set({ actorUid: 'b2b-admin', action: 'tenant:seed', target: SLUG, at: now }, { merge: true });

  // ── A member's opt-in share, to show the privacy boundary working ────────
  await db
    .doc('users/b2b-member-1/gymShares/' + SLUG)
    .set(
      { gymId: SLUG, sessionsThisMonth: 11, streakDays: 6, attendancePct: 84, sharedAt: now },
      { merge: true },
    );
  console.log('  + users/b2b-member-1/gymShares (opt-in aggregates only)');

  // ── Platform data (admin console) ───────────────────────────────────────
  // The `/admin` console reads `platform/**` through the Admin SDK only, so
  // this is the one way its queue, books and audit trail get demo content.
  console.log('\n▸ Ensuring platform data');

  await db
    .collection('platform')
    .doc('applications')
    .collection('entries')
    .doc('app-casa-boxing')
    .set(
      {
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
      { merge: true },
    );

  const platformPayments = [
    ['pinv-seed-1', 0.2, 'transfer'],
    ['pinv-seed-2', 31, 'cmi'],
    ['pinv-seed-3', 62, 'cmi'],
  ];
  for (const [id, daysAgo, method] of platformPayments) {
    await db
      .collection('platform')
      .doc('invoices')
      .collection('entries')
      .doc(id)
      .set(
        {
          slug: SLUG,
          amountMinor: 129_000,
          currency: 'MAD',
          method,
          status: 'paid',
          paidAt: now - Math.round(daysAgo * DAY),
          recordedBy: 'b2b-admin',
        },
        { merge: true },
      );
  }

  const auditRows = [
    ['payment:record', SLUG, 0.2, { amountMinor: 129_000, method: 'transfer' }],
    ['role:grant', 'b2b-admin', 60, { claim: 'sfRole' }],
  ];
  for (const [action, target, daysAgo, meta] of auditRows) {
    await db
      .collection('platform')
      .doc('audit')
      .collection('entries')
      .add({ actorUid: 'b2b-admin', action, target, at: now - Math.round(daysAgo * DAY), meta });
  }
  console.log('  + 1 pending application, 3 platform payments, audit entries');

  console.log('\n✔ Seed complete.\n');
  console.log(`  Tenant subdomain : ${SLUG}  →  /g/${SLUG}`);
  console.log(`  Password (all)   : ${PASSWORD}`);
  console.log('');
  // Roles come from the roster that was just written, not from a second copy
  // of the data that could drift out of step with it.
  const roleByUid = Object.fromEntries(roster.map((m) => [m.uid, m.role]));
  const CONSOLE = `/g/${SLUG}/console`;
  for (const p of PEOPLE) {
    const role = p.claim === 'platform-admin' ? 'platform-admin' : (roleByUid[p.uid] ?? 'member');
    const label =
      role === 'platform-admin'
        ? 'platform admin → /admin'
        : role === 'owner'
          ? `gym owner      → ${CONSOLE}`
          : role === 'staff'
            ? `gym staff      → ${CONSOLE}`
            : 'member         → /dashboard';
    console.log(`  ${p.email.padEnd(38)} ${label}`);
  }
  console.log('\n  Claim changes take up to an hour to reach an already-signed-in browser.');
  console.log('  Sign out and back in (or call getIdToken(true)) to pick them up immediately.\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n✖ Seed failed:', err.message || err);
    process.exit(1);
  });
