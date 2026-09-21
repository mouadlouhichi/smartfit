/**
 * POST /api/admin/plan — edit one tier's price or limits.
 *
 * Body: `{ planId, monthlyPriceMinor?, limits? }`.
 *
 * Writes the tier into `platform/config.plans`, which `effectivePlans` layers
 * over the shipped defaults. Limits are the platform's brakes (member caps,
 * branding entitlements), so every field is bounded server-side — a fat-finger
 * `Infinity` must never become a tenant's contract.
 */
import {
  appendPlatformAudit,
  json,
  loadEffectivePlans,
  requirePlatformAdmin,
} from '@/lib/admin-server';
import { validatePlanPatch } from '@/lib/admin-model';
import type { TenantPlan } from '@smartfit/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const auth = await requirePlatformAdmin(req);
  if (auth.error) return auth.error;
  const { services, uid } = auth;

  let body: { planId?: unknown; monthlyPriceMinor?: unknown; limits?: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  const planId = typeof body.planId === 'string' ? body.planId.trim() : '';
  const result = validatePlanPatch(planId, body);
  if (!result.ok) return json({ error: result.reason }, 400);

  // Merge onto the current effective tier: a patch that only changes the
  // member cap must not wipe the plan's other limits.
  const current = await loadEffectivePlans(services);
  const existing = current.find((p) => p.id === planId);
  if (!existing) return json({ error: `No plan named "${planId}".` }, 404);

  const next: TenantPlan = {
    ...existing,
    ...(result.patch.monthlyPriceMinor !== undefined
      ? { monthlyPriceMinor: result.patch.monthlyPriceMinor }
      : {}),
    limits: { ...existing.limits, ...(result.patch.limits ?? {}) },
  };
  const overrides = current.some((p) => p.id === planId && p !== existing)
    ? current // plan already carried an override
    : [...current.filter((p) => p.id !== planId), next];

  await services.db
    .collection('platform')
    .doc('config')
    .set({ plans: overrides, updatedAt: Date.now() }, { merge: true });
  await appendPlatformAudit(services, uid, 'plan:update', planId, {
    ...(result.patch.monthlyPriceMinor !== undefined
      ? { monthlyPriceMinor: result.patch.monthlyPriceMinor }
      : {}),
    ...(result.patch.limits ? { limits: result.patch.limits } : {}),
  });
  return json({ ok: true, plan: next });
}
