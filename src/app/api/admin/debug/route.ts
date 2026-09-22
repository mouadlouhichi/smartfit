/**
 * GET /api/admin/debug — why did /api/admin/data fail?
 *
 * Platform-admin-only diagnostics for server-side Firebase trouble. Probes
 * every read the console's data route makes, with timings and the full error
 * message + stack of the first failure, plus a redacted summary of how the
 * Admin SDK is configured (presence booleans only — never values).
 *
 * The admin console calls this automatically when its data load fails and
 * renders the result in the error card, so an operator sees the cause without
 * opening Vercel's function logs. Keep it read-only: it exists to explain
 * failures, not to add new ones.
 */
import { getAdminServices } from '@/lib/firebase/admin';
import { bearerToken, json, sameOrigin } from '@/lib/admin-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Presence only — values of credential env vars must never reach a response. */
function envPresence() {
  return {
    FIREBASE_ADMIN_SERVICE_ACCOUNT: Boolean(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT?.trim()),
    FIREBASE_ADMIN_CLIENT_EMAIL: Boolean(process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim()),
    FIREBASE_ADMIN_PRIVATE_KEY: Boolean(process.env.FIREBASE_ADMIN_PRIVATE_KEY?.trim()),
    FIREBASE_ADMIN_PROJECT_ID: Boolean(process.env.FIREBASE_ADMIN_PROJECT_ID?.trim()),
    GOOGLE_CLOUD_PROJECT: Boolean(process.env.GOOGLE_CLOUD_PROJECT?.trim()),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null,
  };
}

/** Which credential path the Admin SDK initialization would take. */
function configMode(): string {
  if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT?.trim()) return 'service-account JSON';
  if (
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim() &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY?.trim()
  )
    return 'client email + private key';
  if (
    process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim()
  )
    return 'project id only — NO credentials (reads will fail with "Could not load the default credentials")';
  return 'nothing configured';
}

export async function GET(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return json({ error: 'Cross-origin requests are not allowed.' }, 403);

  const token = bearerToken(req);
  if (!token) return json({ error: 'A signed-in account is required.' }, 401);

  // No try/catch around the whole route: every probe reports its own failure.
  const probes: Array<{ label: string; ok: boolean; ms: number; error?: string; note?: string }> =
    [];
  let firstStack: string | undefined;

  const probe = async (label: string, fn: () => Promise<unknown>) => {
    const started = Date.now();
    try {
      await fn();
      probes.push({ label, ok: true, ms: Date.now() - started });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      probes.push({ label, ok: false, ms: Date.now() - started, error: message });
      if (!firstStack && err instanceof Error && err.stack) firstStack = err.stack;
    }
  };

  // 1) The caller's token — confirms Auth + the claim the guard checked.
  let caller: { uid: string; sfRole: unknown } | null = null;
  await probe('verify caller token (Auth + claim)', async () => {
    const services = getAdminServices();
    const decoded = await services.auth.verifyIdToken(token);
    caller = { uid: decoded.uid, sfRole: decoded.sfRole ?? null };
    if (decoded.sfRole !== 'platform-admin') {
      throw new Error(`this account's sfRole is ${JSON.stringify(decoded.sfRole ?? null)}`);
    }
  });

  // 2) Each Firestore read the data route performs, in its order.
  await probe('Admin SDK initialize', () => Promise.resolve(getAdminServices()));
  await probe('read gyms (collection, limit 1)', async () => {
    const { db } = getAdminServices();
    const snap = await db.collection('gyms').limit(1).get();
    if (snap.empty) throw new Error('the gyms collection is empty or does not exist');
  });
  await probe('read one gym subcollection (members, limit 1)', async () => {
    const { db } = getAdminServices();
    const gyms = await db.collection('gyms').limit(1).get();
    if (gyms.empty) throw new Error('no gym to probe');
    await db.collection(`gyms/${gyms.docs[0].id}/members`).limit(1).get();
  });
  await probe('read platform/config', async () => {
    const { db } = getAdminServices();
    await db.collection('platform').doc('config').get();
  });
  await probe('read platform applications (orderBy createdAt)', async () => {
    const { db } = getAdminServices();
    await db
      .collection('platform')
      .doc('applications')
      .collection('entries')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
  });
  await probe('read platform invoices (orderBy paidAt)', async () => {
    const { db } = getAdminServices();
    await db
      .collection('platform')
      .doc('invoices')
      .collection('entries')
      .orderBy('paidAt', 'desc')
      .limit(1)
      .get();
  });
  await probe('read platform audit (orderBy at)', async () => {
    const { db } = getAdminServices();
    await db
      .collection('platform')
      .doc('audit')
      .collection('entries')
      .orderBy('at', 'desc')
      .limit(1)
      .get();
  });

  const failed = probes.filter((p) => !p.ok);
  return json({
    ok: failed.length === 0,
    config: { mode: configMode(), env: envPresence() },
    caller,
    probes,
    ...(firstStack ? { firstStack } : {}),
    hint:
      failed.length > 0 && failed[0].error?.includes('default credentials')
        ? 'The Admin SDK has no credentials on this deployment: set FIREBASE_ADMIN_SERVICE_ACCOUNT (the whole service-account JSON) or FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY in Vercel, then redeploy.'
        : undefined,
  });
}
