import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Footprints, Flame, Moon, Dumbbell } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import {
  aggregate,
  dailyStrain,
  sessionsInRange,
  sleepOn,
  targetsForDays,
  toISODate,
  vitalsOn,
} from '@smartfit/core';

function formatMin(totalMin: number) {
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  if (h === 0) return `${m}m`;
  return `${h}h${m > 0 ? m : ''}`;
}

export function DailyGoalsGrid() {
  const { state } = useStore();

  const tiles = useMemo(() => {
    const today = toISODate(new Date());
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

    const STEPS_TARGET = 8500;
    const CAL_TARGET = targets.calories || 400;
    const SLEEP_TARGET = 8 * 60;
    const EXERCISE_TARGET = Math.max(20, targets.minutes);

    return [
      {
        icon: Footprints,
        color: '#f97316',
        label: 'Steps',
        value: (vitals?.steps ?? 0).toLocaleString(),
        target: STEPS_TARGET.toLocaleString(),
        pct: Math.min(100, ((vitals?.steps ?? 0) / STEPS_TARGET) * 100),
      },
      {
        icon: Flame,
        color: '#ef4444',
        label: 'Active Cal',
        value: Math.round((vitals?.activeCalories ?? 0) + day.calories).toString(),
        target: Math.round(CAL_TARGET).toString(),
        pct: Math.min(100, (((vitals?.activeCalories ?? 0) + day.calories) / CAL_TARGET) * 100),
      },
      {
        icon: Moon,
        color: '#8b5cf6',
        label: 'Sleep',
        value: sleep ? formatMin(sleep.durationMin) : '—',
        target: formatMin(SLEEP_TARGET),
        pct: Math.min(100, ((sleep?.durationMin ?? 0) / SLEEP_TARGET) * 100),
      },
      {
        icon: Dumbbell,
        color: '#8AD200',
        label: 'Exercise',
        value: `${exerciseMin} min`,
        target: `${EXERCISE_TARGET} min`,
        pct: Math.min(100, (exerciseMin / EXERCISE_TARGET) * 100),
      },
    ];
  }, [state]);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {tiles.map((t) => (
        <View
          key={t.label}
          style={{
            width: '48%',
            backgroundColor: '#1a1a1a',
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: `${t.color}1a`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <t.icon size={15} color={t.color} />
            </View>
            <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '800' }}>
              {Math.round(t.pct)}%
            </Text>
          </View>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 20, marginTop: 10 }}>
            {t.value}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
            <Text style={{ color: '#9ca3af', fontSize: 11 }}>{t.label}</Text>
            <Text style={{ color: '#9ca3af', fontSize: 11 }}>{t.target}</Text>
          </View>
          <View
            style={{
              height: 5,
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderRadius: 4,
              marginTop: 8,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${t.pct}%`,
                backgroundColor: t.color,
                borderRadius: 4,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
