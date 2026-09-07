/**
 * Firestore repository — persists a user's FitnessState under
 * `users/{uid}`. Profile lives on the profile document; each array
 * collection lives in its own sub-collection so large histories stay
 * scalable and don't require rewriting a single giant document.
 *
 * The in-memory store is the source of truth for rendering; Firestore is the
 * durable backend. Reads assemble the same FitnessState shape the local
 * store uses; writes are best-effort (never block UI).
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
import { getFirebaseServices, colPath, userDoc } from './config';

type CollectionName = 'sessions' | 'schedule' | 'goals' | 'bodyLogs' | 'categories';

/** Firestore document for a single collection item (id + data). */
interface DocMap<T> {
  [id: string]: T;
}

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

/** Load the entire FitnessState for a user from Firestore. */
export async function loadUserState(uid: string): Promise<FitnessState | null> {
  const svc = await getFirebaseServices();
  if (!svc) return null;
  const { db } = svc;
  const { doc, getDoc, collection, getDocs } = await import('firebase/firestore');

  const profileSnap = await getDoc(doc(db, userDoc(uid)));
  if (!profileSnap.exists()) return null;

  const data = profileSnap.data();
  const profile = (data.profile as UserProfile) ?? undefined;
  if (!profile) return null;

  async function getCol<T>(name: CollectionName): Promise<T[]> {
    const snap = await getDocs(collection(db, colPath(uid, name)));
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
  const svc = await getFirebaseServices();
  if (!svc) return;
  const { db } = svc;
  const { doc, getDoc, setDoc, writeBatch } = await import('firebase/firestore');

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
  const svc = await getFirebaseServices();
  if (!svc) return;
  const { db } = svc;
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, userDoc(uid)), { profile, updatedAt: Date.now() }, { merge: true });
}

/** Upsert a single item into a sub-collection. */
export async function upsertItem<T extends { id: string }>(
  uid: string,
  name: CollectionName,
  item: T,
): Promise<void> {
  const svc = await getFirebaseServices();
  if (!svc) return;
  const { db } = svc;
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, colPath(uid, name), item.id), stripId(item));
}

/** Delete a single item from a sub-collection. */
export async function deleteItem(uid: string, name: CollectionName, id: string): Promise<void> {
  const svc = await getFirebaseServices();
  if (!svc) return;
  const { db } = svc;
  const { doc, deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, colPath(uid, name), id));
}

/** Remove every document for a user (account reset / sign-out & wipe). */
export async function wipeUserData(uid: string): Promise<void> {
  const svc = await getFirebaseServices();
  if (!svc) return;
  const { db } = svc;
  const { doc, deleteDoc, collection, getDocs } = await import('firebase/firestore');
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
