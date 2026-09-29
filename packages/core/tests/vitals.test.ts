import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyReadiness,
  dailyStrain,
  sleepScore,
  strainFromZoneMinutes,
  sleepDebt,
  detectAnomalies,
  POPULATION_RANGES,
} from '../src/vitals';
import { emptyState, toISODate } from '../src';

test('sleepScore returns 0 for null sleep', () => {
  assert.equal(sleepScore(null), 0);
});

test('sleepScore rewards 8-hour sleep', () => {
  const s = sleepScore({
    id: 's1',
    date: '2026-09-28',
    durationMin: 8 * 60,
    source: 'manual',
    createdAt: Date.now(),
  });
  assert.ok(s >= 85, `expected high score for 8h sleep, got ${s}`);
});

test('sleepScore penalises 4h sleep', () => {
  const s = sleepScore({
    id: 's2',
    date: '2026-09-28',
    durationMin: 4 * 60,
    source: 'manual',
    createdAt: Date.now(),
  });
  assert.ok(s <= 60, `expected low score for 4h sleep, got ${s}`);
});

test('strainFromZoneMinutes maps zone minutes to 0-21', () => {
  assert.equal(strainFromZoneMinutes({ z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 }), 0);
  const light = strainFromZoneMinutes({ z1: 30, z2: 20, z3: 0, z4: 0, z5: 0 });
  assert.ok(light > 2 && light < 10, `light activity strain should be low, got ${light}`);
  const hard = strainFromZoneMinutes({ z1: 10, z2: 10, z3: 20, z4: 25, z5: 10 });
  assert.ok(hard > 12, `hard workout strain should be high, got ${hard}`);
  assert.ok(hard <= 21);
});

test('dailyStrain returns sensible default for empty state', () => {
  const today = toISODate(new Date());
  const s = dailyStrain(emptyState(), today);
  assert.equal(s.score, 0);
  assert.equal(s.date, today);
});

test('dailyReadiness returns Calibrating on empty state', () => {
  const today = toISODate(new Date());
  const r = dailyReadiness(emptyState(), today);
  assert.equal(r.label, 'Calibrating');
  assert.ok(r.score >= 0 && r.score <= 100);
  assert.ok(r.recommendedStrainMin <= r.recommendedStrainMax);
});

test('dailyReadiness accepts sleep data and produces low recovery on short sleep', () => {
  const today = toISODate(new Date());
  const state = {
    ...emptyState(),
    sleepLogs: [
      {
        id: 's1',
        date: today,
        durationMin: 3 * 60,
        source: 'manual' as const,
        createdAt: Date.now(),
      },
    ],
  };
  const r = dailyReadiness(state, today);
  assert.ok(r.score < 80, `short sleep should drag down recovery, got ${r.score}`);
  assert.ok(r.recommendedStrainMax <= 11);
});

test('sleepDebt returns negative for accumulated short nights', () => {
  const today = new Date();
  const logs = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    logs.push({
      id: `s${i}`,
      date: toISODate(d),
      durationMin: 6 * 60, // 2h under ideal
      source: 'manual' as const,
      createdAt: Date.now(),
    });
  }
  const state = { ...emptyState(), sleepLogs: logs };
  const debt = sleepDebt(state, toISODate(today), 7);
  // 2h × 7 nights = 14h deficit → -840 min
  assert.ok(debt < -700, `expected significant debt, got ${debt}`);
});

test('population ranges are defined and sane', () => {
  assert.ok(POPULATION_RANGES.hrvRmssd.typical > 20);
  assert.ok(POPULATION_RANGES.restingHR.typical > 40);
  assert.ok(POPULATION_RANGES.spo2.typical > 90);
});

test('detectAnomalies returns empty with no baseline data', () => {
  const today = toISODate(new Date());
  const a = detectAnomalies(emptyState(), today);
  assert.equal(a.length, 0);
});
