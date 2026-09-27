import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useStore } from '@/lib/store';
import { BodyMeasurementModal } from '@/components/BodyMeasurementModal';
import { LogWorkoutModal } from '@/components/LogWorkoutModal';
import { QuickActionSheet, type QuickAction } from '@/components/QuickActionSheet';

type QuickActionsValue = {
  openQuickActions: () => void;
  openWorkout: () => void;
  openMeasurement: () => void;
};

const QuickActionsContext = createContext<QuickActionsValue | null>(null);

export function useQuickActions() {
  const value = useContext(QuickActionsContext);
  if (!value) throw new Error('useQuickActions must be used inside QuickActionsProvider');
  return value;
}

export function QuickActionsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const [measurementOpen, setMeasurementOpen] = useState(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    },
    [],
  );

  const openQuickActions = useCallback(() => {
    if (!ready) return;
    void Haptics.selectionAsync().catch(() => {});
    setMenuOpen(true);
  }, [ready]);
  const openWorkout = useCallback(() => {
    if (!ready) return;
    void Haptics.selectionAsync().catch(() => {});
    setWorkoutOpen(true);
  }, [ready]);
  const openMeasurement = useCallback(() => {
    if (!ready) return;
    void Haptics.selectionAsync().catch(() => {});
    setMeasurementOpen(true);
  }, [ready]);

  const selectAction = useCallback(
    (action: QuickAction) => {
      setMenuOpen(false);
      void Haptics.selectionAsync().catch(() => {});
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      transitionTimer.current = setTimeout(() => {
        switch (action) {
          case 'workout':
            setWorkoutOpen(true);
            break;
          case 'measurement':
            setMeasurementOpen(true);
            break;
          case 'goals':
            router.push('/goals');
            break;
          case 'plan':
            router.push('/plan');
            break;
          case 'progress':
            router.push('/progress');
            break;
          case 'coach':
            router.push('/coach');
            break;
        }
        transitionTimer.current = null;
      }, 280);
    },
    [router],
  );

  const contextValue = useMemo(
    () => ({ openQuickActions, openWorkout, openMeasurement }),
    [openQuickActions, openWorkout, openMeasurement],
  );

  return (
    <QuickActionsContext.Provider value={contextValue}>
      {children}
      <QuickActionSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSelect={selectAction}
      />
      <LogWorkoutModal open={workoutOpen} onClose={() => setWorkoutOpen(false)} />
      <BodyMeasurementModal open={measurementOpen} onClose={() => setMeasurementOpen(false)} />
    </QuickActionsContext.Provider>
  );
}
