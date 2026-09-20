'use client';

/**
 * Tenant context — resolves which gym the visitor is looking at, who they are
 * in it, what that lets them do, and how to change things.
 *
 * ## Server-first, client-refresh
 *
 * The storefront is a public marketing page, so its content must be in the
 * initial HTML rather than arriving after hydration. The layout loads the
 * tenant on the server (`./tenant-server`) and hands the result here as
 * `initial`; this provider seeds from it and renders immediately. In cloud mode
 * it then refetches so the page stays live.
 *
 * ## Role resolution
 *
 *  - `platform-admin` comes from the `sfRole` custom claim on the ID token.
 *  - `gym-owner` / `gym-staff` / `member` come from the membership document,
 *    which is also what the Firestore rules `get()`. The two must agree, and
 *    keeping both in this one file is what keeps them agreeing.
 *
 * In demo mode there is no signed-in user, so a switcher picks the role. It is
 * labelled as a demo control and rendered only in demo mode — it is not a
 * privilege-escalation path, because in cloud mode the claim and the membership
 * document are the only inputs.
 *
 * ## Writes
 *
 * Every mutation goes through `run()`, which is the only place that knows the
 * difference between cloud and demo. In cloud mode it writes to Firestore and
 * refetches, so the UI shows what the *server* accepted rather than an
 * optimistic guess — the rules may reject a write the client thought was fine,
 * and papering over that is how a UI ends up lying. In demo mode it edits local
 * state so the console is explorable without a project.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  can,
  roleFromGymRole,
  toRole,
  type Capability,
  type GymMembership,
  type GymTenant,
  type MemberStatus,
  type Role,
} from '@smartfit/core';
import {
  checkIn,
  deleteClass,
  issueInvoice,
  loadBookingsForSlot,
  loadClasses,
  loadGym,
  loadInvoices,
  loadMyMembership,
  loadPlans,
  loadRoster,
  loadSlots,
  saveClass,
  saveGymProfile,
  saveMembership,
  savePlan,
  saveSlot,
  tenantErrorMessage,
  type GymBooking,
  type GymClass,
  type GymSlot,
  type InvoiceDoc,
  type MembershipPlanDoc,
} from '@/lib/firebase/tenant-repo';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { useAuth } from '@/lib/firebase/auth-context';
import { computeMetrics, type TenantMetrics } from './tenant-metrics';

/** Payload produced by `loadTenantServer` and consumed here. */
export interface TenantInitialData {
  mode: 'cloud' | 'demo';
  gym: GymTenant | null;
  roster: GymMembership[];
  classes: GymClass[];
  slots: GymSlot[];
  bookings: GymBooking[];
  plans: MembershipPlanDoc[];
  invoices: InvoiceDoc[];
}

export interface TenantMutations {
  setMemberStatus: (uid: string, status: MemberStatus) => Promise<boolean>;
  checkInMember: (uid: string) => Promise<boolean>;
  upsertClass: (cls: GymClass) => Promise<boolean>;
  removeClass: (classId: string) => Promise<boolean>;
  upsertSlot: (slot: GymSlot) => Promise<boolean>;
  createInvoice: (invoice: InvoiceDoc) => Promise<boolean>;
  upsertPlan: (plan: MembershipPlanDoc) => Promise<boolean>;
  updateGym: (
    patch: Partial<Omit<GymTenant, 'id' | 'status' | 'slug' | 'ownerUid'>>,
  ) => Promise<boolean>;
}

export interface TenantState extends TenantMutations {
  slug: string;
  mode: 'cloud' | 'demo';
  loading: boolean;
  error: string | null;
  /** Name of the mutation in flight, or null. */
  mutating: string | null;
  mutationError: string | null;
  gym: GymTenant | null;
  roster: GymMembership[];
  classes: GymClass[];
  slots: GymSlot[];
  bookings: GymBooking[];
  plans: MembershipPlanDoc[];
  invoices: InvoiceDoc[];
  membership: GymMembership | null;
  role: Role;
  metrics: TenantMetrics;
  demoRole: Role | null;
  setDemoRole: (role: Role) => void;
  can: (capability: Capability) => boolean;
  reload: () => void;
}

