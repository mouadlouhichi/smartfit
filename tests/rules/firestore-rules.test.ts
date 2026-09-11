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
      },
    }),
  );
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
