import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decideCloudHydration,
  decideLocalHydration,
  freshState,
  migrationFor,
} from '../src/lib/hydration.ts';
import { emptyState, isEmptyState, type FitnessState } from '@smartfit/core';

/**
 * The contract these tests defend: a brand-new user starts from nothing and
 * goes through onboarding. No demo content, no other account's leftovers, no
 * half-populated dashboard.
 */

/** A state that looks like a real, used account. */
function usedState(): FitnessState {
  const s = emptyState();
  s.profile.name = 'Sam';
  s.profile.onboardingDone = true;
  s.sessions.push({
    id: 'ses-1',
    date: '2026-09-01',
    categoryId: 'cat-strength',
    title: 'Upper body',
    durationMin: 45,
    intensity: 'moderate',
    calories: 310,
    exercises: [],
    createdAt: Date.now(),
  });
  s.goals.push({
    id: 'goal-1',
    name: 'Train this week',
    metric: 'workouts',
    cadence: 'weekly',
    target: 4,
    startDate: '2026-09-01',
    createdAt: Date.now(),
  });
  return s;
}

test('a brand-new account starts completely empty', () => {
  const d = decideCloudHydration({ remote: null, local: null, defaultPlan: 'full-body' });

  assert.equal(d.isNewAccount, true);
  assert.equal(d.needsOnboarding, true, 'a new user must be sent to onboarding');
  assert.equal(d.migration, null);

  assert.deepEqual(d.state.sessions, [], 'no workouts');
  assert.deepEqual(d.state.goals, [], 'no goals');
  assert.deepEqual(d.state.schedule, [], 'no scheduled sessions');
  assert.deepEqual(d.state.bodyLogs, [], 'no measurements');
  assert.equal(d.state.profile.name, '', 'no invented identity');
  assert.equal(d.state.profile.onboardingDone, false);
  assert.ok(isEmptyState(d.state), 'the state is empty by the domain’s own definition');
});

test('the only pre-filled content is configuration, not data', () => {
  const state = freshState('ppl');

  // Activity types are the app's vocabulary, not someone's training history.
  assert.ok(state.categories.length > 0, 'default activity types are present');
  assert.ok(
    state.categories.every((c) => c.builtin === true),
    'every seeded category is a built-in, never user content',
  );
  assert.equal(state.profile.planId, 'ppl', 'the deployment default plan is honoured');
});

test('a display name from the provider prefills the profile, nothing else does', () => {
  const google = freshState('full-body', 'Ada Lovelace');
  assert.equal(google.profile.name, 'Ada Lovelace');
  assert.ok(isEmptyState(google), 'a prefilled name is still an empty account');

  // Whitespace-only names are not identities.
  assert.equal(freshState('full-body', '   ').profile.name, '');
  assert.equal(freshState('full-body', null).profile.name, '');
});

test('a returning user gets their own data and skips onboarding', () => {
  const remote = usedState();
  const d = decideCloudHydration({ remote, local: null, defaultPlan: 'full-body' });

  assert.equal(d.isNewAccount, false);
  assert.equal(d.needsOnboarding, false);
  assert.equal(d.state.sessions.length, 1);
  assert.equal(d.migration, null);
});

test('a returning user who never finished onboarding is sent back to it', () => {
  const remote = emptyState();
  remote.profile.name = 'Sam';
  remote.profile.onboardingDone = false;

  const d = decideCloudHydration({ remote, local: null, defaultPlan: 'full-body' });
  assert.equal(d.isNewAccount, false);
  assert.equal(d.needsOnboarding, true);
});

test('leftover on-device data is offered, never adopted', () => {
  const local = usedState();
  const d = decideCloudHydration({ remote: null, local, defaultPlan: 'full-body' });

  // The account itself is still pristine...
  assert.ok(isEmptyState(d.state), 'the new account is not pre-populated');
  assert.equal(d.needsOnboarding, true);

  // ...and the leftovers are merely described, for the user to accept or bin.
  assert.ok(d.migration, 'the user is told the data exists');
  assert.equal(d.migration.counts.sessions, 1);
  assert.equal(d.migration.counts.goals, 1);
});

test('empty on-device data is not worth offering', () => {
  assert.equal(migrationFor(null), null);
  assert.equal(migrationFor(emptyState()), null, 'an untouched local state is not a migration');

  // A profile name alone is not training data.
  const named = emptyState();
  named.profile.name = 'Sam';
  assert.equal(migrationFor(named), null);
});

test('a returning cloud user is never offered on-device leftovers', () => {
  const d = decideCloudHydration({
    remote: usedState(),
    local: usedState(),
    defaultPlan: 'full-body',
  });
  assert.equal(d.migration, null, 'migration is a first-sign-in concern only');
});

test('local mode: a first-time visitor lands on onboarding with nothing logged', () => {
  const d = decideLocalHydration(null, 'full-body');

  assert.equal(d.needsOnboarding, true);
  assert.ok(isEmptyState(d.state));
  assert.equal(d.state.profile.name, '');
});

test('local mode: a returning visitor keeps their data', () => {
  const d = decideLocalHydration(usedState(), 'full-body');

  assert.equal(d.needsOnboarding, false);
  assert.equal(d.state.sessions.length, 1);
});
