import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkInActions,
  checkInHistory,
  checkInStreak,
  deadlineLabel,
  emptyState,
  feelingLabel,
  goalDeadline,
  pendingCheckIn,
  recordCheckIn,
  suggestDeadline,
  weeklyReview,
  type FitnessState,
  type FitnessGoal,
  type WorkoutSession,
} from '../src/index';

function session(date: string, durationMin = 45): WorkoutSession {
  return {
    id: `s-${date}-${durationMin}`,
    date,
    categoryId: 'strength',
    title: 'Session',
    durationMin,
    intensity: 'moderate',
    calories: 300,
    exercises: [],
    createdAt: Date.now(),
  };
}

function goal(over: Partial<FitnessGoal> = {}): FitnessGoal {
  return {
    id: 'g1',
    name: 'Train 5 days',
    metric: 'workouts',
    cadence: 'weekly',
    target: 5,
    startDate: '2026-08-01',
    createdAt: Date.now(),
    ...over,
  };
}

// 2026-09-20 is a Sunday; with a Monday week start the week runs 14–20 Sep.
const SUNDAY = new Date('2026-09-20T18:00:00');

function stateWith(dates: string[]): FitnessState {
  const state = emptyState();
  state.sessions = dates.map((d) => session(d));
  return state;
}

test('the weekly review covers the calendar week of the given day', () => {
  const state = stateWith(['2026-09-14', '2026-09-16', '2026-09-20', '2026-09-13']);
  const review = weeklyReview(state, SUNDAY);
  assert.equal(review.from, '2026-09-14');
  assert.equal(review.to, '2026-09-20');
  assert.equal(review.workouts, 3, 'the 13th belongs to the previous week');
  assert.equal(review.minutes, 135);
  assert.ok(review.label.length > 0);
  assert.ok(review.headline.length > 0);
});

test('the review respects a Sunday week start', () => {
  const state = stateWith(['2026-09-14', '2026-09-16', '2026-09-20']);
  state.profile.weekStartsOn = 0;
  const review = weeklyReview(state, SUNDAY);
  assert.equal(review.from, '2026-09-20');
  assert.equal(review.workouts, 1);
});

test('the review reports weight movement only when it is real', () => {
  const state = stateWith(['2026-09-15']);
  state.bodyLogs = [
    { id: 'b1', date: '2026-09-14', unit: 'weight', value: 82, createdAt: 1 },
    { id: 'b2', date: '2026-09-20', unit: 'weight', value: 81.2, createdAt: 2 },
  ];
  assert.equal(weeklyReview(state, SUNDAY).weightDeltaKg, -0.8);

  // A single weigh-in gives no delta, not a fake one.
  state.bodyLogs = [{ id: 'b1', date: '2026-09-20', unit: 'weight', value: 81, createdAt: 1 }];
  assert.equal(weeklyReview(state, SUNDAY).weightDeltaKg, null);
  assert.equal(weeklyReview(state, SUNDAY).latestWeightKg, 81);
});

test('the review splits goals into hit and still-open, in words', () => {
  const state = stateWith(['2026-09-14', '2026-09-15']);
  state.goals = [
    goal({ id: 'a', name: 'Train 5 days', target: 5 }),
    goal({ id: 'b', name: 'Move 100 minutes', metric: 'minutes', target: 60 }),
  ];
  const review = weeklyReview(state, SUNDAY);
  assert.deepEqual(review.goalsHit, ['Move 100 minutes (90/60)']);
  assert.deepEqual(review.goalsMissed, ['Train 5 days (2/5)']);
});

test('a blank week says so without scolding', () => {
  const review = weeklyReview(emptyState(), SUNDAY);
  assert.equal(review.workouts, 0);
  assert.ok(review.headline.startsWith('A blank week'));
  assert.ok(review.goalsHit.length === 0);
});

