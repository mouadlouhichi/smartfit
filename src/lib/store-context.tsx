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
  parseState,
  parseStateJSON,
  uid,
  estimateCalories,
  latestBodyWeightKg,
  type BodyLog,
  type MealLog,
  type Category,
  type FitnessGoal,
  type FitnessState,
  type ScheduledWorkout,
  type UserProfile,
  type WeeklyCheckIn,
  type WorkoutSession,
} from '@smartfit/core';
import { env } from './env';
import { Button } from '@/components/ui/button';
import {
  decideCloudHydration,
  isHydrationReady,
  offlineHydrationState,
  decideLocalHydration,
  freshState as buildFreshState,
  type PendingMigration,
} from './hydration';
import { useAuth } from './firebase/auth-context';
import {
  ensureUserProfile,
  importState,
  loadUserState,
  loadMoreSessions,
  loadMoreBodyLogs,
  saveProfile,
  saveOnboarding,
  upsertItem,
  deleteItem,
  replaceCollection,
  replaceUserState,
  wipeUserData,
  INITIAL_SESSION_LIMIT,
  PAGE_SIZE,
  type CollectionName,
} from './firebase/repo';
import { WriteQueue, type SyncStatus } from './firebase/write-queue';
import { clearAllRunDrafts, clearRunDraft } from './run-sensors';

/** First-run state for a brand-new user (see ./hydration). */
const freshState = (displayName?: string | null): FitnessState =>
  buildFreshState(env.defaultPlan, displayName);

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

/** Returns false when the write failed (quota / storage disabled). */
function writeLocal(owner: string | null, serialized: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    window.localStorage.setItem(storageKeyFor(owner), serialized);
    return true;
  } catch {
    return false;
  }
}

/** Merge two descending-by-date session lists, de-duplicating by id. */
function mergeSessionsDesc(a: WorkoutSession[], b: WorkoutSession[]): WorkoutSession[] {
  const seen = new Set(a.map((s) => s.id));
  return [...a, ...b.filter((s) => !seen.has(s.id))].sort((x, y) =>
    x.date === y.date ? y.createdAt - x.createdAt : x.date < y.date ? 1 : -1,
  );
}

/** Merge two descending-by-date body-log lists, de-duplicating by id. */
function mergeBodyLogsDesc(a: BodyLog[], b: BodyLog[]): BodyLog[] {
  const seen = new Set(a.map((l) => l.id));
  return [...a, ...b.filter((l) => !seen.has(l.id))].sort((x, y) =>
    x.date === y.date ? y.createdAt - x.createdAt : x.date < y.date ? 1 : -1,
  );
}

function clearLocal(owner: string | null) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKeyFor(owner));
  } catch {
    /* ignore */
  }
}

/** Local Pro previews are deliberately not cloud entitlements. Do not let
 * a trial or sandbox paid stamp cross the client-to-cloud migration boundary.
 * A paid stamp already provisioned by a trusted server is handled separately
 * by the Firestore rule that requires an exact existing value. */
function stripLocalProPreview(state: FitnessState): FitnessState {
  if (!state.profile.pro) return state;
  return parseState({
    ...state,
    profile: { ...state.profile, pro: undefined },
  });
}

/** Strip only a local trial when replacing an existing cloud state. A trusted
 * paid stamp may survive a backup replacement only when Firestore sees the
 * exact same stamp already stored on the account. */
function stripCloudTrial(state: FitnessState): FitnessState {
  if (state.profile.pro?.plan !== 'trial') return state;
  return stripLocalProPreview(state);
}

export type { PendingMigration };

interface StoreContextValue {
  state: FitnessState;
  ready: boolean;
  cloud: boolean;
  /** Cloud write health, so the UI can tell the user when a save failed. */
  syncStatus: SyncStatus;
  syncError: string | null;
  retrySync: () => void;

