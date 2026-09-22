/**
 * RBAC invariants.
 *
 * The matrix is load-bearing: Firestore rules and both apps read it. These
 * tests therefore assert *structural* invariants — that every declared
 * capability has a decision, that no decision names a role that does not
 * exist — alongside the specific grants the product depends on. A new
 * capability added without deciding who holds it must fail here, not silently
 * deny everyone in production.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPABILITIES,
  DEFAULT_ROLE,
  GYM_ROLES,
  PERMISSION_MATRIX,
  PLATFORM_ADMIN_CLAIM_VALUE,
  PLATFORM_CAPABILITIES,
  PLATFORM_ROLE_CLAIM,
  PUBLIC_CAPABILITIES,
  ROLES,
  can,
  canAnonymous,
  canAny,
  capabilitiesFor,
  highestRole,
  isGymOperator,
  isPlatformAdmin,
  isRole,
  roleFromGymRole,
  roleLabel,
  roleRank,
  rolesWith,
  toRole,
  type Capability,
  type Role,
} from '../src/index.ts';

const ALL_CAPABILITIES: readonly Capability[] = CAPABILITIES;

// ── Structural invariants ────────────────────────────────────────────────────

test('every declared capability has an explicit decision in the matrix', () => {
  const decided = new Set(Object.keys(PERMISSION_MATRIX));
  for (const capability of ALL_CAPABILITIES) {
    assert.ok(decided.has(capability), `${capability} is missing from PERMISSION_MATRIX`);
  }
});

test('the matrix declares no capability that CAPABILITIES omits', () => {
  const declared = new Set<string>(ALL_CAPABILITIES);
  for (const key of Object.keys(PERMISSION_MATRIX)) {
    assert.ok(declared.has(key), `PERMISSION_MATRIX has unknown capability ${key}`);
  }
});

test('no capability is dead — every one is held by at least one role', () => {
  for (const capability of ALL_CAPABILITIES) {
    assert.ok(PERMISSION_MATRIX[capability].length > 0, `${capability} is granted to nobody`);
  }
});

test('every grant names a real role', () => {
  for (const capability of ALL_CAPABILITIES) {
    for (const role of PERMISSION_MATRIX[capability]) {
      assert.ok(ROLES.includes(role), `${capability} names unknown role ${role}`);
    }
  }
});

test('no capability grants the same role twice', () => {
  for (const capability of ALL_CAPABILITIES) {
    const holders = PERMISSION_MATRIX[capability];
    assert.equal(
      new Set(holders).size,
      holders.length,
      `${capability} lists a role more than once`,
    );
  }
});

test('the matrix is exhaustive over the role × capability grid', () => {
  // Every cell resolves to a boolean — nothing falls through to undefined.
  for (const role of ROLES) {
    for (const capability of ALL_CAPABILITIES) {
      assert.equal(typeof can(role, capability), 'boolean');
    }
  }
});

test('capabilitiesFor agrees with can for every role', () => {
  for (const role of ROLES) {
    const list = capabilitiesFor(role);
    for (const capability of ALL_CAPABILITIES) {
      assert.equal(
        list.includes(capability),
        can(role, capability),
        `${role}/${capability} disagrees`,
      );
    }
  }
});

test('rolesWith agrees with can for every capability', () => {
  for (const capability of ALL_CAPABILITIES) {
    const list = rolesWith(capability);
    for (const role of ROLES) {
      assert.equal(list.includes(role), can(role, capability), `${capability}/${role} disagrees`);
    }
  }
});

// ── The four roles ───────────────────────────────────────────────────────────

test('all seven product roles exist', () => {
  assert.deepEqual([...ROLES].sort(), [
    'content-manager',
    'gym-owner',
    'gym-staff',
    'gym-trainer',
    'member',
    'platform-admin',
    'support-agent',
  ]);
  assert.equal(DEFAULT_ROLE, 'member');
});

test('membership roles map onto product roles', () => {
  assert.equal(roleFromGymRole('owner'), 'gym-owner');
  assert.equal(roleFromGymRole('staff'), 'gym-staff');
  assert.equal(roleFromGymRole('trainer'), 'gym-trainer');
  assert.equal(roleFromGymRole('member'), 'member');
  assert.equal(roleFromGymRole(null), 'member');
  assert.equal(roleFromGymRole(undefined), 'member');
  // @ts-expect-error Exercise the runtime guard for corrupt persisted values.
  assert.equal(roleFromGymRole('nonsense'), 'member');
  assert.deepEqual([...GYM_ROLES].sort(), ['member', 'owner', 'staff', 'trainer']);
});

test('unknown role strings degrade to the least privilege, never throw', () => {
  for (const junk of [null, undefined, '', 'superuser', 42, {}, []]) {
    assert.equal(toRole(junk), 'member');
  }
  assert.equal(toRole('gym-owner'), 'gym-owner');
  assert.equal(isRole('gym-staff'), true);
  assert.equal(isRole('superuser'), false);
  assert.equal(isRole(null), false);
});

test('a nullish role is denied every capability', () => {
  for (const capability of ALL_CAPABILITIES) {
    assert.equal(can(null, capability), false, `${capability} leaked to null role`);
    assert.equal(can(undefined, capability), false, `${capability} leaked to undefined`);
  }
});

// ── Privilege ordering ───────────────────────────────────────────────────────

test('platform-admin holds every capability', () => {
  // Deliberate: the platform operator is the break-glass role for support and
  // billing. The UI funnels this through read-only impersonation, and every
  // privileged write is audited — but the capability itself is not withheld,
  // because a support engineer who cannot fix a tenant is not support.
  for (const capability of ALL_CAPABILITIES) {
    assert.ok(can('platform-admin', capability), `platform-admin lacks ${capability}`);
  }
});

test('role rank orders the roles by privilege', () => {
  assert.ok(roleRank('platform-admin') > roleRank('gym-owner'));
  assert.ok(roleRank('gym-owner') > roleRank('gym-staff'));
  assert.ok(roleRank('gym-staff') > roleRank('member'));
  assert.equal(roleRank('nope' as Role), 0);
});

test('highestRole picks platform-admin even when a lesser role comes first', () => {
  assert.equal(highestRole(['gym-owner', 'platform-admin']), 'platform-admin');
  assert.equal(highestRole(['member', 'gym-staff']), 'gym-staff');
  assert.equal(highestRole(['gym-staff', 'gym-owner']), 'gym-owner');
  assert.equal(highestRole([]), 'member');
  assert.equal(highestRole([null, undefined]), 'member');
});

test('role predicates classify correctly', () => {
  assert.equal(isPlatformAdmin('platform-admin'), true);
  assert.equal(isPlatformAdmin('gym-owner'), false);
  assert.equal(isPlatformAdmin(null), false);
  assert.equal(isGymOperator('gym-owner'), true);
  assert.equal(isGymOperator('gym-staff'), true);
  assert.equal(isGymOperator('member'), false);
  assert.equal(isGymOperator('platform-admin'), false);
});

test('every role has a human label', () => {
  for (const role of ROLES) {
    assert.ok(roleLabel(role).length > 0);
  }
});

// ── Platform capabilities ────────────────────────────────────────────────────

test('platform capabilities are held by the platform alone', () => {
  for (const capability of PLATFORM_CAPABILITIES) {
    assert.ok(can('platform-admin', capability), `platform-admin lacks ${capability}`);
    for (const role of ['gym-owner', 'gym-staff', 'member'] as const) {
      assert.equal(
        can(role, capability),
        false,
        `${role} must not hold platform capability ${capability}`,
      );
    }
  }
});

test('platform capabilities are a subset of all capabilities', () => {
  for (const capability of PLATFORM_CAPABILITIES) {
    assert.ok(ALL_CAPABILITIES.includes(capability), `${capability} is not a declared capability`);
  }
});

test('the platform role claim key and value are pinned', () => {
  // Changing either breaks every already-issued ID token in the field.
  assert.equal(PLATFORM_ROLE_CLAIM, 'sfRole');
  assert.equal(PLATFORM_ADMIN_CLAIM_VALUE, 'platform-admin');
});

// ── The separation of duties the personas depend on ──────────────────────────

test('gym staff cannot touch money policy, branding or the roster delete', () => {
  const denied: Capability[] = [
    'plan:manage',
    'invoice:refund',
    'revenue:read',
    'branding:edit',
    'pricing:publish',
    'member:remove',
    'staff:invite',
    'staff:remove',
    'staff:role:change',
    'promo:manage',
    'gym:delete',
    'gym:update:own',
    'timetable:publish',
    'class:delete',
    'reports:gym',
    'audit:read:own',
  ];
  for (const capability of denied) {
    assert.equal(can('gym-staff', capability), false, `staff must not hold ${capability}`);
  }
});

test('gym staff can still run the front desk', () => {
  const allowed: Capability[] = [
    'checkin:door',
    'class:attend:mark',
    'payment:take',
    'invoice:issue',
    'booking:create:any',
    'booking:cancel:any',
    'member:roster:read',
    'member:status:change',
    'member:invite',
    'waitlist:promote',
    'shift:manage',
    'equipment:manage',
    'broadcast:send',
    'hours:edit',
    'revenue:read:self',
    'reports:staff:self',
  ];
  for (const capability of allowed) {
    assert.ok(can('gym-staff', capability), `staff should hold ${capability}`);
  }
});

test('staff see their own numbers but never gym-wide revenue', () => {
  assert.equal(can('gym-staff', 'revenue:read:self'), true);
  assert.equal(can('gym-staff', 'revenue:read'), false);
  assert.equal(can('gym-staff', 'reports:gym'), false);
  assert.equal(can('gym-staff', 'reports:staff:self'), true);
  assert.equal(can('gym-owner', 'revenue:read'), true);
});

test('gym owner runs the business but not the platform', () => {
  assert.equal(can('gym-owner', 'plan:manage'), true);
  assert.equal(can('gym-owner', 'branding:edit'), true);
  assert.equal(can('gym-owner', 'gym:delete'), true);
  assert.equal(can('gym-owner', 'gym:suspend'), false);
  assert.equal(can('gym-owner', 'impersonate'), false);
  assert.equal(can('gym-owner', 'reports:platform'), false);
  assert.equal(can('gym-owner', 'gym:read:any'), false);
});

test('a member acts on their own records only', () => {
  const allowed: Capability[] = [
    'booking:create:self',
    'booking:cancel:self',
    'booking:read:self',
    'member:self:read',
    'member:data:share',
    'membership:purchase:self',
    'public:read',
  ];
  for (const capability of allowed) {
    assert.ok(can('member', capability), `member should hold ${capability}`);
  }

  const denied: Capability[] = [
    'booking:read:gym',
    'booking:create:any',
    'booking:cancel:any',
    'member:roster:read',
    'member:remove',
    'checkin:door',
    'class:create',
    'revenue:read',
    'reports:gym',
  ];
  for (const capability of denied) {
    assert.equal(can('member', capability), false, `member must not hold ${capability}`);
  }
});

test('self- and any- pairs stay distinct for bookings', () => {
  // The whole point of the split: a member may manage their own seat, never
  // somebody else's or the gym's list.
  assert.equal(can('member', 'booking:create:self'), true);
  assert.equal(can('member', 'booking:create:any'), false);
  assert.equal(can('member', 'booking:cancel:self'), true);
  assert.equal(can('member', 'booking:cancel:any'), false);
  assert.equal(can('gym-staff', 'booking:create:self'), true);
  assert.equal(can('gym-staff', 'booking:create:any'), true);
});

test('sharing own data is available to every role, including an owner', () => {
  // An owner is also a member of their own gym; restricting this to the member
  // role would stop them sharing their own aggregates.
  for (const role of ROLES) {
    assert.equal(can(role, 'member:data:share'), true, `${role} cannot share own data`);
  }
});

// ── Anonymous surface ────────────────────────────────────────────────────────

test('the only anonymous capability is reading the public site', () => {
  assert.deepEqual([...PUBLIC_CAPABILITIES], ['public:read']);
  for (const capability of ALL_CAPABILITIES) {
    assert.equal(
      canAnonymous(capability),
      capability === 'public:read',
      `${capability} must not be anonymous`,
    );
  }
});

test('canAny resolves signed-out visitors and signed-in roles', () => {
  assert.equal(canAny(null, 'public:read'), true);
  assert.equal(canAny(null, 'member:roster:read'), false);
  assert.equal(canAny('member', 'member:roster:read'), false);
  assert.equal(canAny('gym-staff', 'member:roster:read'), true);
  assert.equal(canAny('member', 'booking:create:self'), true);
});
