import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildSeedState,
  emptyState,
  uid,
  type BodyLog,
  type FitnessGoal,
  type FitnessState,
  type ScheduledWorkout,
  type UserProfile,
  type WorkoutSession,
} from '@smartfit/core';
import { env } from './env';

const STORAGE_KEY = 'smartfit.state.v1';

function freshState(): FitnessState {
  if (!env.seedDemo) {
    const empty = emptyState();
    empty.profile.planId = env.defaultPlan;
    return empty;
  }
  return buildSeedState();
}

interface StoreValue {
  state: FitnessState;
  ready: boolean;
  addSession: (s: Omit<WorkoutSession, 'id' | 'createdAt'>) => void;
  deleteSession: (id: string) => void;
  addGoal: (g: Omit<FitnessGoal, 'id' | 'createdAt'>) => void;
  deleteGoal: (id: string) => void;
  updateSchedule: (id: string, patch: Partial<ScheduledWorkout>) => void;
  addBodyLog: (b: Omit<BodyLog, 'id' | 'createdAt'>) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  resetAll: () => void;
  clearData: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FitnessState>(() => emptyState());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => setState(raw ? (JSON.parse(raw) as FitnessState) : freshState()))
      .catch(() => setState(freshState()))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, ready]);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      ready,
      addSession: (s) =>
        setState((p) => ({
          ...p,
          sessions: [...p.sessions, { ...s, id: uid('ses'), createdAt: Date.now() }].sort((a, b) =>
            a.date < b.date ? 1 : -1,
          ),
        })),
      deleteSession: (id) =>
        setState((p) => ({ ...p, sessions: p.sessions.filter((s) => s.id !== id) })),
      addGoal: (g) =>
        setState((p) => ({ ...p, goals: [...p.goals, { ...g, id: uid('goal'), createdAt: Date.now() }] })),
      deleteGoal: (id) => setState((p) => ({ ...p, goals: p.goals.filter((g) => g.id !== id) })),
      updateSchedule: (id, patch) =>
        setState((p) => ({
          ...p,
          schedule: p.schedule.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        })),
      addBodyLog: (b) =>
        setState((p) => ({
          ...p,
          bodyLogs: [...p.bodyLogs, { ...b, id: uid('body'), createdAt: Date.now() }],
        })),
      updateProfile: (patch) =>
        setState((p) => ({ ...p, profile: { ...p.profile, ...patch } })),
      resetAll: () => setState(buildSeedState()),
      clearData: () => setState(emptyState()),
    }),
    [state, ready],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>');
  return ctx;
}
