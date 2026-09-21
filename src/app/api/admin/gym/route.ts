/**
 * POST /api/admin/gym — tenant lifecycle and platform-plan actions.
 *
 * Body: `{ slug, action, planId?, uid? }` where action is one of
 * `suspend | restore | close | set-plan | assign-owner`.
 *
 * These are the platform's kill switches, so three things are deliberate:
 *  - status changes are field updates, never whole-document writes, so an
 *    operator action can never clobber a gym's branding mid-edit;
 *  - every action appends to the platform audit trail with the actor's
 *    *verified* uid;
 *  - `assign-owner` also writes the membership row the security rules treat
 *    as the source of truth for `owner` — a gym whose owner was never
 *    provisioned would otherwise be unadministrable from the owner console.
 */
import { GYM_STATUSES } from '@smartfit/core';
import { appendPlatformAudit, json, requirePlatformAdmin } from '@/lib/admin-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIONS = ['suspend', 'restore', 'close', 'set-plan', 'assign-owner'] as const;
type Action = (typeof ACTIONS)[number];

const STATUS_FOR_ACTION: Record<Exclude<Action, 'set-plan' | 'assign-owner'>, string> = {
  suspend: 'suspended',
  restore: 'active',
  close: 'closed',
};

export async function POST(req: Request): Promise<Response> {
  const auth = await requirePlatformAdmin(req);
  if (auth.error) return auth.error;
  const { services, uid } = auth;

  let body: { slug?: unknown; action?: unknown; planId?: unknown; uid?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const action = typeof body.action === 'string' ? (body.action as Action) : undefined;
  if (!slug) return json({ error: 'A gym slug is required.' }, 400);
  if (!action || !ACTIONS.includes(action)) {
    return json({ error: `action must be one of ${ACTIONS.join(', ')}.` }, 400);
  }

  const gymRef = services.db.doc(`gyms/${slug}`);
  const gymSnap = await gymRef.get();
  if (!gymSnap.exists) {
    return json({ error: `No gym exists at "${slug}".` }, 404);
  }

  const now = Date.now();

  if (action === 'suspend' || action === 'restore' || action === 'close') {
    const status = STATUS_FOR_ACTION[action];
    if (!GYM_STATUSES.includes(status as (typeof GYM_STATUSES)[number])) {
      return json({ error: `Unknown status "${status}".` }, 400);
    }
    await gymRef.update({ status, updatedAt: now });
    await appendPlatformAudit(services, uid, `gym:${action}`, slug, { status });
    return json({ ok: true, slug, status });
  }

  if (action === 'set-plan') {
    const planId = typeof body.planId === 'string' ? body.planId.trim() : '';
    if (!planId) return json({ error: 'A planId is required for set-plan.' }, 400);
    await gymRef.update({ tenantPlanId: planId, updatedAt: now });
    await appendPlatformAudit(services, uid, 'gym:plan', slug, { planId });
    return json({ ok: true, slug, tenantPlanId: planId });
  }

  // assign-owner: the membership document is what the rules get() — without
  // it, "owner" exists only as a string on the gym doc and the console would
  // refuse every write.
  const ownerUid = typeof body.uid === 'string' ? body.uid.trim() : '';
  if (!ownerUid) return json({ error: 'A target uid is required for assign-owner.' }, 400);
  try {
    const user = await services.auth.getUser(ownerUid);
    await gymRef.update({ ownerUid, updatedAt: now });
    await services.db.doc(`gyms/${slug}/members/${ownerUid}`).set(
      {
        role: 'owner',
        status: 'active',
        joinedAt: now,
        checkins: 0,
        ...(user.displayName ? { displayName: user.displayName } : {}),
        ...(user.email ? { email: user.email } : {}),
      },
      { merge: true },
    );
    await appendPlatformAudit(services, uid, 'gym:assign-owner', slug, { ownerUid });
    return json({ ok: true, slug, ownerUid });
  } catch {
    return json({ error: `No account exists for uid "${ownerUid}".` }, 404);
  }
}
