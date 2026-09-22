/**
 * Multi-tenancy primitives: tenant identity, subdomain resolution and plan limits.
 *
 * These are the pure pieces the B2B pivot needs before any UI or Firestore code
 * exists, so they can be tested exhaustively on their own.
 *
 * ## Subdomains, in one paragraph
 *
 * Each gym gets a dedicated subdomain — `acme.smartfit.app`. Resolution is
 * split in two on purpose. **Host → slug** is pure string work and happens in
 * Next.js middleware, which runs on the edge where the Admin SDK cannot.
 * **Slug → tenant** is a lookup and happens in the page or route handler, on
 * the Node runtime, so no public directory of tenant IDs is exposed.
 *
 * Every host mode rewrites into the same `/g/{slug}` route tree, which is also
 * reachable directly. That is what makes the app demonstrable in a preview with
 * no wildcard DNS, while production gets real subdomains for free.
 */

// ── Tenant lifecycle ─────────────────────────────────────────────────────────

/**
 * Tenant lifecycle.
 *
 * `suspended` is the important one: it locks a gym out (owner, staff and
 * members) without deleting a byte, so a non-paying tenant can be restored.
 */
export const GYM_STATUSES = [
  'pending',
  'trial',
  'active',
  'past_due',
  'suspended',
  'closed',
] as const;

export type GymStatus = (typeof GYM_STATUSES)[number];

/** Statuses in which the tenant's public site and app are usable. */
export const LIVE_GYM_STATUSES: readonly GymStatus[] = ['trial', 'active', 'past_due'];

export function isGymLive(status: GymStatus | null | undefined): boolean {
  return !!status && LIVE_GYM_STATUSES.includes(status);
}

/** Membership lifecycle for a person inside one gym. */
export const MEMBER_STATUSES = ['trial', 'active', 'frozen', 'expired', 'cancelled'] as const;

export type MemberStatus = (typeof MEMBER_STATUSES)[number];

/** Booking lifecycle for one seat in one class occurrence. */
export const BOOKING_STATUSES = ['booked', 'attended', 'no_show', 'cancelled', 'waitlist'] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** A booking that still occupies a seat. */
export const OCCUPYING_BOOKING_STATUSES: readonly BookingStatus[] = ['booked', 'attended'];

// ── Platform plans (what SmartFit sells to gyms) ─────────────────────────────

export interface TenantPlanLimits {
  /** Maximum enrolled members. */
  members: number;
  /** Physical locations. */
  locations: number;
  /** Staff seats (owner excluded). */
  staffSeats: number;
  /** Class occurrences publishable per week. */
  classesPerWeek: number;
  /** Own logo, colours and photos on the public site. */
  customBranding: boolean;
  /** Bind a domain the gym already owns. */
  customDomain: boolean;
  /** Programmatic access. */
  apiAccess: boolean;
}

export interface TenantPlan {
  id: string;
  name: string;
  /** Monthly price in the smallest currency unit (centimes for MAD). */
  monthlyPriceMinor: number;
  currency: string;
  limits: TenantPlanLimits;
}

/**
 * The default tier ladder. Overridable server-side by `platform:config` —
 * these are the values a fresh platform ships with.
 */
export const DEFAULT_TENANT_PLANS: TenantPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPriceMinor: 49000,
    currency: 'MAD',
    limits: {
      members: 100,
      locations: 1,
      staffSeats: 2,
      classesPerWeek: 30,
      customBranding: false,
      customDomain: false,
      apiAccess: false,
    },
  },
  {
    id: 'growth',
    name: 'Growth',
    monthlyPriceMinor: 129000,
    currency: 'MAD',
    limits: {
      members: 500,
      locations: 1,
      staffSeats: 8,
      classesPerWeek: 120,
      customBranding: true,
      customDomain: false,
      apiAccess: false,
    },
  },
  {
    id: 'multi',
    name: 'Multi-site',
    monthlyPriceMinor: 299000,
    currency: 'MAD',
    limits: {
      members: 2000,
      locations: 5,
      staffSeats: 25,
      classesPerWeek: 400,
      customBranding: true,
      customDomain: true,
      apiAccess: true,
    },
  },
];

