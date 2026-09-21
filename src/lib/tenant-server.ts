/**
 * Server-side tenant loading.
 *
 * The storefront is a public marketing page: it must be in the HTML that a
 * crawler receives, so it cannot wait on a client `useEffect`. This module
 * resolves a tenant on the Node runtime, where the Admin SDK is available —
 * the split the middleware deliberately cannot make, because it runs on the
 * edge.
 *
 * ## Two modes, one contract
 *
 *  - **Cloud** — Admin SDK credentials are present, so read Firestore. The
 *    Admin SDK bypasses security rules, which is correct here: this data is the
 *    public storefront, readable by any signed-in user anyway.
 *  - **Demo** — no credentials, so serve the fixture. Same shape, so switching
 *    to a real project changes nothing downstream.
 *
 * A *configured but failing* Admin SDK is not silently downgraded to demo data;
 * that would hide a real outage behind a plausible-looking page.
 */
import 'server-only';
import { cache } from 'react';
import { LIVE_GYM_STATUSES, type GymMembership, type GymTenant } from '@smartfit/core';
import { getAdminServices } from '@/lib/firebase/admin';
import type {
  GymBooking,
  GymClass,
  GymSlot,
  InvoiceDoc,
  MembershipPlanDoc,
} from '@/lib/firebase/tenant-repo';
import { demoFixture, demoGyms } from './tenant-demo';

export interface ServerTenantData {
  mode: 'cloud' | 'demo';
  gym: GymTenant | null;
  roster: GymMembership[];
  classes: GymClass[];
  slots: GymSlot[];
  bookings: GymBooking[];
  plans: MembershipPlanDoc[];
  invoices: InvoiceDoc[];
}

/** True when enough Admin SDK configuration exists to talk to Firestore. */
function adminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT?.trim() ||
    (process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim() &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY?.trim()) ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.FIREBASE_ADMIN_PROJECT_ID?.trim(),
  );
}

/** How far ahead the timetable is rendered. */
const WINDOW_MS = 14 * 86_400_000;

function demoData(slug: string): ServerTenantData {
  // Only real fixture slugs render — an unknown slug is "no gym", the same
  // answer a missing Firestore doc gives, never one gym aliased under
  // another's URL.
  const fixture = demoFixture(slug);
  return {
    mode: 'demo',
    gym: fixture?.gym ?? null,
    roster: fixture?.roster ?? [],
    classes: fixture?.classes ?? [],
    slots: fixture?.slots ?? [],
    bookings: fixture?.bookings ?? [],
    plans: fixture?.plans ?? [],
    invoices: fixture?.invoices ?? [],
  };
}

export async function loadTenantServer(slug: string): Promise<ServerTenantData> {
  if (!adminConfigured()) return demoData(slug);

  const { db } = getAdminServices();
  const gymSnap = await db.doc(`gyms/${slug}`).get();
  if (!gymSnap.exists) {
    return {
      ...demoData(slug),
      mode: 'cloud',
      gym: null,
      roster: [],
      classes: [],
      slots: [],
      bookings: [],
      plans: [],
      invoices: [],
    };
  }

  const gym = { id: gymSnap.id, ...(gymSnap.data() as object) } as GymTenant;

  const [classesSnap, slotsSnap, plansSnap, rosterSnap, invoicesSnap] = await Promise.all([
    db.collection(`gyms/${slug}/classes`).get(),
    db
      .collection(`gyms/${slug}/slots`)
      .where('startsAt', '>=', Date.now())
      .where('startsAt', '<', Date.now() + WINDOW_MS)
      .orderBy('startsAt')
      .get(),
    db.collection(`gyms/${slug}/plans`).get(),
    db.collection(`gyms/${slug}/members`).get(),
    db.collection(`gyms/${slug}/invoices`).orderBy('issuedAt', 'desc').limit(200).get(),
  ]);

  const slots = slotsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as GymSlot);

  const bookingSnaps = await Promise.all(
    slots.map((s) =>
      db.collection(`gyms/${slug}/bookings`).where('slotId', '==', s.id).orderBy('createdAt').get(),
    ),
  );

  return {
    mode: 'cloud',
    gym,
    roster: rosterSnap.docs.map((d) => ({ uid: d.id, ...(d.data() as object) }) as GymMembership),
    classes: classesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as GymClass),
    slots,
    bookings: bookingSnaps.flatMap((s) =>
      s.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as GymBooking),
    ),
    plans: plansSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as MembershipPlanDoc),
    invoices: invoicesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as InvoiceDoc),
  };
}

/**
 * Per-request memoised loader.
 *
 * A tenant render asks up to three times — layout, page, `generateMetadata` —
 * and each ask is the same Firestore reads. `cache()` collapses them within a
 * request while keeping results fresh across requests.
 */
export const loadTenantCached = cache(loadTenantServer);

/**
 * Live tenants for the public directory. Statuses that would render a closed
 * storefront (`pending`, `suspended`, `closed`) are excluded: a directory link
 * that dead-ends is worse than no link.
 */
export async function listGymsServer(): Promise<GymTenant[]> {
  if (!adminConfigured()) return demoGyms();

  const { db } = getAdminServices();
  const snap = await db
    .collection('gyms')
    .where('status', 'in', [...LIVE_GYM_STATUSES])
    .limit(100)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as GymTenant);
}
