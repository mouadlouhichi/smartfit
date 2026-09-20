/**
 * Firestore repository for B2B tenants.
 *
 * Mirrors the conventions in `./repo.ts` — lazy `import('firebase/firestore')`
 * so the SDK stays out of the landing bundle, undefined-stripping before every
 * write, and a `requireServices()` guard that throws rather than silently
 * writing nowhere in local mode.
 *
 * ## Where capacity is enforced
 *
 * Security rules can authorise a booking and validate its shape, but they
 * cannot count the seats already taken — that needs a query, and rules are
 * forbidden from querying other documents at scale. So `bookSeat()` runs a
 * **transaction**: it reads the slot, compares `booked` against `capacity`,
 * and either takes the seat (incrementing the counter) or drops the request
 * onto the waitlist. Two members racing for the last spot cannot both get it.
 *
 * ## What is deliberately absent
 *
 * Nothing here reads `users/{uid}`. A gym's roster is built from
 * `gyms/{slug}/members`, and any training aggregates come from the member's
 * own opt-in `gymShares` document. That boundary is enforced in
 * `firestore.rules` too — this file simply never crosses it.
 */
import {
  type BookingStatus,
  type GymMembership,
  type GymShare,
  type GymTenant,
  type MemberStatus,
} from '@smartfit/core';
import { getFirebaseServices } from './config';

// ── Paths ────────────────────────────────────────────────────────────────────

/**
 * A tenant's document id **is** its slug, which is what makes subdomains
 * unique for free — Firestore will not create a second document with the same
 * id, so `suggestSlug()` plus this path is the whole uniqueness story.
 */
export const gymDoc = (slug: string) => `gyms/${slug}`;

export const gymCol = (slug: string, name: string) => `gyms/${slug}/${name}`;

export type TenantCollection =
  | 'members'
  | 'classes'
  | 'slots'
  | 'bookings'
  | 'plans'
  | 'invoices'
  | 'broadcasts'
  | 'equipment'
  | 'shifts'
  | 'audit';

/** The member's own opt-in share document, inside their private tree. */
export const gymShareDoc = (uid: string, slug: string) => `users/${uid}/gymShares/${slug}`;

// ── Internals ────────────────────────────────────────────────────────────────

async function requireServices() {
  const svc = await getFirebaseServices();
  if (!svc) throw new Error('firebase-unavailable');
  return svc;
}

/** Firestore rejects explicit `undefined`s — persist only defined keys. */
function clean<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
}

function withId<T>(d: { id: string; data: () => unknown }): T {
  return { id: d.id, ...(d.data() as object) } as T;
}

/**
 * Translate a rules denial into something a UI can act on.
 *
 * A tenant permission error is not the same failure as a personal-data one: it
 * means the caller has no role in this gym, and the fix is to ask the owner —
 * not to retry.
 */
export function tenantErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'permission-denied':
      return 'You do not have access to this gym. Ask its owner to add you.';
    case 'not-found':
      return 'That gym or record no longer exists.';
    case 'failed-precondition':
      return 'This gym needs an index that has not been deployed yet.';
    case 'unavailable':
      return 'Firestore is unreachable. Check the connection and try again.';
    default:
      return err instanceof Error ? err.message : 'Something went wrong.';
  }
}

// ── Tenant ───────────────────────────────────────────────────────────────────

export async function loadGym(slug: string): Promise<GymTenant | null> {
  const { db } = await requireServices();
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, gymDoc(slug)));
  return snap.exists() ? withId<GymTenant>(snap) : null;
}

/**
 * Update the public half of a tenant.
 *
 * Status, slug and ownerUid are omitted on purpose: the rules reject an owner
 * changing them, so sending them would fail the whole write. Lifecycle changes
 * go through the platform-admin API route instead.
 */
export async function saveGymProfile(
  slug: string,
  patch: Partial<Omit<GymTenant, 'id' | 'status' | 'slug' | 'ownerUid'>>,
): Promise<void> {
  const { db } = await requireServices();
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, gymDoc(slug)), clean({ ...patch, updatedAt: Date.now() }), {
    merge: true,
  });
}

// ── Roster ───────────────────────────────────────────────────────────────────