test('a check-in is always about the last *complete* week', () => {
  const state = stateWith(['2026-09-08', '2026-09-10', '2026-09-16']);

  // Mid-week on the Sunday: the week of 14–20 Sep is still running, so the
  // question is about 7–13 Sep.
  const onSunday = pendingCheckIn(state, SUNDAY)!;
  assert.ok(onSunday);
  assert.equal(onSunday.weekOf, '2026-09-07');
  assert.equal(onSunday.review.workouts, 2, 'the current week is never the subject');
  assert.equal(onSunday.answered, false);

  // The day after that week ends, it becomes the subject.
  const onMonday = pendingCheckIn(state, new Date('2026-09-21T09:00:00'))!;
  assert.equal(onMonday.weekOf, '2026-09-14');
  assert.equal(onMonday.review.workouts, 1);
});

test('answering a check-in clears the nudge for exactly that week', () => {
  const state = stateWith(['2026-09-08', '2026-09-10']);
  const answer = (when: string) => {
    const record = recordCheckIn(state, { feeling: 4 }, new Date(when));
    state.checkIns = [{ id: `c-${record.weekOf}`, ...record }, ...(state.checkIns ?? [])];
  };

  assert.equal(pendingCheckIn(state, SUNDAY)!.weekOf, '2026-09-07');
  answer('2026-09-20T20:00:00');
  assert.equal(pendingCheckIn(state, SUNDAY), null, 'an answered week stops asking');

  // The following Monday opens a fresh question about the week just finished.
  assert.equal(pendingCheckIn(state, new Date('2026-09-21T09:00:00'))!.weekOf, '2026-09-14');
  answer('2026-09-21T09:05:00');
  assert.equal(pendingCheckIn(state, new Date('2026-09-21T10:00:00')), null);

  // Answering the same week twice is idempotent, not a second prompt.
  assert.equal(state.checkIns!.filter((c) => c.weekOf === '2026-09-14').length, 1);
});

test('the recorded check-in snapshots the week it reviewed', () => {
  const state = stateWith(['2026-09-15', '2026-09-16']);
  state.bodyLogs = [{ id: 'b', date: '2026-09-18', unit: 'weight', value: 77.4, createdAt: 1 }];
  const record = recordCheckIn(
    state,
    { feeling: 5, notes: '  slept well  ' },
    new Date('2026-09-21T08:00:00'),
  );
  assert.equal(record.weekOf, '2026-09-14');
  assert.equal(record.date, '2026-09-21');
  assert.equal(record.workouts, 2);
  assert.equal(record.minutes, 90);
  assert.equal(record.weightKg, 77.4);
  assert.equal(record.notes, 'slept well', 'notes are trimmed');
  assert.equal(record.feeling, 5);
});

test('notes are bounded and optional', () => {
  const state = emptyState();
  const long = recordCheckIn(state, { feeling: 3, notes: 'x'.repeat(900) });
  assert.equal(long.notes!.length, 400);
  assert.equal(recordCheckIn(state, { feeling: 3, notes: '   ' }).notes, undefined);
});

test('check-in history is newest first, and the streak counts consecutive weeks', () => {
  const state = emptyState();
  state.checkIns = [
    {
      id: 'a',
      date: '2026-09-07',
      weekOf: '2026-08-31',
      feeling: 3,
      workouts: 3,
      minutes: 100,
      createdAt: 1,
    },
    {
      id: 'b',
      date: '2026-09-14',
      weekOf: '2026-09-07',
      feeling: 4,
      workouts: 4,
      minutes: 160,
      createdAt: 2,
    },
    {
      id: 'c',
      date: '2026-09-21',
      weekOf: '2026-09-14',
      feeling: 4,
      workouts: 4,
      minutes: 160,
      createdAt: 3,
    },
  ];
  assert.deepEqual(
    checkInHistory(state).map((c) => c.id),
    ['c', 'b', 'a'],
  );
  assert.equal(checkInStreak(state, SUNDAY), 3);

  // A missed week breaks the streak rather than silently continuing.
  state.checkIns = state.checkIns.filter((c) => c.id !== 'b');
  assert.equal(checkInStreak(state, SUNDAY), 1);
  assert.equal(checkInStreak(emptyState(), SUNDAY), 0);
});

