'use client';

/**
 * Platform-admin context — data, gate and mutations for `/admin/**`.
 *
 * ## Why the admin console talks to API routes, not Firestore
 *
 * The rules deny `platform/**` to browsers outright — that is the security
 * model. So unlike the tenant tree (which reads Firestore directly under the
 * rules), every admin read and write goes through `/api/admin/*` routes that
 * verify the `sfRole` claim server-side. The client-side gate below is
 * convenience and UX; the routes are the boundary.
 *
 * ## Two modes, one shape
 *
 * Demo mode (no Firebase) serves `admin-demo.ts` fixtures and applies
 * mutations locally, so the console is explorable in previews. Cloud mode
 * POSTs and **refetches** — the screen shows what the server accepted, never
 * an optimistic guess (the same rule the tenant provider follows).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { slugify, type TenantPlan } from '@smartfit/core';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { useAuth } from '@/lib/firebase/auth-context';
import {
  computeAdminOverview,
  validatePlanPatch,
  type AdminApplication,
  type AdminAuditEntry,
  type AdminData,
  type AdminOverview,
  type PlatformInvoice,
} from '@/lib/admin-model';
import { demoAdminData } from '@/lib/admin-demo';

export interface CreateGymInput {
  name: string;
  /** Explicit address; generated from the name when omitted. */
  slug?: string;
  city?: string;
  /** Resolved to the owner membership row when an account exists. */
  ownerEmail?: string;
  planId?: string;
  accentColor?: string;
  tagline?: string;
}

export interface AdminMutations {
  /** suspend / restore / close a tenant. */
  setGymStatus: (slug: string, action: 'suspend' | 'restore' | 'close') => Promise<boolean>;
  setGymPlan: (slug: string, planId: string) => Promise<boolean>;
  /** Assign the owner by uid or email (writes the membership row too). */
  assignOwner: (slug: string, uidOrEmail: string) => Promise<boolean>;
  /** Provision a tenant directly — no application needed. */
  createGym: (input: CreateGymInput) => Promise<{ ok: boolean; slug?: string; note?: string }>;
  /** Approve (optionally with a slug override) or reject (with a reason). */
  decideApplication: (
    appId: string,
    decision: 'approve' | 'reject',
    extra?: { slug?: string; reason?: string },
  ) => Promise<{ ok: boolean; slug?: string; note?: string }>;
  /** Edit one tier's price/limits. */
  savePlan: (
    planId: string,
    patch: { monthlyPriceMinor?: number; limits?: Partial<TenantPlan['limits']> },
  ) => Promise<boolean>;
  /** Record a gym's subscription payment (default: the plan price). */
  recordPayment: (
    slug: string,
    opts: { method: PlatformInvoice['method']; note?: string },
  ) => Promise<boolean>;
}

export interface AdminState extends AdminMutations {
  mode: 'cloud' | 'demo';
  data: AdminData;
  overview: AdminOverview;
  loading: boolean;
  error: string | null;
  /** Name of the mutation in flight, or null. */
  mutating: string | null;
  mutationError: string | null;
  reload: () => void;
}

