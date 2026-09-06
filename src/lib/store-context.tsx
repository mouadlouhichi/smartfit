'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { STORAGE_KEY } from './constants';
import { buildSeedState, emptyState } from './seed';
import type {
  BodyLog,
  Category,
  FitnessGoal,
  FitnessState,
  ScheduledWorkout,
  UserProfile,
  WorkoutSession,
} from './types';
import { uid } from './utils';

interface StoreContextValue {
  state: FitnessState;
  ready: boolean;
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
  resetAll: () => void;
  loadDemo: () => void;
  clearData: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function persist(state: FitnessState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full / unavailable — app keeps working in-memory */
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Deterministic empty state for SSR + first client render (avoids hydration
  // mismatch). The effect below hydrates from localStorage or the demo seed.
  const [state, setState] = useState<FitnessState>(() => emptyState());
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    let initial: FitnessState;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      initial = raw ? (JSON.parse(raw) as FitnessState) : buildSeedState();
    } catch {
      initial = buildSeedState();
    }
    setState(initial);
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) persist(state);
  }, [state, ready]);

  const mutate = useCallback((fn: (s: FitnessState) => FitnessState) => {
    setState((prev) => fn(prev ?? emptyState()));
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      ready,
      addSession: (s) =>
        mutate((prev) => ({
          ...prev,
          sessions: [...prev.sessions, { ...s, id: uid('ses'), createdAt: Date.now() }].sort((a, b) =>
            a.date < b.date ? 1 : -1,
          ),
        })),
      updateSession: (id, patch) =>
        mutate((prev) => ({
          ...prev,
          sessions: prev.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        })),
      deleteSession: (id) =>
        mutate((prev) => ({ ...prev, sessions: prev.sessions.filter((s) => s.id !== id) })),

      addSchedule: (s) =>
        mutate((prev) => ({
          ...prev,
          schedule: [...prev.schedule, { ...s, id: uid('sch'), createdAt: Date.now() }],
        })),
      updateSchedule: (id, patch) =>
        mutate((prev) => ({
          ...prev,
          schedule: prev.schedule.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        })),
      deleteSchedule: (id) =>
        mutate((prev) => ({ ...prev, schedule: prev.schedule.filter((s) => s.id !== id) })),

      addGoal: (g) =>
        mutate((prev) => ({
          ...prev,
          goals: [...prev.goals, { ...g, id: uid('goal'), createdAt: Date.now() }],
        })),
      updateGoal: (id, patch) =>
        mutate((prev) => ({
          ...prev,
          goals: prev.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        })),
      deleteGoal: (id) => mutate((prev) => ({ ...prev, goals: prev.goals.filter((g) => g.id !== id) })),

      addBodyLog: (b) =>
        mutate((prev) => ({ ...prev, bodyLogs: [...prev.bodyLogs, { ...b, id: uid('body'), createdAt: Date.now() }] })),
      deleteBodyLog: (id) =>
        mutate((prev) => ({ ...prev, bodyLogs: prev.bodyLogs.filter((b) => b.id !== id) })),

      addCategory: (c) =>
        mutate((prev) => ({ ...prev, categories: [...prev.categories, { ...c, id: uid('cat') }] })),
      deleteCategory: (id) =>
        mutate((prev) => ({
          ...prev,
          categories: prev.categories.filter((c) => !(c.id === id && !c.builtin)),
        })),

      updateProfile: (patch) => mutate((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } })),
      completeOnboarding: (patch) =>
        mutate((prev) => ({ ...prev, profile: { ...prev.profile, ...patch, onboardingDone: true } })),

      resetAll: () => setState(buildSeedState()),
      loadDemo: () => setState(buildSeedState()),
      clearData: () => setState(emptyState()),
    }),
    [state, ready, mutate],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>');
  return ctx;
}
