/**
 * Platform-role claim management.
 *
 * The `sfRole` custom claim is what makes an account a platform operator, and
 * Firestore rules read it as `request.auth.token.sfRole`. Only a verified
 * platform admin may grant or revoke it — otherwise the first user to reach
 * this route would make themselves one.
 *
 * ## The staleness problem this route has to live with
 *
 * Custom claims are baked into the ID token, so a grant does not take effect
 * until the client refreshes (up to an hour by default). Two consequences,
 * both handled deliberately:
 *
 *  - The client calls `getIdToken(true)` after a successful grant, so the
 *    person who was just promoted is not left staring at a locked admin panel.
 *  - This route re-reads the claim from the *decoded token* rather than
 *    trusting a cached client-side flag, and every privileged action elsewhere
 *    re-verifies server-side.
 *
 * Revocation is the sharp edge: clearing a claim does not invalidate tokens
 * already issued. The response says so out loud, and the admin UI surfaces it.
 */
import { PLATFORM_ADMIN_CLAIM_VALUE, PLATFORM_ROLE_CLAIM } from '@smartfit/core/rbac';
import { getAdminServices } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const host = req.headers.get('host');
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function bearerToken(req: Request): string | null {
  const value = req.headers.get('authorization');
  if (!value?.startsWith('Bearer ')) return null;
  const token = value.slice('Bearer '.length).trim();
  return token || null;
}

/** Resolve the caller, or a response explaining why they are not allowed. */
async function requirePlatformAdmin(req: Request) {
  if (!sameOrigin(req))
    return { error: json({ error: 'Cross-origin requests are not allowed.' }, 403) };

  const token = bearerToken(req);
  if (!token) return { error: json({ error: 'A signed-in account is required.' }, 401) };

  let services: ReturnType<typeof getAdminServices>;
  try {
    services = getAdminServices();
  } catch (err) {
    console.error(
      '[admin-claims] Admin SDK unavailable:',
      err instanceof Error ? err.message : err,
    );
    return {
      error: json(
        { error: 'Admin services are not configured on this deployment.', retryable: false },
        503,
      ),
    };
  }

  try {
    const decoded = await services.auth.verifyIdToken(token);
    // Read from the decoded token, not from any client-supplied flag.
    if (decoded[PLATFORM_ROLE_CLAIM] !== PLATFORM_ADMIN_CLAIM_VALUE) {
      return { error: json({ error: 'This action requires a platform administrator.' }, 403) };
    }
    return { services, uid: decoded.uid };
  } catch {
    return { error: json({ error: 'Your sign-in has expired. Sign in again, then retry.' }, 401) };
  }
}

/** Append to the platform audit trail. Admin SDK only — clients are denied. */
async function audit(
  services: ReturnType<typeof getAdminServices>,
  actorUid: string,
  action: string,
  target: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await services.db
      .collection('platform')
      .doc('audit')
      .collection('entries')
      .add({
        actorUid,
        action,
        target,
        at: Date.now(),
        ...(meta ? { meta } : {}),
      });
  } catch (err) {
    // A failed audit write must not make the primary action look like it
    // failed, but it must not be silent either.
    console.error('[admin-claims] audit write failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * GET — report the caller's platform role.
 *
 * Lets the admin shell decide whether to render at all without exposing
 * anything to a non-admin beyond "you are not one".
 */
export async function GET(req: Request): Promise<Response> {
  const token = bearerToken(req);
  if (!token) return json({ platformAdmin: false }, 200);

  try {
    const services = getAdminServices();
    const decoded = await services.auth.verifyIdToken(token);
    return json({
      platformAdmin: decoded[PLATFORM_ROLE_CLAIM] === PLATFORM_ADMIN_CLAIM_VALUE,
      uid: decoded.uid,
    });
  } catch {
    return json({ platformAdmin: false }, 200);
  }
}

/**
 * POST — grant or revoke the platform-admin claim.
 *
 * Body: `{ uid: string; grant: boolean }`.
 */
export async function POST(req: Request): Promise<Response> {
  const auth = await requirePlatformAdmin(req);
  if (auth.error) return auth.error;
  const { services, uid: actorUid } = auth;

  let body: { uid?: unknown; grant?: unknown };
  try {
    body = (await req.json()) as { uid?: unknown; grant?: unknown };
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  const targetUid = typeof body.uid === 'string' ? body.uid.trim() : '';
  if (!targetUid) return json({ error: 'A target uid is required.' }, 400);
  if (typeof body.grant !== 'boolean') {
    return json({ error: '`grant` must be a boolean.' }, 400);
  }

  try {
    // Confirm the account exists before touching claims: a typo in a uid would
    // otherwise create a claim on nothing and report success.
    await services.auth.getUser(targetUid);
  } catch {
    return json({ error: `No account exists for uid "${targetUid}".` }, 404);
  }

  try {
    // Read existing claims so granting `sfRole` does not wipe unrelated ones.
    const user = await services.auth.getUser(targetUid);
    const existing = (user.customClaims ?? {}) as Record<string, unknown>;
    if (body.grant) {
      await services.auth.setCustomUserClaims(targetUid, {
        ...existing,
        [PLATFORM_ROLE_CLAIM]: PLATFORM_ADMIN_CLAIM_VALUE,
      });
    } else {
      const next = { ...existing };
      delete next[PLATFORM_ROLE_CLAIM];
      await services.auth.setCustomUserClaims(targetUid, next);
    }
  } catch (err) {
    console.error(
      '[admin-claims] setCustomUserClaims failed:',
      err instanceof Error ? err.message : err,
    );
    return json({ error: 'The role could not be changed. Try again.' }, 500);
  }

  await audit(services, actorUid, body.grant ? 'role:grant' : 'role:revoke', targetUid, {
    claim: PLATFORM_ROLE_CLAIM,
    value: body.grant ? PLATFORM_ADMIN_CLAIM_VALUE : null,
  });

  return json({
    ok: true,
    uid: targetUid,
    platformAdmin: body.grant,
    // Tokens already issued keep the old claim until they expire.
    revocationNote: body.grant
      ? undefined
      : 'Already-issued tokens keep the old role until they expire (up to 1 hour). Sign the account out to cut it off immediately.',
  });
}
