/**
 * Platform-admin domain model — the pure half of the admin console.
 *
 * Everything here is framework-free and side-effect-free so the API routes
 * (Node, Admin SDK), the demo fixtures and the client UI all agree by
 * construction — the same split the tenant tree uses (`tenant-metrics.ts`).
 *
 * ## The trust boundary, stated once
 *
 * `platform/**` is denied to browsers outright by the Firestore rules, so this
 * data only ever moves through Admin-SDK routes that re-verify the `sfRole`
 * claim. Nothing in this file enforces that — it is shapes and arithmetic.
 */
import {
  DEFAULT_TENANT_PLANS,
  isGymLive,
  isValidSlug,
  slugify,
  type GymHours,
  type GymStatus,
  type TenantPlan,
  type TenantPlanLimits,
} from '@smartfit/core';

// ── Shapes ───────────────────────────────────────────────────────────────────

/** One row of the gym registry: a tenant plus the rollups the console shows. */
export interface AdminGymSummary {
  slug: string;
  name: string;
  status: GymStatus;
  tenantPlanId: string;
  ownerUid: string;
  ownerName?: string;
  createdAt: number;
  updatedAt?: number;
  accentColor?: string;
  city?: string;
  memberCount: number;
  staffCount: number;
  classCount: number;
  /** Sum of the gym's own paid invoices, all time (its members' money). */
  memberRevenueMinor: number;
  currency: string;
  /** Where the gym stands on its platform contract (dunning-lite). */
  contract?: 'trial' | 'current' | 'due' | 'overdue';
  /** Last platform payment, when any. */
  lastPaymentAt?: number;
  tagline?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  address?: string;
  hours?: GymHours;
  openDays?: number;
}

/** A "list your gym" request. PII-light on purpose: what a stranger would type. */
export interface AdminApplication {
  id: string;
  gymName: string;
  /** Requested subdomain; empty when the applicant left it to us. */
  slug?: string;
  city?: string;
  email: string;
  instagram?: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  decidedAt?: number;
  decidedBy?: string;
  reason?: string;
  /** Slug actually provisioned, once approved. */
  provisionedSlug?: string;
}

export interface AdminAuditEntry {
  id: string;
  actorUid: string;
  action: string;
  target: string;
  at: number;
  meta?: Record<string, unknown>;
}

/** A gym's subscription payment to SmartFit (cash/transfer are the local norm). */
export interface PlatformInvoice {
  id: string;
  slug: string;
  amountMinor: number;
  currency: string;
  method: 'cash' | 'card' | 'transfer' | 'cmi' | 'other';
  status: 'paid';
  paidAt: number;
  recordedBy: string;
  note?: string;
}

/** The KPI band on the admin overview. */
export interface AdminOverview {
  totalGyms: number;
  liveGyms: number;
  byStatus: Record<GymStatus, number>;
  membersTotal: number;
  staffTotal: number;
  classesTotal: number;
  /** Platform MRR: live *paying* tenants only — trials are not revenue. */
  platformMrrMinor: number;
  mrrByPlan: Record<string, number>;
  newThisMonth: number;
  pendingApplications: number;
  collected30dMinor: number;
}

/** Everything one admin page load needs, produced by `/api/admin/data`. */
export interface AdminData {
  mode: 'cloud' | 'demo';
  gyms: AdminGymSummary[];
  applications: AdminApplication[];
  audit: AdminAuditEntry[];
  invoices: PlatformInvoice[];
  plans: TenantPlan[];
}

export const EMPTY_ADMIN_OVERVIEW: AdminOverview = {
  totalGyms: 0,
  liveGyms: 0,
  byStatus: { pending: 0, trial: 0, active: 0, past_due: 0, suspended: 0, closed: 0 },
  membersTotal: 0,
  staffTotal: 0,
  classesTotal: 0,
  platformMrrMinor: 0,
  mrrByPlan: {},
  newThisMonth: 0,
  pendingApplications: 0,
  collected30dMinor: 0,
};

// ── Plan configuration ───────────────────────────────────────────────────────