export async function loadMyMembership(slug: string, uid: string): Promise<GymMembership | null> {
  const { db } = await requireServices();
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, gymCol(slug, 'members'), uid));
  return snap.exists() ? (snap.data() as GymMembership) : null;
}

/** The whole roster. Owner/staff only — the rules deny it to anyone else. */
export async function loadRoster(slug: string): Promise<GymMembership[]> {
  const { db } = await requireServices();
  const { collection, getDocs } = await import('firebase/firestore');
  const snap = await getDocs(collection(db, gymCol(slug, 'members')));
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as object) }) as GymMembership);
}

export async function saveMembership(
  slug: string,
  memberUid: string,
  patch: Partial<GymMembership>,
): Promise<void> {
  const { db } = await requireServices();
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, gymCol(slug, 'members'), memberUid), clean(patch), { merge: true });
}

/**
 * Self-enrol. Always writes `role: 'member'` and `checkins: 0` because the
 * rules reject anything else — hard-coding them here means a UI bug cannot
 * turn into an attempted privilege escalation.
 */
export async function joinGym(
  slug: string,
  uid: string,
  profile?: { displayName?: string; email?: string; phone?: string },
): Promise<void> {
  const { db } = await requireServices();
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(
    doc(db, gymCol(slug, 'members'), uid),
    clean({
      role: 'member',
      status: 'trial' as MemberStatus,
      joinedAt: Date.now(),
      checkins: 0,
      ...profile,
    }),
  );
}

export async function leaveGym(slug: string, uid: string): Promise<void> {
  const { db } = await requireServices();
  const { doc, deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, gymCol(slug, 'members'), uid));
}

/** Front-desk check-in: bump the counter and stamp the visit. */
export async function checkIn(slug: string, uid: string): Promise<void> {
  const { db } = await requireServices();
  const { doc, updateDoc, increment } = await import('firebase/firestore');
  await updateDoc(doc(db, gymCol(slug, 'members'), uid), {
    checkins: increment(1),
    lastVisitAt: Date.now(),
  });
}

// ── Classes & slots ──────────────────────────────────────────────────────────

export interface GymClass {
  id: string;
  name: string;
  focus: 'cardio' | 'hiit' | 'strength' | 'combat' | 'mind' | 'aqua';
  intensity: 'low' | 'moderate' | 'high';
  minutes: number;
  capacity: number;
  instructorUid?: string;
  instructorName?: string;
  studio?: string;
  description?: string;
  createdAt: number;
}

export interface GymSlot {
  id: string;
  classId: string;
  startsAt: number;
  endsAt: number;
  capacity: number;
  booked: number;
  cancelled?: boolean;
}

export async function loadClasses(slug: string): Promise<GymClass[]> {
  const { db } = await requireServices();
  const { collection, getDocs } = await import('firebase/firestore');
  const snap = await getDocs(collection(db, gymCol(slug, 'classes')));
  return snap.docs.map((d) => withId<GymClass>(d));
}

export async function saveClass(slug: string, cls: GymClass): Promise<void> {
  const { db } = await requireServices();
  const { doc, setDoc } = await import('firebase/firestore');
  const { id, ...rest } = cls;
  await setDoc(doc(db, gymCol(slug, 'classes'), id), clean(rest));
}

export async function deleteClass(slug: string, classId: string): Promise<void> {
  const { db } = await requireServices();
  const { doc, deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, gymCol(slug, 'classes'), classId));
}

/** Slots in a window — the timetable query, ordered by the declared index. */
export async function loadSlots(slug: string, fromMs: number, toMs: number): Promise<GymSlot[]> {
  const { db } = await requireServices();
  const { collection, getDocs, query, where, orderBy } = await import('firebase/firestore');
  const snap = await getDocs(
    query(
      collection(db, gymCol(slug, 'slots')),
      where('startsAt', '>=', fromMs),
      where('startsAt', '<', toMs),
      orderBy('startsAt'),
    ),
  );
  return snap.docs.map((d) => withId<GymSlot>(d));
}

export async function saveSlot(slug: string, slot: GymSlot): Promise<void> {
  const { db } = await requireServices();
  const { doc, setDoc } = await import('firebase/firestore');
  const { id, ...rest } = slot;
  await setDoc(doc(db, gymCol(slug, 'slots'), id), clean(rest));
}

