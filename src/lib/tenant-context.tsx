'use client';

/**
 * Tenant context — resolves which gym the visitor is looking at, who they are
 * in it, and what that lets them do.
 *
 * ## Server-first, client-refresh
 *
 * The storefront is a public marketing page, so its content must be in the
 * initial HTML rather than arriving after hydration. The layout therefore loads
 * the tenant on the server (`./tenant-server`) and hands the result here as
 * `initial`; this provider seeds from it and renders immediately. In cloud mode
 * it then refetches on the client so the page stays live, and `reload()` forces
 * a refetch after a write.
 *
 * In demo mode the refetch is skipped entirely — the fixture is deterministic,
 * so fetching it again would only cause a flicker.
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
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  can,
  roleFromGymRole,
  toRole,
  type Capability,
  type GymMembership,
  type GymTenant,
  type Role,
} from '@smartfit/core';
import {
  loadBookingsForSlot,
  loadClasses,
  loadGym,
  loadInvoices,
  loadMyMembership,
  loadPlans,
  loadRoster,
  loadSlots,
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

export interface TenantState {
  slug: string;
  mode: 'cloud' | 'demo';
  loading: boolean;
  error: string | null;
  gym: GymTenant | null;
  roster: GymMembership[];
  classes: GymClass[];
  slots: GymSlot[];
  bookings: GymBooking[];
  plans: MembershipPlanDoc[];
  invoices: InvoiceDoc[];
  /** This visitor's membership row, if any. */
  membership: GymMembership | null;
  /** Resolved role — the only input to permission checks in the UI. */
  role: Role;
  /** Derived numbers the console shows, recomputed from the raw collections. */
  metrics: TenantMetrics;
  /** Demo-only role override; null in cloud mode. */
  demoRole: Role | null;
  setDemoRole: (role: Role) => void;
  can: (capability: Capability) => boolean;
  reload: () => void;
}

const TenantContext = createContext<TenantState | null>(null);

/** How far ahead the timetable loads. */
const TIMETABLE_WINDOW_MS = 14 * 86_400_000;

const EMPTY: Omit<TenantInitialData, 'mode'> = {
  gym: null,
  roster: [],
  classes: [],
  slots: [],
  bookings: [],
  plans: [],
  invoices: [],
};

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

  // Seeded from the server payload so the first paint already has content.
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
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadCloud() {
      try {
        const uid = user?.uid;
        const [tenant, mine, allClasses] = await Promise.all([
          loadGym(slug),
          uid ? loadMyMembership(slug, uid) : Promise.resolve(null),
          loadClasses(slug),
        ]);
        if (cancelled) return;
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
        if (cancelled) return;
        setSlots(allSlots);
        setPlans(allPlans);

        // Roster and money are operator-only; asking for them as a member would
        // be a rules denial, so don't ask.
        if (isOperator) {
          const [allRoster, allInvoices] = await Promise.all([
            loadRoster(slug).catch(() => []),
            loadInvoices(slug).catch(() => []),
          ]);
          if (cancelled) return;
          setRoster(allRoster);
          setInvoices(allInvoices);
        }

        const perSlot = await Promise.all(allSlots.map((s) => loadBookingsForSlot(slug, s.id)));
        if (cancelled) return;
        setBookings(perSlot.flat());
      } catch (err) {
        if (!cancelled) setError(tenantErrorMessage(err));
      }
    }

    // The claim check is separate and best-effort: a failure must not stop the
    // storefront rendering for an ordinary visitor.
    let claimCancelled = false;
    if (mode === 'cloud' && user) {
      user
        .getIdTokenResult()
        .then((res) => {
          if (!claimCancelled) setPlatformAdmin(res.claims?.sfRole === 'platform-admin');
        })
        .catch(() => {
          if (!claimCancelled) setPlatformAdmin(false);
        });
    } else {
      setPlatformAdmin(false);
    }

    // Demo data is deterministic; re-fetching it would only flicker.
    if (mode === 'demo') {
      setGym((g) => g ?? null);
      setLoading(false);
      return () => {
        cancelled = true;
        claimCancelled = true;
      };
    }

    setLoading(!initial || nonce > 0);
    setError(null);
    void loadCloud().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      claimCancelled = true;
    };
  }, [slug, mode, user, nonce, initial]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

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
    };
  }, [
    slug,
    mode,
    loading,
    error,
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
  ]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantState {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within <TenantProvider>');
  return ctx;
}

export { EMPTY };

// ── Derived metrics ──────────────────────────────────────────────────────────

export type { TenantMetrics } from './tenant-metrics';
export { computeMetrics, formatMoney } from './tenant-metrics';
