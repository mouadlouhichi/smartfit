'use client';

import { WorkoutModal } from './modals/WorkoutModal';
import { ScheduleModal } from './modals/ScheduleModal';
import { GoalModal } from './modals/GoalModal';
import { BodyModal } from './modals/BodyModal';
import { CategoryModal } from './modals/CategoryModal';

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
      <CategoryModal />
    </>
  );
}
