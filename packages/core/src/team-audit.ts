import { isActiveGymMembership } from './team';
import type { GymMembership } from './tenant';

export interface AccessAuditMember {
  /** Firestore document ID, not the untrusted uid mirror in its data. */
  id: string;
  data: Record<string, unknown>;
}
export interface AccessAuditFinding {
  gymId: string;
  memberId?: string;
  severity: 'error' | 'warning';
  code:
    | 'invalid-gym-status'
    | 'invalid-owner-id'
    | 'missing-owner-membership'
    | 'owner-role-mismatch'
    | 'inactive-owner'
    | 'extra-owner-role'
    | 'missing-uid-mirror'
    | 'mismatched-uid-mirror'
    | 'inactive-team-role'
    | 'invalid-role'
    | 'invalid-status'
    | 'invalid-expiry'
    | 'incomplete-members';
}
/** Firebase-backed account IDs must also be safe single Firestore path segments. */
export function isMembershipDocumentId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    !/[\/\u0000-\u001f\u007f]/u.test(value) &&
    !['.', '..'].includes(value) &&
    !/^__.*__$/u.test(value)
  );
}
/** Read-only deployment preflight: identify problems, never infer or repair ownership. */
export function auditGymAccess(
  gymId: string,
  gym: Record<string, unknown>,
  members: AccessAuditMember[],
  { complete = true, now = Date.now() } = {},
): AccessAuditFinding[] {
  const findings: AccessAuditFinding[] = [];
  const includes = (values: string[], value: unknown) =>
    typeof value === 'string' && values.includes(value);
  const live = includes(['active', 'trial', 'past_due'], gym.status);
  const ownerSeverity = live ? 'error' : 'warning';
  const add = (
    code: AccessAuditFinding['code'],
    severity: AccessAuditFinding['severity'],
    memberId?: string,
  ) => findings.push({ gymId, ...(memberId ? { memberId } : {}), severity, code });
  if (!complete) add('incomplete-members', 'error');
  if (!includes(['pending', 'trial', 'active', 'past_due', 'suspended', 'closed'], gym.status))
    add('invalid-gym-status', 'error');
  if (!isMembershipDocumentId(gym.ownerUid)) add('invalid-owner-id', ownerSeverity);
  else {
    const owner = members.find((member) => member.id === gym.ownerUid);
    if (!owner) {
      if (complete) add('missing-owner-membership', ownerSeverity, gym.ownerUid);
    } else {
      if (owner.data.role !== 'owner') add('owner-role-mismatch', ownerSeverity, owner.id);
      if (!isActiveGymMembership(owner.data as unknown as GymMembership, now))
        add('inactive-owner', ownerSeverity, owner.id);
    }
  }
  for (const { id, data } of members) {
    const privileged = includes(['owner', 'staff', 'trainer'], data.role);
    if (!includes(['owner', 'staff', 'trainer', 'member'], data.role))
      add('invalid-role', 'error', id);
    if (!includes(['active', 'trial', 'frozen', 'expired', 'cancelled'], data.status))
      add('invalid-status', 'error', id);
    if (
      data.expiresAt !== undefined &&
      (typeof data.expiresAt !== 'number' ||
        !Number.isFinite(data.expiresAt) ||
        data.expiresAt < 0 ||
        data.expiresAt > 4102444800000)
    )
      add('invalid-expiry', 'error', id);
    if (data.role === 'owner' && id !== gym.ownerUid) add('extra-owner-role', 'error', id);
    if (data.uid === undefined) add('missing-uid-mirror', privileged ? 'error' : 'warning', id);
    else if (data.uid !== id) add('mismatched-uid-mirror', privileged ? 'error' : 'warning', id);
    if (
      privileged &&
      id !== gym.ownerUid &&
      !isActiveGymMembership(data as unknown as GymMembership, now)
    )
      add('inactive-team-role', 'warning', id);
  }
  return findings;
}
