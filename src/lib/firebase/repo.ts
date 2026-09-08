/**
 * Firestore repository — persists a user's FitnessState under `users/{uid}`.
 * Profile lives on the root document; each collection lives in its own
 * sub-collection so large histories stay scalable and don't require rewriting
 * a single giant document.
 *
 * Reads are **bounded**: the initial load fetches only a recent window of
 * sessions and body logs (ordered server-side, using the declared composite
 * index) and the log view pages back through the rest on demand. Previously
 * every cold start pulled the user's entire history.
 */
import {
  parseState,
  type BodyLog,
  type Category,
  type FitnessGoal,
  type FitnessState,
  type ScheduledWorkout,
  type UserProfile,
  type WorkoutSession,
} from '@smartfit/core';
import { getFirebaseServices, colPath, userDoc } from './config';

export type CollectionName = 'sessions' | 'schedule' | 'goals' | 'bodyLogs' | 'categories';

export const ALL_COLLECTIONS: CollectionName[] = [
  'sessions',
  'schedule',
  'goals',
  'bodyLogs',
  'categories',
];

/** How many sessions / measurements to fetch on first load. */
export const INITIAL_SESSION_LIMIT = 400;
export const PAGE_SIZE = 200;

/** True when an error is a Firestore permissions/network failure. */
export function isFirestoreError(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? '';
  return (
    code === 'permission-denied' ||
    code === 'unavailable' ||
    code === 'unauthenticated' ||
    code.startsWith('failed-precondition')
  );
}

async function requireServices() {
  const svc = await getFirebaseServices();
  if (!svc) throw new Error('firebase-unavailable');
  return svc;
}

function withId<T>(d: { id: string; data: () => unknown }): T {
  return { id: d.id, ...(d.data() as object) } as T;
}

/**
 * Load a user's state. Returns null when the account has no profile document
 * yet (i.e. this is a brand-new sign-in).
 */
export async function loadUserState(uid: string): Promise<FitnessState | null> {
  const { db } = await requireServices();
  const { doc, getDoc, collection, getDocs, query, orderBy, limit } =
    await import('firebase/firestore');

  const profileSnap = await getDoc(doc(db, userDoc(uid)));
  if (!profileSnap.exists()) return null;

  const data = profileSnap.data();
  const profile = (data?.profile as UserProfile) ?? null;
  if (!profile) return null;

  // Small collections: fetch whole. Time series: fetch a bounded, ordered window.
  const [schedule, goals, categories, sessions, bodyLogs] = await Promise.all([
    getDocs(collection(db, colPath(uid, 'schedule'))).then((s) =>
      s.docs.map((d) => withId<ScheduledWorkout>(d)),
    ),
    getDocs(collection(db, colPath(uid, 'goals'))).then((s) =>
      s.docs.map((d) => withId<FitnessGoal>(d)),
    ),
    getDocs(collection(db, colPath(uid, 'categories'))).then((s) =>
      s.docs.map((d) => withId<Category>(d)),
    ),
    getDocs(
      query(
        collection(db, colPath(uid, 'sessions')),
        orderBy('date', 'desc'),
        orderBy('createdAt', 'desc'),
        limit(INITIAL_SESSION_LIMIT),
      ),
    ).then((s) => s.docs.map((d) => withId<WorkoutSession>(d))),
    getDocs(
      query(
        collection(db, colPath(uid, 'bodyLogs')),
        orderBy('date', 'desc'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      ),
    ).then((s) => s.docs.map((d) => withId<BodyLog>(d))),
  ]);

  // parseState guarantees a valid shape even if a document was written by an
  // older client or hand-edited in the console.
  return parseState({ profile, categories, sessions, schedule, goals, bodyLogs });
}

/** Page further back through the session history. */
export async function loadMoreSessions(
  uid: string,
  cursor: { date: string; createdAt: number },
  pageSize = PAGE_SIZE,
): Promise<WorkoutSession[]> {
  const { db } = await requireServices();
  const { collection, getDocs, query, orderBy, limit, startAfter } =
    await import('firebase/firestore');
  const snap = await getDocs(
    query(
      collection(db, colPath(uid, 'sessions')),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc'),
      startAfter(cursor.date, cursor.createdAt),
      limit(pageSize),
    ),
  );
  return parseState({ sessions: snap.docs.map((d) => withId<WorkoutSession>(d)) }).sessions;
}

/** Page further back through the measurement history. */
export async function loadMoreBodyLogs(
  uid: string,
  cursor: { date: string; createdAt: number },
  pageSize = PAGE_SIZE,
): Promise<BodyLog[]> {
  const { db } = await requireServices();
  const { collection, getDocs, query, orderBy, limit, startAfter } =
    await import('firebase/firestore');
  const snap = await getDocs(
    query(
      collection(db, colPath(uid, 'bodyLogs')),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc'),
      startAfter(cursor.date, cursor.createdAt),
      limit(pageSize),
    ),
  );
  return parseState({ bodyLogs: snap.docs.map((d) => withId<BodyLog>(d)) }).bodyLogs;
}

/** Create the user's profile document if it doesn't exist yet. */
export async function ensureUserProfile(
  uid: string,
  profile: UserProfile,
  fallbackCategories: Category[],
): Promise<void> {
  const { db } = await requireServices();
  const { doc, getDoc, writeBatch } = await import('firebase/firestore');

  const ref = doc(db, userDoc(uid));
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  const batch = writeBatch(db);
  batch.set(ref, { profile, createdAt: Date.now() });
  // Seed the built-in activity categories so a fresh cloud account mirrors
  // a fresh local account. These are default data, not demo content.
  for (const cat of fallbackCategories) {
    batch.set(doc(db, colPath(uid, 'categories'), cat.id), stripId(cat));
  }
  await batch.commit();
}

/** Persist a profile patch (whole-profile writes are cheap and simple). */
export async function saveProfile(uid: string, profile: UserProfile): Promise<void> {
  const { db } = await requireServices();
  const { doc, setDoc, updateDoc, deleteField } = await import('firebase/firestore');
  const ref = doc(db, userDoc(uid));
  // Firestore rejects explicit `undefined`s — persist only defined keys.
  const clean = Object.fromEntries(
    Object.entries(profile).filter(([, value]) => value !== undefined),
  );
  await setDoc(ref, { profile: clean, updatedAt: Date.now() }, { merge: true });
  // Clearing the optional target weight has to remove the persisted field.
  if (profile.targetWeightKg === undefined && 'targetWeightKg' in profile) {
    await updateDoc(ref, { 'profile.targetWeightKg': deleteField() }).catch(() => {
      /* field was not stored — nothing to delete */
    });
  }
}

/** Upsert a single item into a sub-collection. */
export async function upsertItem<T extends { id: string }>(
  uid: string,
  name: CollectionName,
  item: T,
): Promise<void> {
  const { db } = await requireServices();
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, colPath(uid, name), item.id), stripId(item));
}

