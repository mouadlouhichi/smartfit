import 'server-only';
import {
  FeatureError,
  isValidSlug,
  parseTeamChange,
  resolveGymRole,
  validateTeamChange,
  type GymMembership,
  type GymTenant,
} from '@smartfit/core';
import { activeFeatureAccounts, recordId, type FeatureUser } from './feature-server';
/** Single audited write path, shared by the team console and coaching workspace. */
export async function changeTeamRole(actor: FeatureUser, body: Record<string, unknown>) {
  if (typeof body.gym !== 'string' || !isValidSlug(body.gym))
    throw new FeatureError('Invalid gym.');
  const change = parseTeamChange(body);
  const uid = recordId(body.uid);
  const gymRef = actor.services.db.doc(`gyms/${body.gym}`);
  return actor.services.db.runTransaction(async (tx) => {
    const [gymSnap, actorSnap, targetSnap] = await Promise.all([
      tx.get(gymRef),
      tx.get(gymRef.collection('members').doc(actor.uid)),
      tx.get(gymRef.collection('members').doc(uid)),
    ]);
    if (!gymSnap.exists) throw new FeatureError('Gym not found.', 404);
    const gym = gymSnap.data() as GymTenant;
    if (!['active', 'trial', 'past_due'].includes(gym.status))
      throw new FeatureError(
        'Team changes are unavailable while this gym is suspended or closed.',
        403,
      );
    const role = resolveGymRole(
      actor.uid,
      actor.role,
      gym,
      actorSnap.exists ? (actorSnap.data() as GymMembership) : null,
    );
    if (role !== 'platform-admin' && role !== 'gym-owner')
      throw new FeatureError(
        'Only this gym’s owner or a platform administrator can manage team access.',
        403,
      );
    if (!targetSnap.exists) throw new FeatureError('Choose an existing member of this gym.', 404);
    const target = { ...targetSnap.data(), uid } as GymMembership;
    const [assigned, ownAssignment] = await Promise.all([
      tx.get(gymRef.collection('coaching').where('trainerUid', '==', uid).limit(1)),
      tx.get(gymRef.collection('coaching').doc(uid)),
    ]);
    validateTeamChange({
      actorUid: actor.uid,
      ownerUid: gym.ownerUid,
      target,
      change,
      hasAssignments: !assigned.empty || ownAssignment.exists,
    });
    await activeFeatureAccounts(actor, [actor.uid, uid], tx);
    if (target.role === change.role) return { ok: true, unchanged: true, role: change.role };
    const at = Date.now();
    tx.update(targetSnap.ref, {
      uid,
      role: change.role,
      roleChangedAt: at,
      roleChangedBy: actor.uid,
    });
    tx.create(gymRef.collection('audit').doc(), {
      actorUid: actor.uid,
      action: 'staff:role:change',
      target: uid,
      at,
      meta: { previousRole: target.role, role: change.role, reason: change.reason },
    });
    return { ok: true, role: change.role, changedAt: at };
  });
}
