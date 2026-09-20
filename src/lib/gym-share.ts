/**
 * The aggregates a member can choose to share with a gym.
 *
 * This is the privacy boundary of the whole B2B pivot in one function: the
 * gym's roster is built from gym-owned documents, and the *only* training data
 * that ever flows upward is what this function returns — three numbers. No
 * exercises, no body logs, no meals, no notes. The member publishes them
 * themselves into `users/{uid}/gymShares/{gymId}` and can delete the document
 * at any time, which is the entire revocation mechanism.
 */
import { currentStreak, type FitnessState } from '@smartfit/core';
import type { BookingStatus } from '@smartfit/core';

export interface GymShareAggregates {
  sessionsThisMonth: number;
  streakDays: number;
  attendancePct: number;
}

/** ISO `YYYY-MM` of a timestamp, local time — the month the member sees. */
function monthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function computeGymShareAggregates(
  state: Pick<FitnessState, 'sessions' | 'profile'>,
  bookingStatuses: readonly BookingStatus[],
  now = Date.now(),
): GymShareAggregates {
  const month = monthKey(now);
  const sessionsThisMonth = state.sessions.filter((s) => s.date?.slice(0, 7) === month).length;

  // The streak is the same rest-day-aware number the member sees on their own
  // dashboard — sharing a different definition would be a quiet lie.
  const streakDays = currentStreak(state as FitnessState, new Date(now));

  // Attendance is classes, not days: of the bookings the gym actually marked,
  // how many showed up. Unmarked (upcoming) bookings do not count against you.
  const marked = bookingStatuses.filter((s) => s === 'attended' || s === 'no_show');
  const attended = marked.filter((s) => s === 'attended').length;
  const attendancePct = marked.length === 0 ? 0 : Math.round((attended / marked.length) * 100);

  return { sessionsThisMonth, streakDays, attendancePct };
}
