/**
 * POST /api/admin/gym — tenant lifecycle, provisioning, and plan actions.
 *
 * Body: `{ slug, action, planId?, uid? }` where action is one of
 * `suspend | restore | close | set-plan | assign-owner`, or
 * `{ action: 'create', name, slug?, city?, ownerEmail?, planId?,
 * accentColor?, tagline?, phone?, instagram? }` to set up a gym directly
 * (the application queue is for applicants; this is for gyms the platform
 * brings itself).
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
import { GYM_STATUSES, isValidSlug, slugify } from '@smartfit/core';
import {
  appendPlatformAudit,
  json,
  loadEffectivePlans,
  requirePlatformAdmin,
} from '@/lib/admin-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIONS = ['create', 'suspend', 'restore', 'close', 'set-plan', 'assign-owner'] as const;
type Action = (typeof ACTIONS)[number];

const STATUS_FOR_ACTION: Record<Exclude<Action, 'set-plan' | 'assign-owner' | 'create'>, string> = {
  suspend: 'suspended',
  restore: 'active',
  close: 'closed',
};

/** Trimmed string or '' — every optional field comes through this. */
const str = (v: unknown, max = 200): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

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
  if (!action || !ACTIONS.includes(action)) {
    return json({ error: `action must be one of ${ACTIONS.join(', ')}.` }, 400);
  }

  // ── create: no gym exists yet, so it branches before every other action,
  //    which all operate on an existing tenant.
  if (action === 'create') return createGym(body, services, uid);

  if (!slug) return json({ error: 'A gym slug is required.' }, 400);

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
  // refuse every write. The target may be a uid or an email; a uid wins when
  // the string could be both.
  const target = typeof body.uid === 'string' ? body.uid.trim() : '';
  if (!target) return json({ error: 'An owner uid or email is required for assign-owner.' }, 400);
  try {
    const user = await services.auth
      .getUser(target)
      .catch(() => (target.includes('@') ? services.auth.getUserByEmail(target) : null));
    if (!user) throw new Error('no-user');
    const ownerUid = user.uid;
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
    return json({ error: `No account exists for "${target}" (tried as uid and as email).` }, 404);
  }
}

// ── create ───────────────────────────────────────────────────────────────────

/** The `services` half of a passed platform-admin guard. */
type AdminServices =
  Awaited<ReturnType<typeof requirePlatformAdmin>> extends infer R
    ? R extends { services: infer S }
      ? S
      : never
    : never;

/**
 * Provision a tenant directly — same shape as approving an application, minus
 * the application. The slug rules are identical too: an explicit choice must
 * be free (silently renaming a picked address is how a gym prints the wrong
 * URL on its flyers) while a generated one may disambiguate with a suffix.
 */
async function createGym(
  body: Record<string, unknown>,
  services: AdminServices,
  actorUid: string,
): Promise<Response> {
  const name = str(body.name, 60);
  if (name.length < 2) return json({ error: 'A gym name (2+ characters) is required.' }, 400);

  const exists = async (candidate: string) =>
    (await services.db.doc(`gyms/${candidate}`).get()).exists;

  const override = str(body.slug).toLowerCase();
  let slug = '';
  if (override) {
    if (!isValidSlug(override)) {
      return json(
        {
          error: `"${override}" cannot be a gym address (reserved words and punctuation are not allowed).`,
        },
        400,
      );
    }
    if (await exists(override)) {
      return json({ error: `The address "${override}" is already taken. Pick another.` }, 409);
    }
    slug = override;
  } else {
    const base = slugify(name);
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
        { error: 'No free address could be derived from that name. Provide a slug.' },
        409,
      );
    }
  }

  const planId = str(body.planId, 40) || 'starter';
  const plans = await loadEffectivePlans(services);
  if (!plans.some((p) => p.id === planId)) {
    return json({ error: `Unknown plan "${planId}".` }, 400);
  }

  // Resolve the owner before creating anything, so a lookup failure cannot
  // leave a half-provisioned tenant behind. No owner yet is fine — the gym
  // is administrable from here and the admin is told how to finish setup.
  const ownerEmail = str(body.ownerEmail).toLowerCase();
  const owner = ownerEmail
    ? await services.auth.getUserByEmail(ownerEmail).catch(() => null)
    : null;
  const ownerNote = !ownerEmail
    ? undefined
    : !owner
      ? 'No account exists for that email yet — assign an owner from the gym page once they sign up.'
      : undefined;

  const now = Date.now();
  const city = str(body.city, 60);
  const tagline = str(body.tagline, 120);
  const phone = str(body.phone, 30);
  const instagram = str(body.instagram, 40);
  const accent = str(body.accentColor, 7);
  const accentColor = /^#[0-9a-fA-F]{6}$/.test(accent) ? accent.toLowerCase() : undefined;

  await services.db.doc(`gyms/${slug}`).set({
    slug,
    name,
    subdomain: slug,
    status: 'trial',
    tenantPlanId: planId,
    ownerUid: owner?.uid ?? '',
    createdAt: now,
    updatedAt: now,
    ...(accentColor || tagline
      ? { branding: { ...(accentColor ? { accentColor } : {}), ...(tagline ? { tagline } : {}) } }
      : {}),
    ...(city ? { location: { city } } : {}),
    contact: {
      ...(ownerEmail ? { email: ownerEmail } : {}),
      ...(phone ? { phone } : {}),
      ...(instagram ? { instagram } : {}),
    },
  });
  if (owner) {
    await services.db.doc(`gyms/${slug}/members/${owner.uid}`).set({
      role: 'owner',
      status: 'active',
      joinedAt: now,
      checkins: 0,
      ...(owner.displayName ? { displayName: owner.displayName } : {}),
      ...(owner.email ? { email: owner.email } : {}),
    });
  }
  await appendPlatformAudit(services, actorUid, 'gym:create', slug, {
    name,
    planId,
    ownerUid: owner?.uid ?? null,
  });
  return json({ ok: true, slug, status: 'trial', tenantPlanId: planId, ownerNote });
}
