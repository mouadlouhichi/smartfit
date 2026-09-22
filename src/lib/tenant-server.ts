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
import {
  LIVE_GYM_STATUSES,
  type GymMembership,
  type GymProgram,
  type GymTenant,
} from '@smartfit/core';
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

  // A runtime Firebase failure (bad credentials, Firestore unreachable) must
  // not 500 every tenant page: the storefront degrades to its not-found shape
  // and the real cause lands in the server log, tagged. A hard 500 on a gym's
  // public page is the one failure this app cannot show a visitor.
  try {
    return await loadTenantCloud(slug);
  } catch (err) {
    console.error(`[tenant] gyms/${slug}:`, err instanceof Error ? err.message : err);
    return cloudUnavailable();
  }
}

/** The degraded cloud shape: mode cloud, nothing resolved. */
function cloudUnavailable(): ServerTenantData {
  return {
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

async function loadTenantCloud(slug: string): Promise<ServerTenantData> {
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

  // This payload is serialized into public RSC/HTML before authentication.
  // Private collections are fetched later by the authorized tenant client.
  const [classesSnap, slotsSnap, plansSnap] = await Promise.all([
    db.collection(`gyms/${slug}/classes`).get(),
    db
      .collection(`gyms/${slug}/slots`)
      .where('startsAt', '>=', Date.now())
      .where('startsAt', '<', Date.now() + WINDOW_MS)
      .orderBy('startsAt')
      .get(),
    db.collection(`gyms/${slug}/plans`).get(),
  ]);
  const slots = slotsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as GymSlot);

  return {
    mode: 'cloud',
    gym,
    roster: [],
    classes: classesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as GymClass),
    slots,
    bookings: [],
    plans: plansSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as MembershipPlanDoc),
    invoices: [],
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
// ── Member app: gyms as suggested-week programs ──────────────────────────────

/** "Mon–Fri 06:30–22:30 · Sat 08:00–20:00" from the weekly hours map. */
function hoursSummary(hours?: GymTenant['hours']): string {
  if (!hours) return '';
  const days: Array<[number, string]> = [
    [1, 'Mon'],
    [2, 'Tue'],
    [3, 'Wed'],
    [4, 'Thu'],
    [5, 'Fri'],
    [6, 'Sat'],
    [0, 'Sun'],
  ];
  const parts: Array<{ from: string; to: string; open: string; close: string }> = [];
  let lastOpen: string | null = null;
  days.forEach(([day, label], i) => {
    const h = hours[day];
    if (!h) {
      lastOpen = null;
      return;
    }
    const prev = parts[parts.length - 1];
    // Merge only into a run ending on the immediately preceding open day
    // with identical hours — "Mon–Fri 06:30–22:30", never "Mon–Sun".
    const yesterday = i > 0 ? days[i - 1][1] : null;
    if (prev && lastOpen === yesterday && prev.open === h.open && prev.close === h.close) {
      prev.to = label;
    } else {
      parts.push({ from: label, to: label, open: h.open, close: h.close });
    }
    lastOpen = label;
  });
  return parts
    .map((p) =>
      p.from === p.to ? `${p.from} ${p.open}–${p.close}` : `${p.from}–${p.to} ${p.open}–${p.close}`,
    )
    .join(' · ');
}

/**
 * Fold a gym's scheduled occurrences (concrete timestamps) back into a weekly
 * pattern: one `{weekday, time, classId}` per distinct recurring slot, deduped
 * across the window. Cancelled slots do not exist.
 */
function weeklyPattern(slots: GymSlot[]): GymProgram['week'] {
  const seen = new Set<string>();
  const week: GymProgram['week'] = [];
  for (const s of slots) {
    if (s.cancelled) continue;
    const d = new Date(s.startsAt);
    const weekday = d.getDay();
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const key = `${weekday}-${time}-${s.classId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    week.push({ weekday, time, classId: s.classId });
  }
  return week.sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time));
}

/** Classes + occurrences of one gym → the shape the suggested-week engine eats. */
function toGymProgram(gym: GymTenant, classes: GymClass[], slots: GymSlot[]): GymProgram {
  return {
    id: gym.slug,
    name: gym.name,
    hours: hoursSummary(gym.hours),
    classes: Object.fromEntries(
      classes.map((c) => [
        c.id,
        { id: c.id, name: c.name, focus: c.focus, intensity: c.intensity, minutes: c.minutes },
      ]),
    ),
    week: weeklyPattern(slots),
  };
}

/**
 * Every live gym as a `GymProgram`, for the member surfaces: the onboarding
 * "Your gym" picker and the Plan tab's suggested week. Real tenants are the
 * only source — the static in-repo gym list is gone, so a gym that closes
 * disappears from the picker by construction.
 *
 * **Never throws.** Onboarding is the signup path: a member must be able to
 * set up their account while the platform's data layer is failing. A failed
 * load degrades to an empty list (the picker's honest empty state) and logs
 * the real error for the operator; one broken gym never hides the others.
 *
 * Scale note: cloud mode reads each live gym's classes + a 14-day slot window
 * (two collection queries per gym, capped by the directory's limit of 100).
 * Fine for tens of gyms; batch into one aggregate read if that grows.
 */
export async function loadGymProgramsResult(): Promise<{
  gyms: GymProgram[];
  /** Set when the platform read failed — callers can surface a retry state. */
  error: string | null;
}> {
  if (!adminConfigured()) {
    return {
      gyms: demoGyms().map((gym) => {
        const fixture = demoFixture(gym.slug);
        return toGymProgram(gym, fixture?.classes ?? [], fixture?.slots ?? []);
      }),
      error: null,
    };
  }

  try {
    const { db } = getAdminServices();
    const now = Date.now();
    const gyms = await listGymsServer();
    const programs = await Promise.all(
      gyms.map(async (gym) => {
        try {
          const [classesSnap, slotsSnap] = await Promise.all([
            db.collection(`gyms/${gym.slug}/classes`).get(),
            db
              .collection(`gyms/${gym.slug}/slots`)
              .where('startsAt', '>=', now)
              .where('startsAt', '<', now + 14 * 86_400_000)
              .get(),
          ]);
          return toGymProgram(
            gym,
            classesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as GymClass),
            slotsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as GymSlot),
          );
        } catch (err) {
          console.error(`[gym-programs] gyms/${gym.slug}:`, err);
          return null;
        }
      }),
    );
    return { gyms: programs.filter((p): p is GymProgram => p !== null), error: null };
  } catch (err) {
    console.error('[gym-programs] could not load the gym list:', err);
    return {
      gyms: [],
      error: err instanceof Error ? err.message : 'gym-list-unavailable',
    };
  }
}

/** Thin wrapper for callers that only want the list (onboarding). */
export async function loadGymPrograms(): Promise<GymProgram[]> {
  return (await loadGymProgramsResult()).gyms;
}
