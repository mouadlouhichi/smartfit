/**
 * Security-rules unit tests, run against the Firestore emulator:
 *
 *   npx firebase-tools emulators:exec --only firestore --project smartfit-rules-ci \
 *     "node --import tsx --test tests/rules/firestore-rules.test.ts"
 *
 * (or `pnpm test:rules` with firebase-tools installed). The emulator must be
 * running — CI does this in the `firestore-rules` job; these tests are
 * deliberately NOT part of `pnpm test`, which runs without an emulator.
 *
 * The rules are the only server-side enforcement SmartFit has: every write
 * goes straight from the browser to Firestore. These tests pin the two
 * promises they make — (1) your data is reachable only by you, and (2) what
 * you write must be a sane training record, not arbitrary junk.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

const ALICE = 'alice-uid';
const BOB = 'bob-uid';

/** A session document that satisfies every rule-side constraint. */
const VALID_SESSION = {
  date: '2026-09-01',
  categoryId: 'cat-strength',
  title: 'Push day',
  durationMin: 45,
  intensity: 'moderate',
  calories: 310,
  createdAt: Date.now(),
};

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'smartfit-rules-ci',
    firestore: {
      rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
    },
  });
});

after(async () => {
  await env.cleanup();
});

test('nothing is readable without authentication', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'users', ALICE)));
  await assertFails(getDoc(doc(db, 'users', ALICE, 'sessions', 'ses-1')));
});

test('another user\u2019s tree is closed, even when signed in', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', ALICE), { profile: { name: 'Alice' } });
  });
  const bob = env.authenticatedContext(BOB).firestore();
  await assertFails(getDoc(doc(bob, 'users', ALICE)));
  await assertFails(setDoc(doc(bob, 'users', ALICE, 'sessions', 'hack'), { ...VALID_SESSION }));
  await assertFails(deleteDoc(doc(bob, 'users', ALICE)));
});

test('the owner can create, read and delete their own records', async () => {
  const alice = env.authenticatedContext(ALICE).firestore();
  await assertSucceeds(
    setDoc(doc(alice, 'users', ALICE), { profile: { name: 'Alice' }, createdAt: Date.now() }),
  );
  await assertSucceeds(setDoc(doc(alice, 'users', ALICE, 'sessions', 'ses-1'), VALID_SESSION));
  await assertSucceeds(getDoc(doc(alice, 'users', ALICE, 'sessions', 'ses-1')));
  await assertSucceeds(deleteDoc(doc(alice, 'users', ALICE, 'sessions', 'ses-1')));
});

test('sessions must look like training records', async () => {
  const alice = env.authenticatedContext(ALICE).firestore();
  const ref = doc(alice, 'users', ALICE, 'sessions', 'bad-1');

  await assertFails(setDoc(ref, { ...VALID_SESSION, date: 'yesterday' }));
  await assertFails(setDoc(ref, { ...VALID_SESSION, date: 1756684800000 }));
  await assertFails(setDoc(ref, { ...VALID_SESSION, durationMin: -30 }));
  await assertFails(setDoc(ref, { ...VALID_SESSION, intensity: 'extreme' }));
  await assertFails(setDoc(ref, { ...VALID_SESSION, title: 'x'.repeat(5000) }));
  // 7 valid fields + 12 junk = 19 > the 18-field cap.
  await assertFails(
    setDoc(ref, {
      ...VALID_SESSION,
      junk: true,
      more: 1,
      extra: 'a',
      pad: 2,
      x: 3,
      y: 4,
      z: 5,
      one: 6,
      two: 7,
      three: 8,
      four: 9,
      five: 10,
    }),
  );
  // Optional fields are validated when present, including a full GPS run
  // shape that uses every supported session field.
  await assertFails(setDoc(ref, { ...VALID_SESSION, notes: 'n'.repeat(6000) }));
  await assertFails(setDoc(ref, { ...VALID_SESSION, distanceKm: -5 }));
  await assertFails(setDoc(ref, { ...VALID_SESSION, route: 'not-a-list' }));
  await assertFails(
    setDoc(ref, { ...VALID_SESSION, route: Array.from({ length: 1001 }, () => ({})) }),
  );
  await assertSucceeds(
    setDoc(ref, {
      ...VALID_SESSION,
      distanceKm: 10.5,
      notes: 'Felt good',
      scheduleId: 'sch-1',
      exercises: [
        {
          name: 'Bench press',
          sets: [
            { reps: 5, weight: 40, kind: 'warmup' },
            { reps: 8, weight: 80, kind: 'working', rpe: 8 },
          ],
        },
      ],
      route: [
        { lat: 33.57, lng: -7.59 },
        { lat: 33.58, lng: -7.6 },
      ],
      movingTimeMin: 40,
      elevationGainM: 80,
      splits: [{ index: 1, distanceKm: 1, durationSec: 360, paceMinPerKm: 6 }],
    }),
  );
});

