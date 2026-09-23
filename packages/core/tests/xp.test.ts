import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVEL_BASE_XP,
  LEVEL_STEP_XP,
  levelInfo,
  levelTitle,
  levelUp,
  totalXp,
  xpBreakdown,
  xpDelta,
  xpForSession,
  xpSummary,
  xpToReachLevel,
  emptyState,
  type FitnessState,
  type WorkoutSession,
} from '../src/index';

function session(over: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: over.id ?? `s-${Math.random().toString(36).slice(2)}`,
    date: over.date ?? '2026-09-01',
    categoryId: over.categoryId ?? 'strength',
    title: over.title ?? 'Session',
    durationMin: over.durationMin ?? 45,
    intensity: over.intensity ?? 'moderate',
    calories: over.calories ?? 300,
    exercises: over.exercises ?? [],
    createdAt: over.createdAt ?? Date.now(),
  };
}

function withSessions(n: number): FitnessState {
  const state = emptyState();
  state.sessions = Array.from({ length: n }, (_, i) =>
    session({ id: `s${i}`, date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}` }),
  );
  return state;
}

test('the level curve is monotonic and costs more each level', () => {
  assert.equal(xpToReachLevel(1), 0);
  assert.equal(xpToReachLevel(2), LEVEL_BASE_XP);
  assert.equal(xpToReachLevel(3), LEVEL_BASE_XP * 2 + LEVEL_STEP_XP);
  for (let level = 1; level < 30; level++) {
    const step = xpToReachLevel(level + 1) - xpToReachLevel(level);
    const next = xpToReachLevel(level + 2) - xpToReachLevel(level + 1);
    assert.ok(step > 0, `level ${level} must cost something`);
    assert.equal(next - step, LEVEL_STEP_XP);
  }
});

test('levelInfo lands exactly on boundaries', () => {
  assert.equal(levelInfo(0).level, 1);
  assert.equal(levelInfo(xpToReachLevel(2) - 1).level, 1);
  assert.equal(levelInfo(xpToReachLevel(2)).level, 2);
  assert.equal(levelInfo(xpToReachLevel(5)).level, 5);
  assert.equal(levelInfo(xpToReachLevel(5)).into, 0);
  assert.equal(levelInfo(xpToReachLevel(5)).remaining, xpToReachLevel(6) - xpToReachLevel(5));

  const mid = levelInfo(xpToReachLevel(4) + 10);
  assert.equal(mid.level, 4);
  assert.equal(mid.into, 10);
  assert.equal(mid.progressPct, Math.round((10 / (xpToReachLevel(5) - xpToReachLevel(4))) * 100));
  assert.equal(mid.title, levelTitle(4));
});

test('level info never reports negative progress', () => {
  const info = levelInfo(-500);
  assert.equal(info.level, 1);
  assert.equal(info.into, 0);
  assert.equal(info.remaining, LEVEL_BASE_XP);
});

test('a session award is base + minutes + intensity, and XP is the sum of the statement', () => {
  const s = session({ durationMin: 60, intensity: 'high' });
  assert.equal(xpForSession(s), 30 + 60 + 25);

  const state = withSessions(1);
  state.sessions[0] = s;
  const breakdown = xpBreakdown(state);
  assert.equal(
    breakdown.reduce((a, b) => a + b.xp, 0),
    totalXp(state),
  );
  assert.ok(totalXp(state) >= xpForSession(s), 'session XP is part of the total');
});

test('XP only grows when the log grows', () => {
  const state = withSessions(3);
  const before = totalXp(state);
  const more = { ...state, sessions: [...state.sessions, session({ id: 'extra' })] };
  assert.ok(totalXp(more) > before, 'adding a session must add XP');

  // Deleting data costs XP — the honest direction — but never goes negative.
  const less = { ...state, sessions: state.sessions.slice(0, 1) };
  assert.ok(totalXp(less) < before);
  assert.ok(totalXp(emptyState()) >= 0);
});

test('a week rolling over cannot demote anyone', () => {
  // A streak is the classic way this goes wrong: XP must key off the *best*
  // streak, not the current one, or every rest day quietly takes points back.
  const state = emptyState();
  state.sessions = [
    session({ id: 'a', date: '2026-09-01' }),
    session({ id: 'b', date: '2026-09-02' }),
    session({ id: 'c', date: '2026-09-03' }),
  ];
  const xp = totalXp(state);
  // Same log, "now" a year later: no current streak left, same XP.
  assert.equal(totalXp(state), xp);
  const summaryLater = xpSummary(state, new Date('2027-01-01T09:00:00'));
  assert.equal(summaryLater.xp, xp);
});

test('xpDelta reports gains, hides losses, and levelUp only crosses upward', () => {
  const before = withSessions(2);
  const after = withSessions(12);
  assert.ok(xpDelta(before, after) > 0);
  assert.equal(xpDelta(after, before), 0, 'a demotion is never celebrated');

  // 12 sessions is comfortably past level 2; 2 sessions is not.
  const up = levelUp(before, after);
  assert.ok(up, 'expected a level-up');
  assert.ok(up!.to.level > up!.from.level);
  assert.equal(levelUp(after, before), null);
  assert.equal(levelUp(before, before), null);
});

test('the breakdown names every source it pays for', () => {
  const state = withSessions(4);
  state.meals = [
    {
      id: 'm1',
      date: '2026-09-01',
      name: 'Chicken and rice',
      slot: 'lunch',
      calories: 600,
      protein: 45,
      createdAt: Date.now(),
    },
  ];
  state.bodyLogs = [
    { id: 'b1', date: '2026-09-01', unit: 'weight', value: 80, createdAt: Date.now() },
  ];
  state.checkIns = [
    {
      id: 'c1',
      date: '2026-09-08',
      weekOf: '2026-09-01',
      feeling: 4,
      workouts: 4,
      minutes: 180,
      createdAt: Date.now(),
    },
  ];

  const ids = xpBreakdown(state).map((s) => s.id);
  assert.ok(ids.includes('sessions'));
  assert.ok(ids.includes('meals'));
  assert.ok(ids.includes('weigh-ins'));
  assert.ok(ids.includes('check-ins'));

  for (const source of xpBreakdown(state)) {
    assert.ok(source.xp > 0, `${source.id} must be positive or omitted`);
    assert.ok(source.detail.length > 0, `${source.id} must explain itself`);
    assert.ok(source.label.length > 0);
  }
});

test('an empty log is level 1 with zero XP and no invented sources', () => {
  const summary = xpSummary(emptyState());
  assert.equal(summary.xp, 0);
  assert.equal(summary.level, 1);
  assert.equal(summary.title, 'Groundwork');
  assert.equal(summary.progressPct, 0);
  assert.deepEqual(summary.sources, []);
  assert.equal(summary.thisWeek, 0);
});

test('thisWeek only counts the last seven days', () => {
  const state = emptyState();
  const now = new Date('2026-09-20T12:00:00');
  state.sessions = [
    session({ id: 'old', date: '2026-08-01' }),
    session({ id: 'recent', date: '2026-09-18' }),
  ];
  const summary = xpSummary(state, now);
  assert.equal(summary.thisWeek, xpForSession(state.sessions[1]));
  assert.ok(summary.xp > summary.thisWeek, 'lifetime XP still counts the old session');
});

test('titles are defined for every level and plateau past the list', () => {
  for (let level = 1; level <= 10; level++) {
    assert.notEqual(levelTitle(level), '');
  }
  assert.equal(levelTitle(11), levelTitle(10));
  assert.equal(levelTitle(0), levelTitle(1));
});
