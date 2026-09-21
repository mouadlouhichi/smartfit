import 'server-only';
import {
  PLATFORM_ADMIN_CLAIM_VALUE,
  PLATFORM_ROLE_CLAIM,
  type GymStatus,
  type TenantPlan,
} from '@smartfit/core';
import { getAdminServices, type AdminServices } from '@/lib/firebase/admin';
import {
  effectivePlans,
  type AdminApplication,
  type AdminAuditEntry,
  type AdminGymSummary,
  type PlatformInvoice,
} from '@/lib/admin-model';

/**
 * Server-side helpers for the platform-admin API.
 *
 * `platform/**` is denied to browsers by the Firestore rules, so the admin
 * console is only ever as trustworthy as the verification in this file. Every
 * route runs `requirePlatformAdmin` before touching the Admin SDK — the claim
 * is read from the *decoded token*, never from a client-supplied flag, and the
 * same-origin check keeps another site from riding a logged-in tab.
 *
 * The conventions are lifted from the two routes that already shipped
 * (`api/admin/claims`, `api/account/delete`): JSON with `cache-control:
 * no-store`, Node runtime, honest status codes.
 */

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // same-site form posts and curl send no Origin
  const host = req.headers.get('host');
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function bearerToken(req: Request): string | null {
  const value = req.headers.get('authorization');
  if (!value?.startsWith('Bearer ')) return null;
  const token = value.slice('Bearer '.length).trim();
  return token || null;
}

export interface AdminAuth {
  services: AdminServices;
  /** Verified caller — this is the decoded-token uid, not a body field. */
  uid: string;
}

/**
 * The guard's result. Shaped so a plain `if (result.error)` narrows: the
 * success branch declares `error?: undefined` and vice versa, which is the
 * normalisation TypeScript applies to inferred unions — spelled out here
 * because the return type is annotated.
 */
export type PlatformAdminGuard =
  | { services: AdminServices; uid: string; error?: undefined }
  | { services?: undefined; uid?: undefined; error: Response };

/** Resolve the caller or produce the response that explains the refusal. */
export async function requirePlatformAdmin(req: Request): Promise<PlatformAdminGuard> {
  if (!sameOrigin(req))
    return { error: json({ error: 'Cross-origin requests are not allowed.' }, 403) };

  const token = bearerToken(req);
  if (!token) return { error: json({ error: 'A signed-in account is required.' }, 401) };

  let services: AdminServices;
  try {
    services = getAdminServices();
  } catch (err) {
    console.error('[admin] Admin SDK unavailable:', err instanceof Error ? err.message : err);
    return {
      error: json(
        { error: 'Admin services are not configured on this deployment.', retryable: false },
        503,
      ),
    };
  }

  try {
    const decoded = await services.auth.verifyIdToken(token);
    if (decoded[PLATFORM_ROLE_CLAIM] !== PLATFORM_ADMIN_CLAIM_VALUE) {
      return { error: json({ error: 'This action requires a platform administrator.' }, 403) };
    }
    return { services, uid: decoded.uid };
  } catch {
    return { error: json({ error: 'Your sign-in has expired. Sign in again, then retry.' }, 401) };
  }
}

// ── Platform tree paths (browsers are denied all of this) ────────────────────

const platformAuditCol = (services: AdminServices) =>
  services.db.collection('platform').doc('audit').collection('entries');
const platformApplicationsCol = (services: AdminServices) =>
  services.db.collection('platform').doc('applications').collection('entries');
const platformInvoicesCol = (services: AdminServices) =>
  services.db.collection('platform').doc('invoices').collection('entries');

/** Applications queue — read by review, written by the public apply route. */
export const applicationsCollection = platformApplicationsCol;
/** Platform subscription invoices, written when a gym's payment is recorded. */
export const platformInvoiceCollection = platformInvoicesCol;

