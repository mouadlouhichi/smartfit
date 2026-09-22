/**
 * Role-based access control for the B2B pivot.
 *
 * This is the **one** table the whole product consults. Firestore rules mirror
 * it (they are the real enforcement boundary, because the browser writes
 * straight to Firestore), and the UI uses it to decide what to render. Keeping
 * the table here — in the framework-agnostic core package — means the web app,
 * the Expo app and Node tests all agree by construction.
 *
 * ## Why two enforcement layers
 *
 *  - **Platform role** (`platform-admin`) lives in a Firebase custom claim.
 *    Claims are baked into the ID token and can lag up to ~1 hour, so every
 *    privileged server route re-verifies before acting and the client forces a
 *    token refresh after a role change.
 *  - **Per-gym role** (`gym-owner` / `gym-staff` / `member`) is resolved from a
 *    membership document, never from a claim. A claim cannot express "owner of
 *    gym A and staff at gym B", and adding or removing staff would otherwise
 *    wait on a token refresh.
 *
 * ## Contextual roles
 *
 * `can()` answers "may this role do this **in this gym**". The same person can
 * be `gym-owner` of one tenant and `member` of another; callers pass the role
 * resolved for the tenant they are acting in.
 */

/** Product roles. Premium is an entitlement, never a privileged role. */
export const ROLES = [
  'member',
  'platform-admin',
  'gym-owner',
  'gym-staff',
  'gym-trainer',
  'content-manager',
  'support-agent',
] as const;

export type Role = (typeof ROLES)[number];

/** Role every account starts with. */
export const DEFAULT_ROLE: Role = 'member';

/** Custom-claim key carrying the platform-level role. */
export const PLATFORM_ROLE_CLAIM = 'sfRole';

/** Claim value that marks a platform operator. */
export const PLATFORM_ADMIN_CLAIM_VALUE = 'platform-admin';

/**
 * The role stored on a membership document, as the security rules read it.
 *
 * Note this is deliberately separate from {@link Role}: `platform-admin` is a
 * global claim, never a membership row. `gym-owner` is also implied by
 * `gyms/{gymId}.ownerUid`, which rules treat as authoritative.
 */
export const GYM_ROLES = ['owner', 'staff', 'trainer', 'member'] as const;

export type GymRole = (typeof GYM_ROLES)[number];

/**
 * Every capability in the product, grouped by domain.
 *
 * Naming convention is `noun:verb[:qualifier]`, so a capability reads as a
 * sentence and grep stays useful: `booking:cancel:self` versus
 * `booking:cancel:any` is the difference between acting on your own record and
 * acting on somebody else's.
 */
