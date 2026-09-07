import { PLANS, type PlanId } from '@smartfit/core';

/**
 * Centralised, typed access to public build-time environment variables.
 * Next.js inlines `NEXT_PUBLIC_*` at build time. Every value has a safe
 * default so the app runs with zero configuration (local-first).
 */

const VALID_PLANS = new Set<PlanId>(PLANS.map((p) => p.id));

function plan(value: string | undefined, fallback: PlanId): PlanId {
  return value && VALID_PLANS.has(value as PlanId) ? (value as PlanId) : fallback;
}

/**
 * Absolute origin of this deployment, used for canonical URLs, OG tags,
 * robots.txt and the sitemap. Falls back to the Vercel-provided URL, then to
 * localhost for development.
 */
function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`;
  return 'http://localhost:3000';
}

export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'SmartFit',
  siteUrl: siteUrl(),
  /** Default training strategy for brand-new accounts. */
  defaultPlan: plan(process.env.NEXT_PUBLIC_DEFAULT_PLAN, 'full-body'),
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() ?? '',
  },
} as const;
