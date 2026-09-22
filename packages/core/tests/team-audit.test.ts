import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditGymAccess, isMembershipDocumentId } from '../src';
const gym = { ownerUid: 'owner', status: 'active' };
const row = (id: string, role: string, over: Record<string, unknown> = {}) => ({
  id,
  data: { uid: id, role, status: 'active', ...over },
});
const owner = row('owner', 'owner');
const codes = (rows: ReturnType<typeof row>[], g = gym, complete = true) =>
  auditGymAccess('gym', g, rows, { now: 100, complete }).map((f) => f.code);
test('healthy gym passes preflight without mutating source data', () => {
  const rows = [owner, row('staff', 'staff'), row('trainer', 'trainer', { expiresAt: 101 })];
  const copy = structuredClone(rows);
  assert.deepEqual(codes(rows), []);
  assert.deepEqual(rows, copy);
});
test('live authoritative owner must exist, have owner role and active unexpired access', () => {
  assert.ok(codes([]).includes('missing-owner-membership'));
  assert.ok(codes([row('owner', 'staff')]).includes('owner-role-mismatch'));
  for (const over of [
    { status: 'frozen' },
    { status: 'cancelled' },
    { expiresAt: 100 },
    { expiresAt: 0 },
    { expiresAt: null },
  ])
    assert.ok(codes([row('owner', 'owner', over)]).includes('inactive-owner'));
  assert.ok(codes([owner], { ...gym, ownerUid: '' }).includes('invalid-owner-id'));
});
test('pending gyms report missing owner as a warning rather than a live-gym blocker', () => {
  const findings = auditGymAccess('pending', { status: 'pending', ownerUid: 'future-owner' }, []);
  assert.deepEqual(
    findings.map((f) => f.severity),
    ['warning'],
  );
});
test('additional owner rows and mismatched query mirrors are detected by document ID', () => {
  const findings = auditGymAccess('gym', gym, [owner, row('imposter', 'owner', { uid: 'owner' })]);
  assert.ok(findings.some((f) => f.code === 'extra-owner-role' && f.memberId === 'imposter'));
  assert.ok(findings.some((f) => f.code === 'mismatched-uid-mirror' && f.severity === 'error'));
  assert.ok(
    codes([owner, row('staff', 'staff', { uid: undefined })]).includes('missing-uid-mirror'),
  );
});
test('inactive staff are a warning; malformed roles, statuses and expiry are errors', () => {
  const findings = auditGymAccess('gym', gym, [
    owner,
    row('staff', 'staff', { status: 'frozen' }),
    row('odd', 'root', { expiresAt: 'tomorrow', status: 'unknown' }),
  ]);
  assert.equal(findings.find((f) => f.code === 'inactive-team-role')?.severity, 'warning');
  for (const code of ['invalid-role', 'invalid-status', 'invalid-expiry'])
    assert.equal(findings.find((f) => f.code === code)?.severity, 'error');
});
test('partial scan never diagnoses an unobserved owner as missing or reports success', () => {
  const result = codes([], gym, false);
  assert.deepEqual(result, ['incomplete-members']);
});
test('membership document IDs support imported Unicode IDs but reject unsafe paths', () => {
  for (const value of ['uid', 'user@example.test', 'مستخدم', 'customer.123'])
    assert.equal(isMembershipDocumentId(value), true);
  for (const value of ['', 'a/b', '.', '..', '__name__', 'a\n', 'x'.repeat(129), null])
    assert.equal(isMembershipDocumentId(value), false);
});

test('malformed map-valued fields and impossible timestamps produce findings, not coercion errors', () => {
  const findings = auditGymAccess('gym', { ...gym, status: { toString: 'broken' } }, [
    owner,
    row('bad', 'staff', { role: { toString: 'broken' }, status: [], expiresAt: 4102444800001 }),
  ]);
  for (const code of ['invalid-gym-status', 'invalid-role', 'invalid-status', 'invalid-expiry'])
    assert.ok(findings.some((f) => f.code === code));
});
