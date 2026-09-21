/**
 * POST /api/billing/gym/purchase — a member starts buying a plan online.
 *
 * Body: `{ slug, planId }`, bearer token required.
 *
 * This records a **draft** invoice and nothing else. It deliberately cannot
 * complete a sale: the money changes hands at the desk (cash / CMI terminal /
 * transfer), where staff collect it and the membership is applied. A browser
 * cannot mint a paid invoice — the Firestore rules refuse operator-only writes
 * to `invoices`, and this route writes `status: 'draft'` via the Admin SDK
 * with the amount copied **server-side** from the published plan, never from
 * the request body. A member "buying" online is therefore a request, never a
 * receipt — the same rule `docs/billing.md` sets for SmartFit Pro.
 *
 * The online CMI checkout for memberships stays the documented dormant
 * contract (see billing.md §CMI): when finance delivers the merchant keys,
 * collecting a draft gains a `method: 'cmi'` server path and nothing about
 * this route changes.
 */
import { json, sameOrigin, bearerToken } from '@/lib/admin-server';
import { getAdminServices } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return json({ error: 'Cross-origin requests are not allowed.' }, 403);

  const token = bearerToken(req);
  if (!token) return json({ error: 'Sign in to choose a plan.' }, 401);

  let body: { slug?: unknown; planId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }
  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const planId = typeof body.planId === 'string' ? body.planId.trim() : '';
  if (!slug || !planId) return json({ error: 'A gym and a plan are required.' }, 400);

  try {
    const services = getAdminServices();
    const decoded = await services.auth.verifyIdToken(token);
    const uid = decoded.uid;

    // Must be a member of the gym — a stranger cannot have the gym hold an
    // invoice for them, and the rules would refuse the desk collecting it.
    const membership = await services.db.doc(`gyms/${slug}/members/${uid}`).get();
    if (!membership.exists) {
      return json({ error: 'Join this gym before choosing a plan.' }, 403);
    }

    // The plan must exist and be published — pricing is the gym's decision,
    // and an unpublished plan must not be buyable by guessing its id.
    const planSnap = await services.db.doc(`gyms/${slug}/plans/${planId}`).get();
    if (!planSnap.exists) return json({ error: 'That plan is not available.' }, 404);
    const plan = planSnap.data() as { priceMinor?: number; currency?: string; published?: boolean };
    if (plan.published === false) {
      return json({ error: 'That plan is not available.' }, 404);
    }

    // Idempotent per open request: one pending draft per member+plan. Repeated
    // taps must not stack invoices for the desk to dismiss one by one.
    const open = await services.db
      .collection(`gyms/${slug}/invoices`)
      .where('memberUid', '==', uid)
      .where('status', '==', 'draft')
      .limit(10)
      .get();
    if (open.docs.some((d) => (d.data() as { planId?: string }).planId === planId)) {
      return json({ ok: true, status: 'draft', alreadyRequested: true });
    }

    const now = Date.now();
    const ref = await services.db.collection(`gyms/${slug}/invoices`).add({
      memberUid: uid,
      planId,
      amountMinor: plan.priceMinor ?? 0,
      currency: plan.currency ?? 'MAD',
      status: 'draft',
      issuedAt: now,
      issuedBy: 'self-service',
    });

    return json({ ok: true, id: ref.id, status: 'draft' });
  } catch (err) {
    if ((err as { code?: string })?.code === 'auth/id-token-expired') {
      return json({ error: 'Your sign-in has expired. Sign in again, then retry.' }, 401);
    }
    console.error('[gym-purchase] failed:', err instanceof Error ? err.message : err);
    return json({ error: 'The request could not be recorded. Try again.' }, 500);
  }
}
