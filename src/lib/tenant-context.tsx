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
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  can,
  roleFromGymRole,
  toRole,
  type Capability,
  type BookingStatus,
  type GymMembership,
  type GymShare,
  type GymTenant,
  type MemberStatus,
  type Role,
} from '@smartfit/core';
import {
  bookSeat,
  cancelBooking,
  checkIn,
  deleteClass,
  issueInvoice,
  joinGym,
  loadBookingsForSlot,
  loadCheckins,
  loadClasses,
  loadGym,
  loadGymShare,
  loadInvoices,
  loadMyBookings,
  loadMyMembership,
  loadPlans,
  loadRoster,
  loadSlots,
  markAttendance,
  promoteFromWaitlist,
  revokeGymShare,
  saveClass,
  saveGymProfile,
  saveMembership,
  savePlan,
  saveSlot,
  shareWithGym,
  tenantErrorMessage,
  type BookSeatResult,
  type GymBooking,
  type GymCheckin,
  type GymClass,
  type GymSlot,
  type InvoiceDoc,
  type MembershipPlanDoc,
} from '@/lib/firebase/tenant-repo';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { useAuth } from '@/lib/firebase/auth-context';
import { DEMO_PERSONA_UIDS, demoCheckins, type DemoPersonaKey } from './tenant-demo';
import { computeMetrics, type TenantMetrics } from './tenant-metrics';

/**
 * The role a demo visitor plays. Every value maps to a fixture person (see
 * `DEMO_PERSONA_UIDS`) except `prospect` — the signed-in visitor who has not
 * joined the gym yet, which is what makes the join flow walkable in demo mode.
 */
