/**
 * GET /api/auth/home — the signed-in account's dedicated home route.
 *
 * The login gateway uses this to send each persona where they work, instead
 * of funneling everyone into the member dashboard:
 *
 *   platform-admin (sfRole claim)  →  /admin
 *   gym owner / gym staff          →  /g/{their gym}/console
 *   member (or anyone else)        →  { home: null } — the client applies
 *                                      the member logic (onboarding or
 *                                      /dashboard)
 *
 * The roster is the source of truth for gym roles — no mirrored claim that
 * could drift. The lookup is a collection-group query over every gym's
 * `members` collection (server-side Admin SDK; browsers cannot run this
 * query, by design).
 *
 * This route never hard-fails a login: any error degrades to `{ home: null }`
 * so the gateway falls back to the member route. A redirect hint is not
 * worth blocking sign-in over.
 */
import { platformHome, resolveGymRole, type GymMembership, type GymTenant } from '@smartfit/core';
import { getAdminServices, type AdminServices } from '@/lib/firebase/admin';
import { bearerToken, json, sameOrigin } from '@/lib/admin-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Owner beats staff beats nothing; ties prefer the lexicographically first slug. */
async function consoleHome(services: AdminServices, uid: string): Promise<{ home: string | null }> {
  const snap = await services.db.collectionGroup('members').where('uid', '==', uid).get();
  const rank = (role: unknown) =>
    role === 'owner' ? 0 : role === 'staff' ? 1 : role === 'trainer' ? 2 : 99;
  const candidates = snap.docs
    .filter(
      (d) =>
        d.id === uid && d.ref.path.split('/')[0] === 'gyms' && d.ref.path.split('/').length === 4,
    )
    .sort(
      (a, b) => rank(a.get('role')) - rank(b.get('role')) || a.ref.path.localeCompare(b.ref.path),
    );
  for (const doc of candidates) {
    if (rank(doc.get('role')) === 99) continue;
    const slug = doc.ref.path.split('/')[1];
    const gym = await services.db.doc(`gyms/${slug}`).get();
    if (!gym.exists) continue;
    const role = resolveGymRole(
      uid,
      'member',
      gym.data() as GymTenant,
      doc.data() as GymMembership,
    );
    if (role === 'gym-owner' || role === 'gym-staff' || role === 'gym-trainer')
      return { home: `/g/${slug}/${role === 'gym-trainer' ? 'coaching' : 'console'}` };
  }
  return { home: null };
}

export async function GET(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return json({ error: 'Cross-origin requests are not allowed.' }, 403);

  const token = bearerToken(req);
  if (!token) return json({ error: 'A signed-in account is required.' }, 401);

  let services: AdminServices;
  try {
    services = getAdminServices();
  } catch (err) {
    console.error('[auth/home] Admin SDK unavailable:', err instanceof Error ? err.message : err);
    return json({ home: null, reason: 'admin-unavailable' });
  }

  try {
    const decoded = await services.auth.verifyIdToken(token, true);
    const account = await services.auth.getUser(decoded.uid);
    if (account.disabled) return json({ home: null, reason: 'disabled' });
    const home = platformHome(account.customClaims?.sfRole);
    if (home) return json({ home });
    const result = await consoleHome(services, decoded.uid).catch((err) => {
      // e.g. a missing collection-group index — degrade, never block login.
      console.error('[auth/home] roster lookup failed:', err instanceof Error ? err.message : err);
      return { home: null as string | null };
    });
    return json(result);
  } catch {
    return json({ home: null, reason: 'token' });
  }
}