/** The tiers a deployment runs with: `platform/config` overrides over defaults. */
export function effectivePlans(overrides: TenantPlan[] | null | undefined): TenantPlan[] {
  if (!overrides || overrides.length === 0) return DEFAULT_TENANT_PLANS;
  // An override may redefine one tier or add a new one; tiers without an
  // override keep their shipped defaults rather than silently vanishing.
  const byId = new Map(DEFAULT_TENANT_PLANS.map((p) => [p.id, p]));
  for (const p of overrides) {
    if (p && typeof p.id === 'string') byId.set(p.id, p);
  }
  return [...byId.values()];
}

/** Bounds a plan edit accepts. Generous on purpose: limits are a brake, not a business model. */
export const PLAN_LIMIT_BOUNDS: Record<keyof TenantPlanLimits, [number, number]> = {
  members: [1, 100_000],
  locations: [1, 100],
  staffSeats: [0, 1_000],
  classesPerWeek: [1, 2_000],
  customBranding: [0, 1],
  customDomain: [0, 1],
  apiAccess: [0, 1],
};

export const PRICE_BOUNDS_MINOR: [number, number] = [0, 10_000_000];

/**
 * Validate a plan patch coming from the console. Returns a cleaned patch or a
 * reason — the route sends the reason straight back to the UI.
 */
export function validatePlanPatch(
  planId: string,
  patch: { monthlyPriceMinor?: unknown; limits?: Record<string, unknown> },
):
  | { ok: true; patch: { monthlyPriceMinor?: number; limits?: Partial<TenantPlanLimits> } }
  | { ok: false; reason: string } {
  if (!planId || typeof planId !== 'string') return { ok: false, reason: 'A plan id is required.' };

  const out: { monthlyPriceMinor?: number; limits?: Partial<TenantPlanLimits> } = {};

  if (patch.monthlyPriceMinor !== undefined) {
    const price = Number(patch.monthlyPriceMinor);
    if (
      !Number.isInteger(price) ||
      price < PRICE_BOUNDS_MINOR[0] ||
      price > PRICE_BOUNDS_MINOR[1]
    ) {
      return {
        ok: false,
        reason: `Price must be an integer between 0 and ${PRICE_BOUNDS_MINOR[1]}.`,
      };
    }
    out.monthlyPriceMinor = price;
  }

  if (patch.limits !== undefined) {
    const limits: Partial<TenantPlanLimits> = {};
    for (const key of Object.keys(PLAN_LIMIT_BOUNDS) as (keyof TenantPlanLimits)[]) {
      const raw = patch.limits?.[key];
      if (raw === undefined) continue;
      const [lo, hi] = PLAN_LIMIT_BOUNDS[key];
      if (typeof raw === 'boolean') {
        (limits as Record<string, unknown>)[key] = raw;
        continue;
      }
      const n = Number(raw);
      if (!Number.isInteger(n) || n < lo || n > hi) {
        return { ok: false, reason: `${key} must be an integer between ${lo} and ${hi}.` };
      }
      (limits as Record<string, unknown>)[key] = n;
    }
    if (Object.keys(limits).length > 0) out.limits = limits;
  }

  if (out.monthlyPriceMinor === undefined && out.limits === undefined) {
    return { ok: false, reason: 'Nothing to change.' };
  }
  return { ok: true, patch: out };
}

// ── Overview arithmetic ──────────────────────────────────────────────────────

/** Local calendar month key of a timestamp — the month the operator sees. */
function monthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Compute the KPI band from registry rows.
 *
 * MRR counts only tenants that are both live *and* paying: `trial` gyms have
 * not bought anything yet, and a suspended gym is precisely the one whose
 * invoice is not arriving. A tenant on an unknown plan contributes 0 rather
 * than NaN — a misconfigured plan must not blank the whole band.
 */