export const CAPABILITIES = [
  'content:manage',
  'support:manage',
  'coaching:assign',
  'coaching:read:assigned',
  'coaching:feedback',
  // ── Tenant & platform ──────────────────────────────────────────────────
  'gym:create',
  'gym:read:any',
  'gym:read:own',
  'gym:update:own',
  'gym:suspend',
  'gym:restore',
  'gym:delete',
  'subdomain:claim',
  'platform:config',
  'impersonate',
  'audit:read:platform',
  'audit:read:own',
  'application:review',

  // ── Branding & public site ─────────────────────────────────────────────
  'branding:edit',
  'hours:edit',
  'pricing:publish',
  'public:read',

  // ── Scheduling, bookings, check-in ─────────────────────────────────────
  'class:create',
  'class:update',
  'class:delete',
  'timetable:publish',
  'class:attend:mark',
  'booking:create:self',
  'booking:create:any',
  'booking:cancel:self',
  'booking:cancel:any',
  'booking:read:gym',
  'booking:read:self',
  'waitlist:promote',
  'checkin:door',

  // ── Members & staff ────────────────────────────────────────────────────
  'member:roster:read',
  'member:invite',
  'member:status:change',
  'member:notes:write',
  'member:remove',
  'member:self:read',
  'member:data:share',
  'staff:invite',
  'staff:remove',
  'staff:role:change',
  'shift:manage',

  // ── Money ──────────────────────────────────────────────────────────────
  'plan:manage',
  'payment:take',
  'invoice:issue',
  'invoice:refund',
  'revenue:read',
  'revenue:read:self',
  'membership:purchase:self',

  // ── Marketing, facility, reporting ─────────────────────────────────────
  'broadcast:send',
  'promo:manage',
  'equipment:manage',
  'reports:gym',
  'reports:staff:self',
  'reports:platform',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** Shorthand aliases used throughout the matrix for readability. */
const PA = 'platform-admin' as const;
const OWN = 'gym-owner' as const;
const STAFF = 'gym-staff' as const;
const MEM = 'member' as const;

/**
 * The permission matrix.
 *
 * Every capability in {@link CAPABILITIES} must appear here — a test asserts
 * the two lists agree, so adding a capability without deciding who gets it
 * fails the build rather than silently denying everyone.
 *
 * Denials are *absence*, not an explicit `[]`: a capability nobody holds is a
 * dead capability, and the test suite flags it.
 */
export const PERMISSION_MATRIX: Record<Capability, readonly Role[]> = {
  'content:manage': [PA, 'content-manager'],
  'support:manage': [PA, 'support-agent'],
  'coaching:assign': [PA, OWN],
  'coaching:read:assigned': [PA, OWN, STAFF, 'gym-trainer', MEM],
  'coaching:feedback': [PA, OWN, 'gym-trainer', MEM],
  // ── Tenant & platform ──────────────────────────────────────────────────
  // Provisioning a tenant is a platform act: it allocates a subdomain and
  // issues the owner claim.
  'gym:create': [PA],
  'gym:read:any': [PA],
  'gym:read:own': [PA, OWN, STAFF],
  'gym:update:own': [PA, OWN],
  'gym:suspend': [PA],
  'gym:restore': [PA],
  // An owner may close their own gym; destroying the tenant record is the
  // platform's, and both paths go through the same confirmation + audit.
  'gym:delete': [PA, OWN],
  'subdomain:claim': [PA, OWN],
  'platform:config': [PA],
  // Read-only view-as-gym for support. Never write-capable, always audited.
  impersonate: [PA],
  'audit:read:platform': [PA],
  'audit:read:own': [PA, OWN],
  'application:review': [PA],

  // ── Branding & public site ─────────────────────────────────────────────
  'branding:edit': [PA, OWN],
  // Opening hours are day-of operations: reception adjusts them for a holiday.
  'hours:edit': [PA, OWN, STAFF],
  'pricing:publish': [PA, OWN],
  // Public storefront. Anonymous visitors are handled separately by
  // PUBLIC_CAPABILITIES — this row covers signed-in roles.
  'public:read': [PA, OWN, STAFF, MEM, 'gym-trainer', 'content-manager', 'support-agent'],

  // ── Scheduling, bookings, check-in ─────────────────────────────────────
  'class:create': [PA, OWN, STAFF],
  'class:update': [PA, OWN, STAFF],
  'class:delete': [PA, OWN],
  'timetable:publish': [PA, OWN],
  'class:attend:mark': [PA, OWN, STAFF],
  'booking:create:self': [PA, OWN, STAFF, MEM, 'gym-trainer', 'content-manager', 'support-agent'],
  'booking:create:any': [PA, OWN, STAFF],
  'booking:cancel:self': [PA, OWN, STAFF, MEM, 'gym-trainer', 'content-manager', 'support-agent'],
  'booking:cancel:any': [PA, OWN, STAFF],
  'booking:read:gym': [PA, OWN, STAFF],
  'booking:read:self': [PA, OWN, STAFF, MEM, 'gym-trainer', 'content-manager', 'support-agent'],
  'waitlist:promote': [PA, OWN, STAFF],
  'checkin:door': [PA, OWN, STAFF],

  // ── Members & staff ────────────────────────────────────────────────────
  'member:roster:read': [PA, OWN, STAFF],
  'member:invite': [PA, OWN, STAFF],
  'member:status:change': [PA, OWN, STAFF],
  'member:notes:write': [PA, OWN, STAFF],
  // Removing a member is destructive and financial — owner only.
  'member:remove': [PA, OWN],
  'member:self:read': [PA, OWN, STAFF, MEM, 'gym-trainer', 'content-manager', 'support-agent'],
  // Granted to every role: an owner is also a member of their own gym and must
  // be able to share (or withhold) their own aggregates like anyone else.
  'member:data:share': [PA, OWN, STAFF, MEM, 'gym-trainer', 'content-manager', 'support-agent'],
  'staff:invite': [PA, OWN],
  'staff:remove': [PA, OWN],
  'staff:role:change': [PA, OWN],
  'shift:manage': [PA, OWN, STAFF],

  // ── Money ──────────────────────────────────────────────────────────────
  'plan:manage': [PA, OWN],
  // Front desk takes payment; it does not get to define the price list.
  'payment:take': [PA, OWN, STAFF],
  'invoice:issue': [PA, OWN, STAFF],
  'invoice:refund': [PA, OWN],
  'revenue:read': [PA, OWN],
  // Staff see only what they personally sold, never gym totals.
  'revenue:read:self': [PA, OWN, STAFF],
  'membership:purchase:self': [
    PA,
    OWN,
    STAFF,
    MEM,
    'gym-trainer',
    'content-manager',
    'support-agent',
  ],

  // ── Marketing, facility, reporting ─────────────────────────────────────
  'broadcast:send': [PA, OWN, STAFF],
  'promo:manage': [PA, OWN],
  'equipment:manage': [PA, OWN, STAFF],
  'reports:gym': [PA, OWN],
  'reports:staff:self': [PA, OWN, STAFF],
  'reports:platform': [PA],
};

/**
 * What a signed-out visitor may do. Deliberately tiny: the public storefront
 * is the only anonymous surface, and it is read-only.
 */
export const PUBLIC_CAPABILITIES: readonly Capability[] = ['public:read'];

/** Capabilities that apply to the platform rather than to one tenant. */
export const PLATFORM_CAPABILITIES: readonly Capability[] = [
  'gym:create',
  'gym:read:any',
  'gym:suspend',
  'gym:restore',
  'platform:config',
  'impersonate',
  'audit:read:platform',
  'application:review',
  'reports:platform',
];

/** True for any recognised role string. */
export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/**
 * Parse a role from an untrusted source (a claim, a document field, a cookie).
 *
 * Unknown values fall back to {@link DEFAULT_ROLE} rather than throwing: an
 * unrecognised role must degrade to the least privilege, not crash a render.
 */
export function toRole(value: unknown): Role {
  return isRole(value) ? value : DEFAULT_ROLE;
}

/**
 * The core check: may `role` perform `capability`?
 *
 * Nullish or unrecognised roles are denied everything, including capabilities
 * that are nominally public — anonymous access goes through
 * {@link canAnonymous} so the two paths never blur.
 */
export function can(role: Role | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  const holders = PERMISSION_MATRIX[capability];
  if (!holders) return false;
  return holders.includes(role);
}

/** What a signed-out visitor may do. */
export function canAnonymous(capability: Capability): boolean {
  return PUBLIC_CAPABILITIES.includes(capability);
}

/** Any capability, signed in or not. */
export function canAny(role: Role | null | undefined, capability: Capability): boolean {
  return can(role, capability) || (!role && canAnonymous(capability));
}

/** Every capability a role holds, in {@link CAPABILITIES} order. */
export function capabilitiesFor(role: Role): Capability[] {
  return CAPABILITIES.filter((c) => can(role, c));
}

/** Every role holding a capability. */
export function rolesWith(capability: Capability): Role[] {
  return ROLES.filter((r) => can(r, capability));
}

export function isPlatformAdmin(role: Role | null | undefined): boolean {
  return role === 'platform-admin';
}

/** Owner or staff — anyone who operates a gym rather than using it. */
export function isGymOperator(role: Role | null | undefined): boolean {
  return role === 'gym-owner' || role === 'gym-staff';
}

/** Map a membership row's role to the product {@link Role}. */
export function roleFromGymRole(gymRole: GymRole | null | undefined): Role {
  switch (gymRole) {
    case 'owner':
      return 'gym-owner';
    case 'staff':
      return 'gym-staff';
    case 'trainer':
      return 'gym-trainer';
    case 'member':
      return 'member';
    default:
      return DEFAULT_ROLE;
  }
}

/**
 * Rank used to order people in rosters and to break ties in the UI. Higher is
 * more privileged. Not a security primitive — `can()` is.
 */
export function roleRank(role: Role): number {
  switch (role) {
    case 'platform-admin':
      return 4;
    case 'gym-owner':
      return 3;
    case 'gym-staff':
    case 'gym-trainer':
    case 'content-manager':
    case 'support-agent':
      return 2;
    case 'member':
      return 1;
    default:
      return 0;
  }
}

/**
 * Highest-privilege role across a set — used when a person holds several
 * memberships and the shell has to pick one label for the badge.
 */
export function highestRole(roles: readonly (Role | null | undefined)[]): Role {
  let best: Role = DEFAULT_ROLE;
  let bestRank = roleRank(DEFAULT_ROLE);
  for (const r of roles) {
    const resolved = toRole(r);
    const rank = roleRank(resolved);
    if (rank > bestRank) {
      best = resolved;
      bestRank = rank;
    }
  }
  // A platform admin outranks everything, so make sure a gym-owner appearing
  // first in the list cannot mask it.
  if (roles.some((r) => r === 'platform-admin')) return 'platform-admin';
  return best;
}

/** Human label for a role badge. */
export function roleLabel(role: Role): string {
  switch (role) {
    case 'platform-admin':
      return 'Platform admin';
    case 'gym-owner':
      return 'Gym owner';
    case 'gym-staff':
      return 'Gym staff';
    case 'gym-trainer':
      return 'Trainer';
    case 'content-manager':
      return 'Content manager';
    case 'support-agent':
      return 'Support agent';
    case 'member':
      return 'Member';
    default:
      return 'Member';
  }
}