test('goals are constrained to the four real metrics and two cadences', async () => {
  const alice = env.authenticatedContext(ALICE).firestore();
  const ref = doc(alice, 'users', ALICE, 'goals', 'goal-1');
  const valid = {
    name: 'Train this week',
    metric: 'workouts',
    cadence: 'weekly',
    target: 4,
    startDate: '2026-09-01',
    createdAt: Date.now(),
  };
  await assertSucceeds(setDoc(ref, valid));
  await assertFails(setDoc(ref, { ...valid, metric: 'steps' }));
  await assertFails(setDoc(ref, { ...valid, cadence: 'yearly' }));
  await assertFails(setDoc(ref, { ...valid, target: -1 }));
});

test('body logs and categories reject junk payloads', async () => {
  const alice = env.authenticatedContext(ALICE).firestore();
  await assertSucceeds(
    setDoc(doc(alice, 'users', ALICE, 'bodyLogs', 'body-1'), {
      date: '2026-09-01',
      unit: 'weight',
      value: 80.5,
      createdAt: Date.now(),
    }),
  );
  await assertFails(
    setDoc(doc(alice, 'users', ALICE, 'bodyLogs', 'body-2'), {
      date: '2026-09-01',
      unit: 'weight',
      value: 'eighty',
      createdAt: Date.now(),
    }),
  );
  await assertFails(
    setDoc(doc(alice, 'users', ALICE, 'categories', 'cat-x'), {
      name: 'x'.repeat(500),
      icon: 'activity',
      color: '#D6532F',
    }),
  );
});

test('the root profile document must carry a bounded profile map', async () => {
  const alice = env.authenticatedContext(ALICE).firestore();
  const ref = doc(alice, 'users', ALICE);
  await assertFails(setDoc(ref, { hello: 'world' }));
  await assertSucceeds(setDoc(ref, { profile: { name: 'A' } }));
  await assertFails(setDoc(ref, { profile: { name: 'n'.repeat(81) } }));
  await assertFails(setDoc(ref, { profile: { weightUnit: 'stone' } }));
  await assertFails(setDoc(ref, { profile: { weeklyRestDays: 7 } }));
  await assertFails(setDoc(ref, { profile: { planId: 'anything' } }));
  // 16 junk keys — validProfile caps the map at 15 fields.
  await assertFails(
    setDoc(ref, {
      profile: {
        a: 1,
        b: 2,
        c: 3,
        d: 4,
        e: 5,
        f: 6,
        g: 7,
        h: 8,
        i: 9,
        j: 10,
        k: 11,
        l: 12,
        m: 13,
        n: 14,
        o: 15,
        p: 16,
      },
    }),
  );
});

test('the profile accepts bounded fuel fields and rejects junk values', async () => {
  const alice = env.authenticatedContext(ALICE).firestore();
  const ref = doc(alice, 'users', ALICE);
  await assertSucceeds(
    setDoc(ref, {
      profile: {
        nutritionGoal: 'cut',
        activityLevel: 'moderate',
        sex: 'female',
        ageYears: 31,
        heightCm: 168,
      },
    }),
  );
  await assertFails(setDoc(ref, { profile: { nutritionGoal: 'bulk' } }));
  await assertFails(setDoc(ref, { profile: { activityLevel: 'extreme' } }));
  await assertFails(setDoc(ref, { profile: { sex: 'other' } }));
  await assertFails(setDoc(ref, { profile: { ageYears: 200 } }));
  await assertFails(setDoc(ref, { profile: { heightCm: 20 } }));
});