export function findTenantPlan(plans: readonly TenantPlan[], id: string): TenantPlan | null {
  return plans.find((p) => p.id === id) ?? null;
}

/**
 * Check a requested count against a plan limit.
 *
 * Returns a reason string rather than a boolean so the UI can say *which* limit
 * was hit — "Member limit reached (500 on Growth)" beats "Not allowed", and the
 * same message serves the API response.
 */
export function checkLimit(
  plan: TenantPlan | null,
  limit: keyof TenantPlanLimits,
  current: number,
  requested = 1,
): { ok: boolean; reason?: string } {
  if (!plan) return { ok: false, reason: 'No active plan.' };
  const max = plan.limits[limit];
  if (typeof max === 'boolean') {
    return max
      ? { ok: true }
      : { ok: false, reason: `${limit} is not included in the ${plan.name} plan.` };
  }
  if (current + requested > max) {
    return {
      ok: false,
      reason: `${limit} limit reached (${max} on ${plan.name}).`,
    };
  }
  return { ok: true };
}

// ── Documents ────────────────────────────────────────────────────────────────

export const GYM_AMENITIES = [
  'Showers',
  'Lockers',
  'Parking',
  'Personal training',
  'Group classes',
  'Accessible entrance',
  'Wi-Fi',
  'Recovery area',
] as const;

export interface GymBranding {
  /** Small raster logo, optimized on-device; avoids a separate storage dependency. */
  logoData?: string;
  logoShape?: 'rounded' | 'circle' | 'square';
  heroLayout?: 'split' | 'banner' | 'minimal';
  coverPreset?: 'strength' | 'studio' | 'combat' | 'recovery';
  coverPosition?: 'top' | 'center' | 'bottom';
  ctaLabel?: string;
  amenities?: (typeof GYM_AMENITIES)[number][];
  galleryUrls?: string[];
  logoUrl?: string;
  coverUrl?: string;
  /** Hex accent used by the public site. */
  accentColor?: string;
  tagline?: string;
  description?: string;
}

export interface GymContact {
  phone?: string;
  email?: string;
  instagram?: string;
  whatsapp?: string;
}

