'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type {
  BodyLog,
  FitnessGoal,
  MealLog,
  MealSlot,
  ScheduledWorkout,
  WorkoutExercise,
  WorkoutSession,
} from '@smartfit/core';

/**
 * Global modal coordinator.
 *
 * Modals carry an optional payload so the same dialog handles both "create"
 * and "edit" — previously every modal was create-only, which is why logged
 * sessions, goals and scheduled slots could never be corrected.
 */
export type ModalKind =
  | 'workout'
  | 'schedule'
  | 'goal'
  | 'body'
  | 'meal'
  | 'category'
  | 'session-detail'
  | 'pro'
  | 'runner';

export type ModalPayload =
  | { kind: 'workout'; session?: WorkoutSession; prefill?: Partial<WorkoutSession> }
  | { kind: 'schedule'; schedule?: ScheduledWorkout }
  | { kind: 'goal'; goal?: FitnessGoal }
  | { kind: 'body'; log?: BodyLog }
  | { kind: 'meal'; meal?: MealLog; date?: string; slot?: MealSlot }
  | { kind: 'category' }
  | { kind: 'session-detail'; session: WorkoutSession }
  | { kind: 'pro' }
  | {
      kind: 'runner';
      title: string;
      categoryId: string;
      intensity: WorkoutSession['intensity'];
      scheduleId?: string;
      /** The routine's exercise list, pre-loaded into the guided runner. */
      exercises?: WorkoutExercise[];
    };

interface ModalContextValue {
  open: ModalKind | null;
  payload: ModalPayload | null;
  openModal: (kind: ModalKind) => void;
  openWith: (payload: ModalPayload) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<ModalPayload | null>(null);

  const openWith = useCallback((next: ModalPayload) => setPayload(next), []);
  const openModal = useCallback((kind: ModalKind) => setPayload({ kind } as ModalPayload), []);
  const closeModal = useCallback(() => setPayload(null), []);

  const value = useMemo(
    () => ({ open: payload?.kind ?? null, payload, openModal, openWith, closeModal }),
    [payload, openModal, openWith, closeModal],
  );

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

export function useModals(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModals must be used within <ModalProvider>');
  return ctx;
}

/** Narrow the payload for a specific modal. */
export function usePayload<K extends ModalKind>(kind: K) {
  const { payload } = useModals();
  return payload?.kind === kind ? (payload as Extract<ModalPayload, { kind: K }>) : null;
}
