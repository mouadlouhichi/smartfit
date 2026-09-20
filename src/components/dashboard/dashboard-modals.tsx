'use client';

import { WorkoutModal } from './modals/WorkoutModal';
import { ScheduleModal } from './modals/ScheduleModal';
import { GoalModal } from './modals/GoalModal';
import { BodyModal } from './modals/BodyModal';
import { MealModal } from './modals/MealModal';
import { CategoryModal } from './modals/CategoryModal';
import { SessionDetailModal } from './modals/SessionDetailModal';
import { ProModal } from './modals/pro-modal';
import { SessionRunnerModal } from './modals/session-runner-modal';

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
      <CategoryModal />
      <SessionDetailModal />
      <ProModal />
      <SessionRunnerModal />
    </>
  );
}
