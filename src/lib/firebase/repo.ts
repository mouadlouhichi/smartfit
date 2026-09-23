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
import { readOrFallback } from './load-errors';

export type CollectionName =
  | 'sessions'
  | 'schedule'
  | 'goals'
  | 'bodyLogs'
  | 'meals'
  | 'checkIns'
  | 'categories'
  | 'customGyms';

export const ALL_COLLECTIONS: CollectionName[] = [
  'sessions',
  'schedule',
  'goals',
  'bodyLogs',
  'meals',
  'checkIns',
  'categories',
  'customGyms',
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

/**
 * True when Firestore reports a missing composite index.
 *
 * The bounded history queries need the indexes in firestore.indexes.json. When
 * they were never deployed, every cold start fails while onboarding itself
 * succeeds (writes need no indexes) — so the user lands back on onboarding
 * with empty data on every login. Callers fall back to an unordered read
 * instead of failing the whole sign-in.
 */
export function isMissingIndexError(err: unknown): boolean {
  if ((err as { code?: string })?.code !== 'failed-precondition') return false;
  return /index/i.test((err as { message?: string })?.message ?? '');
}

interface HistoryCursor {
  date: string;
  createdAt: number;
}

type DescRow = Pick<HistoryCursor, 'date' | 'createdAt'>;

/** Newest-first, exactly matching the server-side (date desc, createdAt desc). */
export function byDateDesc(a: DescRow, b: DescRow): number {
  return a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1;
}

/**
 * Rows strictly older than the cursor, newest-first — the in-memory
 * equivalent of a `startAfter(date, createdAt)` page (also exclusive, so a
 * page boundary landing inside identical timestamps behaves the same way).
 */
export function olderThan<T extends DescRow>(rows: T[], cursor: HistoryCursor): T[] {
  return rows
    .filter(
      (r) => r.date < cursor.date || (r.date === cursor.date && r.createdAt < cursor.createdAt),
    )
    .sort(byDateDesc);
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
export async function loadUserState(
  uid: string,
  onBlocked?: (name: string, err: unknown) => void,
): Promise<FitnessState | null> {
  const { db } = await requireServices();
  const { doc, getDoc, collection, getDocs } = await import('firebase/firestore');

  const profileSnap = await getDoc(doc(db, userDoc(uid)));
  if (!profileSnap.exists()) return null;

  const data = profileSnap.data();
  const profile = (data?.profile as UserProfile) ?? null;
  if (!profile) return null;

  /*
   * Small collections: fetch whole. Time series: fetch a bounded, ordered
   * window.
   *
   * Every read except the profile (the identity anchor above, which must
   * succeed or fail on its own terms) goes through `readOrFallback`: a
   * collection the deployed rules do not grant degrades to empty and is
   * reported, instead of rejecting the batch and locking the athlete out of an
   * account whose data is sitting right there. Offline still throws — see
   * `load-errors.ts` for why that distinction is load-bearing.
   */
  const readAll = <T>(name: CollectionName, run: () => Promise<T>): Promise<T> =>
    readOrFallback(`${name}`, run, [] as unknown as T, onBlocked);
  const readWindow = <T extends DescRow>(
    name: 'sessions' | 'bodyLogs' | 'meals' | 'checkIns',
    select: (rows: unknown[]) => T[],
  ): Promise<T[]> =>
    readOrFallback(`${name}`, () => loadHistoryWindow(uid, name, select, null), [], onBlocked);

  const [schedule, goals, categories, customGyms, sessions, bodyLogs, meals, checkIns] =
    await Promise.all([
      readAll<ScheduledWorkout[]>('schedule', () =>
        getDocs(collection(db, colPath(uid, 'schedule'))).then((s) =>
          s.docs.map((d) => withId<ScheduledWorkout>(d)),
        ),
      ),
      readAll<FitnessGoal[]>('goals', () =>
        getDocs(collection(db, colPath(uid, 'goals'))).then((s) =>
          s.docs.map((d) => withId<FitnessGoal>(d)),
        ),
      ),
      readAll<Category[]>('categories', () =>
        getDocs(collection(db, colPath(uid, 'categories'))).then((s) =>
          s.docs.map((d) => withId<Category>(d)),
        ),
      ),
      readAll<any[]>('customGyms', () =>
        getDocs(collection(db, colPath(uid, 'customGyms'))).then((s) =>
          s.docs.map((d) => withId<any>(d)),
        ),
      ),
      readWindow('sessions', (rows) => parseState({ sessions: rows }).sessions),
      readWindow('bodyLogs', (rows) => parseState({ bodyLogs: rows }).bodyLogs),
      readWindow('meals', (rows) => parseState({ meals: rows }).meals),
      readWindow('checkIns', (rows) => parseState({ checkIns: rows }).checkIns ?? []),
    ]);

  // parseState guarantees a valid shape even if a document was written by an
  // older client or hand-edited in the console.
  return parseState({
    profile,
    categories,
    sessions,
    schedule,
    goals,
    bodyLogs,
    meals,
    checkIns,
    customGyms,
  });
}

/** Page further back through the session history. */
export async function loadMoreSessions(
  uid: string,
  cursor: { date: string; createdAt: number },
  pageSize = PAGE_SIZE,
): Promise<WorkoutSession[]> {
  return loadHistoryWindow(
    uid,
    'sessions',
    (rows) => parseState({ sessions: rows }).sessions,
    cursor,
    pageSize,
  );
}

/** Page further back through the measurement history. */
export async function loadMoreBodyLogs(
  uid: string,
  cursor: { date: string; createdAt: number },
  pageSize = PAGE_SIZE,
): Promise<BodyLog[]> {
  return loadHistoryWindow(
    uid,
    'bodyLogs',
    (rows) => parseState({ bodyLogs: rows }).bodyLogs,
    cursor,
    pageSize,
  );
}

/**
 * One newest-first window of a time-series collection, optionally starting
 * after a cursor.
 *
 * Normally this is a server-side ordered window (cheap, bounded). When the
 * composite index was never deployed the ordered query throws
 * `failed-precondition` — instead of failing the whole sign-in, fall back to a
 * single unordered read windowed in memory. Correct for any history size, just
 * more expensive until the indexes exist, hence the loud warning.
 */
async function loadHistoryWindow<T extends DescRow>(
  uid: string,
  name: 'sessions' | 'bodyLogs' | 'meals' | 'checkIns',
  select: (rows: unknown[]) => T[],
  cursor: HistoryCursor | null,
  pageSize = cursor ? PAGE_SIZE : INITIAL_SESSION_LIMIT,
): Promise<T[]> {
  const { db } = await requireServices();
  const { collection, getDocs, query, orderBy, limit, startAfter } =
    await import('firebase/firestore');
  const ref = collection(db, colPath(uid, name));
  try {
    // Type-only annotation (erased at build — the SDK itself stays dynamically
    // imported): order/start/limit constraints share only this base type.
    const parts: import('firebase/firestore').QueryConstraint[] = [
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc'),
    ];
    if (cursor) parts.push(startAfter(cursor.date, cursor.createdAt));
    parts.push(limit(pageSize));
    const snap = await getDocs(query(ref, ...parts));
    return select(snap.docs.map((d) => withId(d)));
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    console.warn(
      `[smartfit] ${name} composite index missing — sign-in fell back to an unordered read. ` +
        `Deploy it: firebase deploy --only firestore:indexes`,
    );
    const snap = await getDocs(ref);
    const rows = select(snap.docs.map((d) => withId(d))).sort(byDateDesc);
    return (cursor ? olderThan(rows, cursor) : rows).slice(0, pageSize);
  }
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

/**
 * Save the onboarding profile, first goal, and optional starter week together.
 * The dashboard should never be entered with a profile that says "done" while
 * its promised first goal or generated week is still queued separately.
 */
export async function saveOnboarding(
  uid: string,
  profile: UserProfile,
  goal?: FitnessGoal,
  starterSchedule: ScheduledWorkout[] = [],
): Promise<void> {
  const { db } = await requireServices();
  const { doc, writeBatch } = await import('firebase/firestore');
  const batch = writeBatch(db);
  batch.set(
    doc(db, userDoc(uid)),
    { profile: sanitize(profile), updatedAt: Date.now() },
    { merge: true },
  );
  if (goal) batch.set(doc(db, colPath(uid, 'goals'), goal.id), stripId(goal));
  for (const item of starterSchedule) {
    batch.set(doc(db, colPath(uid, 'schedule'), item.id), stripId(item));
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
  // Clearing an optional field (target weight, gym) has to remove it from the
  // persisted document — merge alone would keep the stale value.
  const cleared = Object.entries(profile)
    .filter(([, value]) => value === undefined)
    .map(([key]) => key);
  if (cleared.length > 0) {
    const updates: Record<string, ReturnType<typeof deleteField>> = {};
    cleared.forEach((key) => {
      updates[`profile.${key}`] = deleteField();
    });
    await updateDoc(ref, updates).catch(() => {
      /* fields were not stored — nothing to delete */
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
  options: { removeStale?: boolean } = {},
): Promise<void> {
  const { db } = await requireServices();
  const { doc, getDocs, writeBatch, collection } = await import('firebase/firestore');
  const ops: Array<{ ref: ReturnType<typeof doc>; item?: T }> = [];

  if (options.removeStale !== false) {
    const snap = await getDocs(collection(db, colPath(uid, name)));
    const keep = new Set(items.map((i) => i.id));
    snap.docs.forEach((d) => {
      if (!keep.has(d.id)) ops.push({ ref: doc(db, colPath(uid, name), d.id) });
    });
  }
  items.forEach((item) => ops.push({ ref: doc(db, colPath(uid, name), item.id), item }));
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + 400)) {
      // Same shape as a single upsert: no `id` field, no nested `undefined`.
      if (op.item) batch.set(op.ref, stripId(op.item));
      else batch.delete(op.ref);
    }
    await batch.commit();
  }
}

/** Remove rows not present in a validated backup, after all replacement rows
 * have been uploaded successfully. */
async function removeStaleCollection<T extends { id: string }>(
  uid: string,
  name: CollectionName,
  items: T[],
): Promise<void> {
  const { db } = await requireServices();
  const { doc, getDocs, writeBatch, collection } = await import('firebase/firestore');
  const keep = new Set(items.map((i) => i.id));
  const snap = await getDocs(collection(db, colPath(uid, name)));
  const stale = snap.docs.filter((d) => !keep.has(d.id));
  for (let i = 0; i < stale.length; i += 400) {
    const batch = writeBatch(db);
    for (const item of stale.slice(i, i + 400)) batch.delete(doc(db, colPath(uid, name), item.id));
    await batch.commit();
  }
}

/**
 * Replace a cloud account from a validated backup without deleting first.
 * Each collection is first upserted without deleting anything. Stale rows are
 * removed only after every replacement row and the profile have uploaded. If a
 * later network call fails, the account may temporarily contain old plus new
 * rows, but it is never reduced to an empty or partially deleted account and a
 * retry can safely finish the cleanup.
 */
export async function replaceUserState(uid: string, state: FitnessState): Promise<void> {
  await replaceCollection(uid, 'categories', state.categories, { removeStale: false });
  await replaceCollection(uid, 'sessions', state.sessions, { removeStale: false });
  await replaceCollection(uid, 'schedule', state.schedule, { removeStale: false });
  await replaceCollection(uid, 'goals', state.goals, { removeStale: false });
  await replaceCollection(uid, 'bodyLogs', state.bodyLogs, { removeStale: false });
  await replaceCollection(uid, 'meals', state.meals, { removeStale: false });
  await replaceCollection(uid, 'checkIns', state.checkIns ?? [], { removeStale: false });
  await replaceCollection(uid, 'customGyms', (state.customGyms || []) as any, {
    removeStale: false,
  });
  // saveProfile also removes optional fields omitted by the backup.
  await saveProfile(uid, state.profile);
  await removeStaleCollection(uid, 'categories', state.categories);
  await removeStaleCollection(uid, 'sessions', state.sessions);
  await removeStaleCollection(uid, 'schedule', state.schedule);
  await removeStaleCollection(uid, 'goals', state.goals);
  await removeStaleCollection(uid, 'bodyLogs', state.bodyLogs);
  await removeStaleCollection(uid, 'meals', state.meals);
  await removeStaleCollection(uid, 'checkIns', state.checkIns ?? []);
  await removeStaleCollection(uid, 'customGyms', (state.customGyms || []) as any);
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
    ...state.meals.map((item) => ({ name: 'meals' as const, item })),
    ...(state.checkIns ?? []).map((item) => ({ name: 'checkIns' as const, item })),
    ...((state.customGyms || []) as any).map((item: any) => ({
      name: 'customGyms' as const,
      item,
    })),
  ];

  const CHUNK = 400; // headroom under the 500-op batch limit
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = writeBatch(db);
    if (i === 0) {
      batch.set(
        doc(db, userDoc(uid)),
        { profile: sanitize(state.profile), updatedAt: Date.now() },
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
  return sanitize(rest) as Omit<T, 'id'>;
}

/**
 * Firestore rejects explicit `undefined` at *any* depth — a set logged as
 * `{reps: 8, weight: undefined}` (the shape `parseState` produces for a
 * bodyweight set) throws on write. Strip undefined keys recursively so a
 * nested optional field can never fail an otherwise valid document.
 */
export function sanitize<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => sanitize(v)) as T;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, sanitize(v)]),
    ) as T;
  }
  return value;
}