test('meal logs reject junk payloads', async () => {
  const alice = env.authenticatedContext(ALICE).firestore();
  const valid = {
    date: '2026-09-01',
    name: 'Chicken & rice',
    slot: 'lunch',
    calories: 620,
    protein: 45,
    carbs: 70,
    fat: 14,
    scanned: true,
    createdAt: Date.now(),
  };
  await assertSucceeds(setDoc(doc(alice, 'users', ALICE, 'meals', 'meal-1'), valid));
  await assertFails(
    setDoc(doc(alice, 'users', ALICE, 'meals', 'meal-2'), { ...valid, slot: 'brunch' }),
  );
  await assertFails(
    setDoc(doc(alice, 'users', ALICE, 'meals', 'meal-3'), { ...valid, calories: -5 }),
  );
  await assertFails(
    setDoc(doc(alice, 'users', ALICE, 'meals', 'meal-4'), { ...valid, name: 'x'.repeat(200) }),
  );
  await assertFails(
    setDoc(doc(alice, 'users', ALICE, 'meals', 'meal-5'), { ...valid, fat: 'lots' }),
  );
  // Foreign users can neither read nor write someone else's meal log.
  const bob = env.authenticatedContext(BOB).firestore();
  await assertFails(getDoc(doc(bob, 'users', ALICE, 'meals', 'meal-1')));
  await assertFails(setDoc(doc(bob, 'users', ALICE, 'meals', 'meal-9'), valid));
});

test('clients cannot mint paid Pro entitlements', async () => {
  const alice = env.authenticatedContext(ALICE).firestore();
  const ref = doc(alice, 'users', ALICE);
  const paidSince = Date.now();
  await assertFails(
    setDoc(ref, {
      profile: { name: 'A', pro: { plan: 'lifetime', since: paidSince } },
    }),
  );
  await assertFails(
    setDoc(ref, {
      profile: { name: 'A', pro: { plan: 'trial', since: paidSince } },
    }),
  );

  // A trusted server can provision the stamp (the Admin SDK bypasses rules),
  // and the owner may still edit ordinary profile fields without stripping it.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', ALICE), {
      profile: { name: 'A', pro: { plan: 'lifetime', since: paidSince } },
    });
  });
  await assertSucceeds(
    setDoc(ref, {
      profile: { name: 'Updated', pro: { plan: 'lifetime', since: paidSince } },
    }),
  );
});

test('everything outside users/{uid} is denied', async () => {
  const alice = env.authenticatedContext(ALICE).firestore();
  await assertFails(setDoc(doc(alice, 'public', 'anything'), { v: 1 }));
  await assertFails(getDoc(doc(alice, 'meta', 'anything')));
  await assertFails(getDoc(doc(alice, 'accountDeletionJobs', ALICE)));
});

// ═══════════════════════════════════════════════════════════════════════════
// B2B tenant isolation
//
// These pin the four promises the pivot makes, in descending order of how bad
// it is to break them:
//   1. a gym's roster is invisible outside that gym;
//   2. a member cannot escalate to staff;
//   3. a gym owner cannot change lifecycle status or transfer ownership;
//   4. member training data stays inside users/{uid} — the tenant tree never
//      exposes it, because it never contains it.
// ═══════════════════════════════════════════════════════════════════════════

const GYM_A = 'acme';
const GYM_B = 'bravo';
const OWNER = 'owner-uid';
const STAFF = 'staff-uid';
const MEMBER = 'member-uid';
const OUTSIDER = 'outsider-uid';
const ADMIN = 'admin-uid';

const VALID_GYM = {
  slug: GYM_A,
  name: 'Acme Fitness',
  status: 'active',
  tenantPlanId: 'growth',
  ownerUid: OWNER,
  createdAt: Date.now(),
};