export type DemoRole = DemoPersonaKey;

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
  /** Self-enrol: always a plain trial member, exactly what the rules accept. */
  joinGymAsMember: () => Promise<boolean>;
  /** Take a seat, or land on the waitlist when the class is full. */
  bookSlot: (slotId: string) => Promise<BookSeatResult | null>;
  /** Release my own seat (or leave the waitlist). */
  cancelMyBooking: (bookingId: string) => Promise<boolean>;
  /** Staff: mark a booking attended or a no-show. */
  markBookingAttendance: (bookingId: string, status: 'attended' | 'no_show') => Promise<boolean>;
  /** Staff: move the head of the waitlist into a freed seat. */
  promoteWaitlist: (bookingId: string) => Promise<boolean>;
  /** Publish (or revoke, with null) my opt-in progress aggregates. */
  updateGymShare: (share: Omit<GymShare, 'gymId'> | null) => Promise<boolean>;
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
  /**
   * Whose eyes the page is seen through — the signed-in user's uid, or the
   * demo persona's. Null for a signed-out visitor (and for the demo
   * platform-admin, who is nobody in this gym).
   */
  viewerUid: string | null;
  /** My bookings in this gym, whatever my role. */
  myBookings: GymBooking[];
  /** Invoices addressed to me. */
  myInvoices: InvoiceDoc[];
  /** My door visits, newest first. */
  myCheckins: GymCheckin[];
  /** My current opt-in share with this gym, null when sharing is off. */
  gymShare: GymShare | null;
  /**
   * True once the viewer's own member-half data is on screen (immediately
   * true in demo mode). Gates the member section against the join-CTA flash.
   */
  memberDataReady: boolean;
  role: Role;
  metrics: TenantMetrics;
  demoRole: DemoRole | null;
  setDemoRole: (role: DemoRole) => void;
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
  const [membershipState, setMembership] = useState<GymMembership | null>(null);
  const [myBookingsState, setMyBookings] = useState<GymBooking[]>([]);
  const [checkins, setCheckins] = useState<GymCheckin[]>(mode === 'demo' ? demoCheckins() : []);
  const [gymShare, setGymShare] = useState<GymShare | null>(null);
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const [demoRole, setDemoRole] = useState<DemoRole | null>(mode === 'demo' ? 'gym-owner' : null);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  /**
   * The uid whose member-half data (membership, my bookings, share) is on
   * screen, or null once resolved for a signed-out visitor. While it lags
   * behind `user` the member section stays hidden rather than flashing the
   * join CTA at someone who joined months ago.
   */
  const [resolvedUid, setResolvedUid] = useState<string | null>(null);

  // Demo mutations read the latest collections to decide (is the class full?
  // whose booking is this?) before applying functional updates. A closure over
  // the state variables would go stale behind the memoised mutations.
  const rosterRef = useRef(roster);
  rosterRef.current = roster;
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const bookingsRef = useRef(bookings);
  bookingsRef.current = bookings;

  /** The demo persona's uid, or null (platform-admin is nobody here). */
  const demoUid = mode === 'demo' && demoRole ? DEMO_PERSONA_UIDS[demoRole] : null;
  const viewerUid = mode === 'demo' ? demoUid : (user?.uid ?? null);

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

    // The member half: my seat list, my invoices, my visits, my share. Each is
    // self-scoped by the rules, so asking as a non-member returns nothing
    // rather than an error — a denial would only add console noise.
    if (uid) {
      const [mineBookings, myShare, myVisits] = await Promise.all([
        loadMyBookings(slug, uid).catch(() => []),
        loadGymShare(uid, slug).catch(() => null),
        loadCheckins(slug, uid).catch(() => []),
      ]);
      setMyBookings(mineBookings);
      setGymShare(myShare);
      setCheckins(myVisits);
      if (!isOperator) {
        setInvoices(await loadInvoices(slug, uid).catch(() => []));
      }
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
        if (!cancelled) {
          setLoading(false);
          setResolvedUid(user?.uid ?? null);
        }
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
      .finally(() => {
        setLoading(false);
        setResolvedUid(user?.uid ?? null);
      });
  }, [mode, fetchAll, user]);

  /**
   * The single write path. Cloud writes refetch rather than patching locally,
   * so the screen shows what the *server* accepted; demo writes edit local
   * state. Returns the result, or null on failure — a caller can never mistake
   * a failed write for a successful one.
   */
  const runVal = useCallback(
    async <T,>(action: string, cloud: () => Promise<T>, demo: () => T): Promise<T | null> => {
      setMutating(action);
      setMutationError(null);
      try {
        if (mode === 'demo') {
          return demo();
        }
        const result = await cloud();
        // Refetch rather than patch locally: show what the server accepted.
        await fetchAll();
        return result;
      } catch (err) {
        setMutationError(tenantErrorMessage(err));
        return null;
      } finally {
        setMutating(null);
      }
    },
    [mode, fetchAll],
  );

  /**
   * Boolean wrapper for mutations whose only result is "did it happen" —
   * the overwhelming majority.
   */
  const run = useCallback(
    async (action: string, cloud: () => Promise<void>, demo: () => void): Promise<boolean> =>
      (await runVal(
        action,
        async () => {
          await cloud();
          return true;
        },
        () => {
          demo();
          return true;
        },
      )) ?? false,
    [runVal],
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
          () => checkIn(slug, uid, user?.uid),
          () => {
            setRoster((rows) =>
              rows.map((r) =>
                r.uid === uid ? { ...r, checkins: r.checkins + 1, lastVisitAt: Date.now() } : r,
              ),
            );
            // Counter *and* visit record, mirroring the cloud batch write.
            setCheckins((rows) => [
              { id: `chk-${Date.now()}`, uid, at: Date.now(), by: demoUid ?? 'demo' },
              ...rows,
            ]);
          },
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
      joinGymAsMember: () =>
        run(
          'join',
          async () => {
            if (!user) throw new Error('Sign in to join this gym.');
            await joinGym(slug, user.uid, {
              displayName: user.displayName ?? undefined,
              email: user.email ?? undefined,
            });
          },
          () => {
            const uid = demoUid ?? DEMO_PERSONA_UIDS.prospect;
            setRoster((rows) =>
              rows.some((r) => r.uid === uid)
                ? rows
                : [
                    ...rows,
                    {
                      uid,
                      role: 'member' as const,
                      status: 'trial' as MemberStatus,
                      joinedAt: Date.now(),
                      checkins: 0,
                      displayName: 'You (demo)',
                    },
                  ],
            );
          },
        ),
      bookSlot: (slotId) =>
        runVal<BookSeatResult>(
          `book:${slotId}`,
          async () => {
            if (!user) throw new Error('Sign in to book a class.');
            return bookSeat(slug, slotId, user.uid, user.displayName ?? user.email ?? undefined);
          },
          () => {
            const uid = demoUid;
            if (!uid) throw new Error('Switch to a member persona to book.');
            const slot = slotsRef.current.find((s) => s.id === slotId);
            if (!slot) throw new Error('That class is not on the timetable.');
            if (slot.cancelled) throw new Error('That class was cancelled.');
            const full = (slot.booked ?? 0) >= (slot.capacity ?? 0);
            const bookingId = `bk-demo-${Date.now()}`;
            const name = rosterRef.current.find((r) => r.uid === uid)?.displayName ?? 'You (demo)';
            setBookings((rows) => [
              {
                id: bookingId,
                slotId,
                uid,
                status: (full ? 'waitlist' : 'booked') as BookingStatus,
                createdAt: Date.now(),
                memberName: name,
              },
              ...rows,
            ]);
            if (!full) {
              setSlots((rows) =>
                rows.map((s) => (s.id === slotId ? { ...s, booked: (s.booked ?? 0) + 1 } : s)),
              );
            }
            return {
              bookingId,
              status: full ? 'waitlist' : 'booked',
              seatsLeft: Math.max(0, (slot.capacity ?? 0) - (slot.booked ?? 0) - (full ? 0 : 1)),
            };
          },
        ),
      cancelMyBooking: (bookingId) =>
        run(
          `cancel:${bookingId}`,
          async () => {
            if (!user) throw new Error('Sign in first.');
            await cancelBooking(slug, bookingId);
          },
          () => {
            const booking = bookingsRef.current.find((b) => b.id === bookingId);
            setBookings((rows) =>
              rows.map((b) =>
                b.id === bookingId ? { ...b, status: 'cancelled' as BookingStatus } : b,
              ),
            );
            if (booking && (booking.status === 'booked' || booking.status === 'attended')) {
              setSlots((rows) =>
                rows.map((s) =>
                  s.id === booking.slotId ? { ...s, booked: Math.max(0, (s.booked ?? 0) - 1) } : s,
                ),
              );
            }
          },
        ),
      markBookingAttendance: (bookingId, status) =>
        run(
          `attend:${bookingId}`,
          async () => {
            if (!user) throw new Error('Sign in first.');
            await markAttendance(slug, bookingId, status, user.uid);
          },
          () =>
            setBookings((rows) =>
              rows.map((b) =>
                b.id === bookingId
                  ? { ...b, status, markedBy: demoUid ?? 'demo', markedAt: Date.now() }
                  : b,
              ),
            ),
        ),
      promoteWaitlist: (bookingId) =>
        run(
          `promote:${bookingId}`,
          () => promoteFromWaitlist(slug, bookingId),
          () => {
            const booking = bookingsRef.current.find((b) => b.id === bookingId);
            if (!booking || booking.status !== 'waitlist') throw new Error('Not on the waitlist.');
            const slot = slotsRef.current.find((s) => s.id === booking.slotId);
            if (!slot) throw new Error('That class is not on the timetable.');
            if ((slot.booked ?? 0) >= (slot.capacity ?? 0)) throw new Error('The class is full.');
            setBookings((rows) =>
              rows.map((b) =>
                b.id === bookingId ? { ...b, status: 'booked' as BookingStatus } : b,
              ),
            );
            setSlots((rows) =>
              rows.map((s) =>
                s.id === booking.slotId ? { ...s, booked: (s.booked ?? 0) + 1 } : s,
              ),
            );
          },
        ),
      updateGymShare: (share) =>
        run(
          'share',
          async () => {
            if (!user) throw new Error('Sign in first.');
            if (share) await shareWithGym(user.uid, slug, share);
            else await revokeGymShare(user.uid, slug);
          },
          () => setGymShare(share ? { ...share, gymId: slug } : null),
        ),
    }),
    [run, runVal, slug, user, demoUid],
  );

  /**
   * In demo mode the persona's membership *is* their roster row, so joining
   * (which appends one) is reflected on the next render with no extra wiring.
   */
  const membership = useMemo(
    () => (mode === 'demo' ? (roster.find((r) => r.uid === demoUid) ?? null) : membershipState),
    [mode, roster, demoUid, membershipState],
  );

  const role: Role = useMemo(() => {
    if (platformAdmin) return 'platform-admin';
    if (mode === 'demo' && demoRole) return demoRole === 'prospect' ? 'member' : demoRole;
    if (!membership) return 'member';
    return toRole(roleFromGymRole(membership.role));
  }, [platformAdmin, mode, demoRole, membership]);

  const myBookings = useMemo(
    () => (mode === 'demo' ? bookings.filter((b) => b.uid === demoUid) : myBookingsState),
    [mode, bookings, demoUid, myBookingsState],
  );
  const myCheckins = useMemo(
    () => (mode === 'demo' ? checkins.filter((c) => c.uid === demoUid) : checkins),
    [mode, checkins, demoUid],
  );
  const myInvoices = useMemo(
    () => invoices.filter((i) => i.memberUid === viewerUid),
    [invoices, viewerUid],
  );

  /** Member-half data on screen matches the current viewer (always true in demo). */
  const memberDataReady = mode === 'demo' || resolvedUid === (user?.uid ?? null);

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
      viewerUid,
      myBookings,
      myInvoices,
      myCheckins,
      gymShare,
      memberDataReady,
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
    viewerUid,
    myBookings,
    myInvoices,
    myCheckins,
    gymShare,
    memberDataReady,
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
