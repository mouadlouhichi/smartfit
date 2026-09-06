import { PLANS, type PlanId } from '@smartfit/core';

/**
 * Centralised, typed access to public build-time environment variables.
 * Next.js inlines `NEXT_PUBLIC_*` at build time. Every value has a safe
 * default so the app runs with zero configuration (local-first).
 */

function flag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

const VALID_PLANS = new Set<PlanId>(PLANS.map((p) => p.id));

function plan(value: string | undefined, fallback: PlanId): PlanId {
  return value && VALID_PLANS.has(value as PlanId) ? (value as PlanId) : fallback;
}

export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'SmartFit',
  /**
   * Seed demo training history on first run. Off in production — new users
   * start from guided onboarding with their own data. Set true only for demos.
   */
  seedDemo: flag(process.env.NEXT_PUBLIC_SEED_DEMO, false),
  /** Default training strategy for brand-new accounts. */
  defaultPlan: plan(process.env.NEXT_PUBLIC_DEFAULT_PLAN, 'full-body'),
} as const;