export function computeAdminOverview(
  gyms: readonly AdminGymSummary[],
  applications: readonly AdminApplication[],
  invoices: readonly PlatformInvoice[],
  plans: readonly TenantPlan[],
  now = Date.now(),
): AdminOverview {
  const priceByPlan = new Map(plans.map((p) => [p.id, p.monthlyPriceMinor]));
  const byStatus: Record<GymStatus, number> = { ...EMPTY_ADMIN_OVERVIEW.byStatus };

  let liveGyms = 0;
  let membersTotal = 0;
  let staffTotal = 0;
  let classesTotal = 0;
  let platformMrrMinor = 0;
  let newThisMonth = 0;
  const mrrByPlan: Record<string, number> = {};
  const thisMonth = monthKey(now);

  for (const gym of gyms) {
    byStatus[gym.status] = (byStatus[gym.status] ?? 0) + 1;
    membersTotal += gym.memberCount;
    staffTotal += gym.staffCount;
    classesTotal += gym.classCount;
    if (monthKey(gym.createdAt) === thisMonth) newThisMonth++;
    if (isGymLive(gym.status)) liveGyms++;
    if (gym.status === 'active' || gym.status === 'past_due') {
      const price = priceByPlan.get(gym.tenantPlanId) ?? 0;
      platformMrrMinor += price;
      mrrByPlan[gym.tenantPlanId] = (mrrByPlan[gym.tenantPlanId] ?? 0) + price;
    }
  }

  const cutoff = now - 30 * 86_400_000;
  const collected30dMinor = invoices
    .filter((i) => i.status === 'paid' && i.paidAt >= cutoff)
    .reduce((s, i) => s + i.amountMinor, 0);

  return {
    totalGyms: gyms.length,
    liveGyms,
    byStatus,
    membersTotal,
    staffTotal,
    classesTotal,
    platformMrrMinor,
    mrrByPlan,
    newThisMonth,
    pendingApplications: applications.filter((a) => a.status === 'pending').length,
    collected30dMinor,
  };
}

// ── Application intake ───────────────────────────────────────────────────────

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** What a public application form may carry. Everything is optional but name + email. */
export interface ApplicationInput {
  gymName: unknown;
  slug: unknown;
  city: unknown;
  email: unknown;
  instagram: unknown;
  message: unknown;
}

export interface ValidatedApplication {
  gymName: string;
  slug: string;
  city?: string;
  email: string;
  instagram?: string;
  message?: string;
}

/**
 * Validate and normalise a public application.
 *
 * The slug is *suggested*, not taken: uniqueness is checked at decision time
 * against Firestore, because checking here would need a read and the form is
 * public. An invalid or reserved requested slug is an error rather than a
 * silent rewrite — the applicant chose it, and `zone-fight2` behind their back
 * is worse than a clear message asking them to pick again.
 */
export function validateApplication(
  input: ApplicationInput,
): { ok: true; value: ValidatedApplication } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  const gymName = typeof input.gymName === 'string' ? input.gymName.trim() : '';
  if (gymName.length < 2 || gymName.length > 80) {
    errors.push('The gym name must be between 2 and 80 characters.');
  }

  const email = typeof input.email === 'string' ? input.email.trim() : '';
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    errors.push('A valid contact email is required.');
  }

  const city = typeof input.city === 'string' ? input.city.trim() : '';
  if (city.length > 80) errors.push('The city must be at most 80 characters.');

  const instagram = typeof input.instagram === 'string' ? input.instagram.trim() : '';
  if (instagram.length > 80) errors.push('The Instagram handle must be at most 80 characters.');

  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (message.length > 1000) errors.push('The message must be at most 1000 characters.');

  const rawSlug = typeof input.slug === 'string' ? input.slug.trim().toLowerCase() : '';
  if (rawSlug && rawSlug.length > 48) {
    errors.push('The requested address must be at most 48 characters.');
  }

  if (errors.length > 0) return { ok: false, errors };

  // `slugify` here is a *check*, not a generator: a reserved or malformed
  // requested slug is a clear error rather than a silent rewrite — the
  // applicant chose it, and `zone-fight2` behind their back is worse.
  const slug = rawSlug ? slugify(rawSlug) : '';
  if (rawSlug && (!slug || !isValidSlug(slug))) {
    return {
      ok: false,
      errors: [
        `"${rawSlug}" cannot be a gym address (reserved words and punctuation are not allowed). Pick another, or leave it blank and we will suggest one.`,
      ],
    };
  }

  return {
    ok: true,
    value: {
      gymName,
      slug,
      email,
      ...(city ? { city } : {}),
      ...(instagram ? { instagram } : {}),
      ...(message ? { message } : {}),
    },
  };
}

// ── Console analytics ────────────────────────────────────────────────────────
//
// Pure chart-and-triage arithmetic for the admin console. Everything here is
// derived client-side from data the console already loads — no new reads, no
// counters to drift. Companion shapes live in `admin-demo.ts` fixtures so the
// demo console exercises the same code paths as the cloud one.

