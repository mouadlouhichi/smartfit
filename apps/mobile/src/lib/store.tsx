import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  emptyState,
  parseStateJSON,
  uid,
  type BodyLog,
  type ContextMemory,
  type FitnessGoal,
  type FitnessState,
  type MealLog,
  type ScheduledWorkout,
  type SleepLog,
  type UserProfile,
  type VitalsLog,
  type WeeklyCheckIn,
  type WorkoutSession,
} from '@smartfit/core';
import { env } from './env';
import {
  isHealthConnectAvailable,
  requestHealthPermissions,
  syncHealthData,
  openHealthConnectPlayStore,
  type SyncResult,
  type SyncStatus,
} from './health-connect';

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
  addSleepLog: (s: Omit<SleepLog, 'id' | 'createdAt'>) => void;
  addVitalsLog: (v: Omit<VitalsLog, 'id' | 'createdAt'>) => void;
  addContextMemory: (m: Omit<ContextMemory, 'id' | 'createdAt'>) => void;
  upsertSyncedHealth: (result: SyncResult) => { sleeps: number; vitals: number };
  updateProfile: (patch: Partial<UserProfile>) => void;
  /**
   * Commits the onboarding wizard in one shot: profile patch, the optional
   * first goal, and the optional starter week derived from a chosen gym.
   * Sets `profile.onboardingDone`, which is what releases the OnboardingGate.
   */
  completeOnboarding: (
    patch: Partial<UserProfile>,
    firstGoal?: FitnessGoal,
    starterSchedule?: Omit<ScheduledWorkout, 'id' | 'createdAt'>[],
  ) => void;
  clearData: () => void;
  // Health Connect
  hcAvailable: boolean;
  hcStatus: SyncStatus;
  hcMessage?: string;
  hcLastSync?: number;
  syncHealthConnect: () => Promise<SyncResult>;
  requestHealthAccess: () => Promise<boolean>;
  installHealthConnect: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

