import { PLANS, type PlanId } from '@smartfit/core';

/**
 * Public environment variables for the Expo app. Expo inlines EXPO_PUBLIC_*
 * at build/start time. Everything has a safe default — SmartFit is
 * local-first and needs no configuration.
 *
 * `process` is referenced indirectly so tsc doesn't require @types/node.
 */
const envObj = (typeof process !== 'undefined' && process.env) || {};

const VALID_PLANS = new Set<PlanId>(PLANS.map((p) => p.id));

export const env = {
  appName: envObj.EXPO_PUBLIC_APP_NAME || 'SmartFit',
  defaultPlan: (VALID_PLANS.has(envObj.EXPO_PUBLIC_DEFAULT_PLAN as PlanId)
    ? envObj.EXPO_PUBLIC_DEFAULT_PLAN
    : 'full-body') as PlanId,
} as const;