// ── Bookings ─────────────────────────────────────────────────────────────────

export interface GymBooking {
  id: string;
  slotId: string;
  uid: string;
  status: BookingStatus;
  createdAt: number;
  memberName?: string;
  markedBy?: string;
  markedAt?: number;
}

export async function loadBookingsForSlot(slug: string, slotId: string): Promise<GymBooking[]> {
  const { db } = await requireServices();
  const { collection, getDocs, query, where, orderBy } = await import('firebase/firestore');
  const snap = await getDocs(
    query(
      collection(db, gymCol(slug, 'bookings')),
      where('slotId', '==', slotId),
      orderBy('createdAt'),
    ),
  );
  return snap.docs.map((d) => withId<GymBooking>(d));
}

export async function loadMyBookings(slug: string, uid: string): Promise<GymBooking[]> {
  const { db } = await requireServices();
  const { collection, getDocs, query, where, orderBy } = await import('firebase/firestore');
  const snap = await getDocs(
    query(
      collection(db, gymCol(slug, 'bookings')),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snap.docs.map((d) => withId<GymBooking>(d));
}

export interface BookSeatResult {
  bookingId: string;
  /** `waitlist` when the class was already full. */
  status: 'booked' | 'waitlist';
  seatsLeft: number;
}

/**
 * Take a seat, or join the waitlist if the class is full.
 *
 * The transaction is the capacity guarantee. Reading `booked` and writing the
 * booking + counter as one unit is what stops two concurrent requests from
 * both claiming the last spot.
 */
export async function bookSeat(
  slug: string,
  slotId: string,
  uid: string,
  memberName?: string,
): Promise<BookSeatResult> {
  const { db } = await requireServices();
  const { doc, setDoc, updateDoc, increment, runTransaction } = await import('firebase/firestore');
  const bookingId = `bk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const status = await runTransaction(db, async (tx) => {
    const slotRef = doc(db, gymCol(slug, 'slots'), slotId);
    const snap = await tx.get(slotRef);
    if (!snap.exists()) throw new Error('slot-missing');
    const slot = snap.data() as GymSlot;
    if (slot.cancelled) throw new Error('slot-cancelled');

    const full = (slot.booked ?? 0) >= (slot.capacity ?? 0);
    const next: BookingStatus = full ? 'waitlist' : 'booked';

    tx.set(
      doc(db, gymCol(slug, 'bookings'), bookingId),
      clean({
        slotId,
        uid,
        status: next,
        createdAt: Date.now(),
        memberName,
      }),
    );
    // Only a real seat moves the counter; a waitlist entry does not occupy one.
    if (!full) tx.update(slotRef, { booked: increment(1) });
    return next;
  });

  const slotAfter = await loadSlot(slug, slotId);
  return {
    bookingId,
    status,
    seatsLeft: Math.max(0, (slotAfter?.capacity ?? 0) - (slotAfter?.booked ?? 0)),
  };
}

export async function loadSlot(slug: string, slotId: string): Promise<GymSlot | null> {
  const { db } = await requireServices();
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, gymCol(slug, 'slots'), slotId));
  return snap.exists() ? withId<GymSlot>(snap) : null;
}

/** A member cancelling their own seat — releases it back to the class. */
export async function cancelBooking(slug: string, bookingId: string): Promise<void> {
  const { db } = await requireServices();
  const { doc, increment, runTransaction } = await import('firebase/firestore');
  await runTransaction(db, async (tx) => {
    const bookingRef = doc(db, gymCol(slug, 'bookings'), bookingId);
    const snap = await tx.get(bookingRef);
    if (!snap.exists()) return;
    const booking = snap.data() as GymBooking;
    const heldSeat = booking.status === 'booked' || booking.status === 'attended';
    tx.set(bookingRef, { ...booking, status: 'cancelled' });
    // Releasing a seat must give it back, or the class slowly fills with
    // ghosts and the waitlist stops ever promoting.
    if (heldSeat) {
      tx.update(doc(db, gymCol(slug, 'slots'), booking.slotId), { booked: increment(-1) });
    }
  });
}

/** Staff marking attendance. Only `attended` / `no_show` are meaningful here. */
export async function markAttendance(
  slug: string,
  bookingId: string,
  status: 'attended' | 'no_show',
  markedBy: string,
): Promise<void> {
  const { db } = await requireServices();
  const { doc, setDoc, getDoc } = await import('firebase/firestore');
  const ref = doc(db, gymCol(slug, 'bookings'), bookingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('booking-missing');
  await setDoc(ref, { ...snap.data(), status, markedBy, markedAt: Date.now() }, { merge: true });
}

// ── Money ────────────────────────────────────────────────────────────────────

export interface MembershipPlanDoc {
  id: string;
  name: string;
  priceMinor: number;
  currency: string;
  period: 'month' | 'quarter' | 'year' | 'pass';
  joinFeeMinor?: number;
  published?: boolean;
  description?: string;
}

export interface InvoiceDoc {
  id: string;
  memberUid: string;
  amountMinor: number;
  currency: string;
  status: 'draft' | 'paid' | 'refunded' | 'void' | 'overdue';
  issuedAt: number;
  method?: 'cash' | 'card' | 'transfer' | 'cmi' | 'stripe' | 'other';
  paidAt?: number;
  issuedBy?: string;
  planId?: string;
  note?: string;
}

export async function loadPlans(slug: string): Promise<MembershipPlanDoc[]> {
  const { db } = await requireServices();
  const { collection, getDocs } = await import('firebase/firestore');
  const snap = await getDocs(collection(db, gymCol(slug, 'plans')));
  return snap.docs.map((d) => withId<MembershipPlanDoc>(d));
}

export async function savePlan(slug: string, plan: MembershipPlanDoc): Promise<void> {
  const { db } = await requireServices();
  const { doc, setDoc } = await import('firebase/firestore');
  const { id, ...rest } = plan;
  await setDoc(doc(db, gymCol(slug, 'plans'), id), clean(rest));
}

export async function issueInvoice(slug: string, invoice: InvoiceDoc): Promise<void> {
  const { db } = await requireServices();
  const { doc, setDoc } = await import('firebase/firestore');
  const { id, ...rest } = invoice;
  await setDoc(doc(db, gymCol(slug, 'invoices'), id), clean(rest));
}

export async function loadInvoices(slug: string, memberUid?: string): Promise<InvoiceDoc[]> {
  const { db } = await requireServices();
  const { collection, getDocs, query, where, orderBy } = await import('firebase/firestore');
  const q = memberUid
    ? query(
        collection(db, gymCol(slug, 'invoices')),
        where('memberUid', '==', memberUid),
        orderBy('issuedAt', 'desc'),
      )
    : query(collection(db, gymCol(slug, 'invoices')), orderBy('issuedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => withId<InvoiceDoc>(d));
}

// ── Audit ────────────────────────────────────────────────────────────────────

/**
 * Append an audit entry. Never updates or deletes — the rules refuse both,
 * because a log the subject can rewrite is not a log.
 */
export async function appendAudit(
  slug: string,
  entry: { actorUid: string; action: string; target?: string; meta?: Record<string, unknown> },
): Promise<void> {
  const { db } = await requireServices();
  const { doc, setDoc } = await import('firebase/firestore');
  const id = `au-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await setDoc(doc(db, gymCol(slug, 'audit'), id), clean({ ...entry, at: Date.now() }));
}

// ── Member-side opt-in sharing ───────────────────────────────────────────────

/**
 * Publish the aggregates a member chooses to share with one gym.
 *
 * Written into the member's **own** tree, so the owner-only rules on
 * `users/**` stay untouched and the gym never reads training data directly.
 */
export async function shareWithGym(
  uid: string,
  slug: string,
  share: Omit<GymShare, 'gymId'>,
): Promise<void> {
  const { db } = await requireServices();
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, gymShareDoc(uid, slug)), { ...share, gymId: slug });
}

/** Revoke. Deleting the document is the whole mechanism — nothing to sync. */
export async function revokeGymShare(uid: string, slug: string): Promise<void> {
  const { db } = await requireServices();
  const { doc, deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, gymShareDoc(uid, slug)));
}