/**
 * Append to the cross-tenant audit trail.
 *
 * Best-effort by design (a failed audit write must not make the primary
 * action look like it failed) but never silent. Same path the claims route
 * writes to, so the log reads as one stream.
 */
export async function appendPlatformAudit(
  services: AdminServices,
  actorUid: string,
  action: string,
  target: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await platformAuditCol(services).add({
      actorUid,
      action,
      target,
      at: Date.now(),
      ...(meta ? { meta } : {}),
    });
  } catch (err) {
    console.error('[admin] audit write failed:', err instanceof Error ? err.message : err);
  }
}

/** The deployment's plan tiers: `platform/config` overrides over the defaults. */
export async function loadEffectivePlans(services: AdminServices): Promise<TenantPlan[]> {
  const snap = await services.db.collection('platform').doc('config').get();
  const raw = snap.exists ? snap.data() : undefined;
  const overrides = (raw?.plans as TenantPlan[] | undefined) ?? null;
  return effectivePlans(overrides);
}

// ── Registry assembly ────────────────────────────────────────────────────────

/**
 * Build the gym registry with rollups.
 *
 * Deliberately read-heavy: every gym costs a members, classes and invoices
 * read. That is fine at platform-admin scale (tens of gyms, a page the
 * operator opens on purpose) and buys correct, fresh numbers without any
 * counter maintenance — the moment a counter can drift, it will.
 */
export async function loadAdminRegistry(services: AdminServices): Promise<AdminGymSummary[]> {
  const gymsSnap = await services.db.collection('gyms').limit(200).get();
  const summaries = await Promise.all(
    gymsSnap.docs.map(async (doc) => {
      const data = (doc.data() ?? {}) as Record<string, unknown>;
      const [members, classes, invoices] = await Promise.all([
        services.db.collection(`gyms/${doc.id}/members`).get(),
        services.db.collection(`gyms/${doc.id}/classes`).get(),
        services.db.collection(`gyms/${doc.id}/invoices`).limit(500).get(),
      ]);

      let staffCount = 0;
      let memberCount = 0;
      let ownerName: string | undefined;
      for (const m of members.docs) {
        const role = (m.data() as { role?: string }).role;
        if (role === 'owner') ownerName = (m.data() as { displayName?: string }).displayName;
        if (role === 'owner' || role === 'staff') staffCount++;
        else memberCount++;
      }
      const memberRevenueMinor = invoices.docs
        .map((d) => d.data() as { status?: string; amountMinor?: number })
        .filter((i) => i.status === 'paid')
        .reduce((s, i) => s + (i.amountMinor ?? 0), 0);

      return {
        slug: doc.id,
        name: (data.name as string) ?? doc.id,
        status: (data.status as GymStatus) ?? 'pending',
        tenantPlanId: (data.tenantPlanId as string) ?? '',
        ownerUid: (data.ownerUid as string) ?? '',
        ownerName,
        createdAt: (data.createdAt as number) ?? 0,
        updatedAt: data.updatedAt as number | undefined,
        accentColor: (data.branding as { accentColor?: string } | undefined)?.accentColor,
        city: (data.location as { city?: string } | undefined)?.city,
        memberCount,
        staffCount,
        classCount: classes.size,
        memberRevenueMinor,
        currency: 'MAD',
      } satisfies AdminGymSummary;
    }),
  );
  return summaries;
}

export async function loadApplications(services: AdminServices): Promise<AdminApplication[]> {
  const snap = await platformApplicationsCol(services)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as AdminApplication[];
}

export async function loadRecentAudit(services: AdminServices): Promise<AdminAuditEntry[]> {
  const snap = await platformAuditCol(services).orderBy('at', 'desc').limit(50).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as AdminAuditEntry[];
}

export async function loadPlatformInvoices(services: AdminServices): Promise<PlatformInvoice[]> {
  const snap = await platformInvoicesCol(services).orderBy('paidAt', 'desc').limit(100).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as PlatformInvoice[];
}