const membership = (uid: string, role: string, over: Record<string, unknown> = {}) => ({
  role,
  status: 'active',
  joinedAt: Date.now(),
  checkins: 0,
  ...over,
});

/** Admin context — the `sfRole` claim is what makes it a platform operator. */
const adminCtx = () => env.authenticatedContext(ADMIN, { sfRole: 'platform-admin' });

/** Seed two gyms with rosters, bypassing rules the way the Admin SDK does. */
async function seedTenants() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'gyms', GYM_A), VALID_GYM);
    await setDoc(doc(db, 'gyms', GYM_A, 'members', OWNER), membership(OWNER, 'owner'));
    await setDoc(doc(db, 'gyms', GYM_A, 'members', STAFF), membership(STAFF, 'staff'));
    await setDoc(doc(db, 'gyms', GYM_A, 'members', MEMBER), membership(MEMBER, 'member'));
    await setDoc(doc(db, 'gyms', GYM_B), {
      ...VALID_GYM,
      slug: GYM_B,
      name: 'Bravo Gym',
      ownerUid: OUTSIDER,
    });
    await setDoc(doc(db, 'gyms', GYM_B, 'members', OUTSIDER), membership(OUTSIDER, 'owner'));
  });
}

test('tenant: nothing about a gym is readable while signed out', async () => {
  await seedTenants();
  const anon = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon, 'gyms', GYM_A)));
  await assertFails(getDoc(doc(anon, 'gyms', GYM_A, 'members', MEMBER)));
  await assertFails(getDoc(doc(anon, 'gyms', GYM_A, 'settings', 'settings')));
});

test('tenant: the public storefront is readable by any signed-in user', async () => {
  await seedTenants();
  const outsider = env.authenticatedContext(OUTSIDER).firestore();
  // The storefront is the product — a prospect must be able to see the gym.
  await assertSucceeds(getDoc(doc(outsider, 'gyms', GYM_A)));
  // But not its private configuration, roster or money.
  await assertFails(getDoc(doc(outsider, 'gyms', GYM_A, 'members', MEMBER)));
  await assertFails(getDoc(doc(outsider, 'gyms', GYM_A, 'settings', 'settings')));
  await assertFails(getDoc(doc(outsider, 'gyms', GYM_A, 'invoices', 'inv-1')));
});

test('tenant: a member of gym A cannot reach gym B at all', async () => {
  await seedTenants();
  const member = env.authenticatedContext(MEMBER).firestore();
  await assertSucceeds(getDoc(doc(member, 'gyms', GYM_A, 'members', MEMBER)));
  await assertFails(getDoc(doc(member, 'gyms', GYM_B, 'members', OUTSIDER)));
  await assertFails(getDoc(doc(member, 'gyms', GYM_B, 'settings', 'settings')));
});

test('tenant: a member sees only their own roster row', async () => {
  await seedTenants();
  const member = env.authenticatedContext(MEMBER).firestore();
  await assertSucceeds(getDoc(doc(member, 'gyms', GYM_A, 'members', MEMBER)));
  await assertFails(getDoc(doc(member, 'gyms', GYM_A, 'members', STAFF)));
  await assertFails(getDoc(doc(member, 'gyms', GYM_A, 'members', OWNER)));
});

test('tenant: staff and owner see the whole roster', async () => {
  await seedTenants();
  for (const uid of [STAFF, OWNER]) {
    const ctx = env.authenticatedContext(uid).firestore();
    await assertSucceeds(getDoc(doc(ctx, 'gyms', GYM_A, 'members', MEMBER)));
    await assertSucceeds(getDoc(doc(ctx, 'gyms', GYM_A, 'members', STAFF)));
  }
});

