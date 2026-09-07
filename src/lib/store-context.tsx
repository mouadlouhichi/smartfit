'use client';

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
  STORAGE_KEY,
  DEFAULT_CATEGORIES,
  emptyState,
  isEmptyState,
  parseState,
  parseStateJSON,
  uid,
  estimateCalories,
  latestBodyWeightKg,
  type BodyLog,
  type Category,
  type FitnessGoal,
  type FitnessState,
  type ScheduledWorkout,
  type UserProfile,
  type WorkoutSession,
} from '@smartfit/core';
import { env } from './env';
import { useAuth } from './firebase/auth-context';
import {
  ensureUserProfile,
  importState,
  loadUserState,
  saveProfile,
  upsertItem,
  deleteItem,
  wipeUserData,
  type CollectionName,
} from './firebase/repo';
import { WriteQueue, type SyncStatus } from './firebase/write-queue';

/**
 * First-run state for a brand-new user: a clean account that lands on
 * guided onboarding. No demo data is seeded in production.
 */
function freshState(): FitnessState {
  const empty = emptyState();
  empty.profile.planId = env.defaultPlan;
  return empty;
}

/**
 * The in-memory snapshot always carries the identity it belongs to.
 *
 * This is what makes sign-out safe. Previously `cloud` was derived from render
 * state, so there was a commit in which `cloud` had already flipped to false
 * while `state` still held the signed-out user's cloud data — and the
 * persistence effect happily wrote it to the shared localStorage key, where
 * the next visitor read it back. Binding the owner to the data means a write
 * can never be misattributed, regardless of render or effect ordering.
 */
interface Snapshot {
  /** Firebase uid the data belongs to, or null for on-device data. */
  owner: string | null;
  ready: boolean;
  state: FitnessState;
}

const BLANK: Snapshot = { owner: null, ready: false, state: emptyState() };

/** Per-account offline mirror of cloud data. Never the shared local key. */
const cacheKey = (owner: string) => `smartfit.cache.${owner}`;

function storageKeyFor(owner: string | null): string {
  return owner ? cacheKey(owner) : STORAGE_KEY;
}

function readLocal(owner: string | null): FitnessState | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseStateJSON(window.localStorage.getItem(storageKeyFor(owner)));
  } catch {
    return null;
  }
}

function writeLocal(owner: string | null, state: FitnessState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKeyFor(owner), JSON.stringify(state));
  } catch {
    /* storage full / unavailable — the app keeps working in memory */
  }
}

function clearLocal(owner: string | null) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKeyFor(owner));
  } catch {
    /* ignore */
  }
}

export interface PendingMigration {
  /** On-device data found when signing in to an empty cloud account. */
  state: FitnessState;
  counts: { sessions: number; goals: number; schedule: number; bodyLogs: number };
}

interface StoreContextValue {
  state: FitnessState;
  ready: boolean;
  cloud: boolean;
  /** Cloud write health, so the UI can tell the user when a save failed. */
  syncStatus: SyncStatus;
  syncError: string | null;
  retrySync: () => void;

  /** Local data awaiting import into a freshly created cloud account. */
  pendingMigration: PendingMigration | null;
  importLocalData: () => Promise<void>;
  discardLocalData: () => void;

