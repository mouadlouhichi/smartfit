import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePreflightArgs,
  requireLocalEmulator,
  validatePreflightTarget,
  runTeamPreflight,
  preflightExitCode,
  type PreflightReader,
} from '../scripts/lib/team-preflight';
const options = parsePreflightArgs(['--project', 'demo-smartfit-audit']);
const row = (id: string, data: Record<string, unknown>) => ({ id, data });
const gym = row('gym', { ownerUid: 'owner', status: 'active' });
const owner = row('owner', { uid: 'owner', role: 'owner', status: 'active' });
const reader: PreflightReader = {
  gyms: async (after) => (after ? [] : [gym]),
  gym: async () => gym,
  members: async (_gym, after) => (after ? [] : [owner]),
};
test('preflight requires an explicit project and rejects write flags and unsafe limits', () => {
  for (const args of [
    [],
    ['--project'],
    ['--project', 'demo-good', '--apply'],
    ['--project', 'demo-good', '--max-gyms', '0'],
    ['--project', 'demo-good', '--gym', 'x/y'],
    ['--project', 'demo-good', '--max-members', 'Infinity'],
  ])
    assert.throws(() => parsePreflightArgs(args));
  assert.equal(
    parsePreflightArgs(['--project', 'demo-good', '--gym', 'zone-fight', '--json']).json,
    true,
  );
});
test('audit target checks fail closed for mismatched projects and nonlocal emulators', () => {
  assert.doesNotThrow(() => validatePreflightTarget(options, { emulatorHost: '127.0.0.1:8080' }));
  assert.throws(() => validatePreflightTarget(options, {}));
  assert.throws(() =>
    validatePreflightTarget(
      { ...options, projectId: 'real-project' },
      { emulatorHost: 'localhost:8080' },
    ),
  );
  assert.throws(() =>
    validatePreflightTarget(
      { ...options, projectId: 'real-project' },
      { credentialProject: 'other-project' },
    ),
  );
  assert.throws(() =>
    validatePreflightTarget(
      { ...options, projectId: 'real-project' },
      { publicProject: 'other-project' },
    ),
  );
  for (const host of [
    undefined,
    'https://127.0.0.1:8080',
    'evil.test:8080',
    'localhost:0',
    'localhost:65536',
    '127.0.0.1:8080/path',
  ])
    assert.throws(() => requireLocalEmulator(host));
});
test('complete read-only audit has stable counts and emits no member profile fields', async () => {
  const report = await runTeamPreflight(options, reader, 100);
  assert.equal(preflightExitCode(report), 0);
  assert.equal(report.gymsScanned, 1);
  assert.equal(report.membersScanned, 1);
  assert.equal(report.readOnly, true);
  assert.deepEqual(report.findings, []);
  const bad = await runTeamPreflight(options, {
    ...reader,
    members: async (_gym, after) =>
      after
        ? []
        : [
            row('owner', {
              role: 'owner',
              status: 'active',
              email: 'private@example.test',
              notes: 'secret',
            }),
          ],
  });
  assert.equal(preflightExitCode(bad), 1);
  assert.ok(!JSON.stringify(bad).includes('private@example.test'));
  assert.ok(!JSON.stringify(bad).includes('secret'));
});
test('missing selected gym and read failures cannot appear as clean audits', async () => {
  const missing = await runTeamPreflight(
    { ...options, gym: 'missing' },
    { ...reader, gym: async () => null },
  );
  assert.equal(preflightExitCode(missing), 2);
  assert.deepEqual(missing.errors, ['gym-not-found']);
  const failed = await runTeamPreflight(options, {
    ...reader,
    members: async () => {
      throw new Error('secret credentials');
    },
  });
  assert.equal(preflightExitCode(failed), 2);
  assert.ok(!JSON.stringify(failed).includes('secret credentials'));
});
test('pagination truncation is explicit, including when the owner lies beyond the page', async () => {
  const members = [row('a', { uid: 'a', role: 'member', status: 'active' }), owner];
  const report = await runTeamPreflight(
    { ...options, maxMembers: 1 },
    {
      ...reader,
      members: async (_gym, after, limit) =>
        members.filter((r) => !after || r.id > after).slice(0, limit),
    },
  );
  assert.equal(preflightExitCode(report), 2);
  assert.equal(report.membersScanned, 1);
  assert.ok(report.findings.some((f) => f.code === 'incomplete-members'));
  assert.ok(!report.findings.some((f) => f.code === 'missing-owner-membership'));
});
test('multi-page scan visits every gym/member once, including exact-limit scans', async () => {
  const gyms = Array.from({ length: 205 }, (_, n) =>
    row(`gym-${String(n).padStart(3, '0')}`, gym.data),
  );
  const seen: string[] = [];
  const report = await runTeamPreflight(
    { ...options, maxGyms: 205, maxMembers: 1 },
    {
      ...reader,
      gyms: async (after, limit) => gyms.filter((g) => !after || g.id > after).slice(0, limit),
      members: async (gymId, after) => {
        if (after) return [];
        seen.push(gymId);
        return [owner];
      },
    },
  );
  assert.equal(preflightExitCode(report), 0);
  assert.equal(report.gymsScanned, 205);
  assert.equal(new Set(seen).size, 205);
  const limited = await runTeamPreflight(
    { ...options, maxGyms: 1 },
    {
      ...reader,
      gyms: async (after, limit) => gyms.filter((g) => !after || g.id > after).slice(0, limit),
    },
  );
  assert.equal(preflightExitCode(limited), 2);
  assert.equal(limited.gymsScanned, 1);
});
test('non-advancing pagination terminates rather than looping or silently duplicating data', async () => {
  const report = await runTeamPreflight(options, { ...reader, gyms: async () => [gym] });
  assert.equal(preflightExitCode(report), 2);
  assert.deepEqual(report.errors, ['gym-read-failed']);
});

test('pagination follows Firestore UTF-8 document-ID ordering, including non-BMP IDs', async () => {
  const rows = ['owner', '\uffff', '😀']
    .map((id) => row(id, { uid: id, role: id === 'owner' ? 'owner' : 'member', status: 'active' }))
    .sort((a, b) => Buffer.compare(Buffer.from(a.id), Buffer.from(b.id)));
  const report = await runTeamPreflight(
    { ...options, maxMembers: 3 },
    {
      ...reader,
      members: async (_gym, after) =>
        rows
          .filter((r) => !after || Buffer.compare(Buffer.from(r.id), Buffer.from(after)) > 0)
          .slice(0, 1),
    },
  );
  assert.equal(preflightExitCode(report), 0);
  assert.equal(report.membersScanned, 3);
});
