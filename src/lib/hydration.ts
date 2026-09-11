import { emptyState, isEmptyState, type FitnessState, type PlanId } from '@smartfit/core';

/**
 * What happens when the app decides which data a person should see.
 *
 * This used to live inline in an async effect inside the store, which made the
 * single most important question — *what does a brand-new user get?* —
 * impossible to assert without a browser. It is pure here, and covered by
 * tests/hydration.test.ts.
 */

/** On-device data found when signing in to an empty cloud account. */
export interface PendingMigration {
  state: FitnessState;
  counts: { sessions: number; goals: number; schedule: number; bodyLogs: number };
}

export interface HydrationDecision {
  /** The state to show. */
  state: FitnessState;
  /** True when the cloud account had nothing in it yet. */
  isNewAccount: boolean;
  /** True when the profile still has to go through onboarding. */
  needsOnboarding: boolean;
  /** Legacy on-device data to *offer* — never applied automatically. */
  migration: PendingMigration | null;
}

/**
 * First-run state: a clean account that lands on guided onboarding.
 * No demo content is ever seeded — the only pre-filled values are the default
 * activity types (configuration, not data) and the deployment's default plan.
 */
export function freshState(defaultPlan: PlanId, displayName?: string | null): FitnessState {
  const state = emptyState();
  state.profile.planId = defaultPlan;
  const name = displayName?.trim();
  if (name) state.profile.name = name;
  return state;
}

/** Describe on-device data worth offering to import, or null if there's none. */
export function migrationFor(local: FitnessState | null): PendingMigration | null {
  if (!local || isEmptyState(local)) return null;
  return {
    state: local,
    counts: {
      sessions: local.sessions.length,
      goals: local.goals.length,
      schedule: local.schedule.length,
      bodyLogs: local.bodyLogs.length,
    },
  };
}

/**
 * Decide what a signed-in cloud user sees.
 *
 * `remote` is null for a brand-new account. In that case the user starts from
 * a clean slate and goes through onboarding; any leftover on-device data is
 * *offered* separately rather than silently adopted, so a new account is never
 * pre-populated with someone else's — or an old build's — content.
 */
export function decideCloudHydration(input: {
  remote: FitnessState | null;
  local: FitnessState | null;
  displayName?: string | null;
  defaultPlan: PlanId;
}): HydrationDecision {
  const { remote, local, displayName, defaultPlan } = input;

  if (remote) {
    return {
      state: remote,
      isNewAccount: false,
      needsOnboarding: !remote.profile.onboardingDone,
      migration: null,
    };
  }

  return {
    state: freshState(defaultPlan, displayName),
    isNewAccount: true,
    needsOnboarding: true,
    migration: migrationFor(local),
  };
}

/** Decide what a local-mode (no account) visitor sees. */
export function decideLocalHydration(
  local: FitnessState | null,
  defaultPlan: PlanId,
): HydrationDecision {
  const state = local ?? freshState(defaultPlan);
  return {
    state,
    isNewAccount: local === null,
    needsOnboarding: !state.profile.onboardingDone,
    migration: null,
  };
}

/** A ready snapshot is usable only by the identity it was loaded for. */
export function isHydrationReady(
  snapshot: { owner: string | null; ready: boolean },
  owner: string | null,
  initializing: boolean,
): boolean {
  return !initializing && snapshot.ready && snapshot.owner === owner;
}

/** Failed reads are not evidence of a new account. Only a completed cache is safe. */
export function offlineHydrationState(cached: FitnessState | null): FitnessState | null {
  return cached?.profile.onboardingDone ? cached : null;
}
