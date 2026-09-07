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
  /** Firebase Cloud Messaging sender id (optional, used by Firebase config). */
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() ?? '',
  },
} as const;
