/**
 * Firestore repository — persists a user's FitnessState under
 * `users/{uid}`. Profile lives on the profile document; each array
 * collection lives in its own sub-collection so large histories stay
 * scalable and don't require rewriting a single giant document.
 *
 * Writes are fire-and-forget (the in-memory store is the source of truth
 * for rendering; Firestore is the durable backend). Reads assemble the same
 * FitnessState shape used by the local store.
 */
import {
  type BodyLog,
  type Category,
  type FitnessGoal,
  type FitnessState,
  type ScheduledWorkout,
  type UserProfile,
  type WorkoutSession,
} from '@smartfit/core';
import { getDb, colPath, userDoc } from './config';

type CollectionName = 'sessions' | 'schedule' | 'goals' | 'bodyLogs' | 'categories';

/** Firestore document for a single collection item (id + data). */
interface DocMap<T> {
  [id: string]: T;
}

function fs() {
  // Lazy require keeps these out of any server bundle.
  return require('firebase/firestore') as typeof import('firebase/firestore');
}

/** Load the entire FitnessState for a user from Firestore. */
export async function loadUserState(uid: string): Promise<FitnessState | null> {
  const db = getDb();
  if (!db) return null;
  const { doc, getDoc, collection, getDocs } = fs();

  const profileSnap = await getDoc(doc(db, userDoc(uid)));
  if (!profileSnap.exists()) return null;

  const data = profileSnap.data();
  const profile = (data.profile as UserProfile) ?? undefined;
  if (!profile) return null;

  const firestore = db;
  async function getCol<T>(name: CollectionName): Promise<T[]> {
    const snap = await getDocs(collection(firestore, colPath(uid, name)));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as unknown as T);
  }

  const [sessions, schedule, goals, bodyLogs, categories] = await Promise.all([
    getCol<WorkoutSession>('sessions'),
    getCol<ScheduledWorkout>('schedule'),
    getCol<FitnessGoal>('goals'),
    getCol<BodyLog>('bodyLogs'),
    getCol<Category>('categories'),
  ]);

  sessions.sort((a, b) => (a.date < b.date ? 1 : -1));
  bodyLogs.sort((a, b) => (a.date < b.date ? 1 : -1));

  return { profile, categories, sessions, schedule, goals, bodyLogs };
}

/** Create the user's profile document if it doesn't exist yet. */
export async function ensureUserProfile(
  uid: string,
  profile: UserProfile,
  fallbackCategories: Category[],
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const { doc, getDoc, setDoc, writeBatch } = fs();
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
  const db = getDb();
  if (!db) return;
  const { doc, setDoc } = fs();
  await setDoc(doc(db, userDoc(uid)), { profile, updatedAt: Date.now() }, { merge: true });
}

/** Persist a full collection in one batch (used after a mutation). */
export async function saveCollection<T extends { id: string }>(
  uid: string,
  name: CollectionName,
  items: T[],
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const { doc, writeBatch } = fs();
  const batch = writeBatch(db);
  for (const item of items) {
    batch.set(doc(db, colPath(uid, name), item.id), stripId(item));
  }
  await batch.commit();
}

/** Upsert a single item into a sub-collection. */
export async function upsertItem<T extends { id: string }>(
  uid: string,
  name: CollectionName,
  item: T,
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const { doc, setDoc } = fs();
  await setDoc(doc(db, colPath(uid, name), item.id), stripId(item));
}

/** Delete a single item from a sub-collection. */
export async function deleteItem(uid: string, name: CollectionName, id: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const { doc, deleteDoc } = fs();
  await deleteDoc(doc(db, colPath(uid, name), id));
}

/** Remove every document for a user (account reset / sign-out & wipe). */
export async function wipeUserData(uid: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const { doc, deleteDoc, collection, getDocs } = fs();
  const names: CollectionName[] = ['sessions', 'schedule', 'goals', 'bodyLogs', 'categories'];
  for (const name of names) {
    const snap = await getDocs(collection(db, colPath(uid, name)));
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
  }
  await deleteDoc(doc(db, userDoc(uid)));
}

function stripId<T extends { id?: string }>(item: T): Omit<T, 'id'> {
  const { id: _id, ...rest } = item;
  return rest;
}

export type { DocMap };