test('a brand-new account is never asked to review a week that predates it', () => {
  // No sessions, no meals, no weigh-ins: there is nothing to review, and a
  // first-day "your week is waiting" is the fastest way to make a check-in
  // feel like homework.
  assert.equal(pendingCheckIn(emptyState(), SUNDAY), null);

  // One meal inside the reviewed week (7–13 Sep) is enough to make it worth a
  // look — a week of food tracking with no training still happened.
  const fed = emptyState();
  fed.meals = [
    {
      id: 'm1',
      date: '2026-09-09',
      name: 'Lunch',
      slot: 'lunch',
      calories: 600,
      protein: 40,
      createdAt: 1,
    },
  ];
  const pending = pendingCheckIn(fed, SUNDAY)!;
  assert.ok(pending);
  assert.equal(pending.review.mealsLogged, 1);
  assert.equal(pending.review.workouts, 0);
  assert.equal(pending.review.hasEntries, true);

  // A meal in the *current* week does not resurrect last week's review.
  const fresh = emptyState();
  fresh.meals = [
    {
      id: 'm1',
      date: '2026-09-15',
      name: 'Lunch',
      slot: 'lunch',
      calories: 600,
      protein: 40,
      createdAt: 1,
    },
  ];
  assert.equal(pendingCheckIn(fresh, SUNDAY), null);
});

test('the review counts the nutrition half of the week too', () => {
  const state = emptyState();
  state.meals = [
    {
      id: 'm1',
      date: '2026-09-09',
      name: 'A',
      slot: 'lunch',
      calories: 500,
      protein: 30,
      createdAt: 1,
    },
    {
      id: 'm2',
      date: '2026-09-10',
      name: 'B',
      slot: 'dinner',
      calories: 700,
      protein: 40,
      createdAt: 2,
    },
    {
      id: 'm3',
      date: '2026-09-16',
      name: 'C',
      slot: 'lunch',
      calories: 600,
      protein: 35,
      createdAt: 3,
    },
  ];
  state.bodyLogs = [{ id: 'b1', date: '2026-09-12', unit: 'weight', value: 79, createdAt: 1 }];
  // `weeklyReview` reviews the week *containing* the date it is given, so this
  // window is 14–20 Sep: only the 16th's meal and no weigh-in fall inside it.
  const review = weeklyReview(state, SUNDAY);
  assert.equal(review.from, '2026-09-14');
  assert.equal(review.mealsLogged, 1);
  assert.equal(review.weighedIn, false);
  assert.equal(review.hasEntries, true, 'a logged meal alone makes the week reviewable');

  // The previous week, which is what the check-in actually asks about.
  const previous = weeklyReview(state, new Date('2026-09-13T12:00:00'));
  assert.equal(previous.from, '2026-09-07');
  assert.equal(previous.mealsLogged, 2);
  assert.equal(previous.weighedIn, true);
});

test('a blank week is only worth reviewing once there is a habit to protect', () => {
  const blankWithHistory = emptyState();
  blankWithHistory.sessions = []; // no sessions last week
  blankWithHistory.bodyLogs = [
    { id: 'b1', date: '2026-08-01', unit: 'weight', value: 80, createdAt: 1 },
  ];
  assert.equal(
    pendingCheckIn(blankWithHistory, SUNDAY),
    null,
    'an old weigh-in alone does not make a blank week worth reviewing',
  );

  // Once the athlete has answered a check-in before, the habit carries even
  // through an empty week — that is exactly the week the nudge is for.
  blankWithHistory.checkIns = [
    {
      id: 'c1',
      date: '2026-09-07',
      weekOf: '2026-08-31',
      feeling: 3,
      workouts: 4,
      minutes: 160,
      createdAt: 1,
    },
  ];
  const pending = pendingCheckIn(blankWithHistory, SUNDAY)!;
  assert.ok(pending);
  assert.equal(pending.review.workouts, 0);
  assert.match(pending.review.headline, /blank week/i);
});

