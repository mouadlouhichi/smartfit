/** HTTP handlers with mocked Auth/Admin persistence. No production credentials or network. */
import { before, after, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAdminServices } from '../../src/lib/firebase/admin';
import * as content from '../../src/app/api/content/route';
import * as support from '../../src/app/api/support/route';
import * as authHome from '../../src/app/api/auth/home/route';
import * as team from '../../src/app/api/tenant/team/route';
import * as coaching from '../../src/app/api/coaching/route';
import * as accountExport from '../../src/app/api/account/export/route';
import { deleteFeatureAccountData } from '../../src/lib/feature-account-data';
import { loadTenantServer } from '../../src/lib/tenant-server';

type Row = Record<string, unknown>;
const rows = new Map<string, Row>();
let sequence = 0;
const roles: Record<string, string> = {
  editor: 'content-manager',
  agent: 'support-agent',
  admin: 'platform-admin',
};
class Ref {
  id: string;
  constructor(public path: string) {
    this.id = path.split('/').at(-1)!;
  }
  collection(name: string) {
    return new Query(`${this.path}/${name}`);
  }
  async get() {
    return snapshot(this);
  }
}
function snapshot(ref: Ref) {
  const data = rows.get(ref.path);
  return { ref, id: ref.id, exists: !!data, data: () => data, get: (key: string) => data?.[key] };
}
class Query {
  filters: [string, unknown][] = [];
  count = Infinity;
  constructor(
    public path: string,
    public group = false,
  ) {}
  doc(id = String(++sequence)) {
    return new Ref(`${this.path}/${id}`);
  }
  where(field: string, _op: string, value: unknown) {
    this.filters.push([field, value]);
    return this;
  }
  orderBy() {
    return this;
  }
  limit(n: number) {
    this.count = n;
    return this;
  }
  async get() {
    const docs = [...rows.keys()]
      .filter((path) =>
        this.group
          ? path.split('/').at(-2) === this.path
          : path.startsWith(`${this.path}/`) &&
            path.split('/').length === this.path.split('/').length + 1,
      )
      .map((path) => snapshot(new Ref(path)))
      .filter((d) => this.filters.every(([key, value]) => d.get(key) === value))
      .slice(0, this.count);
    return { docs, empty: !docs.length };
  }
}
const app = initializeApp({ projectId: 'demo-smartfit-handler-tests' });
const services = getAdminServices();
before(() => {
  mock.method(services.auth, 'verifyIdToken', async (token: string, revoked: boolean) => {
    assert.equal(revoked, true);
    return { uid: token, sfRole: 'platform-admin' } as never; // stale/spoofed token claim must NOT grant admin
  });
  mock.method(
    services.auth,
    'getUser',
    async (uid: string) =>
      ({ uid, customClaims: { sfRole: roles[uid] }, disabled: uid === 'disabled' }) as never,
  );
  mock.method(services.db, 'doc', (path: string) => new Ref(path) as never);
  mock.method(services.db, 'collection', (path: string) => new Query(path) as never);
  mock.method(services.db, 'collectionGroup', (path: string) => new Query(path, true) as never);
  mock.method(services.db, 'runTransaction', async (fn: (tx: unknown) => Promise<unknown>) => {
    const pending: (() => void)[] = [];
    const tx = {
      get: (ref: Ref | Query) => ref.get(),
      set: (ref: Ref, value: Row) => pending.push(() => rows.set(ref.path, structuredClone(value))),
      create: (ref: Ref, value: Row) =>
        pending.push(() => {
          if (rows.has(ref.path)) throw new Error('Already exists');
          rows.set(ref.path, structuredClone(value));
        }),
      update: (ref: Ref, value: Row) =>
        pending.push(() => rows.set(ref.path, { ...rows.get(ref.path), ...value })),
      delete: (ref: Ref) => pending.push(() => rows.delete(ref.path)),
    };
    const result = await fn(tx);
    pending.forEach((write) => write());
    return result;
  });
  mock.method(services.db, 'batch', () => {
    const refs: Ref[] = [];
    return {
      delete: (ref: Ref) => refs.push(ref),
      commit: async () => refs.forEach((ref) => rows.delete(ref.path)),
    } as never;
  });
});
after(async () => {
  mock.restoreAll();
  await deleteApp(app);
});
function request(path: string, user?: string, body?: unknown) {
  return new Request(`http://smartfit.test${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { host: 'smartfit.test', ...(user ? { authorization: `Bearer ${user}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const draft = {
  kind: 'workout',
  title: 'Published routine',
  description: '',
  status: 'published',
  difficulty: 'beginner',
  equipment: [],
  muscles: [],
  instructions: [],
  durationMin: 20,
  exercises: [{ name: 'Squat', sets: [{ reps: 8 }] }],
};

test('content authorization rereads fresh claims; specialist cannot become an admin via token/body', async () => {
  assert.equal((await content.POST(request('/api/content', 'agent', { draft }))).status, 403);
  assert.equal(
    (await content.POST(request('/api/content', 'ordinary', { draft, role: 'platform-admin' })))
      .status,
    403,
  );
  assert.equal((await content.POST(request('/api/content', 'disabled', { draft }))).status, 401);
});

test('cloud content saves a revision, rejects stale writes, and excludes drafts from public reads', async () => {
  const response = await content.POST(request('/api/content', 'editor', { draft }));
  assert.equal(response.status, 200);
  const { item } = await response.json();
  assert.equal(item.version, 1);
  assert.ok(rows.has(`platform/content/entries/${item.id}/revisions/1`));
  let publicBody = await (await content.GET(request('/api/content'))).json();
  assert.equal(publicBody.items.length, 1);
  assert.equal(publicBody.items[0].updatedBy, '');
  assert.equal(
    (await content.POST(request('/api/content', 'editor', { id: item.id, version: 0, draft })))
      .status,
    409,
  );
  assert.equal(
    (
      await content.POST(
        request('/api/content', 'editor', {
          id: item.id,
          version: 1,
          draft: { ...draft, status: 'draft' },
        }),
      )
    ).status,
    200,
  );
  publicBody = await (await content.GET(request('/api/content'))).json();
  assert.equal(publicBody.items.length, 0);
  assert.equal((await content.GET(request('/api/content?editorial=1', 'agent'))).status, 403);
  assert.equal(rows.get(`platform/content/entries/${item.id}/revisions/1`)?.status, 'published');
});

test('support pins ownership to caller, bounds creation, and prevents foreign updates', async () => {
  const response = await support.POST(
    request('/api/support', 'member-a', {
      action: 'create',
      ownerUid: 'victim',
      category: 'workout',
      subject: 'Workout help',
      message: 'Please help me find the player.',
    }),
  );
  assert.equal(response.status, 200);
  const { item } = await response.json();
  assert.equal(item.ownerUid, 'member-a');
  assert.equal(
    (
      await support.POST(
        request('/api/support', 'member-a', {
          action: 'create',
          category: 'workout',
          subject: 'Second ticket',
          message: 'Another support question.',
        }),
      )
    ).status,
    429,
  );
  for (const user of ['member-b', 'editor']) {
    assert.equal((await (await support.GET(request('/api/support', user))).json()).items.length, 0);
    assert.equal(
      (
        await support.POST(
          request('/api/support', user, {
            action: 'reply',
            id: item.id,
            version: item.version,
            message: 'Steal conversation',
          }),
        )
      ).status,
      404,
    );
  }
  assert.equal(
    (
      await support.POST(
        request('/api/support', 'member-a', {
          action: 'status',
          id: item.id,
          version: 1,
          status: 'in-progress',
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await support.POST(
        request('/api/support', 'agent', {
          action: 'reply',
          id: item.id,
          version: 1,
          message: 'Here is how to open it.',
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await support.POST(
        request('/api/support', 'member-a', {
          action: 'reply',
          id: item.id,
          version: 1,
          message: 'Stale reply',
        }),
      )
    ).status,
    409,
  );
});

function seedGym() {
  rows.set('gyms/test-gym', { ownerUid: 'owner', status: 'active' });
  for (const [uid, role] of [
    ['owner', 'owner'],
    ['staff', 'staff'],
    ['trainer-a', 'trainer'],
    ['trainer-b', 'trainer'],
    ['member-c', 'member'],
  ])
    rows.set(`gyms/test-gym/members/${uid}`, {
      uid,
      role,
      status: 'active',
      displayName: uid,
      joinedAt: 1,
      checkins: 0,
    });
}
test('coaching requires a real gym relationship, not a global or caller-supplied gym role', async () => {
  seedGym();
  assert.equal((await coaching.GET(request('/api/coaching?gym=test-gym', 'outsider'))).status, 403);
  assert.equal(
    (
      await coaching.POST(
        request('/api/coaching', 'staff', {
          gym: 'test-gym',
          action: 'assign',
          memberUid: 'member-c',
          trainerUid: 'trainer-a',
          role: 'gym-owner',
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await coaching.POST(
        request('/api/coaching', 'owner', {
          gym: 'test-gym',
          action: 'assign',
          memberUid: 'member-c',
          trainerUid: 'outsider',
        }),
      )
    ).status,
    400,
  );
});
test('coaching assignment, consent, feedback, role restrictions and foreign trainer isolation work end to end', async () => {
  seedGym();
  const body = { gym: 'test-gym', memberUid: 'member-c' };
  assert.equal(
    (
      await coaching.POST(
        request('/api/coaching', 'owner', { ...body, action: 'assign', trainerUid: 'trainer-a' }),
      )
    ).status,
    200,
  );
  assert.equal(
    (await (await coaching.GET(request('/api/coaching?gym=test-gym', 'trainer-b'))).json()).items
      .length,
    0,
  );
  const assigned = await (
    await coaching.GET(request('/api/coaching?gym=test-gym', 'trainer-a'))
  ).json();
  assert.equal(assigned.items.length, 1);
  assert.equal(assigned.roster.length, 0);
  assert.equal(
    (
      await coaching.POST(
        request('/api/coaching', 'trainer-b', {
          ...body,
          action: 'feedback',
          version: 999,
          message: 'Probe a foreign record',
        }),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await coaching.POST(
        request('/api/coaching', 'trainer-a', {
          ...body,
          action: 'feedback',
          version: 1,
          message: 'Before consent',
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await coaching.POST(
        request('/api/coaching', 'trainer-a', {
          ...body,
          action: 'consent',
          version: 1,
          consent: 'accepted',
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await coaching.POST(
        request('/api/coaching', 'member-c', {
          ...body,
          action: 'consent',
          version: 1,
          consent: 'accepted',
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await coaching.POST(
        request('/api/coaching', 'trainer-b', {
          ...body,
          action: 'feedback',
          version: 2,
          message: 'Foreign trainer',
        }),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await coaching.POST(
        request('/api/coaching', 'staff', {
          ...body,
          action: 'feedback',
          version: 2,
          message: 'Staff write',
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await coaching.POST(
        request('/api/coaching', 'trainer-a', {
          ...body,
          action: 'routine',
          version: 2,
          routine: { title: 'Assigned session', exercises: draft.exercises },
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await coaching.POST(
        request('/api/coaching', 'owner', {
          gym: 'test-gym',
          action: 'role',
          uid: 'trainer-a',
          role: 'staff',
        }),
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await coaching.POST(
        request('/api/coaching', 'member-c', { ...body, action: 'remove', version: 3 }),
      )
    ).status,
    200,
  );
  assert.equal(rows.has('gyms/test-gym/coaching/member-c'), false);
});
test('account export and deletion cover supplementary records without including another requester', async () => {
  rows.set('platform/support/entries/private-b', { ownerUid: 'member-b', messages: [] });
  rows.set('gyms/test-gym/coaching/exported', { memberUid: 'member-a', trainerUid: 'trainer-a' });
  const body = await (
    await accountExport.GET(request('/api/account/export?uid=member-b', 'member-a'))
  ).json();
  assert.equal(body.support.length, 1);
  assert.equal(body.support[0].ownerUid, 'member-a');
  assert.equal(body.coaching.length, 1);
  await deleteFeatureAccountData(services.db, 'member-a');
  assert.ok(rows.has('platform/support/entries/private-b'));
  assert.equal(rows.has('gyms/test-gym/coaching/exported'), false);
});
test('deletion locks refuse new personal records', async () => {
  rows.set('accountDeletionJobs/deleting', { status: 'running' });
  assert.equal(
    (
      await support.POST(
        request('/api/support', 'deleting', {
          action: 'create',
          category: 'other',
          subject: 'Blocked',
          message: 'Must not survive deletion.',
        }),
      )
    ).status,
    409,
  );
});
test('public cloud tenant payload contains no roster, booking or invoice records', async () => {
  process.env.FIREBASE_ADMIN_PROJECT_ID = 'demo-smartfit-handler-tests';
  seedGym();
  rows.set('gyms/test-gym/invoices/private', { memberUid: 'member-c' });
  rows.set('gyms/test-gym/bookings/private', { memberUid: 'member-c' });
  const result = await loadTenantServer('test-gym');
  assert.equal(result.mode, 'cloud');
  assert.deepEqual(result.roster, []);
  assert.deepEqual(result.invoices, []);
  assert.deepEqual(result.bookings, []);
});

test('team role changes are atomic, audited and conflict checked without refreshing tokens', async () => {
  rows.clear();
  seedGym();
  const body = {
    gym: 'test-gym',
    uid: 'member-c',
    role: 'staff',
    expectedRole: 'member',
    reason: 'Joining the front desk',
  };
  delete rows.get('gyms/test-gym/members/member-c')!.uid; // old rows may lack the query mirror
  assert.equal((await team.POST(request('/api/tenant/team', 'owner', body))).status, 200);
  const target = rows.get('gyms/test-gym/members/member-c')!;
  assert.equal(target.role, 'staff');
  assert.equal(target.roleChangedBy, 'owner');
  assert.equal(target.uid, 'member-c');
  const audits = [...rows.entries()].filter(([path]) => path.startsWith('gyms/test-gym/audit/'));
  assert.equal(audits.length, 1);
  assert.deepEqual(audits[0][1].meta, {
    previousRole: 'member',
    role: 'staff',
    reason: body.reason,
  });
  assert.equal((await coaching.GET(request('/api/coaching?gym=test-gym', 'member-c'))).status, 200);
  assert.equal((await team.POST(request('/api/tenant/team', 'owner', body))).status, 409);
  assert.equal(
    (
      await coaching.POST(
        request('/api/coaching', 'owner', {
          ...body,
          action: 'role',
          role: 'member',
          expectedRole: 'staff',
        }),
      )
    ).status,
    200,
  );
  assert.equal(rows.get('gyms/test-gym/members/member-c')!.role, 'member');
});
test('only active owner membership or platform admin can change team roles', async () => {
  const body = {
    gym: 'test-gym',
    uid: 'member-c',
    role: 'trainer',
    expectedRole: 'member',
    reason: 'Joining the training team',
  };
  for (const actor of ['staff', 'trainer-a', 'member-c', 'outsider']) {
    rows.clear();
    seedGym();
    assert.equal((await team.POST(request('/api/tenant/team', actor, body))).status, 403);
  }
  for (const status of ['frozen', 'expired', 'cancelled']) {
    rows.clear();
    seedGym();
    rows.get('gyms/test-gym/members/owner')!.status = status;
    assert.equal((await team.POST(request('/api/tenant/team', 'owner', body))).status, 403);
  }
  rows.clear();
  seedGym();
  rows.delete('gyms/test-gym/members/owner');
  assert.equal((await team.POST(request('/api/tenant/team', 'owner', body))).status, 403);
  assert.equal((await team.POST(request('/api/tenant/team', 'admin', body))).status, 200);
  rows.get('gyms/test-gym')!.status = 'suspended';
  assert.equal(
    (
      await team.POST(
        request('/api/tenant/team', 'admin', { ...body, expectedRole: 'trainer', role: 'member' }),
      )
    ).status,
    403,
  );
});
test('team mutations protect owner, inactive targets, assignments and deletion locks with no partial audit', async () => {
  const base = {
    gym: 'test-gym',
    uid: 'member-c',
    role: 'staff',
    expectedRole: 'member',
    reason: 'Changing team responsibilities',
  };
  for (const setup of ['expired', 'assigned', 'deleting', 'owner'] as const) {
    rows.clear();
    seedGym();
    let body = { ...base };
    if (setup === 'expired') rows.get('gyms/test-gym/members/member-c')!.expiresAt = 1;
    if (setup === 'assigned')
      rows.set('gyms/test-gym/coaching/member-c', { trainerUid: 'trainer-a' });
    if (setup === 'deleting') rows.set('accountDeletionJobs/member-c', { status: 'pending' });
    if (setup === 'owner') body = { ...base, uid: 'owner', expectedRole: 'owner' };
    assert.equal(
      (await team.POST(request('/api/tenant/team', 'owner', body))).status,
      setup === 'owner' ? 403 : 409,
    );
    assert.equal(
      [...rows.keys()].filter((path) => path.startsWith('gyms/test-gym/audit/')).length,
      0,
    );
    assert.equal(rows.get('gyms/test-gym/members/member-c')!.role, 'member');
  }
  rows.clear();
  seedGym();
  rows.set('gyms/test-gym/coaching/member-c', { trainerUid: 'trainer-a' });
  assert.equal(
    (
      await team.POST(
        request('/api/tenant/team', 'owner', {
          ...base,
          uid: 'trainer-a',
          expectedRole: 'trainer',
          role: 'member',
        }),
      )
    ).status,
    409,
  );
});
test('team handler rejects missing identity, cross origin and incomplete confirmation', async () => {
  rows.clear();
  seedGym();
  const body = {
    gym: 'test-gym',
    uid: 'member-c',
    role: 'staff',
    expectedRole: 'member',
    reason: 'Front desk onboarding',
  };
  assert.equal((await team.POST(request('/api/tenant/team', undefined, body))).status, 401);
  const cross = request('/api/tenant/team', 'owner', body);
  cross.headers.set('Origin', 'https://foreign.test');
  assert.equal((await team.POST(cross)).status, 403);
  assert.equal(
    (await team.POST(request('/api/tenant/team', 'owner', { ...body, expectedRole: undefined })))
      .status,
    409,
  );
  assert.equal(
    (await team.POST(request('/api/tenant/team', 'owner', { ...body, reason: '' }))).status,
    400,
  );
  assert.equal(
    (await team.POST(request('/api/tenant/team', 'owner', { ...body, role: 'owner' }))).status,
    400,
  );
});

test('dedicated homes require current active gym access and real document identity', async () => {
  rows.clear();
  seedGym();
  for (const [uid, home] of [
    ['admin', '/admin'],
    ['owner', '/g/test-gym/console'],
    ['staff', '/g/test-gym/console'],
    ['trainer-a', '/g/test-gym/coaching'],
  ]) {
    assert.equal((await (await authHome.GET(request('/api/auth/home', uid))).json()).home, home);
  }
  rows.get('gyms/test-gym/members/staff')!.expiresAt = 1;
  assert.equal((await (await authHome.GET(request('/api/auth/home', 'staff'))).json()).home, null);
  rows.get('gyms/test-gym')!.status = 'suspended';
  assert.equal((await (await authHome.GET(request('/api/auth/home', 'owner'))).json()).home, null);
  rows.get('gyms/test-gym')!.status = 'active';
  rows.get('gyms/test-gym/members/owner')!.uid = 'outsider';
  assert.equal(
    (await (await authHome.GET(request('/api/auth/home', 'outsider'))).json()).home,
    null,
  );
});

test('team requests enforce a streaming byte limit before any role or audit write', async () => {
  rows.clear();
  seedGym();
  const body = {
    gym: 'test-gym',
    uid: 'member-c',
    role: 'staff',
    expectedRole: 'member',
    reason: 'م'.repeat(25000),
  };
  const response = await team.POST(request('/api/tenant/team', 'owner', body));
  assert.equal(response.status, 413);
  assert.equal(rows.get('gyms/test-gym/members/member-c')!.role, 'member');
  assert.equal(
    [...rows.keys()].filter((path) => path.startsWith('gyms/test-gym/audit/')).length,
    0,
  );
});
