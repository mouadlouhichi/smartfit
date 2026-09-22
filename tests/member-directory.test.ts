import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isGymCustomer, type GymMembership } from '@smartfit/core';
import {
  directoryStats,
  directoryStatus,
  filterDirectory,
  memberInitials,
  memberDate,
} from '../src/lib/member-directory';
import { readTenantSections } from '../src/lib/tenant-reads';
import { demoAdminGyms } from '../src/lib/admin-demo';
import { demoFixture } from '../src/lib/tenant-demo';
const now = Date.parse('2026-09-22T12:00:00Z');
const row = (uid: string, over: Partial<GymMembership> = {}) =>
  ({ uid, role: 'member', status: 'active', joinedAt: now, checkins: 2, ...over }) as GymMembership;
test('three customer records stay visible even if legacy role fields are missing or unclassified', () => {
  const roster = [
    row('a'),
    row('b', { role: undefined }),
    row('c', { role: 'legacy-member' as never }),
    row('owner', { role: 'owner' }),
    row('staff', { role: 'staff' }),
    row('trainer', { role: 'trainer' }),
  ];
  assert.equal(roster.filter(isGymCustomer).length, 3);
  assert.equal(directoryStats(roster, now).total, 3);
  assert.equal(directoryStats(roster, now).unclassified, 2);
  assert.deepEqual(
    filterDirectory(roster, '', 'all', 'name', now).map((m) => m.uid),
    ['a', 'b', 'c'],
  );
});
test('failed invoices or personal-history queries cannot discard the three loaded members', async () => {
  const members = [row('a'), row('b'), row('c')];
  const result = await readTenantSections({
    roster: async () => members,
    invoices: async () => {
      throw new Error('Missing invoice index');
    },
    visits: async () => {
      throw new Error('Missing visits index');
    },
  });
  assert.deepEqual(result.roster, { status: 'fulfilled', value: members });
  assert.equal(result.invoices.status, 'rejected');
  assert.equal(result.visits.status, 'rejected');
});
test('a failed roster remains an explicit error, not a successful empty list', async () => {
  const result = await readTenantSections({
    roster: async () => {
      throw new Error('permission-denied');
    },
    invoices: async () => [],
  });
  assert.equal(result.roster.status, 'rejected');
  assert.deepEqual(result.invoices, { status: 'fulfilled', value: [] });
});
test('section loading isolates synchronous failures as well', async () => {
  const result = await readTenantSections({
    roster: async () => [row('a')],
    broken: () => {
      throw new Error('bad config');
    },
  });
  assert.equal(result.roster.status, 'fulfilled');
  assert.equal(result.broken.status, 'rejected');
});
test('registry and gym demo use the same customer membership count', () => {
  for (const gym of demoAdminGyms()) {
    const fixture = demoFixture(gym.slug);
    if (!fixture) continue;
    assert.equal(gym.memberCount, directoryStats(fixture.roster).total);
  }
  assert.equal(demoAdminGyms().find((g) => g.slug === 'iron-house')!.memberCount, 3);
});
test('search, effective expiry, renewing segment and sorting use the same real rows', () => {
  const members = [
    row('a', { displayName: 'Zara', email: 'zara@test.example', checkins: 20 }),
    row('b', { displayName: 'Amina', expiresAt: now + 86400000 }),
    row('c', { displayName: 'Mina', expiresAt: now - 1 }),
  ];
  assert.equal(directoryStatus(members[2], now), 'expired');
  assert.deepEqual(
    filterDirectory(members, '  zara@test  ', 'all', 'name', now).map((m) => m.uid),
    ['a'],
  );
  assert.deepEqual(
    filterDirectory(members, '', 'renewing', 'name', now).map((m) => m.uid),
    ['b'],
  );
  assert.deepEqual(
    filterDirectory(members, '', 'all', 'visits', now).map((m) => m.uid),
    ['a', 'b', 'c'],
  );
  assert.equal(directoryStats(members, now).active, 2);
});
test('member identities and missing dates format without fake timestamps', () => {
  assert.equal(memberInitials('Amina Rachidi'), 'AR');
  assert.equal(memberInitials('  '), '?');
  assert.equal(memberDate(undefined), '—');
  assert.equal(memberDate(NaN), '—');
});
