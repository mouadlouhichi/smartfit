import { FeatureError, objectValue, textValue } from './content';
import { roleFromGymRole, type GymRole, type Role } from './rbac';
import type { GymMembership, GymTenant } from './tenant';

export const ASSIGNABLE_GYM_ROLES = ['member', 'trainer', 'staff'] as const;
export type AssignableGymRole = (typeof ASSIGNABLE_GYM_ROLES)[number];
export const TEAM_ROLE_DESCRIPTIONS = {
  member: 'Personal bookings and membership only. No team or gym operations access.',
  trainer:
    'Assigned coaching only; member consent is required before changing routines or feedback. No roster or financial access.',
  staff:
    'Front-desk roster, attendance, classes and payment recording. Cannot manage team roles, branding or platform billing.',
  owner:
    'Gym branding, membership pricing, team access and gym operations. Ownership transfer requires a separate platform procedure.',
} as const;
export function isActiveGymMembership(
  member: GymMembership | null | undefined,
  now = Date.now(),
): boolean {
  return (
    !!member &&
    ['active', 'trial'].includes(member.status) &&
    (member.expiresAt === undefined ||
      (Number.isFinite(member.expiresAt) && member.expiresAt > now))
  );
}
/** The current membership is the authority; gym ownership metadata must agree. */
export function resolveGymRole(
  uid: string,
  platformRole: Role,
  gym: Pick<GymTenant, 'ownerUid' | 'status'>,
  member: GymMembership | null,
  now = Date.now(),
): Role | null {
  if (platformRole === 'platform-admin') return platformRole;
  if (!['active', 'trial', 'past_due'].includes(gym.status) || !isActiveGymMembership(member, now))
    return null;
  if (member?.role === 'owner' && gym.ownerUid !== uid) return null;
  return roleFromGymRole(member?.role);
}
export function parseTeamChange(value: unknown) {
  const body = objectValue(value);
  if (!ASSIGNABLE_GYM_ROLES.includes(body.role as AssignableGymRole))
    throw new FeatureError('Choose member, trainer or staff.');
  if (!['owner', 'staff', 'trainer', 'member'].includes(String(body.expectedRole)))
    throw new FeatureError('Reload the team before changing access.', 409);
  return {
    role: body.role as AssignableGymRole,
    expectedRole: body.expectedRole as GymRole,
    reason: textValue(body.reason, 'Change reason', 8, 500),
  };
}
export function validateTeamChange({
  actorUid,
  ownerUid,
  target,
  change,
  hasAssignments,
  now = Date.now(),
}: {
  actorUid: string;
  ownerUid: string;
  target: GymMembership;
  change: ReturnType<typeof parseTeamChange>;
  hasAssignments: boolean;
  now?: number;
}) {
  if (target.uid === ownerUid || target.role === 'owner' || target.uid === actorUid)
    throw new FeatureError('Owner access and your own role cannot be changed here.', 403);
  if (target.role !== change.expectedRole)
    throw new FeatureError(
      'This role changed in another session. Reload the team and review it again.',
      409,
    );
  if (target.role === change.role) return;
  if (change.role !== 'member' && !isActiveGymMembership(target, now))
    throw new FeatureError('Activate or renew this membership before granting team access.', 409);
  if (hasAssignments)
    throw new FeatureError(
      'Remove or reassign this person’s coaching assignments before changing their role.',
      409,
    );
}