const TenantContext = createContext<TenantState | null>(null);

/** How far ahead the timetable loads. */
const TIMETABLE_WINDOW_MS = 14 * 86_400_000;

export function TenantProvider({
  slug,
  initial,
  children,
}: {
  slug: string;
  initial?: TenantInitialData;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const mode: 'cloud' | 'demo' = isFirebaseConfigured ? 'cloud' : 'demo';

  const [gym, setGym] = useState<GymTenant | null>(initial?.gym ?? null);
  const [roster, setRoster] = useState<GymMembership[]>(initial?.roster ?? []);
  const [classes, setClasses] = useState<GymClass[]>(initial?.classes ?? []);
  const [slots, setSlots] = useState<GymSlot[]>(initial?.slots ?? []);
  const [bookings, setBookings] = useState<GymBooking[]>(initial?.bookings ?? []);
  const [plans, setPlans] = useState<MembershipPlanDoc[]>(initial?.plans ?? []);
  const [invoices, setInvoices] = useState<InvoiceDoc[]>(initial?.invoices ?? []);
  const [membership, setMembership] = useState<GymMembership | null>(null);
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const [demoRole, setDemoRole] = useState<Role | null>(mode === 'demo' ? 'gym-owner' : null);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  /**
   * Read everything the current role is allowed to read.
   *
   * Operator-only collections are skipped for members rather than requested and
   * caught: asking for the roster as a member is a rules denial, and a denial in
   * the console log is noise that hides real failures.
   */
  const fetchAll = useCallback(async () => {
    const uid = user?.uid;
    const [tenant, mine, allClasses] = await Promise.all([
      loadGym(slug),
      uid ? loadMyMembership(slug, uid) : Promise.resolve(null),
      loadClasses(slug),
    ]);
    setGym(tenant);
    setMembership(mine);
    setClasses(allClasses);
    if (!tenant) return;

    const gymRole = mine ? roleFromGymRole(mine.role) : 'member';
    const isOperator = gymRole === 'gym-owner' || gymRole === 'gym-staff';

    const [allSlots, allPlans] = await Promise.all([
      loadSlots(slug, Date.now(), Date.now() + TIMETABLE_WINDOW_MS),
      loadPlans(slug),
    ]);
    setSlots(allSlots);
    setPlans(allPlans);

    if (isOperator) {
      const [allRoster, allInvoices] = await Promise.all([
        loadRoster(slug).catch(() => []),
        loadInvoices(slug).catch(() => []),
      ]);
      setRoster(allRoster);
      setInvoices(allInvoices);

      const perSlot = await Promise.all(allSlots.map((s) => loadBookingsForSlot(slug, s.id)));
      setBookings(perSlot.flat());
    }
  }, [slug, user]);

  useEffect(() => {
    let cancelled = false;

    if (mode === 'cloud' && user) {
      user
        .getIdTokenResult()
        .then((res) => {
          if (!cancelled) setPlatformAdmin(res.claims?.sfRole === 'platform-admin');
        })
        .catch(() => {
          if (!cancelled) setPlatformAdmin(false);
        });
    } else {
      setPlatformAdmin(false);
    }

    // Demo data is deterministic; re-fetching it would only flicker.
    if (mode === 'demo') {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);
    fetchAll()
      .catch((err) => {
        if (!cancelled) setError(tenantErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, mode, user, fetchAll]);

  const reload = useCallback(() => {
    if (mode === 'demo') return;
    setLoading(true);
    fetchAll()
      .catch((err) => setError(tenantErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [mode, fetchAll]);

  /**
   * The single write path. Returns false on failure so callers can skip a
   * success toast without try/catch at every call site.
   */
  const run = useCallback(
    async (action: string, cloud: () => Promise<void>, demo: () => void): Promise<boolean> => {
      setMutating(action);
      setMutationError(null);
      try {
        if (mode === 'demo') {
          demo();
        } else {
          await cloud();
          // Refetch rather than patch locally: show what the server accepted.
          await fetchAll();
        }
        return true;
      } catch (err) {
        setMutationError(tenantErrorMessage(err));
        return false;
      } finally {
        setMutating(null);
      }
    },
    [mode, fetchAll],
  );

  const mutations = useMemo<TenantMutations>(
    () => ({
      setMemberStatus: (uid, status) =>
        run(
          `member:${uid}`,
          () => saveMembership(slug, uid, { status }),
          () => setRoster((rows) => rows.map((r) => (r.uid === uid ? { ...r, status } : r))),
        ),
      checkInMember: (uid) =>
        run(
          `checkin:${uid}`,
          () => checkIn(slug, uid),
          () =>
            setRoster((rows) =>
              rows.map((r) =>
                r.uid === uid ? { ...r, checkins: r.checkins + 1, lastVisitAt: Date.now() } : r,
              ),
            ),
        ),
      upsertClass: (cls) =>
        run(
          `class:${cls.id}`,
          () => saveClass(slug, cls),
          () =>
            setClasses((rows) => {
              const next = rows.filter((r) => r.id !== cls.id);
              return [...next, cls].sort((a, b) => a.name.localeCompare(b.name));
            }),
        ),
      removeClass: (classId) =>
        run(
          `class:${classId}`,
          () => deleteClass(slug, classId),
          () => setClasses((rows) => rows.filter((r) => r.id !== classId)),
        ),
      upsertSlot: (slot) =>
        run(
          `slot:${slot.id}`,
          () => saveSlot(slug, slot),
          () =>
            setSlots((rows) => {
              const next = rows.filter((r) => r.id !== slot.id);
              return [...next, slot].sort((a, b) => a.startsAt - b.startsAt);
            }),
        ),
      createInvoice: (invoice) =>
        run(
          `invoice:${invoice.id}`,
          () => issueInvoice(slug, invoice),
          () => setInvoices((rows) => [invoice, ...rows]),
        ),
      upsertPlan: (plan) =>
        run(
          `plan:${plan.id}`,
          () => savePlan(slug, plan),
          () =>
            setPlans((rows) => {
              const next = rows.filter((r) => r.id !== plan.id);
              return [...next, plan];
            }),
        ),
      updateGym: (patch) =>
        run(
          'gym',
          () => saveGymProfile(slug, patch),
          () => setGym((g) => (g ? { ...g, ...patch } : g)),
        ),
    }),
    [run, slug],
  );

  const role: Role = useMemo(() => {
    if (platformAdmin) return 'platform-admin';
    if (mode === 'demo' && demoRole) return demoRole;
    if (!membership) return 'member';
    return toRole(roleFromGymRole(membership.role));
  }, [platformAdmin, mode, demoRole, membership]);

  const value = useMemo<TenantState>(() => {
    const metrics = computeMetrics({ roster, slots, invoices, plans });
    return {
      slug,
      mode,
      loading,
      error,
      mutating,
      mutationError,
      gym,
      roster,
      classes,
      slots,
      bookings,
      plans,
      invoices,
      membership,
      role,
      metrics,
      demoRole: mode === 'demo' ? demoRole : null,
      setDemoRole,
      can: (capability: Capability) => can(role, capability),
      reload,
      ...mutations,
    };
  }, [
    slug,
    mode,
    loading,
    error,
    mutating,
    mutationError,
    gym,
    roster,
    classes,
    slots,
    bookings,
    plans,
    invoices,
    membership,
    role,
    demoRole,
    reload,
    mutations,
  ]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantState {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within <TenantProvider>');
  return ctx;
}

export type { TenantMetrics };
export { computeMetrics, formatMoney } from './tenant-metrics';