/** Delete a single item from a sub-collection. */
export async function deleteItem(uid: string, name: CollectionName, id: string): Promise<void> {
  const { db } = await requireServices();
  const { doc, deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, colPath(uid, name), id));
}

/**
 * Replace an entire sub-collection with the given rows in one pass
 * (used by "import suggested week" — deletes docs no longer present and
 * writes the new set). Batched in chunks to stay under Firestore's limits.
 */
export async function replaceCollection<T extends { id: string }>(
  uid: string,
  name: CollectionName,
  items: T[],
): Promise<void> {
  const { db } = await requireServices();
  const { doc, getDocs, writeBatch, collection } = await import('firebase/firestore');
  const colRef = collection(db, colPath(uid, name));
  const snap = await getDocs(colRef);
  const keep = new Set(items.map((i) => i.id));
  const ops: Array<{ ref: ReturnType<typeof doc>; item?: T }> = [];
  snap.docs.forEach((d) => {
    if (!keep.has(d.id)) ops.push({ ref: doc(db, colPath(uid, name), d.id) });
  });
  items.forEach((item) => ops.push({ ref: doc(db, colPath(uid, name), item.id), item }));
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + 400)) {
      if (op.item) batch.set(op.ref, op.item);
      else batch.delete(op.ref);
    }
    await batch.commit();
  }
}

/**
 * Upload a whole local state into a (presumably empty) cloud account —
 * the local → cloud migration performed on first sign-in. Batched in chunks
 * so a large history doesn't exceed Firestore's 500-write batch limit.
 */
export async function importState(uid: string, state: FitnessState): Promise<void> {
  const { db } = await requireServices();
  const { doc, writeBatch } = await import('firebase/firestore');

  type Row = { name: CollectionName; item: { id: string } };
  const rows: Row[] = [
    ...state.categories.map((item) => ({ name: 'categories' as const, item })),
    ...state.sessions.map((item) => ({ name: 'sessions' as const, item })),
    ...state.schedule.map((item) => ({ name: 'schedule' as const, item })),
    ...state.goals.map((item) => ({ name: 'goals' as const, item })),
    ...state.bodyLogs.map((item) => ({ name: 'bodyLogs' as const, item })),
  ];

  const CHUNK = 400; // headroom under the 500-op batch limit
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = writeBatch(db);
    if (i === 0) {
      batch.set(
        doc(db, userDoc(uid)),
        { profile: state.profile, updatedAt: Date.now() },
        { merge: true },
      );
    }
    for (const { name, item } of rows.slice(i, i + CHUNK)) {
      batch.set(doc(db, colPath(uid, name), item.id), stripId(item));
    }
    await batch.commit();
  }

  if (rows.length === 0) await saveProfile(uid, state.profile);
}

/** Remove every document for a user (account reset / delete). Batched. */
export async function wipeUserData(uid: string): Promise<void> {
  const { db } = await requireServices();
  const { doc, collection, getDocs, writeBatch } = await import('firebase/firestore');

  for (const name of ALL_COLLECTIONS) {
    // Loop because a collection can hold more documents than one batch allows.
    for (;;) {
      const snap = await getDocs(collection(db, colPath(uid, name)));
      if (snap.empty) break;
      const docs = snap.docs.slice(0, 400);
      const batch = writeBatch(db);
      for (const d of docs) batch.delete(d.ref);
      await batch.commit();
      if (docs.length === snap.docs.length) break;
    }
  }

  const batch = writeBatch(db);
  batch.delete(doc(db, userDoc(uid)));
  await batch.commit();
}

function stripId<T extends { id?: string }>(item: T): Omit<T, 'id'> {
  const { id: _id, ...rest } = item;
  // Firestore rejects `undefined`; drop those keys rather than failing the write.
  return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) as Omit<
    T,
    'id'
  >;
}
