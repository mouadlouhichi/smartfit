import { isActiveGymMembership, resolveGymRole } from './team';
import type { GymMembership, GymTenant } from './tenant';
import type { Role } from './rbac';
import type { WorkoutExercise } from './types';
export interface CoachingAssignment {
  id: string;
  gymId: string;
  memberUid: string;
  trainerUid: string;
  memberName: string;
  trainerName: string;
  consent: 'pending' | 'accepted' | 'declined';
  title: string;
  exercises: WorkoutExercise[];
  messages: { id: string; authorUid: string; body: string; at: number }[];
  version: number;
  createdAt: number;
  updatedAt: number;
}
export function activeMembership(member: GymMembership | null, now = Date.now()): boolean {
  return isActiveGymMembership(member, now);
}
export function coachingRole(
  uid: string,
  platformRole: Role,
  gym: Pick<GymTenant, 'ownerUid' | 'status'>,
  membership: GymMembership | null,
): Role | null {
  return resolveGymRole(uid, platformRole, gym, membership);
}

export function canReadCoaching(
  uid: string,
  role: Role,
  assignment: Pick<CoachingAssignment, 'memberUid' | 'trainerUid'>,
): boolean {
  return (
    role === 'platform-admin' ||
    role === 'gym-owner' ||
    role === 'gym-staff' ||
    (role === 'gym-trainer' && assignment.trainerUid === uid) ||
    assignment.memberUid === uid
  );
}
export function canWriteCoaching(
  uid: string,
  role: Role,
  assignment: Pick<CoachingAssignment, 'memberUid' | 'trainerUid' | 'consent'>,
): boolean {
  return (
    assignment.consent === 'accepted' &&
    (assignment.memberUid === uid ||
      (role === 'gym-trainer' && assignment.trainerUid === uid) ||
      role === 'gym-owner' ||
      role === 'platform-admin')
  );
}