test('next-week actions are concrete and never more than two', () => {
  const state = stateWith(['2026-09-15']);
  state.schedule = [
    {
      id: 'sc1',
      title: 'Push day',
      categoryId: 'strength',
      weekday: 1,
      timeOfDay: '07:00',
      durationMin: 60,
      intensity: 'moderate',
      active: true,
      createdAt: 1,
    },
  ];
  const actions = checkInActions(state, weeklyReview(state, SUNDAY));
  assert.ok(actions.length >= 1 && actions.length <= 2, `got ${actions.length} actions`);
  for (const a of actions) assert.ok(a.length > 10, 'actions must be sentences, not labels');

  // A perfect week still gets one line of guidance.
  const great = stateWith(['2026-09-14', '2026-09-15', '2026-09-16']);
  const actions2 = checkInActions(great, weeklyReview(great, SUNDAY));
  assert.equal(actions2.length, 1);
});

test('feeling labels cover the whole scale', () => {
  for (let f = 1; f <= 5; f++) assert.notEqual(feelingLabel(f), '');
  assert.equal(feelingLabel(1), 'Rough');
  assert.equal(feelingLabel(5), 'Excellent');
});

test('a deadline goal reports required pace against actual pace', () => {
  const state = emptyState();
  state.sessions = ['2026-09-14', '2026-09-16', '2026-09-18'].map((d) => session(d));
  const g = goal({ startDate: '2026-09-07', deadline: '2026-10-12', target: 12 });
  const d = goalDeadline(state, g, SUNDAY)!;
  assert.ok(d);
  assert.equal(d.remaining, 9);
  assert.ok(d.daysLeft > 0);
  assert.ok(d.requiredPerWeek > 0);
  assert.ok(d.actualPerWeek !== null);
  assert.ok(['ahead', 'on-track', 'behind'].includes(d.verdict));
  assert.ok(d.message.length > 0);
});

test('a brand-new goal has no pace yet and says so', () => {
  const state = emptyState();
  const g = goal({ startDate: '2026-09-19', deadline: '2026-12-01' });
  const d = goalDeadline(state, g, SUNDAY)!;
  assert.equal(d.actualPerWeek, null);
  assert.equal(d.verdict, 'unknown');
  assert.ok(d.message.includes('week'), d.message);
});

test('a met goal and an overdue goal are both reported plainly', () => {
  const state = stateWith(['2026-09-14', '2026-09-15', '2026-09-16']);
  const met = goalDeadline(state, goal({ target: 2, deadline: '2026-10-01' }), SUNDAY)!;
  assert.equal(met.verdict, 'done');

  const late = goalDeadline(state, goal({ target: 20, deadline: '2026-09-01' }), SUNDAY)!;
  assert.equal(late.verdict, 'overdue');
  assert.equal(late.daysLeft < 0, true);
});

test('a goal without a deadline produces no deadline maths', () => {
  assert.equal(goalDeadline(emptyState(), goal(), SUNDAY), null);
});

test('deadline labels read like a human countdown', () => {
  assert.equal(deadlineLabel('2026-09-20', SUNDAY), 'Due today');
  assert.equal(deadlineLabel('2026-09-21', SUNDAY), '1 day left');
  assert.equal(deadlineLabel('2026-10-02', SUNDAY), '12 days left');
  assert.equal(deadlineLabel('2027-03-01', SUNDAY), '5 months left');
  assert.ok(deadlineLabel('2026-09-10', SUNDAY).includes('overdue'));
});

test('the suggested deadline is in the future and ISO-shaped', () => {
  const state = stateWith(['2026-09-14', '2026-09-16', '2026-09-18', '2026-09-20']);
  const iso = suggestDeadline(state, 'workouts', 20, SUNDAY);
  assert.match(iso, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(iso > '2026-09-20', 'a suggestion in the past is not a suggestion');

  // An ambitious target must push the date out, never pull it in.
  const easy = suggestDeadline(state, 'workouts', 4, SUNDAY);
  const hard = suggestDeadline(state, 'workouts', 400, SUNDAY);
  assert.ok(hard > easy, `${hard} should be later than ${easy}`);
});
