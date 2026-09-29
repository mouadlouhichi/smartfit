'use client';

import { WorkoutModal } from './modals/WorkoutModal';
import { ScheduleModal } from './modals/ScheduleModal';
import { GoalModal } from './modals/GoalModal';
import { BodyModal } from './modals/BodyModal';
import { MealModal } from './modals/MealModal';
import { SleepModal } from './modals/SleepModal';
import { VitalsModal } from './modals/VitalsModal';
import { CategoryModal } from './modals/CategoryModal';
import { SessionDetailModal } from './modals/SessionDetailModal';
import { ProModal } from './modals/pro-modal';
import { SessionRunnerModal } from './modals/session-runner-modal';
import { QuickActionsModal } from './modals/quick-actions-modal';

/**
 * Renders every global modal. Must sit inside <ModalProvider> — the shell wraps
 * its whole tree so the header, FAB and quick-actions can all call useModals().
 */
export function DashboardModals() {
  return (
    <>
      <WorkoutModal />
      <ScheduleModal />
      <GoalModal />
      <BodyModal />
      <MealModal />
      <SleepModal />
      <VitalsModal />
      <CategoryModal />
      <SessionDetailModal />
      <ProModal />
      <SessionRunnerModal />
      <QuickActionsModal />
    </>
  );
}
