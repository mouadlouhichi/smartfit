/**
 * POST /api/admin/application — review a "list your gym" request.
 *
 * Body: `{ appId, decision: 'approve' | 'reject', slug?, reason? }`.
 *
 * ## What approving does, in order
 *
 *  1. Resolve the slug: the admin's override, else the applicant's request,
 *     else a suggestion from the gym name. Validated and uniqueness-checked —
 *     a tenant document id *is* its subdomain, so this is the moment
 *     uniqueness is guaranteed (Firestore refuses the second doc with the
 *     same id, and we check first for a clean error).
 *  2. Create `gyms/{slug}` with `status: 'trial'` and the Starter plan.
 *  3. If the applicant's email matches an account, write their `owner`
 *     membership row — the doc the rules treat as authoritative. When it
 *     does not, the gym is still provisioned and the admin is told to assign
 *     an owner once the applicant signs up (the queue must not be blocked on
 *     an account that may be created tomorrow).
 *  4. Mark the application decided and audit the whole thing.
 *
 * Rejecting records the reason — the applicant sees it, so it stays factual.
 */
import { isValidSlug, slugify } from '@smartfit/core';
import {
  appendPlatformAudit,
  applicationsCollection,
  json,
  requirePlatformAdmin,
} from '@/lib/admin-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const auth = await requirePlatformAdmin(req);
  if (auth.error) return auth.error;
  const { services, uid } = auth;

  let body: { appId?: unknown; decision?: unknown; slug?: unknown; reason?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  const appId = typeof body.appId === 'string' ? body.appId.trim() : '';
  const decision = body.decision === 'approve' || body.decision === 'reject' ? body.decision : null;
  if (!appId) return json({ error: 'An appId is required.' }, 400);
  if (!decision) return json({ error: 'decision must be "approve" or "reject".' }, 400);

  const appRef = applicationsCollection(services).doc(appId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) return json({ error: 'That application no longer exists.' }, 404);

  const application = appSnap.data() as {
    gymName: string;
    slug?: string;
    email: string;
    status: string;
  };
  if (application.status !== 'pending') {
    return json({ error: `That application was already ${application.status}.` }, 409);
  }

  const now = Date.now();
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';

  if (decision === 'reject') {
    await appRef.update({
      status: 'rejected',
      decidedAt: now,
      decidedBy: uid,
      ...(reason ? { reason } : {}),
    });
    await appendPlatformAudit(services, uid, 'application:reject', appId, {
      gymName: application.gymName,
      ...(reason ? { reason } : {}),
    });
    return json({ ok: true, appId, status: 'rejected' });
  }

  // ── Approve: resolve and claim the slug ──────────────────────────────────
  // An explicit choice (the admin's override or the applicant's request) must
  // be free or the approve fails loudly — silently renaming someone's picked
  // address is how a gym prints the wrong URL on its flyers. A *generated*
  // slug (name only) may disambiguate with a numeric suffix.
  const exists = async (candidate: string) =>
    (await services.db.doc(`gyms/${candidate}`).get()).exists;
  const override = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  const explicit = override || (application.slug ?? '');
  let slug = '';

  if (explicit) {
    if (!isValidSlug(explicit)) {
      return json(
        {
          error: `"${explicit}" cannot be a gym address (reserved words and punctuation are not allowed).`,
        },
        400,
      );
    }
    if (await exists(explicit)) {
      return json({ error: `The address "${explicit}" is already taken. Pick another.` }, 409);
    }
    slug = explicit;
  } else {
    const base = slugify(application.gymName);
    let candidate = base;
    for (let i = 2; i <= 50; i++) {
      if (isValidSlug(candidate) && !(await exists(candidate))) {
        slug = candidate;
        break;
      }
      candidate = `${base}-${i}`;
    }
    if (!slug) {
      return json(
        { error: 'No free address could be derived from that gym name. Provide a slug.' },
        409,
      );
    }
  }

  // Resolve the owner *before* creating anything, so a lookup failure cannot
  // leave a half-provisioned tenant behind.
  let ownerUid = '';
  let ownerNote: string | undefined;
  const owner = await services.auth.getUserByEmail(application.email).catch(() => null);
  if (owner) ownerUid = owner.uid;
  else {
    ownerNote =
      'No account exists for the applicant email yet — assign an owner from the gym page once they sign up.';
  }

  await services.db.doc(`gyms/${slug}`).set({
    slug,
    name: application.gymName,
    subdomain: slug,
    status: 'trial',
    tenantPlanId: 'starter',
    ownerUid,
    createdAt: now,
    updatedAt: now,
    contact: { email: application.email },
  });
  if (ownerUid) {
    await services.db.doc(`gyms/${slug}/members/${ownerUid}`).set({
      role: 'owner',
      status: 'active',
      joinedAt: now,
      checkins: 0,
      ...(owner?.displayName ? { displayName: owner.displayName } : {}),
      email: application.email,
    });
  }

  await appRef.update({
    status: 'approved',
    decidedAt: now,
    decidedBy: uid,
    provisionedSlug: slug,
  });
  await appendPlatformAudit(services, uid, 'application:approve', appId, {
    gymName: application.gymName,
    slug,
    ownerUid: ownerUid || null,
  });

  return json({ ok: true, appId, status: 'approved', slug, ownerNote });
}