function makeLogKey(log: { source?: string; externalId?: string }) {
  return log.source && log.externalId ? `${log.source}:${log.externalId}` : null;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FitnessState>(() => emptyState());
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [hcAvailable, setHcAvailable] = useState(false);
  const [hcStatus, setHcStatus] = useState<SyncStatus>('idle');
  const [hcMessage, setHcMessage] = useState<string | undefined>();
  const [hcLastSync, setHcLastSync] = useState<number | undefined>();
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let active = true;
    setReady(false);
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

  useEffect(() => {
    let alive = true;
    isHealthConnectAvailable().then((yes) => {
      if (alive) setHcAvailable(yes);
    });
    return () => {
      alive = false;
    };
  }, []);

  const upsertSyncedHealth = useCallback((result: SyncResult) => {
    let sleeps = 0;
    let vitals = 0;
    setState((p) => {
      const prevSleep = p.sleepLogs ?? [];
      const prevVitals = p.vitalsLogs ?? [];
      const sleepByKey = new Map<string, SleepLog>();
      const sleepByDate = new Map<string, SleepLog>();
      for (const s of prevSleep) {
        const k = makeLogKey(s);
        if (k) sleepByKey.set(k, s);
        else if (!sleepByDate.has(s.date)) sleepByDate.set(s.date, s);
      }
      for (const s of result.sleepLogs) {
        const k = makeLogKey(s);
        if (k && sleepByKey.has(k)) continue;
        if (!k && sleepByDate.has(s.date)) continue;
        sleepByKey.set(k ?? `${s.date}:import`, {
          ...s,
          id: s.id || uid('slp'),
        });
        sleeps++;
      }
      const vitalsByKey = new Map<string, VitalsLog>();
      const vitalsByDate = new Map<string, VitalsLog>();
      for (const v of prevVitals) {
        const k = makeLogKey(v);
        if (k) vitalsByKey.set(k, v);
        else if (!vitalsByDate.has(v.date)) vitalsByDate.set(v.date, v);
      }
      for (const v of result.vitalsLogs) {
        const k = makeLogKey(v);
        if (k && vitalsByKey.has(k)) continue;
        const existing = !k ? vitalsByDate.get(v.date) : undefined;
        if (existing) {
          vitalsByKey.set(k ?? `${v.date}:merged`, {
            ...existing,
            id: existing.id,
            restingHR: existing.restingHR ?? v.restingHR,
            hrvRmssd: existing.hrvRmssd ?? v.hrvRmssd,
            respiratoryRate: existing.respiratoryRate ?? v.respiratoryRate,
            spo2: existing.spo2 ?? v.spo2,
            steps: existing.steps ?? v.steps,
            activeCalories: existing.activeCalories ?? v.activeCalories,
          });
          continue;
        }
        vitalsByKey.set(k ?? `${v.date}:import`, { ...v, id: v.id || uid('vit') });
        vitals++;
      }
      return {
        ...p,
        sleepLogs: [...sleepByKey.values()].sort((a, b) => (a.date < b.date ? 1 : -1)),
        vitalsLogs: [...vitalsByKey.values()].sort((a, b) => (a.date < b.date ? 1 : -1)),
      };
    });
    return { sleeps, vitals };
  }, []);

  const requestHealthAccess = useCallback(async () => {
    setHcStatus('requesting-permissions');
    const ok = await requestHealthPermissions();
    if (ok) setHcStatus('idle');
    else {
      setHcStatus('permission-denied');
      setHcMessage('Health Connect permission was denied');
    }
    setHcAvailable(await isHealthConnectAvailable());
    return ok;
  }, []);

  const installHealthConnect = useCallback(async () => {
    await openHealthConnectPlayStore();
  }, []);

  const syncHealthConnect = useCallback(async (): Promise<SyncResult> => {
    setHcStatus('syncing');
    const res = await syncHealthData(14);
    if (res.status === 'ok') {
      const { sleeps, vitals } = upsertSyncedHealth(res);
      setHcStatus('ok');
      setHcMessage(
        `Synced ${res.daysSynced} day${res.daysSynced === 1 ? '' : 's'} · ${sleeps} sleep, ${vitals} vitals`,
      );
      setHcLastSync(Date.now());
    } else {
      setHcStatus(res.status);
      setHcMessage(res.message);
    }
    return res;
  }, [upsertSyncedHealth]);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      ready,
      loadError,
      retryLoad: () => {
        setReady(false);
        setLoadAttempt((a) => a + 1);
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
      addSleepLog: (s) =>
        setState((p) => ({
          ...p,
          sleepLogs: [...(p.sleepLogs ?? []), { ...s, id: uid('slp'), createdAt: Date.now() }].sort(
            (a, b) => (a.date < b.date ? 1 : -1),
          ),
        })),
      addVitalsLog: (v) =>
        setState((p) => ({
          ...p,
          vitalsLogs: [
            ...(p.vitalsLogs ?? []),
            { ...v, id: uid('vit'), createdAt: Date.now() },
          ].sort((a, b) => (a.date < b.date ? 1 : -1)),
        })),
      addContextMemory: (m) =>
        setState((p) => ({
          ...p,
          contextMemory: [
            ...(p.contextMemory ?? []),
            { ...m, id: uid('mem'), createdAt: Date.now() },
          ].sort((a, b) => b.createdAt - a.createdAt),
        })),
      upsertSyncedHealth,
      updateProfile: (patch) => setState((p) => ({ ...p, profile: { ...p.profile, ...patch } })),
      completeOnboarding: (patch, firstGoal, starterSchedule = []) =>
        setState((p) => {
          const now = Date.now();
          const starterItems: ScheduledWorkout[] = starterSchedule.map((item, index) => ({
            ...item,
            id: uid('sch'),
            createdAt: now + index,
          }));
          return {
            ...p,
            profile: { ...p.profile, ...patch, onboardingDone: true },
            // Guard against a duplicate when the wizard is finished twice (a
            // double-tap on "Enter SmartFit", or a reload racing the write).
            ...(firstGoal && !p.goals.some((goal) => goal.id === firstGoal.id)
              ? { goals: [...p.goals, firstGoal] }
              : {}),
            // A starter week is only seeded into an empty schedule — never on
            // top of a plan the user already has.
            ...(starterItems.length > 0 && p.schedule.length === 0
              ? { schedule: starterItems }
              : {}),
          };
        }),
      clearData: () => {
        setState(freshState());
        setLoadError(false);
      },
      hcAvailable,
      hcStatus,
      hcMessage,
      hcLastSync,
      syncHealthConnect,
      requestHealthAccess,
      installHealthConnect,
    }),
    [
      state,
      ready,
      loadError,
      upsertSyncedHealth,
      syncHealthConnect,
      requestHealthAccess,
      installHealthConnect,
      hcAvailable,
      hcStatus,
      hcMessage,
      hcLastSync,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>');
  return ctx;
}