  /**
   * True when the cloud account holds more history than the initial bounded
   * load fetched — the log can page further back on demand.
   */
  hasMoreSessions: boolean;
  hasMoreBodyLogs: boolean;
  /** Which paged fetch (if any) is in flight, for button spinners. */
  loadingMore: 'sessions' | 'body' | null;
  loadEarlierSessions: () => Promise<void>;
  loadEarlierBodyLogs: () => Promise<void>;
  /** Full state including any un-loaded history pages (used by JSON export). */
  collectFullState: () => Promise<FitnessState>;

  /** Set when the on-device mirror could not be written (quota exceeded). */
  storageFull: boolean;
  dismissStorageWarning: () => void;

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
  /** Swap the whole scheduled week in one operation (suggested-program import). */
  replaceSchedule: (items: Omit<ScheduledWorkout, 'id' | 'createdAt'>[]) => void;
  // goals
  addGoal: (g: Omit<FitnessGoal, 'id' | 'createdAt'>) => void;
  updateGoal: (id: string, patch: Partial<FitnessGoal>) => void;
  deleteGoal: (id: string) => void;
  // body
  addBodyLog: (b: Omit<BodyLog, 'id' | 'createdAt'>) => void;
  deleteBodyLog: (id: string) => void;
  // meals (fuel)
  addMeal: (m: Omit<MealLog, 'id' | 'createdAt'>) => void;
  updateMeal: (id: string, patch: Partial<MealLog>) => void;
  deleteMeal: (id: string) => void;

  /**
   * Record a weekly check-in. Idempotent per week: answering the same week
   * twice replaces the answer rather than stacking a second entry, because the
   * weekly prompt must never be able to pile up duplicates in the log.
   */
  addCheckIn: (c: Omit<WeeklyCheckIn, 'id' | 'createdAt'>) => WeeklyCheckIn | null;
  // categories
  addCategory: (c: Omit<Category, 'id'>) => void;
  deleteCategory: (id: string) => void;
  // profile / lifecycle
  updateProfile: (patch: Partial<UserProfile>) => void;
  completeOnboarding: (
    patch: Partial<UserProfile>,
    firstGoal?: FitnessGoal,
    starterSchedule?: Omit<ScheduledWorkout, 'id' | 'createdAt'>[],
  ) => void;
  /** Generic state patch (for gyms, enrollments, etc.) */
  updateState: (patch: Partial<FitnessState>) => void;
  /** Resolves when every queued cloud write has landed; instant on-device. */
  flushWrites: () => Promise<void>;
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
  const [hasMoreSessions, setHasMoreSessions] = useState(false);
  const [hasMoreBodyLogs, setHasMoreBodyLogs] = useState(false);
  const [loadingMore, setLoadingMore] = useState<'sessions' | 'body' | null>(null);
  const [storageFull, setStorageFull] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const queueRef = useRef<WriteQueue | null>(null);
  if (queueRef.current === null) queueRef.current = new WriteQueue();
  const queue = queueRef.current;

  /**
   * Last serialisation this tab wrote (or adopted). The persistence effect
   * skips re-writing identical content, which is also what stops two tabs from
   * ping-ponging storage events at each other after a cross-tab adoption.
   */
  const lastSerialized = useRef<string | null>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

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
    // until the new snapshot is ready. An unfinished GPS trace is sensitive
    // too, so remove the old account's draft when auth changes rather than
    // leaving it behind for a later sign-in.
    const previousOwner = snapshotRef.current.owner;
    if (previousOwner && previousOwner !== uidValue) clearRunDraft(previousOwner);
    setSnapshot(BLANK);
    setLoadError(null);
    setPendingMigration(null);
    setHasMoreSessions(false);
    setHasMoreBodyLogs(false);
    setLoadingMore(null);
    setStorageFull(false);
    lastSerialized.current = null;
    queue.clear();

    // In cloud mode, wait for auth to resolve before deciding what to load —
    // otherwise a signed-in reload briefly hydrates (and would persist) the
    // anonymous local state.
    if (cloudMode && initializing) return;

