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
  uid,
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
  loadUserState,
  saveProfile,
  upsertItem,
  deleteItem,
  wipeUserData,
} from './firebase/repo';

/**
 * First-run state for a brand-new user: a clean account that lands on
 * guided onboarding. No demo data is seeded in production.
 */
function freshState(): FitnessState {
  const empty = emptyState();
  empty.profile.planId = env.defaultPlan;
  return empty;
}

interface StoreContextValue {
  state: FitnessState;
  ready: boolean;
  cloud: boolean;
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
  clearData: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function persistLocal(state: FitnessState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full / unavailable — app keeps working in-memory */
  }
}

type ColName = 'sessions' | 'schedule' | 'goals' | 'bodyLogs' | 'categories';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user, mode } = useAuth();
  const cloud = mode === 'cloud' && !!user;
  const uidRef = useRef<string | null>(user?.uid ?? null);
  uidRef.current = user?.uid ?? null;

  // Deterministic empty state for SSR + first render (avoids hydration
  // mismatch). The effect below hydrates from cloud/local.
  const [state, setState] = useState<FitnessState>(() => emptyState());
  const [ready, setReady] = useState(false);
  const hydratedRef = useRef(false);

  // ── Hydrate on auth/session changes ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      // Local mode (no Firebase or signed out) → read localStorage.
      if (!user) {
        let initial: FitnessState;
        try {
          const raw =
            typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
          initial = raw ? (JSON.parse(raw) as FitnessState) : freshState();
        } catch {
          initial = freshState();
        }
        if (!cancelled) {
          setState(initial);
          hydratedRef.current = true;
          setReady(true);
        }
        return;
      }

      // Cloud mode → read Firestore, creating a profile doc on first sign-in.
      setReady(false);
      try {
        let remote = await loadUserState(user.uid);
        if (!remote) {
          const starter = freshState();
          // Pre-fill the display name from the provider if available.
          if (user.displayName) starter.profile.name = user.displayName;
          await ensureUserProfile(user.uid, starter.profile, DEFAULT_CATEGORIES);
          remote = starter;
        }
        if (!cancelled) {
          setState(remote);
          hydratedRef.current = true;
          setReady(true);
        }
      } catch {
        // On a Firestore error, fall back to a fresh local state so the UI
        // never gets stuck on the loading screen.
        if (!cancelled) {
          setState(freshState());
          hydratedRef.current = true;
          setReady(true);
        }
      }
    }

    hydratedRef.current = false;
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // ── Persistence ──────────────────────────────────────────────────────
  const persistProfile = useCallback((profile: UserProfile) => {
    const id = uidRef.current;
    if (cloud && id) void saveProfile(id, profile);
    else persistLocal(state);
  }, [cloud, state]);

  const upsert = useCallback(
    <T extends { id: string }>(name: ColName, item: T) => {
      const id = uidRef.current;
      if (cloud && id) void upsertItem(id, name, item);
    },
    [cloud],
  );

  const remove = useCallback(
    (name: ColName, id: string) => {
      const owner = uidRef.current;
      if (cloud && owner) void deleteItem(owner, name, id);
    },
    [cloud],
  );

  // Local persistence (only meaningful in local mode).
  useEffect(() => {
    if (!ready || cloud) return;
    persistLocal(state);
  }, [state, ready, cloud]);

  const mutate = useCallback((fn: (s: FitnessState) => FitnessState) => {
    setState((prev) => fn(prev ?? emptyState()));
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      ready,
      cloud,
      addSession: (s) => {
        const item: WorkoutSession = {
          ...s,
          id: uid('ses'),
          createdAt: Date.now(),
        };
        mutate((prev) => ({
          ...prev,
          sessions: [...prev.sessions, item].sort((a, b) => (a.date < b.date ? 1 : -1)),
        }));
        upsert('sessions', item);
      },
      updateSession: (id, patch) => {
        mutate((prev) => ({
          ...prev,
          sessions: prev.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        }));
        const target = state.sessions.find((s) => s.id === id);
        if (target) upsert('sessions', { ...target, ...patch });
      },
      deleteSession: (id) => {
        mutate((prev) => ({ ...prev, sessions: prev.sessions.filter((s) => s.id !== id) }));
        remove('sessions', id);
      },

      addSchedule: (s) => {
        const item: ScheduledWorkout = { ...s, id: uid('sch'), createdAt: Date.now() };
        mutate((prev) => ({ ...prev, schedule: [...prev.schedule, item] }));
        upsert('schedule', item);
      },
      updateSchedule: (id, patch) => {
        mutate((prev) => ({
          ...prev,
          schedule: prev.schedule.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        }));
        const target = state.schedule.find((s) => s.id === id);
        if (target) upsert('schedule', { ...target, ...patch });
      },
      deleteSchedule: (id) => {
        mutate((prev) => ({ ...prev, schedule: prev.schedule.filter((s) => s.id !== id) }));
        remove('schedule', id);
      },

      addGoal: (g) => {
        const item: FitnessGoal = { ...g, id: uid('goal'), createdAt: Date.now() };
        mutate((prev) => ({ ...prev, goals: [...prev.goals, item] }));
        upsert('goals', item);
      },
      updateGoal: (id, patch) => {
        mutate((prev) => ({
          ...prev,
          goals: prev.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        }));
        const target = state.goals.find((g) => g.id === id);
        if (target) upsert('goals', { ...target, ...patch });
      },
      deleteGoal: (id) => {
        mutate((prev) => ({ ...prev, goals: prev.goals.filter((g) => g.id !== id) }));
        remove('goals', id);
      },

      addBodyLog: (b) => {
        const item: BodyLog = { ...b, id: uid('body'), createdAt: Date.now() };
        mutate((prev) => ({ ...prev, bodyLogs: [...prev.bodyLogs, item] }));
        upsert('bodyLogs', item);
      },
      deleteBodyLog: (id) => {
        mutate((prev) => ({ ...prev, bodyLogs: prev.bodyLogs.filter((b) => b.id !== id) }));
        remove('bodyLogs', id);
      },

      addCategory: (c) => {
        const item: Category = { ...c, id: uid('cat') };
        mutate((prev) => ({ ...prev, categories: [...prev.categories, item] }));
        upsert('categories', item);
      },
      deleteCategory: (id) => {
        mutate((prev) => ({
          ...prev,
          categories: prev.categories.filter((c) => !(c.id === id && !c.builtin)),
        }));
        remove('categories', id);
      },

      updateProfile: (patch) => {
        mutate((prev) => {
          const profile = { ...prev.profile, ...patch };
          persistProfile(profile);
          return { ...prev, profile };
        });
      },
      completeOnboarding: (patch) => {
        mutate((prev) => {
          const profile = { ...prev.profile, ...patch, onboardingDone: true };
          persistProfile(profile);
          return { ...prev, profile };
        });
      },

      clearData: () => {
        const id = uidRef.current;
        if (cloud && id) void wipeUserData(id).then(() => setState(freshState()));
        else {
          setState(freshState());
          persistLocal(freshState());
        }
      },
    }),
    [state, ready, cloud, mutate, upsert, remove, persistProfile],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>');
  return ctx;
}
