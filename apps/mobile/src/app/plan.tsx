import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  EXERCISES,
  EXERCISE_EQUIPMENT_LABELS,
  EXERCISE_GROUPS,
  EXERCISE_MUSCLE_LABELS,
  formatMinutes,
  INTENSITY_META,
  WEEKDAYS_LONG,
  type ExerciseGroup,
} from '@smartfit/core';
import { useStore } from '@/lib/store';
import { Card, SectionTitle } from '@/components/ui';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ExerciseDemo } from '@/components/ExerciseDemo';
import { ExerciseDetailModal } from '@/components/ExerciseDetailModal';

/** Tiles rendered per group — keeps image loads light while scrolling. */
const GROUP_LIMIT = 12;

/**
 * The browsable exercise library on the plan tab: the shared catalog grouped
 * by body section, with demos and the how-to sheet one tap away.
 */
function ExerciseLibrary() {
  const [group, setGroup] = useState<ExerciseGroup | 'all'>('all');
  const [detailName, setDetailName] = useState<string | null>(null);

  const list = useMemo(
    () =>
      group === 'all'
        ? EXERCISES.filter((e) => e.popular)
        : EXERCISES.filter((e) => e.group === group),
    [group],
  );

  return (
    <View className="gap-2">
      <SectionTitle>Exercise library</SectionTitle>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2"
      >
        {[{ id: 'all' as const, label: 'Popular' }, ...EXERCISE_GROUPS].map((g) => {
          const active = group === g.id;
          return (
            <Pressable
              key={g.id}
              onPress={() => setGroup(g.id)}
              className="rounded-full border px-3 py-2"
              style={{
                borderColor: active ? '#D6532F' : '#E7E2DB',
                backgroundColor: active ? '#D6532F14' : 'transparent',
              }}
            >
              <Text
                className="text-sm font-medium"
                style={{ color: active ? '#D6532F' : '#857D75' }}
              >
                {g.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Card className="flex-row flex-wrap gap-3">
        {list.slice(0, GROUP_LIMIT).map((entry) => (
          <Pressable
            key={entry.id}
            accessibilityLabel={`How to do ${entry.name}`}
            onPress={() => setDetailName(entry.name)}
            className="active:bg-muted w-[31%] items-center gap-1 rounded-xl p-1"
          >
            <ExerciseDemo name={entry.name} size={72} radius={12} animated={false} />
            <Text
              className="text-foreground w-full text-center text-xs font-semibold"
              numberOfLines={2}
            >
              {entry.name}
            </Text>
            <Text
              className="text-muted-foreground w-full text-center text-[11px]"
              numberOfLines={1}
            >
              {EXERCISE_MUSCLE_LABELS[entry.muscles[0]]}
            </Text>
          </Pressable>
        ))}
      </Card>

      <ExerciseDetailModal name={detailName} onClose={() => setDetailName(null)} />
    </View>
  );
}

export default function PlanScreen() {
  const { state, updateSchedule } = useStore();
  const today = new Date().getDay();

  const byDay = new Map<number, typeof state.schedule>();
  for (const s of state.schedule) {
    const arr = byDay.get(s.weekday) ?? [];
    arr.push(s);
    byDay.set(s.weekday, arr);
  }
  for (const arr of byDay.values()) arr.sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay));

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-28 gap-4">
        <View>
          <Text className="text-foreground text-2xl font-bold">Training plan</Text>
          <Text className="text-muted-foreground text-sm">
            {state.schedule.filter((s) => s.active).length} active sessions · tap the switch to rest
            a day.
          </Text>
        </View>

        <ExerciseLibrary />

        {WEEKDAYS_LONG.map((day, i) => {
          const items = (byDay.get(i) ?? []).sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay));
          const isToday = i === today;
          return (
            <Card key={day} className={isToday ? 'border-primary' : ''}>
              <View className="flex-row items-center justify-between">
                <Text
                  className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}
                >
                  {day} {isToday ? '· today' : ''}
                </Text>
                {items.length === 0 && <Text className="text-muted-foreground text-xs">Rest</Text>}
              </View>
              <View className="mt-2 gap-2">
                {items.map((s) => {
                  const cat = state.categories.find((c) => c.id === s.categoryId);
                  const meta = INTENSITY_META[s.intensity];
                  return (
                    <View
                      key={s.id}
                      className="bg-muted/60 flex-row items-center gap-3 rounded-xl p-3"
                    >
                      <View
                        className="h-9 w-9 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${cat?.color ?? '#64748b'}1a` }}
                      >
                        <CategoryIcon
                          name={cat?.icon ?? 'activity'}
                          color={cat?.color ?? '#64748b'}
                          size={16}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-foreground text-sm font-medium">{s.title}</Text>
                        <Text className="text-muted-foreground text-xs">
                          {s.timeOfDay} · {formatMinutes(s.durationMin)} ·{' '}
                          <Text style={{ color: meta.color }}>{meta.label}</Text>
                        </Text>
                      </View>
                      <Switch
                        value={s.active}
                        onValueChange={(v) => updateSchedule(s.id, { active: v })}
                        trackColor={{ true: '#D6532F', false: '#E7E2DB' }}
                      />
                    </View>
                  );
                })}
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
