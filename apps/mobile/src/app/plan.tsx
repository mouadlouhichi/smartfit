import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import {
  EXERCISE_EQUIPMENT_LABELS,
  EXERCISE_GROUPS,
  EXERCISE_MUSCLE_LABELS,
  allExercises,
  formatMinutes,
  INTENSITY_META,
  searchExercises,
  WEEKDAYS_LONG,
  type ExerciseGroup,
} from '@smartfit/core';
import { useStore } from '@/lib/store';
import { Card, SectionTitle } from '@/components/ui';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ExerciseDemo } from '@/components/ExerciseDemo';
import { ExerciseDetailModal } from '@/components/ExerciseDetailModal';
import { useAllExercises } from '@/lib/use-extended-catalog';

/** Tiles rendered before "Show more" — keeps image loads light. */
const PAGE_SIZE = 24;

/**
 * The browsable exercise library on the plan tab: the shared catalog grouped
 * by body section, with demos and the how-to sheet one tap away.
 */
function ExerciseLibrary() {
  const [group, setGroup] = useState<ExerciseGroup | 'all'>('all');
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [detailName, setDetailName] = useState<string | null>(null);

  // The full 1,323-exercise catalog arrives at runtime; the shelf refreshes
  // when it lands. Until then this shows the curated 103.
  const catalog = useAllExercises();

  const list = useMemo(() => {
    const q = query.trim();
    if (q) {
      const found = searchExercises(q, catalog.length);
      return group === 'all' ? found : found.filter((e) => e.group === group);
    }
    if (group === 'all') return catalog.filter((e) => e.popular);
    return catalog.filter((e) => e.group === group);
  }, [group, query, catalog]);

  const shown = list.slice(0, visible);

  function selectGroup(next: ExerciseGroup | 'all') {
    setGroup(next);
    setVisible(PAGE_SIZE);
  }

  return (
    <View className="gap-2">
      <SectionTitle>Exercise library</SectionTitle>

      <View className="border-border bg-card flex-row items-center gap-2 rounded-xl border px-3">
        <Search color="#857D75" size={16} />
        <TextInput
          accessibilityLabel="Search exercises"
          placeholder="Search 1,300+ exercises…"
          placeholderTextColor="#857D75"
          className="text-foreground flex-1 py-2.5 text-sm"
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setVisible(PAGE_SIZE);
          }}
        />
      </View>

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
              onPress={() => selectGroup(g.id)}
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
        {shown.map((entry) => (
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

      {list.length > visible && (
        <Pressable
          accessibilityLabel="Show more exercises"
          onPress={() => setVisible((v) => v + PAGE_SIZE)}
          className="border-border bg-card items-center rounded-xl border py-2.5"
        >
          <Text className="text-sm font-medium" style={{ color: '#D6532F' }}>
            Show more · {list.length - visible} left
          </Text>
        </Pressable>
      )}

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