test('tenant: a member may self-enrol, but only ever as a member', async () => {
  await seedTenants();
  const fresh = env.authenticatedContext('new-joiner').firestore();
  const ownRef = doc(fresh, 'gyms', GYM_A, 'members', 'new-joiner');

  await assertSucceeds(setDoc(ownRef, membership('new-joiner', 'member')));

  // The escalation this rule exists to stop.
  await assertFails(
    setDoc(doc(fresh, 'gyms', GYM_A, 'members', 'sneaky'), membership('sneaky', 'staff')),
  );
  await assertFails(
    setDoc(doc(fresh, 'gyms', GYM_A, 'members', 'bossy'), membership('bossy', 'owner')),
  );
  // A self-join cannot pre-seed an attendance history either.
  await assertFails(
    setDoc(
      doc(fresh, 'gyms', GYM_A, 'members', 'padded'),
      membership('padded', 'member', { checkins: 99 }),
    ),
  );
  // Nor enrol somebody else.
  await assertFails(
    setDoc(doc(fresh, 'gyms', GYM_A, 'members', 'victim'), membership('victim', 'member')),
  );
});

test('tenant: a member cannot edit their own membership to escalate', async () => {
  await seedTenants();
  const member = env.authenticatedContext(MEMBER).firestore();
  const ownRef = doc(member, 'gyms', GYM_A, 'members', MEMBER);
  await assertFails(setDoc(ownRef, membership(MEMBER, 'staff')));
  await assertFails(
    setDoc(ownRef, membership(MEMBER, 'member', { expiresAt: Date.now() + 31536000000 })),
  );
  // Leaving is still their right.
  await assertSucceeds(deleteDoc(ownRef));
});

test('tenant: staff may not delete members or change roles', async () => {
  await seedTenants();
  const staff = env.authenticatedContext(STAFF).firestore();
  // Staff can operate the roster...
  await assertSucceeds(
    setDoc(doc(staff, 'gyms', GYM_A, 'members', 'walk-in'), membership('walk-in', 'member')),
  );
  // ...but removal is owner-only.
  await assertFails(deleteDoc(doc(staff, 'gyms', GYM_A, 'members', MEMBER)));
});

test('tenant: only the owner may remove a member', async () => {
  await seedTenants();
  const owner = env.authenticatedContext(OWNER).firestore();
  await assertSucceeds(deleteDoc(doc(owner, 'gyms', GYM_A, 'members', MEMBER)));
});

test('tenant: staff cannot read private settings, the owner can', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'gyms', GYM_A, 'settings', 'settings'), {
      timezone: 'Africa/Casablanca',
      currency: 'MAD',
      taxPct: 20,
    });
  });
  const staff = env.authenticatedContext(STAFF).firestore();
  await assertFails(getDoc(doc(staff, 'gyms', GYM_A, 'settings', 'settings')));
  const owner = env.authenticatedContext(OWNER).firestore();
  await assertSucceeds(getDoc(doc(owner, 'gyms', GYM_A, 'settings', 'settings')));
});

test('tenant: an owner edits their gym but not status, slug or ownerUid', async () => {
  await seedTenants();
  const owner = env.authenticatedContext(OWNER).firestore();
  const ref = doc(owner, 'gyms', GYM_A);

  await assertSucceeds(setDoc(ref, { ...VALID_GYM, name: 'Acme Fitness Club' }));
  await assertFails(setDoc(ref, { ...VALID_GYM, status: 'suspended' }));
  await assertFails(setDoc(ref, { ...VALID_GYM, ownerUid: STAFF }));
  await assertFails(setDoc(ref, { ...VALID_GYM, slug: GYM_B }));
  // The document id *is* the slug; a mismatch is rejected outright.
  await assertFails(setDoc(doc(owner, 'gyms', 'mismatch'), { ...VALID_GYM, slug: 'mismatch' }));
});

test('tenant: only the platform can provision, suspend or delete a gym', async () => {
  await seedTenants();
  const outsider = env.authenticatedContext(OUTSIDER).firestore();
  await assertFails(setDoc(doc(outsider, 'gyms', 'fresh'), { ...VALID_GYM, slug: 'fresh' }));
  await assertFails(deleteDoc(doc(outsider, 'gyms', GYM_A)));

  const admin = adminCtx().firestore();
  await assertSucceeds(
    setDoc(doc(admin, 'gyms', 'fresh'), { ...VALID_GYM, slug: 'fresh', ownerUid: ADMIN }),
  );
  await assertSucceeds(
    setDoc(doc(admin, 'gyms', 'fresh'), { ...VALID_GYM, slug: 'fresh', status: 'suspended' }),
  );
  await assertSucceeds(deleteDoc(doc(admin, 'gyms', 'fresh')));
});

