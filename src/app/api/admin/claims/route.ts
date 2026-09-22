/** Platform grants are managed by a freshly verified admin, never by a browser flag. */
import { FeatureError } from '@smartfit/core';
import { getAdminServices } from '@/lib/firebase/admin';
import { bearerToken, json, requirePlatformAdmin, sameOrigin } from '@/lib/admin-server';
import { featureBody } from '@/lib/feature-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const GRANTABLE = ['platform-admin', 'content-manager', 'support-agent'] as const;
export async function GET(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'Cross-origin request refused.' }, 403);
  const token = bearerToken(req);
  if (!token) return json({ platformAdmin: false });
  try {
    const services = getAdminServices();
    const decoded = await services.auth.verifyIdToken(token, true);
    const account = await services.auth.getUser(decoded.uid);
    const role = account.disabled ? 'member' : (account.customClaims?.sfRole ?? 'member');
    return json({ platformAdmin: role === 'platform-admin', role, uid: decoded.uid });
  } catch {
    return json({ platformAdmin: false });
  }
}
/** `role` selects a specialist grant. Legacy `{uid,grant}` still grants/revokes admin. */
export async function POST(req: Request) {
  const auth = await requirePlatformAdmin(req);
  if (auth.error) return auth.error;
  const { services, uid: actorUid } = auth;
  let body: Record<string, unknown>;
  try {
    body = await featureBody(req);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : 'Invalid request.' },
      e instanceof FeatureError ? e.status : 400,
    );
  }
  const targetUid = typeof body.uid === 'string' ? body.uid.trim() : '';
  if (!targetUid || targetUid.length > 128)
    return json({ error: 'A valid target UID is required.' }, 400);
  if (typeof body.grant !== 'boolean') return json({ error: '`grant` must be a boolean.' }, 400);
  const role = body.role ?? 'platform-admin';
  if (!GRANTABLE.includes(role as (typeof GRANTABLE)[number]))
    return json({ error: 'Unknown platform role. Gym roles are managed inside the gym.' }, 400);
  if (targetUid === actorUid && (!body.grant || role !== 'platform-admin'))
    return json({ error: 'You cannot remove or downgrade your own admin access.' }, 409);
  let account;
  try {
    account = await services.auth.getUser(targetUid);
  } catch {
    return json({ error: 'No account exists for that UID.' }, 404);
  }
  const claims = { ...account.customClaims };
  if (body.grant) claims.sfRole = role;
  else delete claims.sfRole;
  try {
    await services.auth.setCustomUserClaims(targetUid, claims);
    // Revocation cuts refresh-token access; server routes also reread fresh claims.
    if (
      !body.grant ||
      (account.customClaims?.sfRole === 'platform-admin' && role !== 'platform-admin')
    )
      await services.auth.revokeRefreshTokens(targetUid);
  } catch (e) {
    console.error('[admin-claims] update failed', e instanceof Error ? e.message : 'unknown');
    return json(
      { error: 'Role update could not be confirmed. Check the account before retrying.' },
      503,
    );
  }
  try {
    await services.db
      .collection('platform')
      .doc('audit')
      .collection('entries')
      .add({
        actorUid,
        action: body.grant ? 'role:grant' : 'role:revoke',
        target: targetUid,
        at: Date.now(),
        meta: { value: body.grant ? role : null, previous: account.customClaims?.sfRole ?? null },
      });
  } catch (e) {
    console.error('[admin-claims] audit failed', e instanceof Error ? e.message : 'unknown');
  }
  return json({
    ok: true,
    uid: targetUid,
    role: body.grant ? role : 'member',
    platformAdmin: body.grant && role === 'platform-admin',
    revocationNote: !body.grant
      ? 'Access was revoked. Ask the account holder to sign in again. Existing direct Firestore tokens can retain old claims until expiry (up to one hour).'
      : undefined,
  });
}
