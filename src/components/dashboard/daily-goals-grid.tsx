'use client';

import { useMemo } from 'react';
import { Footprints, Flame, Moon, Dumbbell } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import {
  activityRings,
  aggregate,
  dailyStrain,
  sleepOn,
  sessionsInRange,
  targetsForDays,
  toISODate,
  vitalsOn,
  type FitnessState,
} from '@smartfit/core';

/**
 * Sonar-style 2x2 daily goal tiles: steps, active calories, sleep, exercise minutes.
 * Steps/calories come from vitals if synced, else 0 placeholder.
 */
export function DailyGoalsGrid() {
  const { state } = useStore();
  const today = toISODate(new Date());

  const data = useMemo(() => computeDailyGoals(state, today), [state, today]);

  const tiles = [
    {
      icon: Footprints,
      label: 'Steps',
      value: data.steps.toLocaleString(),
      target: `${data.stepsTarget.toLocaleString()}`,
      pct: Math.min(100, (data.steps / Math.max(1, data.stepsTarget)) * 100),
      color: '#f97316',
    },
    {
      icon: Flame,
      label: 'Active Cal',
      value: Math.round(data.calories).toString(),
      target: `${Math.round(data.caloriesTarget)}`,
      pct: Math.min(100, (data.calories / Math.max(1, data.caloriesTarget)) * 100),
      color: '#ef4444',
    },
    {
      icon: Moon,
      label: 'Sleep',
      value: data.sleepMin > 0 ? formatHrsMins(data.sleepMin) : '—',
      target: formatHrsMins(data.sleepTarget),
      pct: Math.min(100, (data.sleepMin / Math.max(1, data.sleepTarget)) * 100),
      color: '#8b5cf6',
    },
    {
      icon: Dumbbell,
      label: 'Exercise',
      value: `${data.exerciseMin} min`,
      target: `${data.exerciseTarget} min`,
      pct: Math.min(100, (data.exerciseMin / Math.max(1, data.exerciseTarget)) * 100),
      color: 'var(--volt)',
    },
  ];

  return (
    <section aria-label="Daily goals" className="min-w-0">
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="bg-card ring-border rounded-2xl p-4 shadow-sm ring-1">
            <div className="flex items-center justify-between">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${t.color}1a`, color: t.color }}
              >
                <t.icon className="h-4 w-4" />
              </span>
              <span className="text-muted-foreground text-[11px] font-bold tabular-nums">
                {Math.round(t.pct)}%
              </span>
            </div>
            <p className="font-display mt-3 text-xl leading-tight font-extrabold tabular-nums">
              {t.value}
            </p>
            <p className="text-muted-foreground flex items-center justify-between text-xs">
              <span>{t.label}</span>
              <span className="tabular-nums">{t.target}</span>
            </p>
            <div className="bg-secondary mt-2 h-1.5 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${t.pct}%`, backgroundColor: t.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatHrsMins(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m > 0 ? m + 'm' : ''}`.trim();
}

const DEFAULT_STEPS_TARGET = 8500;
const DEFAULT_SLEEP_TARGET_MIN = 8 * 60;
const DEFAULT_ACTIVE_CAL_TARGET = 400;

function computeDailyGoals(state: FitnessState, today: string) {
  const day = aggregate(sessionsInRange(state, today, today));
  const targets = targetsForDays(state, 1);
  const vitals = vitalsOn(state, today);
  const sleep = sleepOn(state, today);
  const strain = dailyStrain(state, today);

  const exerciseMin =
    day.minutes +
    Math.round(
      strain.zoneMinutes.z1 +
        strain.zoneMinutes.z2 +
        strain.zoneMinutes.z3 +
        strain.zoneMinutes.z4 +
        strain.zoneMinutes.z5,
    );

  return {
    steps: vitals?.steps ?? 0,
    stepsTarget: DEFAULT_STEPS_TARGET,
    calories: (vitals?.activeCalories ?? 0) + day.calories,
    caloriesTarget: targets.calories || DEFAULT_ACTIVE_CAL_TARGET,
    sleepMin: sleep?.durationMin ?? 0,
    sleepTarget: DEFAULT_SLEEP_TARGET_MIN,
    exerciseMin,
    exerciseTarget: Math.max(20, targets.minutes),
  };
}

// silence unused var warnings
void activityRings;