test('tenant: an owner cannot self-provision a second gym', async () => {
  await seedTenants();
  const owner = env.authenticatedContext(OWNER).firestore();
  await assertFails(setDoc(doc(owner, 'gyms', 'mine'), { ...VALID_GYM, slug: 'mine' }));
});

test('tenant: gym documents must look like tenants', async () => {
  const admin = adminCtx().firestore();
  const ref = doc(admin, 'gyms', 'shaped');
  await assertFails(setDoc(ref, { ...VALID_GYM, slug: 'shaped', status: 'live' }));
  await assertFails(setDoc(ref, { ...VALID_GYM, slug: 'shaped', name: 'x'.repeat(200) }));
  await assertFails(setDoc(ref, { ...VALID_GYM, slug: 'SHAPED' }));
  await assertFails(setDoc(ref, { ...VALID_GYM, slug: 'shaped', createdAt: -1 }));
});

test('tenant: bookings — a member manages their own seat only', async () => {
  await seedTenants();
  const member = env.authenticatedContext(MEMBER).firestore();
  const booking = { slotId: 'slot-1', uid: MEMBER, status: 'booked', createdAt: Date.now() };

  await assertSucceeds(setDoc(doc(member, 'gyms', GYM_A, 'bookings', 'b1'), booking));
  await assertSucceeds(getDoc(doc(member, 'gyms', GYM_A, 'bookings', 'b1')));
  // Booking on somebody else's behalf is staff work.
  await assertFails(
    setDoc(doc(member, 'gyms', GYM_A, 'bookings', 'b2'), { ...booking, uid: STAFF }),
  );
  // Marking your own attendance is not a thing a member can do.
  await assertFails(
    setDoc(doc(member, 'gyms', GYM_A, 'bookings', 'b1'), { ...booking, status: 'attended' }),
  );
  // Cancelling is.
  await assertSucceeds(
    setDoc(doc(member, 'gyms', GYM_A, 'bookings', 'b1'), { ...booking, status: 'cancelled' }),
  );
  // Somebody else's booking is invisible.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'gyms', GYM_A, 'bookings', 'other'), {
      ...booking,
      uid: STAFF,
    });
  });
  await assertFails(getDoc(doc(member, 'gyms', GYM_A, 'bookings', 'other')));
});

test('tenant: staff can take attendance and book for anyone', async () => {
  await seedTenants();
  const staff = env.authenticatedContext(STAFF).firestore();
  const booking = { slotId: 'slot-1', uid: MEMBER, status: 'booked', createdAt: Date.now() };
  await assertSucceeds(setDoc(doc(staff, 'gyms', GYM_A, 'bookings', 'b3'), booking));
  await assertSucceeds(
    setDoc(doc(staff, 'gyms', GYM_A, 'bookings', 'b3'), { ...booking, status: 'attended' }),
  );
  await assertSucceeds(getDoc(doc(staff, 'gyms', GYM_A, 'bookings', 'b3')));
});

test('tenant: classes and slots are staff-writable, member-readable, owner-deletable', async () => {
  await seedTenants();
  const member = env.authenticatedContext(MEMBER).firestore();
  const staff = env.authenticatedContext(STAFF).firestore();
  const owner = env.authenticatedContext(OWNER).firestore();

  const cls = {
    name: 'HIIT 45',
    focus: 'hiit',
    intensity: 'high',
    minutes: 45,
    capacity: 20,
    createdAt: Date.now(),
  };
  await assertFails(setDoc(doc(member, 'gyms', GYM_A, 'classes', 'c1'), cls));
  await assertSucceeds(setDoc(doc(staff, 'gyms', GYM_A, 'classes', 'c1'), cls));
  await assertSucceeds(getDoc(doc(member, 'gyms', GYM_A, 'classes', 'c1')));
  await assertFails(deleteDoc(doc(staff, 'gyms', GYM_A, 'classes', 'c1')));
  await assertSucceeds(deleteDoc(doc(owner, 'gyms', GYM_A, 'classes', 'c1')));

  // Shape validation still applies.
  await assertFails(setDoc(doc(staff, 'gyms', GYM_A, 'classes', 'c2'), { ...cls, focus: 'yoga' }));
  await assertFails(setDoc(doc(staff, 'gyms', GYM_A, 'classes', 'c2'), { ...cls, capacity: -1 }));
});

