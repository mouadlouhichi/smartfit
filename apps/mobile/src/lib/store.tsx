import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  emptyState,
  parseStateJSON,
  uid,
  type BodyLog,
  type FitnessGoal,
  type FitnessState,
  type MealLog,
  type ScheduledWorkout,
  type UserProfile,
  type WeeklyCheckIn,
  type WorkoutSession,
} from '@smartfit/core';
import { env } from './env';

const STORAGE_KEY = 'smartfit.state.v1';

function freshState(): FitnessState {
  const empty = emptyState();
  empty.profile.planId = env.defaultPlan;
  return empty;
}

interface StoreValue {
  state: FitnessState;
  ready: boolean;
  loadError: boolean;
  retryLoad: () => void;
  addSession: (s: Omit<WorkoutSession, 'id' | 'createdAt'>) => void;
  deleteSession: (id: string) => void;
  addGoal: (g: Omit<FitnessGoal, 'id' | 'createdAt'>) => void;
  deleteGoal: (id: string) => void;
  updateSchedule: (id: string, patch: Partial<ScheduledWorkout>) => void;
  addBodyLog: (b: Omit<BodyLog, 'id' | 'createdAt'>) => void;
  addMeal: (m: Omit<MealLog, 'id' | 'createdAt'>) => void;
  addCheckIn: (checkIn: Omit<WeeklyCheckIn, 'id' | 'createdAt'>) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  clearData: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FitnessState>(() => emptyState());
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setReady(false);
    // Never cast or silently replace data that could not be read. The app
    // remains behind a retry screen until the existing local state is valid.
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active) return;
        const restored = parseStateJSON(raw);
        if (raw !== null && restored === null) throw new Error('Invalid local state');
        setState(restored ?? freshState());
        setLoadError(false);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  useEffect(() => {
    if (ready && !loadError)
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, ready, loadError]);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      ready,
      loadError,
      retryLoad: () => {
        setReady(false);
        setLoadAttempt((attempt) => attempt + 1);
      },
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
        setState((p) => ({
          ...p,
          goals: [...p.goals, { ...g, id: uid('goal'), createdAt: Date.now() }],
        })),
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
      addMeal: (m) =>
        setState((p) => ({
          ...p,
          meals: [...p.meals, { ...m, id: uid('meal'), createdAt: Date.now() }].sort((a, b) =>
            a.date < b.date ? 1 : -1,
          ),
        })),
      addCheckIn: (checkIn) =>
        setState((p) => {
          const history = p.checkIns ?? [];
          const existing = history.find((item) => item.weekOf === checkIn.weekOf);
          const saved: WeeklyCheckIn = {
            ...checkIn,
            id: existing?.id ?? uid('checkin'),
            createdAt: existing?.createdAt ?? Date.now(),
          };
          const checkIns = existing
            ? history.map((item) => (item.id === existing.id ? saved : item))
            : [...history, saved].sort((a, b) => (a.weekOf < b.weekOf ? -1 : 1));
          return { ...p, checkIns };
        }),
      updateProfile: (patch) => setState((p) => ({ ...p, profile: { ...p.profile, ...patch } })),
      clearData: () => {
        setState(freshState());
        setLoadError(false);
      },
    }),
    [state, ready, loadError],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>');
  return ctx;
}
