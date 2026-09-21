/**
 * POST /api/admin/payment — record a gym's subscription payment.
 *
 * Body: `{ slug, method, amountMinor?, note? }`.
 *
 * Bank transfer and cash are how most gyms in this market actually pay, so
 * the platform's revenue view is built on *recorded* payments rather than a
 * gateway webhook. The default amount is the gym's current plan price —
 * recording "the usual" should be one click, and a discount is an explicit
 * choice with a note.
 */
import type { GymStatus } from '@smartfit/core';
import { gymStatusAfterPayment } from '@/lib/billing/gym-contract';
import {
  appendPlatformAudit,
  json,
  loadEffectivePlans,
  platformInvoiceCollection,
  requirePlatformAdmin,
} from '@/lib/admin-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const METHODS = ['cash', 'card', 'transfer', 'cmi', 'other'] as const;
type Method = (typeof METHODS)[number];

export async function POST(req: Request): Promise<Response> {
  const auth = await requirePlatformAdmin(req);
  if (auth.error) return auth.error;
  const { services, uid } = auth;

  let body: { slug?: unknown; method?: unknown; amountMinor?: unknown; note?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  if (!slug) return json({ error: 'A gym slug is required.' }, 400);
  const method =
    typeof body.method === 'string' && METHODS.includes(body.method as Method)
      ? (body.method as Method)
      : null;
  if (!method) return json({ error: `method must be one of ${METHODS.join(', ')}.` }, 400);

  const gymSnap = await services.db.doc(`gyms/${slug}`).get();
  if (!gymSnap.exists) return json({ error: `No gym exists at "${slug}".` }, 404);

  const plans = await loadEffectivePlans(services);
  const planId = (gymSnap.data() as { tenantPlanId?: string }).tenantPlanId ?? '';
  const plan = plans.find((p) => p.id === planId);
  const currency = plan?.currency ?? 'MAD';

  let amountMinor: number;
  if (body.amountMinor === undefined || body.amountMinor === null || body.amountMinor === '') {
    if (!plan) return json({ error: 'The gym is on an unknown plan — provide an amount.' }, 400);
    amountMinor = plan.monthlyPriceMinor;
  } else {
    const n = Number(body.amountMinor);
    if (!Number.isInteger(n) || n < 0 || n > 10_000_000) {
      return json({ error: 'amountMinor must be an integer between 0 and 10000000.' }, 400);
    }
    amountMinor = n;
  }

  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : '';
  const paidAt = Date.now();

  const ref = await platformInvoiceCollection(services).add({
    slug,
    amountMinor,
    currency,
    method,
    status: 'paid',
    paidAt,
    recordedBy: uid,
    ...(note ? { note } : {}),
  });

  // Money arriving converts a trial into a paying customer and clears
  // past_due — but never overrides a suspend/close (that stays a human
  // decision; see gymStatusAfterPayment).
  const before = (gymSnap.data() as { status?: GymStatus }).status;
  const after = gymStatusAfterPayment(before ?? 'pending');
  const activated = after !== before;
  if (activated) {
    await services.db.doc(`gyms/${slug}`).update({ status: after, updatedAt: paidAt });
  }

  await appendPlatformAudit(services, uid, 'payment:record', slug, {
    amountMinor,
    method,
    ...(activated ? { activatedFrom: before } : {}),
  });

  return json({
    ok: true,
    id: ref.id,
    amountMinor,
    currency,
    ...(activated ? { status: after } : {}),
  });
}