test('tenant: money is scoped — staff issue, owner refunds, members see their own', async () => {
  await seedTenants();
  const invoice = {
    memberUid: MEMBER,
    amountMinor: 39000,
    currency: 'MAD',
    status: 'paid',
    issuedAt: Date.now(),
  };
  const staff = env.authenticatedContext(STAFF).firestore();
  await assertSucceeds(setDoc(doc(staff, 'gyms', GYM_A, 'invoices', 'i1'), invoice));
  // Currency must be a real ISO code.
  await assertFails(
    setDoc(doc(staff, 'gyms', GYM_A, 'invoices', 'i2'), { ...invoice, currency: 'dh' }),
  );
  // Deleting money records is owner-only.
  await assertFails(deleteDoc(doc(staff, 'gyms', GYM_A, 'invoices', 'i1')));

  const member = env.authenticatedContext(MEMBER).firestore();
  await assertSucceeds(getDoc(doc(member, 'gyms', GYM_A, 'invoices', 'i1')));
  // Another member's invoice is nobody else's business.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'gyms', GYM_A, 'invoices', 'i3'), {
      ...invoice,
      memberUid: STAFF,
    });
  });
  await assertFails(getDoc(doc(member, 'gyms', GYM_A, 'invoices', 'i3')));
  await assertFails(setDoc(doc(member, 'gyms', GYM_A, 'invoices', 'i4'), invoice));
});

test('tenant: membership plans are owner-only', async () => {
  await seedTenants();
  const plan = { name: 'Monthly', priceMinor: 39000, currency: 'MAD', period: 'month' };
  const staff = env.authenticatedContext(STAFF).firestore();
  const owner = env.authenticatedContext(OWNER).firestore();
  await assertFails(setDoc(doc(staff, 'gyms', GYM_A, 'plans', 'p1'), plan));
  await assertSucceeds(setDoc(doc(owner, 'gyms', GYM_A, 'plans', 'p1'), plan));
  await assertSucceeds(getDoc(doc(staff, 'gyms', GYM_A, 'plans', 'p1')));
  await assertFails(
    setDoc(doc(owner, 'gyms', GYM_A, 'plans', 'p2'), { ...plan, period: 'decade' }),
  );
});

test('tenant: the audit trail is append-only', async () => {
  await seedTenants();
  const staff = env.authenticatedContext(STAFF).firestore();
  const owner = env.authenticatedContext(OWNER).firestore();
  const entry = { actorUid: STAFF, action: 'checkin:mark', at: Date.now() };

  await assertSucceeds(setDoc(doc(staff, 'gyms', GYM_A, 'audit', 'a1'), entry));
  // A log the subject can rewrite is not a log.
  await assertFails(
    setDoc(doc(staff, 'gyms', GYM_A, 'audit', 'a1'), { ...entry, action: 'nothing-happened' }),
  );
  await assertFails(deleteDoc(doc(staff, 'gyms', GYM_A, 'audit', 'a1')));
  await assertFails(deleteDoc(doc(owner, 'gyms', GYM_A, 'audit', 'a1')));
  // Staff write it but only the owner reads it.
  await assertFails(getDoc(doc(staff, 'gyms', GYM_A, 'audit', 'a1')));
  await assertSucceeds(getDoc(doc(owner, 'gyms', GYM_A, 'audit', 'a1')));
});