    async function hydrate() {
      // ── Local mode / signed out ───────────────────────────────────────
      if (!uidValue) {
        const decision = decideLocalHydration(readLocal(null), env.defaultPlan);
        if (!cancelled) setSnapshot({ owner: null, ready: true, state: decision.state });
        return;
      }

      // ── Cloud mode, signed in ─────────────────────────────────────────
      const owner = uidValue;
      try {
        const remote = await loadUserState(owner);
        if (cancelled) return;

        const decision = decideCloudHydration({
          remote,
          local: readLocal(null),
          displayName: user?.displayName,
          defaultPlan: env.defaultPlan,
        });

        // A brand-new account needs its profile document before anything can
        // be written to it.
        if (decision.isNewAccount) {
          await ensureUserProfile(owner, decision.state.profile, DEFAULT_CATEGORIES);
          if (cancelled) return;
        }

        setSnapshot({ owner, ready: true, state: decision.state });
        // Offered, never applied automatically — a new account starts clean.
        setPendingMigration(decision.migration);
        // A full initial window means the server-side query hit its limit, so
        // there is very likely older history to page through on demand.
        setHasMoreSessions(decision.state.sessions.length >= INITIAL_SESSION_LIMIT);
        setHasMoreBodyLogs(decision.state.bodyLogs.length >= PAGE_SIZE);
      } catch {
        // Offline or Firestore unreachable: fall back to this account's
        // cached copy so the app is usable rather than stuck or empty.
        if (cancelled) return;
        const cached = offlineHydrationState(readLocal(owner));
        if (!cached) {
          // Never manufacture an incomplete profile after a failed read: it
          // sends returning users through setup and can overwrite cloud data.
          setLoadError("We couldn't load your account. Check your connection and try again.");
          return;
        }
        setSnapshot({ owner, ready: true, state: cached });
        // The cache mirrors whatever was loaded before, so it can also be a
        // truncated window. Offer paging when it looks like one; a fetch that
        // comes back empty simply clears the flag.
        setHasMoreSessions((cached?.sessions.length ?? 0) >= INITIAL_SESSION_LIMIT);
        setHasMoreBodyLogs((cached?.bodyLogs.length ?? 0) >= PAGE_SIZE);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
    // `user.displayName` is intentionally not a dependency — it must not
    // trigger a re-hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uidValue, cloudMode, initializing, queue, loadAttempt]);

  // ── Persistence ──────────────────────────────────────────────────────
  // Writes to the key that belongs to `snapshot.owner`, so cloud data is
  // mirrored per-account and on-device data keeps the shared key. Identical
  // content is never rewritten: that keeps the mirror cheap and is the guard
  // that makes cross-tab adoption (below) converge instead of ping-ponging.
  useEffect(() => {
    if (!snapshot.ready) return;
    const serialized = JSON.stringify(snapshot.state);
    if (serialized === lastSerialized.current) return;
    lastSerialized.current = serialized;
    if (!writeLocal(snapshot.owner, serialized)) {
      // Quota exceeded / storage disabled — the app keeps working in memory,
      // but the user should know the offline mirror is gone.
      setStorageFull(true);
    }
  }, [snapshot]);

  // ── Cross-tab adoption ───────────────────────────────────────────────
  // Another tab writing to the same key means the same person edited the same
  // data. Adopt its snapshot when this tab is idle (ready, no queued writes),
  // so two open tabs converge instead of diverging until reload.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const owner = snapshot.owner;
    const key = storageKeyFor(owner);

    function onStorage(e: StorageEvent) {
      if (e.key !== key || !e.newValue) return;
      if (e.newValue === lastSerialized.current) return;
      const cur = snapshotRef.current;
      if (!cur.ready || cur.owner !== owner || queue.pending > 0) return;
      let next: FitnessState | null = null;
      try {
        next = parseStateJSON(e.newValue);
      } catch {
        return;
      }
      if (!next) return;
      // Remember our own serialisation of the adopted state (not the raw
      // event value) so the persistence effect sees "already written" and
      // adoption can never bounce back to the other tab.
      lastSerialized.current = JSON.stringify(next);
      setSnapshot((prev) =>
        prev.ready && prev.owner === owner ? { ...prev, state: next! } : prev,
      );
    }

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [snapshot.owner, queue]);

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

  const { owner, state } = snapshot;
  // Effects reset the snapshot after render; gates must not see the previous
  // identity's ready state during that render (especially immediately after login).
  const ready = isHydrationReady(snapshot, uidValue, cloudMode && initializing);
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

      hasMoreSessions,
      hasMoreBodyLogs,
      loadingMore,
      dismissStorageWarning: () => setStorageFull(false),
      storageFull,

      loadEarlierSessions: async () => {
        if (!owner || loadingMore) return;
        const oldest = state.sessions[state.sessions.length - 1];
        if (!oldest) {
          setHasMoreSessions(false);
          return;
        }
        setLoadingMore('sessions');
        try {
          const more = await loadMoreSessions(owner, {
            date: oldest.date,
            createdAt: oldest.createdAt,
          });
          setSnapshot((prev) =>
            prev.owner === owner && prev.ready
              ? {
                  ...prev,
                  state: {
                    ...prev.state,
                    sessions: mergeSessionsDesc(prev.state.sessions, more),
                  },
                }
              : prev,
          );
          // A short page means we reached the beginning of the history.
          setHasMoreSessions(more.length >= PAGE_SIZE);
        } catch (err) {
          // Let the caller surface it — a failed page fetch must not look
          // like a successful end of history.
          throw new Error('Could not load older workouts. Check your connection.', {
            cause: err,
          });
        } finally {
          setLoadingMore(null);
        }
      },

      loadEarlierBodyLogs: async () => {
        if (!owner || loadingMore) return;
        const oldest = state.bodyLogs[state.bodyLogs.length - 1];
        if (!oldest) {
          setHasMoreBodyLogs(false);
          return;
        }
        setLoadingMore('body');
        try {
          const more = await loadMoreBodyLogs(owner, {
            date: oldest.date,
            createdAt: oldest.createdAt,
          });
          setSnapshot((prev) =>
            prev.owner === owner && prev.ready
              ? {
                  ...prev,
                  state: { ...prev.state, bodyLogs: mergeBodyLogsDesc(prev.state.bodyLogs, more) },
                }
              : prev,
          );
          setHasMoreBodyLogs(more.length >= PAGE_SIZE);
        } catch (err) {
          throw new Error('Could not load older measurements. Check your connection.', {
            cause: err,
          });
        } finally {
          setLoadingMore(null);
        }
      },

      collectFullState: async () => {
        if (!owner) return state;
        let sessions = state.sessions;
        let bodyLogs = state.bodyLogs;
        try {
          // Page to the very beginning so the export/backup is complete,
          // even for histories far beyond the initial bounded window.
          for (let i = 0; i < 200 && sessions.length; i++) {
            const cursor = sessions[sessions.length - 1];
            const more = await loadMoreSessions(owner, {
              date: cursor.date,
              createdAt: cursor.createdAt,
            });
            if (!more.length) break;
            const merged = mergeSessionsDesc(sessions, more);
            const grew = merged.length > sessions.length;
            sessions = merged;
            if (!grew || more.length < PAGE_SIZE) break;
          }
          for (let i = 0; i < 200 && bodyLogs.length; i++) {
            const cursor = bodyLogs[bodyLogs.length - 1];
            const more = await loadMoreBodyLogs(owner, {
              date: cursor.date,
              createdAt: cursor.createdAt,
            });
            if (!more.length) break;
            const merged = mergeBodyLogsDesc(bodyLogs, more);
            const grew = merged.length > bodyLogs.length;
            bodyLogs = merged;
            if (!grew || more.length < PAGE_SIZE) break;
          }
        } catch (err) {
          // Never label a truncated cloud view as a complete backup. The
          // caller shows a retryable error while the paging flags remain
          // untouched for another attempt.
          throw new Error('complete-backup-unavailable', { cause: err });
        }
        if (sessions !== state.sessions || bodyLogs !== state.bodyLogs) {
          setHasMoreSessions(false);
          setHasMoreBodyLogs(false);
          setSnapshot((prev) =>
            prev.owner === owner && prev.ready
              ? { ...prev, state: { ...prev.state, sessions, bodyLogs } }
              : prev,
          );
        }
        return { ...state, sessions, bodyLogs };
      },

      pendingMigration,
      importLocalData: async () => {
        if (!pendingMigration || !owner) return;
        const incoming = pendingMigration.state;
        const merged = stripLocalProPreview(
          parseState({
            ...incoming,
            profile: {
              ...incoming.profile,
              // Only skip onboarding if the on-device profile was actually set
              // up. Importing a half-configured profile must not strand the user
              // in a dashboard with no name, units or plan.
              onboardingDone: incoming.profile.onboardingDone && !!incoming.profile.name.trim(),
            },
          }),
        );
        await importState(owner, merged);
        clearLocal(null); // it now lives in the cloud account
        setPendingMigration(null);
        // The imported history is fully in memory now — nothing left to page.
        setHasMoreSessions(false);
        setHasMoreBodyLogs(false);
        setSnapshot((prev) => (prev.owner === owner ? { ...prev, state: merged } : prev));
      },
      /**
       * "Start fresh" has to actually erase the on-device copy. Otherwise the
       * same leftovers are offered again at the next sign-in — and to every
       * other account that signs in on this device.
       */
      discardLocalData: () => {
        clearLocal(null);
        setPendingMigration(null);
      },

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
      replaceSchedule: (items) => {
        const now = Date.now();
        const next: ScheduledWorkout[] = items.map((s, i) => ({
          ...s,
          id: uid('sch'),
          createdAt: now + i,
        }));
        mutate(
          (prev) => ({ ...prev, schedule: next }),
          (fresh, owner) => ({
            key: 'schedule:replace',
            run: () => replaceCollection(owner, 'schedule', fresh.schedule),
          }),
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

      addMeal: (m) => {
        const item: MealLog = { ...m, id: uid('meal'), createdAt: Date.now() };
        mutate(
          (prev) => ({
            ...prev,
            meals: [...prev.meals, item].sort((a, b) => (a.date < b.date ? 1 : -1)),
          }),
          upsert('meals', item),
        );
      },
      updateMeal: (id, patch) => {
        const next = patched(state.meals, id, patch);
        mutate(
          (prev) => ({
            ...prev,
            meals: prev.meals
              .map((m) => (m.id === id ? { ...m, ...patch } : m))
              .sort((a, b) => (a.date < b.date ? 1 : -1)),
          }),
          next ? upsert('meals', next) : undefined,
        );
      },
      deleteMeal: (id) => {
        mutate(
          (prev) => ({ ...prev, meals: prev.meals.filter((m) => m.id !== id) }),
          remove('meals', id),
        );
      },

      addCheckIn: (c) => {
        // A re-answer for the same week edits the existing record in place
        // (same id, so the sync queue coalesces it) instead of appending.
        const existing = state.checkIns?.find((x) => x.weekOf === c.weekOf);
        if (existing) {
          const replacement: WeeklyCheckIn = { ...existing, ...c };
          mutate(
            (prev) => ({
              ...prev,
              checkIns: (prev.checkIns ?? []).map((x) => (x.id === existing.id ? replacement : x)),
            }),
            upsert('checkIns', replacement),
          );
          return replacement;
        }
        const item: WeeklyCheckIn = { ...c, id: uid('checkin'), createdAt: Date.now() };
        mutate(
          (prev) => ({
            ...prev,
            checkIns: [...(prev.checkIns ?? []), item].sort((a, b) =>
              a.weekOf < b.weekOf ? -1 : 1,
            ),
          }),
          upsert('checkIns', item),
        );
        return item;
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
      updateState: (patch) => {
        mutate((prev) => ({ ...prev, ...patch }));
      },
      completeOnboarding: (patch, firstGoal, starterSchedule = []) => {
        const now = Date.now();
        const starterItems: ScheduledWorkout[] = starterSchedule.map((item, index) => ({
          ...item,
          id: uid('sch'),
          createdAt: now + index,
        }));
        mutate(
          (prev) => ({
            ...prev,
            profile: { ...prev.profile, ...patch, onboardingDone: true },
            ...(firstGoal && !prev.goals.some((goal) => goal.id === firstGoal.id)
              ? { goals: [...prev.goals, firstGoal] }
              : {}),
            ...(starterItems.length > 0 && prev.schedule.length === 0
              ? { schedule: starterItems }
              : {}),
          }),
          (next, o) => ({
            key: 'onboarding',
            run: () =>
              saveOnboarding(
                o,
                next.profile,
                firstGoal,
                next.schedule.length > 0 && state.schedule.length === 0 ? starterItems : [],
              ),
          }),
        );
      },
      flushWrites: async () => {
        // `mutate` schedules its remote operation after React commits the
        // snapshot. Yield one macrotask so an onboarding click cannot observe
        // an empty queue just before that commit enqueues the batch.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        await queue.flushStrict();
      },

      clearData: async () => {
        // Let an in-flight mutation finish before the destructive wipe. Merely
        // clearing the array cannot cancel Firestore: an old write could land
        // after the delete and resurrect data.
        await queue.flush();
        queue.clear();
        const blank = freshState();
        if (owner) {
          await wipeUserData(owner);
          await ensureUserProfile(owner, blank.profile, DEFAULT_CATEGORIES);
          clearLocal(owner);
        } else {
          clearLocal(null);
        }
        lastSerialized.current = null;
        setHasMoreSessions(false);
        setHasMoreBodyLogs(false);
        setSnapshot({ owner, ready: true, state: blank });
      },

      signOutAndForget: async () => {
        // Do not sign out while a cloud mutation is still in flight. Firebase
        // may complete it after the auth transition and write the previous
        // account's data at an unpredictable point in the next session.
        await queue.flush();
        queue.clear();
        if (owner) {
          clearLocal(owner);
          clearRunDraft(owner);
        }
        clearLocal(null);
        clearAllRunDrafts();
        setSnapshot(BLANK);
        await signOut();
      },

      replaceState: async (next) => {
        const parsed = parseState(next);
        const clean = owner ? stripCloudTrial(parsed) : parsed;
        // A replace must not race a queued write, or the old mutation can
        // recreate a document immediately after the wipe.
        await queue.flush();
        queue.clear();
        if (owner) {
          // Upsert the validated backup and remove stale rows collection by
          // collection. Unlike the old wipe-then-upload order, a failed
          // network call cannot turn a healthy account into an empty one.
          await replaceUserState(owner, clean);
          clearLocal(owner);
        }
        lastSerialized.current = null;
        setHasMoreSessions(false);
        setHasMoreBodyLogs(false);
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
    hasMoreSessions,
    hasMoreBodyLogs,
    loadingMore,
    storageFull,
    pendingMigration,
    mutate,
    upsert,
    remove,
    queue,
    signOut,
    estimateSessionCalories,
  ]);

  return (
    <StoreContext.Provider value={value}>
      {loadError && uidValue && !ready ? (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-xl font-semibold">Your account couldn&apos;t be loaded</h1>
          <p role="alert" className="text-muted-foreground">
            {loadError}
          </p>
          <Button
            onClick={() => {
              setLoadError(null);
              setLoadAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              void signOut().catch(() => setLoadError('Could not sign out. Please try again.'));
            }}
          >
            Back to sign in
          </Button>
        </div>
      ) : (
        children
      )}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>');
  return ctx;
}