const AdminContext = createContext<AdminState | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const mode: 'cloud' | 'demo' = isFirebaseConfigured ? 'cloud' : 'demo';

  const [data, setData] = useState<AdminData>(() =>
    mode === 'demo'
      ? demoAdminData()
      : {
          mode: 'cloud',
          gyms: [],
          applications: [],
          audit: [],
          invoices: [],
          plans: [],
        },
  );
  const [loading, setLoading] = useState(mode === 'cloud');
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch('/api/admin/data', {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const body = (await res.json().catch(() => ({}))) as Partial<AdminData> & { error?: string };
    if (!res.ok) throw new Error(body.error ?? 'The platform data could not be loaded.');
    setData(body as AdminData);
  }, [user]);

  useEffect(() => {
    if (mode !== 'cloud' || !user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchData()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Something went wrong.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, user, fetchData]);

  const reload = useCallback(() => {
    if (mode !== 'cloud') return;
    setLoading(true);
    fetchData()
      .catch((err) => setError(err instanceof Error ? err.message : 'Something went wrong.'))
      .finally(() => setLoading(false));
  }, [mode, fetchData]);

  /** POST a mutation, then refetch — show what the server accepted. */
  const post = useCallback(
    async (
      action: string,
      path: string,
      payload: Record<string, unknown>,
    ): Promise<{ ok: boolean; body: Record<string, unknown> }> => {
      setMutating(action);
      setMutationError(null);
      try {
        const token = await user?.getIdToken();
        const res = await fetch(path, {
          method: 'POST',
          headers: {
            authorization: token ? `Bearer ${token}` : '',
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          const message = typeof body.error === 'string' ? body.error : 'The action failed.';
          setMutationError(message);
          return { ok: false, body: { error: message } };
        }
        await fetchData();
        return { ok: true, body };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'The action failed.';
        setMutationError(message);
        return { ok: false, body: { error: message } };
      } finally {
        setMutating(null);
      }
    },
    [user, fetchData],
  );

  /** Demo-mode audit: keep the log honest about what was done locally. */
  const demoAudit = useCallback(
    (action: string, target: string, meta?: Record<string, unknown>) => {
      setData((d) => ({
        ...d,
        audit: [
          {
            id: `audit-demo-${Date.now()}`,
            actorUid: 'demo-admin',
            action,
            target,
            at: Date.now(),
            ...(meta ? { meta } : {}),
          },
          ...d.audit,
        ],
      }));
    },
    [],
  );

  const mutations = useMemo<AdminMutations>(
    () => ({
      setGymStatus: (slug, action) =>
        mode === 'demo'
          ? Promise.resolve(
              (() => {
                const status =
                  action === 'suspend' ? 'suspended' : action === 'restore' ? 'active' : 'closed';
                setData((d) => ({
                  ...d,
                  gyms: d.gyms.map((g) => (g.slug === slug ? { ...g, status } : g)),
                }));
                demoAudit(`gym:${action}`, slug, { status });
                return true;
              })(),
            )
          : post(`gym:${action}`, '/api/admin/gym', { slug, action }).then((r) => r.ok),

      setGymPlan: (slug, planId) =>
        mode === 'demo'
          ? Promise.resolve(
              (() => {
                setData((d) => ({
                  ...d,
                  gyms: d.gyms.map((g) => (g.slug === slug ? { ...g, tenantPlanId: planId } : g)),
                }));
                demoAudit('gym:plan', slug, { planId });
                return true;
              })(),
            )
          : post('gym:set-plan', '/api/admin/gym', { slug, action: 'set-plan', planId }).then(
              (r) => r.ok,
            ),

      assignOwner: (slug, uid) =>
        mode === 'demo'
          ? Promise.resolve(
              (() => {
                setData((d) => ({
                  ...d,
                  gyms: d.gyms.map((g) =>
                    g.slug === slug ? { ...g, ownerUid: uid, ownerName: uid } : g,
                  ),
                }));
                demoAudit('gym:assign-owner', slug, { ownerUid: uid });
                return true;
              })(),
            )
          : post('gym:assign-owner', '/api/admin/gym', { slug, action: 'assign-owner', uid }).then(
              (r) => r.ok,
            ),

      createGym: (input) => {
        if (mode === 'demo') {
          const base = (input.slug || slugify(input.name)).toLowerCase();
          let slug = base;
          for (let i = 2; data.gyms.some((g) => g.slug === slug); i++) slug = `${base}-${i}`;
          setData((d) => ({
            ...d,
            gyms: [
              ...d.gyms,
              {
                slug,
                name: input.name,
                status: 'trial' as const,
                tenantPlanId: input.planId || data.plans[0]?.id || 'starter',
                ownerUid: '',
                createdAt: Date.now(),
                accentColor: input.accentColor,
                city: input.city,
                memberCount: 0,
                staffCount: 0,
                classCount: 0,
                memberRevenueMinor: 0,
                currency: 'MAD',
              },
            ],
          }));
          demoAudit('gym:create', slug, { name: input.name });
          return Promise.resolve({ ok: true, slug });
        }
        return post('gym:create', '/api/admin/gym', { action: 'create', ...input }).then((r) => ({
          ok: r.ok,
          slug: typeof r.body.slug === 'string' ? r.body.slug : undefined,
          note: typeof r.body.ownerNote === 'string' ? r.body.ownerNote : undefined,
        }));
      },

      decideApplication: async (appId, decision, extra) => {
        if (mode === 'demo') {
          const app = data.applications.find((a) => a.id === appId);
          let provisioned: string | undefined;
          if (decision === 'approve' && app) {
            const base = extra?.slug || app.slug || slugify(app.gymName);
            let slug = base;
            for (let i = 2; data.gyms.some((g) => g.slug === slug); i++) slug = `${base}-${i}`;
            provisioned = slug;
            const plan = data.plans[0];
            setData((d) => ({
              ...d,
              gyms: [
                ...d.gyms,
                {
                  slug,
                  name: app.gymName,
                  status: 'trial' as const,
                  tenantPlanId: plan?.id ?? 'starter',
                  ownerUid: '',
                  createdAt: Date.now(),
                  accentColor: undefined,
                  city: app.city,
                  memberCount: 0,
                  staffCount: 0,
                  classCount: 0,
                  memberRevenueMinor: 0,
                  currency: 'MAD',
                },
              ],
              applications: d.applications.map((a) =>
                a.id === appId
                  ? {
                      ...a,
                      status: 'approved' as const,
                      decidedAt: Date.now(),
                      provisionedSlug: slug,
                    }
                  : a,
              ),
            }));
            demoAudit('application:approve', appId, { gymName: app.gymName, slug });
            return { ok: true, slug };
          }
          setData((d) => ({
            ...d,
            applications: d.applications.map((a) =>
              a.id === appId
                ? {
                    ...a,
                    status: 'rejected' as const,
                    decidedAt: Date.now(),
                    reason: extra?.reason,
                  }
                : a,
            ),
          }));
          demoAudit('application:reject', appId, { gymName: app?.gymName });
          return { ok: true };
        }
        const r = await post(`application:${appId}`, '/api/admin/application', {
          appId,
          decision,
          ...(extra?.slug ? { slug: extra.slug } : {}),
          ...(extra?.reason ? { reason: extra.reason } : {}),
        });
        return {
          ok: r.ok,
          slug: typeof r.body.slug === 'string' ? r.body.slug : undefined,
          note: typeof r.body.ownerNote === 'string' ? r.body.ownerNote : undefined,
        };
      },

      savePlan: (planId, patch) => {
        const validated = validatePlanPatch(
          planId,
          patch as { monthlyPriceMinor?: unknown; limits?: Record<string, unknown> },
        );
        if (!validated.ok) {
          setMutationError(validated.reason);
          return Promise.resolve(false);
        }
        if (mode === 'demo') {
          setData((d) => ({
            ...d,
            plans: d.plans.map((p) =>
              p.id === planId
                ? {
                    ...p,
                    ...(validated.patch.monthlyPriceMinor !== undefined
                      ? { monthlyPriceMinor: validated.patch.monthlyPriceMinor }
                      : {}),
                    limits: { ...p.limits, ...(validated.patch.limits ?? {}) },
                  }
                : p,
            ),
          }));
          demoAudit('plan:update', planId);
          return Promise.resolve(true);
        }
        return post('plan:update', '/api/admin/plan', { planId, ...validated.patch }).then(
          (r) => r.ok,
        );
      },

      recordPayment: (slug, opts) =>
        mode === 'demo'
          ? Promise.resolve(
              (() => {
                const gym = data.gyms.find((g) => g.slug === slug);
                const plan = data.plans.find((p) => p.id === gym?.tenantPlanId);
                const amountMinor = plan?.monthlyPriceMinor ?? 0;
                setData((d) => ({
                  ...d,
                  invoices: [
                    {
                      id: `pinv-demo-${Date.now()}`,
                      slug,
                      amountMinor,
                      currency: plan?.currency ?? 'MAD',
                      method: opts.method,
                      status: 'paid' as const,
                      paidAt: Date.now(),
                      recordedBy: 'demo-admin',
                      ...(opts.note ? { note: opts.note } : {}),
                    },
                    ...d.invoices,
                  ],
                }));
                demoAudit('payment:record', slug, { amountMinor, method: opts.method });
                return true;
              })(),
            )
          : post('payment:record', '/api/admin/payment', {
              slug,
              method: opts.method,
              ...(opts.note ? { note: opts.note } : {}),
            }).then((r) => r.ok),
    }),
    [mode, post, demoAudit, data.applications, data.gyms, data.plans],
  );

  const overview = useMemo(
    () => computeAdminOverview(data.gyms, data.applications, data.invoices, data.plans),
    [data],
  );

  const value = useMemo<AdminState>(
    () => ({
      mode,
      data,
      overview,
      loading,
      error,
      mutating,
      mutationError,
      reload,
      ...mutations,
    }),
    [mode, data, overview, loading, error, mutating, mutationError, reload, mutations],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminState {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within <AdminProvider>');
  return ctx;
}

export type { AdminApplication, AdminAuditEntry, PlatformInvoice };