  // sessions
  addSession: (s: Omit<WorkoutSession, 'id' | 'createdAt'>) => void;
  updateSession: (id: string, patch: Partial<WorkoutSession>) => void;
  deleteSession: (id: string) => void;
  // schedule
  addSchedule: (s: Omit<ScheduledWorkout, 'id' | 'createdAt'>) => void;
  updateSchedule: (id: string, patch: Partial<ScheduledWorkout>) => void;
  deleteSchedule: (id: string) => void;
  // goals
  addGoal: (g: Omit<FitnessGoal, 'id' | 'createdAt'>) => void;
  updateGoal: (id: string, patch: Partial<FitnessGoal>) => void;
  deleteGoal: (id: string) => void;
  // body
  addBodyLog: (b: Omit<BodyLog, 'id' | 'createdAt'>) => void;
  deleteBodyLog: (id: string) => void;
  // categories
  addCategory: (c: Omit<Category, 'id'>) => void;
  deleteCategory: (id: string) => void;
  // profile / lifecycle
  updateProfile: (patch: Partial<UserProfile>) => void;
  completeOnboarding: (patch: Partial<UserProfile>) => void;
  clearData: () => Promise<void>;
  /** Sign out and drop this device's copy of the account's data. */
  signOutAndForget: () => Promise<void>;
  /** Replace all state (used by JSON import). */
  replaceState: (next: FitnessState) => Promise<void>;
  /** Estimated calories for a session, personalised by latest body weight. */
  estimateSessionCalories: (durationMin: number, intensity: WorkoutSession['intensity']) => number;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user, mode, initializing, signOut } = useAuth();
  const cloudMode = mode === 'cloud';

  const [snapshot, setSnapshot] = useState<Snapshot>(BLANK);
  const [pendingMigration, setPendingMigration] = useState<PendingMigration | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  const queueRef = useRef<WriteQueue | null>(null);
  if (queueRef.current === null) queueRef.current = new WriteQueue();
  const queue = queueRef.current;

  useEffect(() => {
    const unsub = queue.subscribe((status, _pending, error) => {
      setSyncStatus(status);
      setSyncError(error);
    });
    return () => {
      unsub();
    };
  }, [queue]);

  const uidValue = user?.uid ?? null;

  // ── Hydrate whenever the identity changes ────────────────────────────
  useEffect(() => {
    let cancelled = false;

    // Drop the previous identity's data immediately. Nothing may be persisted
    // until the new snapshot is ready.
    setSnapshot(BLANK);
    setPendingMigration(null);
    queue.clear();

    // In cloud mode, wait for auth to resolve before deciding what to load —
    // otherwise a signed-in reload briefly hydrates (and would persist) the
    // anonymous local state.
    if (cloudMode && initializing) return;

    async function hydrate() {
      // ── Local mode / signed out ───────────────────────────────────────
      if (!uidValue) {
        const local = readLocal(null) ?? freshState();
        if (!cancelled) setSnapshot({ owner: null, ready: true, state: local });
        return;
      }

      // ── Cloud mode, signed in ─────────────────────────────────────────
      const owner = uidValue;
      try {
        const remote = await loadUserState(owner);
        if (cancelled) return;

        if (remote) {
          setSnapshot({ owner, ready: true, state: remote });
          return;
        }

        // Brand-new account. Offer to bring across anything logged on this
        // device before signing up, rather than silently orphaning it.
        const starter = freshState();
        if (user?.displayName) starter.profile.name = user.displayName;
        await ensureUserProfile(owner, starter.profile, DEFAULT_CATEGORIES);
        if (cancelled) return;

        setSnapshot({ owner, ready: true, state: starter });

        const local = readLocal(null);
        if (local && !isEmptyState(local)) {
          setPendingMigration({
            state: local,
            counts: {
              sessions: local.sessions.length,
              goals: local.goals.length,
              schedule: local.schedule.length,
              bodyLogs: local.bodyLogs.length,
            },
          });
        }
      } catch {
        // Offline or Firestore unreachable: fall back to this account's
        // cached copy so the app is usable rather than stuck or empty.
        if (cancelled) return;
        const cached = readLocal(owner);
        setSnapshot({ owner, ready: true, state: cached ?? freshState() });
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
    // `user.displayName` is intentionally not a dependency — it must not
    // trigger a re-hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uidValue, cloudMode, initializing, queue]);

  // ── Persistence ──────────────────────────────────────────────────────
  // Writes to the key that belongs to `snapshot.owner`, so cloud data is
  // mirrored per-account and on-device data keeps the shared key.
  useEffect(() => {
    if (!snapshot.ready) return;
    writeLocal(snapshot.owner, snapshot.state);
  }, [snapshot]);

  const enqueue = useCallback(
    (owner: string | null, key: string, run: () => Promise<void>) => {
      if (!owner) return; // local mode persists via the effect above
      queue.push({ key, run });
    },
    [queue],
  );

  /**
   * Apply a pure update to the snapshot and, in cloud mode, queue the
   * matching remote write. The remote write is derived from the *next* state
   * and enqueued after the updater has run — never inside it, so React's
   * StrictMode double-invocation can't double-write.
   */
  const mutate = useCallback(
    (
      update: (prev: FitnessState) => FitnessState,
      remote?: (next: FitnessState, owner: string) => { key: string; run: () => Promise<void> },
    ) => {
      setSnapshot((prev) => {
        if (!prev.ready) return prev;
        const next = update(prev.state);
        if (remote && prev.owner) {
          const { key, run } = remote(next, prev.owner);
          // Defer so no side effect happens during the updater itself.
          queueMicrotask(() => enqueue(prev.owner, key, run));
        }
        return { ...prev, state: next };
      });
    },
    [enqueue],
  );

  const upsert = useCallback(
    <T extends { id: string }>(name: CollectionName, item: T) =>
      (_next: FitnessState, owner: string) => ({
        key: `${name}:${item.id}`,
        run: () => upsertItem(owner, name, item),
      }),
    [],
  );

  const remove = useCallback(
    (name: CollectionName, id: string) => (_next: FitnessState, owner: string) => ({
      key: `${name}:${id}`,
      run: () => deleteItem(owner, name, id),
    }),
    [],
  );

  const { owner, ready, state } = snapshot;
  const cloud = cloudMode && !!owner;

  const estimateSessionCalories = useCallback(
    (durationMin: number, intensity: WorkoutSession['intensity']) =>
      estimateCalories(durationMin, intensity, latestBodyWeightKg(state) ?? undefined),
    [state],
  );

  const value = useMemo<StoreContextValue>(() => {
    const patched = <T extends { id: string }>(
      list: T[],
      id: string,
      patch: Partial<T>,
    ): T | null => {
      const found = list.find((x) => x.id === id);
      return found ? { ...found, ...patch } : null;
    };

    return {
      state,
      ready,
      cloud,
      syncStatus,
      syncError,
      retrySync: () => queue.retry(),

      pendingMigration,
      importLocalData: async () => {
        if (!pendingMigration || !owner) return;
        const merged = parseState({
          ...pendingMigration.state,
          profile: { ...pendingMigration.state.profile, onboardingDone: true },
        });
        await importState(owner, merged);
        clearLocal(null); // it now lives in the cloud account
        setPendingMigration(null);
        setSnapshot((prev) => (prev.owner === owner ? { ...prev, state: merged } : prev));
      },
      discardLocalData: () => setPendingMigration(null),

      addSession: (s) => {
        const item: WorkoutSession = { ...s, id: uid('ses'), createdAt: Date.now() };
        mutate(
          (prev) => ({
            ...prev,
            sessions: [...prev.sessions, item].sort((a, b) => (a.date < b.date ? 1 : -1)),
          }),
          upsert('sessions', item),
        );
      },
      updateSession: (id, patch) => {
        const next = patched(state.sessions, id, patch);
        mutate(
          (prev) => ({
            ...prev,
            sessions: prev.sessions
              .map((s) => (s.id === id ? { ...s, ...patch } : s))
              .sort((a, b) => (a.date < b.date ? 1 : -1)),
          }),
          next ? upsert('sessions', next) : undefined,
        );
      },
      deleteSession: (id) => {
        mutate(
          (prev) => ({ ...prev, sessions: prev.sessions.filter((s) => s.id !== id) }),
          remove('sessions', id),
        );
      },

      addSchedule: (s) => {
        const item: ScheduledWorkout = { ...s, id: uid('sch'), createdAt: Date.now() };
        mutate(
          (prev) => ({ ...prev, schedule: [...prev.schedule, item] }),
          upsert('schedule', item),
        );
      },
      updateSchedule: (id, patch) => {
        const next = patched(state.schedule, id, patch);
        mutate(
          (prev) => ({
            ...prev,
            schedule: prev.schedule.map((s) => (s.id === id ? { ...s, ...patch } : s)),
          }),
          next ? upsert('schedule', next) : undefined,
        );
      },
      deleteSchedule: (id) => {
        mutate(
          (prev) => ({ ...prev, schedule: prev.schedule.filter((s) => s.id !== id) }),
          remove('schedule', id),
        );
      },

      addGoal: (g) => {
        const item: FitnessGoal = { ...g, id: uid('goal'), createdAt: Date.now() };
        mutate((prev) => ({ ...prev, goals: [...prev.goals, item] }), upsert('goals', item));
      },
      updateGoal: (id, patch) => {
        const next = patched(state.goals, id, patch);
        mutate(
          (prev) => ({
            ...prev,
            goals: prev.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
          }),
          next ? upsert('goals', next) : undefined,
        );
      },
      deleteGoal: (id) => {
        mutate(
          (prev) => ({ ...prev, goals: prev.goals.filter((g) => g.id !== id) }),
          remove('goals', id),
        );
      },

      addBodyLog: (b) => {
        const item: BodyLog = { ...b, id: uid('body'), createdAt: Date.now() };
        mutate(
          (prev) => ({
            ...prev,
            bodyLogs: [...prev.bodyLogs, item].sort((a, b2) => (a.date < b2.date ? 1 : -1)),
          }),
          upsert('bodyLogs', item),
        );
      },
      deleteBodyLog: (id) => {
        mutate(
          (prev) => ({ ...prev, bodyLogs: prev.bodyLogs.filter((b) => b.id !== id) }),
          remove('bodyLogs', id),
        );
      },

      addCategory: (c) => {
        const item: Category = { ...c, id: uid('cat') };
        mutate(
          (prev) => ({ ...prev, categories: [...prev.categories, item] }),
          upsert('categories', item),
        );
      },
      deleteCategory: (id) => {
        const target = state.categories.find((c) => c.id === id);
        if (!target || target.builtin) return;
        mutate(
          (prev) => ({ ...prev, categories: prev.categories.filter((c) => c.id !== id) }),
          remove('categories', id),
        );
      },

      updateProfile: (patch) => {
        mutate(
          (prev) => ({ ...prev, profile: { ...prev.profile, ...patch } }),
          (next, o) => ({ key: 'profile', run: () => saveProfile(o, next.profile) }),
        );
      },
      completeOnboarding: (patch) => {
        mutate(
          (prev) => ({ ...prev, profile: { ...prev.profile, ...patch, onboardingDone: true } }),
          (next, o) => ({ key: 'profile', run: () => saveProfile(o, next.profile) }),
        );
      },

      clearData: async () => {
        queue.clear();
        const blank = freshState();
        if (owner) {
          await wipeUserData(owner);
          await ensureUserProfile(owner, blank.profile, DEFAULT_CATEGORIES);
          clearLocal(owner);
        } else {
          clearLocal(null);
        }
        setSnapshot({ owner, ready: true, state: blank });
      },

      signOutAndForget: async () => {
        queue.clear();
        if (owner) clearLocal(owner);
        clearLocal(null);
        setSnapshot(BLANK);
        await signOut();
      },

      replaceState: async (next) => {
        const clean = parseState(next);
        if (owner) await importState(owner, clean);
        setSnapshot((prev) => ({ ...prev, state: clean, ready: true }));
      },

      estimateSessionCalories,
    };
  }, [
    state,
    ready,
    cloud,
    owner,
    syncStatus,
    syncError,
    pendingMigration,
    mutate,
    upsert,
    remove,
    queue,
    signOut,
    estimateSessionCalories,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>');
  return ctx;
}