test('tenant: the platform namespace is unreachable from a browser', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'platform', 'config'), { reserved: ['acme'] });
  });
  const admin = adminCtx().firestore();
  const owner = env.authenticatedContext(OWNER).firestore();
  // Not even a platform operator's *browser* session may read it: the Admin SDK
  // bypasses rules, and that is the only sanctioned path.
  await assertFails(getDoc(doc(admin, 'platform', 'config')));
  await assertFails(getDoc(doc(owner, 'platform', 'config')));
  await assertFails(getDoc(doc(owner, 'platform', 'applications', 'app-1')));
});

test('tenant: member training data never appears in the tenant tree', async () => {
  // The privacy promise: a gym reads aggregates the member opted into, never
  // users/{uid}. Prove the tenant side has no such path at all.
  await seedTenants();
  const owner = env.authenticatedContext(OWNER).firestore();
  await assertFails(getDoc(doc(owner, 'users', MEMBER)));
  await assertFails(getDoc(doc(owner, 'users', MEMBER, 'sessions', 'ses-1')));
  await assertFails(getDoc(doc(owner, 'users', MEMBER, 'bodyLogs', 'b1')));
  await assertFails(getDoc(doc(owner, 'gyms', GYM_A, 'members', MEMBER, 'sessions', 'ses-1')));
});

test('sharing: a member publishes aggregates to their own tree, the gym only reads', async () => {
  await seedTenants();
  const member = env.authenticatedContext(MEMBER).firestore();
  const shareRef = doc(member, 'users', MEMBER, 'gymShares', GYM_A);
  const share = {
    gymId: GYM_A,
    sessionsThisMonth: 9,
    streakDays: 4,
    attendancePct: 78,
    sharedAt: Date.now(),
  };

  await assertSucceeds(setDoc(shareRef, share));

  // The gym reads what was volunteered — and nothing more.
  const owner = env.authenticatedContext(OWNER).firestore();
  await assertSucceeds(getDoc(doc(owner, 'users', MEMBER, 'gymShares', GYM_A)));
  await assertFails(getDoc(doc(owner, 'users', MEMBER, 'sessions', 'ses-1')));
  // A gym may not write into a member's tree, even a field it would like.
  await assertFails(
    setDoc(doc(owner, 'users', MEMBER, 'gymShares', GYM_A), { ...share, attendancePct: 100 }),
  );
  // Nor may a stranger read the share.
  const stranger = env.authenticatedContext('stranger-uid').firestore();
  await assertFails(getDoc(doc(stranger, 'users', MEMBER, 'gymShares', GYM_A)));
});

test('sharing: the document must name the gym it is filed under', async () => {
  await seedTenants();
  const member = env.authenticatedContext(MEMBER).firestore();
  const share = {
    gymId: GYM_B,
    sessionsThisMonth: 9,
    streakDays: 4,
    attendancePct: 78,
    sharedAt: Date.now(),
  };
  // Filing a GYM_B share under GYM_A would let a client leak aggregates to a
  // gym that never asked for them.
  await assertFails(setDoc(doc(member, 'users', MEMBER, 'gymShares', GYM_A), share));
  // Bounds are enforced too.
  await assertFails(
    setDoc(doc(member, 'users', MEMBER, 'gymShares', GYM_A), {
      ...share,
      gymId: GYM_A,
      attendancePct: 140,
    }),
  );
  await assertFails(
    setDoc(doc(member, 'users', MEMBER, 'gymShares', GYM_A), {
      ...share,
      gymId: GYM_A,
      bodyWeightKg: 82,
    }),
  );
  // Revoking is the member's alone.
  await assertSucceeds(
    setDoc(doc(member, 'users', MEMBER, 'gymShares', GYM_A), { ...share, gymId: GYM_A }),
  );
  const owner = env.authenticatedContext(OWNER).firestore();
  await assertFails(deleteDoc(doc(owner, 'users', MEMBER, 'gymShares', GYM_A)));
  await assertSucceeds(deleteDoc(doc(member, 'users', MEMBER, 'gymShares', GYM_A)));
});
