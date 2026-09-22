import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveGymRole,
  isActiveGymMembership,
  parseTeamChange,
  validateTeamChange,
  type GymMembership,
} from '../src';
const gym = { ownerUid: 'owner', status: 'active' as const };
const member: GymMembership = {
  uid: 'person',
  role: 'member',
  status: 'active',
  joinedAt: 1,
  checkins: 0,
};
test('gym roles require a live membership, not a tenant claim or ownership metadata alone', () => {
  for (const role of ['gym-owner', 'gym-staff', 'gym-trainer'] as const)
    assert.equal(resolveGymRole('person', role, gym, null), null);
  assert.equal(resolveGymRole('owner', 'member', gym, null), null);
  assert.equal(resolveGymRole('person', 'member', gym, { ...member, role: 'owner' }), null);
  assert.equal(
    resolveGymRole('owner', 'member', gym, { ...member, uid: 'owner', role: 'owner' }),
    'gym-owner',
  );
  assert.equal(resolveGymRole('person', 'member', gym, { ...member, role: 'staff' }), 'gym-staff');
  assert.equal(
    resolveGymRole('person', 'member', gym, { ...member, role: 'trainer' }),
    'gym-trainer',
  );
});
test('frozen, expired, cancelled and suspended grants fail closed', () => {
  for (const status of ['frozen', 'expired', 'cancelled'] as const)
    assert.equal(
      resolveGymRole('person', 'member', gym, { ...member, role: 'staff', status }),
      null,
    );
  for (const expiresAt of [0, 999, 1000, NaN])
    assert.equal(isActiveGymMembership({ ...member, expiresAt }, 1000), false);
  assert.equal(isActiveGymMembership({ ...member, expiresAt: 1001 }, 1000), true);
  for (const status of ['pending', 'suspended', 'closed'] as const)
    assert.equal(
      resolveGymRole('person', 'member', { ...gym, status }, { ...member, role: 'staff' }),
      null,
    );
});
test('team changes require a reason, a valid role and an expected current role', () => {
  assert.throws(() =>
    parseTeamChange({ role: 'owner', expectedRole: 'member', reason: 'Ownership change' }),
  );
  assert.throws(() => parseTeamChange({ role: 'staff', reason: 'New colleague' }));
  assert.throws(() => parseTeamChange({ role: 'staff', expectedRole: 'member', reason: '  ' }));
  assert.deepEqual(
    parseTeamChange({ role: 'staff', expectedRole: 'member', reason: ' New colleague ' }),
    { role: 'staff', expectedRole: 'member', reason: 'New colleague' },
  );
});
test('role policy protects ownership and self, conflicts, inactive grants and assigned people', () => {
  const input = {
    actorUid: 'owner',
    ownerUid: 'owner',
    target: member,
    change: parseTeamChange({ role: 'staff', expectedRole: 'member', reason: 'New colleague' }),
    hasAssignments: false,
  };
  assert.doesNotThrow(() => validateTeamChange(input));
  assert.throws(() => validateTeamChange({ ...input, actorUid: 'person' }));
  assert.throws(() => validateTeamChange({ ...input, ownerUid: 'person' }));
  assert.throws(() => validateTeamChange({ ...input, target: { ...member, role: 'trainer' } }));
  assert.throws(() => validateTeamChange({ ...input, target: { ...member, status: 'expired' } }));
  assert.throws(() => validateTeamChange({ ...input, hasAssignments: true }));
  assert.doesNotThrow(() =>
    validateTeamChange({
      ...input,
      target: { ...member, role: 'staff', status: 'expired' },
      change: parseTeamChange({
        role: 'member',
        expectedRole: 'staff',
        reason: 'Remove inactive staff',
      }),
    }),
  );
});