export interface GymLocation {
  address?: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

/** Weekly opening hours, keyed by weekday (0 = Sunday). */
export type GymHours = Partial<Record<number, { open: string; close: string } | null>>;

/**
 * The public half of a tenant.
 *
 * Firestore rules make this readable by any signed-in user because it *is* the
 * storefront. Anything sensitive therefore lives in `gyms/{gymId}/settings`,
 * which is a separate document with owner/staff-only rules — read grants in
 * Firestore are per-document, never per-field, so the split is the only way to
 * publish some of a tenant safely.
 */
export interface GymTenant {
  id: string;
  name: string;
  slug: string;
  /** Unique subdomain label; normally equals `slug`. */
  subdomain: string;
  status: GymStatus;
  tenantPlanId: string;
  /** Authoritative owner — rules treat this as the source of truth. */
  ownerUid: string;
  createdAt: number;
  updatedAt?: number;
  branding?: GymBranding;
  contact?: GymContact;
  location?: GymLocation;
  hours?: GymHours;
  /** A gym the tenant already owned, bound to `gym.acme.ma`. */
  customDomain?: string;
}

/**
 * A membership row. Doubles as the roster entry and as the per-gym role
 * resolution the security rules `get()`.
 */
export interface GymMembership {
  /** Server-owned team change metadata; the reason lives in the gym audit trail. */
  roleChangedAt?: number;
  roleChangedBy?: string;
  uid: string;
  role: 'owner' | 'staff' | 'trainer' | 'member';
  status: MemberStatus;
  joinedAt: number;
  expiresAt?: number;
  /** Gym membership tier, not the tenant's platform plan. */
  planId?: string;
  checkins: number;
  lastVisitAt?: number;
  /** Internal CRM note — staff-visible, never shown to the member. */
  notes?: string;
  displayName?: string;
  email?: string;
  phone?: string;
}

/**
 * Aggregates a member *chooses* to share with one gym.
 *
 * Written by the member into their own tree
 * (`users/{uid}/gymShares/{gymId}`), so the existing owner-only rules on
 * `users/**` stay untouched and the gym never reads training data directly.
 * Revoking is deleting the document.
 */
export interface GymShare {
  gymId: string;
  sessionsThisMonth: number;
  streakDays: number;
  attendancePct: number;
  sharedAt: number;
}

// ── Slugs ────────────────────────────────────────────────────────────────────

/** Longest subdomain label we accept. */
export const SLUG_MIN_LENGTH = 2;
export const SLUG_MAX_LENGTH = 48;

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * Host labels that can never be a tenant.
 *
 * Two jobs: keep real infrastructure reachable (`api`, `admin`, `www`) and stop
 * a gym claiming a word that would collide with a first-party route or a
 * future service. The platform can extend this at runtime via `platform:config`
 * — the list here is the shipped floor.
 */
export const RESERVED_SUBDOMAINS: readonly string[] = [
  // Infrastructure
  'www',
  'api',
  'admin',
  'app',
  'manage',
  'console',
  'dashboard',
  'docs',
  'status',
  'mail',
  'smtp',
  'ftp',
  'cdn',
  'assets',
  'static',
  // First-party routes — a tenant named `login` would shadow the real one.
  'g',
  'gyms',
  'login',
  'logout',
  'signup',
  'onboarding',
  'privacy',
  'terms',
  'offline',
  'auth',
  'account',
  'billing',
  'settings',
  'help',
  'support',
  'studio',
  'library',
  'blog',
  'careers',
  'press',
  // Protocol / platform words that break clients if hijacked.
  'localhost',
  'test',
  'dev',
  'staging',
  'preview',
  'beta',
  'new',
  'search',
];

export function isReservedSlug(slug: string): boolean {
  const s = slug.toLowerCase();
  return RESERVED_SUBDOMAINS.includes(s) || s.startsWith('xn--');
}

/**
 * Turn free text into a subdomain-safe slug.
 *
 * Handles the realistic input for this market: French accents and mixed case
 * ("Salle de Sport Marrakech" → `salle-de-sport-marrakech"). Diacritics are
 * decomposed and stripped rather than transliterated beyond ASCII, because a
 * half-transliterated name is worse than a plain one.
 *
 * Returns `''` when nothing usable survives — callers must then fall back to a
 * generated suffix rather than storing an empty slug.
 */
export function slugify(input: string): string {
  if (!input) return '';
  const base = input
    .normalize('NFKD')
    // Strip combining marks left by the decomposition (é → e + ´).
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Anything outside the safe set becomes a separator; this also maps Arabic
    // or emoji input to separators instead of producing an unusable label.
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.slice(0, SLUG_MAX_LENGTH).replace(/-+$/g, '');
}

/** True when `slug` could be a tenant subdomain. */
export function isValidSlug(slug: string): boolean {
  if (typeof slug !== 'string') return false;
  if (slug.length < SLUG_MIN_LENGTH || slug.length > SLUG_MAX_LENGTH) return false;
  if (!SLUG_PATTERN.test(slug)) return false;
  if (isReservedSlug(slug)) return false;
  return true;
}

export interface SlugSuggestionResult {
  slug: string;
  /** True when the suggestion needed a numeric suffix to avoid `taken`. */
  disambiguated: boolean;
}

/**
 * Propose a free slug for a gym name.
 *
 * `taken` is a predicate rather than a list so the caller can consult Firestore
 * lazily instead of loading every tenant. Deterministic and side-effect free:
 * given the same name and the same `taken` answers it always returns the same
 * slug, which matters because the result is shown to the user before it is
 * written.
 */
export function suggestSlug(
  name: string,
  taken: (candidate: string) => boolean,
  maxAttempts = 100,
): SlugSuggestionResult {
  const base = slugify(name);
  if (!base || base.length < SLUG_MIN_LENGTH) {
    // Nothing usable in the name — a stable, obviously-generated label is
    // clearer to the user than a random string they cannot recognise.
    return { slug: 'gym', disambiguated: false };
  }
  if (!isValidSlug(base)) {
    // e.g. the name slugged onto a reserved word ("Admin Fitness" → "admin-…").
    if (isReservedSlug(base)) {
      for (let i = 2; i <= maxAttempts; i++) {
        const candidate = `${base}-${i}`;
        if (isValidSlug(candidate) && !taken(candidate)) {
          return { slug: candidate, disambiguated: true };
        }
      }
      return { slug: base, disambiguated: false };
    }
    return { slug: base, disambiguated: false };
  }
  if (!taken(base)) return { slug: base, disambiguated: false };
  for (let i = 2; i <= maxAttempts; i++) {
    const candidate = `${base}-${i}`;
    if (!taken(candidate)) return { slug: candidate, disambiguated: true };
  }
  // Unreachable in practice; keeps the return type honest if every suffix is
  // somehow taken.
  return { slug: base, disambiguated: true };
}

// ── Host resolution ──────────────────────────────────────────────────────────

export interface ResolveTenantHostOptions {
  /**
   * Apex domains a tenant subdomain may hang off, e.g. `['smartfit.app']`.
   * Longest match wins, so `['e2b.app', 'preview.smartfit.app']` behaves
   * sensibly.
   */
  apexDomains?: readonly string[];
  /**
   * Exact hosts that are never tenants, whatever they look like. Used to pin
   * the canonical apex and a preview base host.
   */
  baseHosts?: readonly string[];
  /**
   * Allow a tenant label in front of a deeper host (`acme.8080-xyz.e2b.app`).
   * Off by default: it is only safe when the apex is stable, and enabling it
   * against a loose apex would make the base host itself look like a tenant.
   */
  allowNestedHosts?: boolean;
  /** Extra reserved words beyond {@link RESERVED_SUBDOMAINS}. */
  extraReserved?: readonly string[];
}

/** Lowercase, strip the port and any trailing dot. */
export function normalizeHost(host: string): string {
  return (host || '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.+$/, '');
}

/**
 * Extract the tenant slug from a request host, or null when the host is not a
 * tenant subdomain.
 *
 * Returns null for: an empty host, the apex itself, `www.`, any base host, a
 * reserved label, an invalid slug, a host under no configured apex, and —
 * unless `allowNestedHosts` — a multi-label prefix.
 *
 * This never touches the network. Slug → tenant is a separate lookup.
 */
export function resolveTenantHost(
  host: string | null | undefined,
  options: ResolveTenantHostOptions = {},
): string | null {
  const apexes = (options.apexDomains ?? []).map(normalizeHost).filter(Boolean);
  const baseHosts = new Set((options.baseHosts ?? []).map(normalizeHost).filter(Boolean));
  const reserved = new Set([
    ...RESERVED_SUBDOMAINS,
    ...(options.extraReserved ?? []).map((r) => r.toLowerCase()),
  ]);

  const h = normalizeHost(host ?? '');
  if (!h) return null;
  // PaaS-managed hosts are never tenants, whatever the apex configuration
  // says: `vercel.app` sub-hosts are per-deployment aliases Vercel assigns
  // (`smartfit-mouadlouhichis-projects.vercel.app`) and their prefix can be a
  // perfectly valid slug — with the apex misconfigured to `vercel.app`, every
  // deployment alias resolved to a phantom tenant and the middleware rewrote
  // the entire app into the tenant tree (`/admin` and `/dashboard` 404, the
  // landing page became "not open yet"). Real tenants hang off the
  // deployment's own apex, never off a PaaS host nobody controls. `e2b.app`
  // is the same class (sandbox previews).
  if (h.endsWith('.vercel.app') || h.endsWith('.e2b.app')) return null;
  if (baseHosts.has(h)) return null;

  // Longest apex first so a nested apex wins over its parent.
  const sorted = [...apexes].sort((a, b) => b.length - a.length);
  for (const apex of sorted) {
    if (!apex) continue;
    if (h === apex || h === `www.${apex}`) return null;
    if (!h.endsWith(`.${apex}`)) continue;

    const prefix = h.slice(0, -(apex.length + 1));
    if (!prefix) return null;
    if (reserved.has(prefix)) return null;
    if (!isValidSlug(prefix)) {
      // Multi-label prefix (e.g. the sandbox id under a loose apex). Only the
      // leading label is a candidate, and only when explicitly allowed.
      if (!options.allowNestedHosts) return null;
      const first = prefix.split('.')[0];
      if (!first || reserved.has(first) || !isValidSlug(first)) return null;
      return first;
    }
    return prefix;
  }
  return null;
}

/**
 * Absolute URL for a tenant's public site in production host mode, or the
 * path-fallback URL when no apex is configured (previews, local dev).
 */
export function buildTenantUrl(
  slug: string,
  options: { apexDomain?: string; baseUrl?: string } = {},
): string {
  const apex = options.apexDomain ? normalizeHost(options.apexDomain) : '';
  const origin = options.baseUrl?.replace(/\/+$/, '') ?? '';
  if (apex) return `https://${slug}.${apex}`;
  return `${origin}/g/${slug}`;
}

/** Canonical in-app path for a tenant page. Leading slash, no double slashes. */
export function tenantPath(slug: string, path = ''): string {
  // Collapse interior runs *before* trimming, so '//a//b//' becomes 'a/b'
  // rather than 'a//b'. A doubled slash in a Next.js path is a different
  // route, not a cosmetic wart.
  const clean = path.replace(/\/{2,}/g, '/').replace(/^\/+|\/+$/g, '');
  return clean ? `/g/${slug}/${clean}` : `/g/${slug}`;
}

/** True when a pathname is inside the tenant route tree. */
export function isTenantPath(pathname: string | null | undefined): boolean {
  return /^\/g\/[^/]+/.test(pathname ?? '');
}

/** Pull the slug out of a `/g/{slug}/...` pathname. */
export function slugFromTenantPath(pathname: string | null | undefined): string | null {
  const m = /^\/g\/([^/]+)/.exec(pathname ?? '');
  if (!m) return null;
  const slug = decodeURIComponent(m[1]);
  return isValidSlug(slug) ? slug : null;
}

// ── Roster helpers ───────────────────────────────────────────────────────────

/** Days without a visit before a member counts as at-risk. */
export const AT_RISK_DAYS = 21;

/**
 * True when a member has not been seen for `days`.
 *
 * A member who has never visited is *not* at risk — they are new, and nagging
 * them on day one is how a gym loses them. `lastVisitAt` absent means we have
 * no attendance signal at all, so we abstain.
 */
export function isAtRisk(
  membership: Pick<GymMembership, 'lastVisitAt' | 'status'>,
  now: number,
  days = AT_RISK_DAYS,
): boolean {
  if (membership.status !== 'active') return false;
  if (typeof membership.lastVisitAt !== 'number') return false;
  return now - membership.lastVisitAt > days * 86_400_000;
}

/** Days until a membership lapses; negative when already lapsed. */
export function daysUntilExpiry(expiresAt: number | undefined, now: number): number | null {
  if (typeof expiresAt !== 'number') return null;
  return Math.ceil((expiresAt - now) / 86_400_000);
}

/** Members whose membership expires within `days` — the renewal worklist. */
export function expiringSoon(
  memberships: readonly GymMembership[],
  now: number,
  days = 7,
): GymMembership[] {
  return memberships
    .filter((m) => m.status === 'active')
    .filter((m) => {
      const d = daysUntilExpiry(m.expiresAt, now);
      return d !== null && d >= 0 && d <= days;
    })
    .sort((a, b) => (a.expiresAt ?? 0) - (b.expiresAt ?? 0));
}

/** Count of live seats taken, i.e. bookings that occupy a spot. */
export function seatsTaken(statuses: readonly BookingStatus[]): number {
  return statuses.filter((s) => OCCUPYING_BOOKING_STATUSES.includes(s)).length;
}

/** Remaining capacity, never negative. */
export function seatsLeft(capacity: number, statuses: readonly BookingStatus[]): number {
  return Math.max(0, capacity - seatsTaken(statuses));
}
