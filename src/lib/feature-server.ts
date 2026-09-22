import 'server-only';
import { readJsonObject } from './request-body';
import { FeatureError, toRole, type Role } from '@smartfit/core';
import { bearerToken, json, sameOrigin } from './admin-server';
import type { Transaction } from 'firebase-admin/firestore';
import { deletionJobPath, getAdminServices, type AdminServices } from './firebase/admin';

export interface FeatureUser {
  uid: string;
  role: Role;
  services: AdminServices;
}
export async function featureUser(req: Request): Promise<FeatureUser> {
  if (!sameOrigin(req)) throw new FeatureError('Cross-origin request refused.', 403);
  const token = bearerToken(req);
  if (!token) throw new FeatureError('Sign in to continue.', 401);
  const services = getAdminServices();
  let actor: FeatureUser;
  try {
    const decoded = await services.auth.verifyIdToken(token, true);
    // Fresh claims ensure a revoked editor/support grant cannot keep working with an old token.
    const account = await services.auth.getUser(decoded.uid);
    if (account.disabled) throw new Error();
    const claim = account.customClaims?.sfRole;
    const role = ['platform-admin', 'content-manager', 'support-agent'].includes(claim)
      ? toRole(claim)
      : 'member';
    actor = { uid: decoded.uid, role, services };
  } catch {
    throw new FeatureError('Your session has expired. Sign in again.', 401);
  }
  await activeFeatureAccounts(actor, [actor.uid]);
  return actor;
}
export async function featureBody(req: Request) {
  return readJsonObject(req);
}
export async function featureResponse(fn: () => Promise<unknown>) {
  try {
    return json(await fn());
  } catch (e) {
    if (e instanceof FeatureError) return json({ error: e.message }, e.status);
    console.error('[features]', e instanceof Error ? e.message : 'Service error');
    return json(
      { error: 'The service is unavailable. Your changes were not confirmed; please retry.' },
      503,
    );
  }
}
export function recordId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value))
    throw new FeatureError('Invalid record ID.');
  return value;
}

/** Read in the same transaction as writes so deletion cannot race new personal records. */
export async function activeFeatureAccounts(actor: FeatureUser, uids: string[], tx?: Transaction) {
  for (const uid of new Set(uids)) {
    const ref = actor.services.db.doc(deletionJobPath(uid));
    const snapshot = await (tx ? tx.get(ref) : ref.get());
    if (snapshot.exists)
      throw new FeatureError(
        'Account deletion is in progress or completed. No new records can be created.',
        409,
      );
  }
}