export interface MonthBucket {
  /** `YYYY-MM`, the local calendar month. */
  key: string;
  /** Short label for chart axes: `Mar`, `Apr`, … */
  label: string;
  /** Sum of the bucketed value. */
  total: number;
  /** Bucket items, oldest first — callers decide what to count. */
  count: number;
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * The last `count` calendar months (oldest → newest), each with the sum of
 * `value` for the items that fall in it. Items before the window are dropped,
 * not smeared into the first bucket — a payment from last year must not fake a
 * spike in this January.
 */
export function monthBuckets<T>(
  items: readonly T[],
  count: number,
  getAt: (item: T) => number,
  getValue: (item: T) => number = () => 1,
  now: number = Date.now(),
): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  const cursor = new Date(now);
  cursor.setDate(1);
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: MONTH_SHORT[d.getMonth()],
      total: 0,
      count: 0,
    });
  }
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const item of items) {
    const at = getAt(item);
    if (!Number.isFinite(at) || at > now) continue;
    const d = new Date(at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const i = index.get(key);
    if (i === undefined) continue; // outside the window
    buckets[i].total += getValue(item);
    buckets[i].count += 1;
  }
  return buckets;
}

/** Payments split by method — cash vs transfer vs CMI is a real ops question. */
export function invoicesByMethod(
  invoices: readonly PlatformInvoice[],
): { method: string; totalMinor: number; count: number }[] {
  const map = new Map<string, { totalMinor: number; count: number }>();
  for (const i of invoices) {
    const cur = map.get(i.method) ?? { totalMinor: 0, count: 0 };
    cur.totalMinor += i.amountMinor;
    cur.count += 1;
    map.set(i.method, cur);
  }
  return [...map.entries()]
    .map(([method, v]) => ({ method, ...v }))
    .sort((a, b) => b.totalMinor - a.totalMinor);
}

/** One actionable row of the "needs attention" panel, worst first. */
export interface AttentionItem {
  severity: 'high' | 'medium';
  reason: string;
  /** Deep link — always somewhere useful, never a dead end. */
  href: string;
}

/**
 * Triage: what an operator should look at *today*, derived from the registry.
 *
 * - overdue contracts — money the platform is owed
 * - trials older than `trialDays` (default 14) — about to need a decision
 * - suspended gyms — either restore or close, but decide
 * - pending applications — the queue the whole funnel lives on
 */
export function collectAttention(
  gyms: readonly AdminGymSummary[],
  applications: readonly AdminApplication[],
  now: number = Date.now(),
  trialDays = 14,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const g of gyms) {
    if (g.contract === 'overdue') {
      items.push({
        severity: 'high',
        reason: `${g.name} is overdue on its platform plan`,
        href: `/admin/gyms/${g.slug}`,
      });
    }
    if (g.status === 'trial') {
      const ageDays = Math.floor((now - g.createdAt) / 86_400_000);
      if (ageDays >= trialDays) {
        items.push({
          severity: 'medium',
          reason: `${g.name} trial is ${ageDays}d old — convert or park it`,
          href: `/admin/gyms/${g.slug}`,
        });
      }
    }
    if (g.status === 'suspended') {
      items.push({
        severity: 'medium',
        reason: `${g.name} is suspended — restore or close`,
        href: `/admin/gyms/${g.slug}`,
      });
    }
  }
  const pending = applications.filter((a) => a.status === 'pending').length;
  if (pending > 0) {
    items.push({
      severity: 'high',
      reason: `${pending} application${pending === 1 ? '' : 's'} waiting for review`,
      href: '/admin/applications',
    });
  }
  const rank = { high: 0, medium: 1 } as const;
  return items.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** `"3d ago"`, `"5h ago"`, `"just now"` — the audit feed's clock. */
export function relativeTime(ms: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ms);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** Count of weekdays with published hours — the "is the door schedule set" KPI. */
export function countOpenDays(hours: GymHours | undefined): number {
  if (!hours) return 0;
  let n = 0;
  for (let day = 0; day < 7; day++) {
    const h = hours[day];
    if (h && typeof h.open === 'string' && typeof h.close === 'string') n += 1;
  }
  return n;
}
