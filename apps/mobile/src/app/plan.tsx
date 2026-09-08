import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowDownAZ, Dumbbell, Search, X } from 'lucide-react-native';
import {
  EXERCISE_EQUIPMENT_LABELS,
  EXERCISE_GROUPS,
  EXERCISE_MUSCLE_LABELS,
  formatMinutes,
  INTENSITY_META,
  searchExercises,
  WEEKDAYS_LONG,
  type ExerciseEquipment,
  type ExerciseGroup,
  type ExerciseMuscle,
} from '@smartfit/core';
import { useStore } from '@/lib/store';
import { Card, SectionTitle } from '@/components/ui';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ExerciseDemo } from '@/components/ExerciseDemo';
import { ExerciseDetailModal } from '@/components/ExerciseDetailModal';
import { useAllExercises, useExtendedCatalogStatus } from '@/lib/use-extended-catalog';

/** Tiles rendered before "Show more" — keeps image loads light. */
const PAGE_SIZE = 24;

/** Browse sections; "all" and "popular" are pseudo-sections. */
type GroupFilter = ExerciseGroup | 'all' | 'popular';
/** Result order: curated-first (default) or alphabetical. */
type SortMode = 'recommended' | 'az';

/** Equipment chips in a sensible browse order. */
const EQUIPMENT_ORDER: ExerciseEquipment[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'body',
  'kettlebell',
  'band',
  'ez-bar',
  'other',
];

function inGroup(entry: { group: ExerciseGroup; popular?: boolean }, group: GroupFilter): boolean {
  if (group === 'all') return true;
  if (group === 'popular') return !!entry.popular;
  return entry.group === group;
}

/** Section / filter chip with an optional muted count. */
function LibraryChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      className="rounded-full border px-3 py-1.5"
      style={{
        borderColor: active ? '#D6532F' : '#E7E2DB',
        backgroundColor: active ? '#D6532F14' : 'transparent',
      }}
    >
      <Text className="text-sm font-medium" style={{ color: active ? '#D6532F' : '#857D75' }}>
        {label}
        {typeof count === 'number' && count > 0 ? ' ' : null}
        {typeof count === 'number' && count > 0 ? (
          <Text style={{ opacity: 0.65 }}>{count}</Text>
        ) : null}
      </Text>
    </Pressable>
  );
}

/**
 * The browsable exercise library on the plan tab: the whole shared catalog —
 * curated 103 plus the runtime-fetched full library — with body-section
 * chips, an equipment filter, muscle focus chips, search and A–Z ordering.
 * Tapping a tile opens the how-to sheet.
 */
function ExerciseLibrary() {
  const [group, setGroup] = useState<GroupFilter>('popular');
  const [muscle, setMuscle] = useState<ExerciseMuscle | null>(null);
  const [equipment, setEquipment] = useState<ExerciseEquipment | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('recommended');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [detailName, setDetailName] = useState<string | null>(null);

  // The full 1,323-exercise catalog arrives at runtime; counts and results
  // refresh when it lands. Until then this shows the curated 103.
  const catalog = useAllExercises();
  const status = useExtendedCatalogStatus();

  // Search once; every filter below composes on top of the ranked matches,
  // so the chip counts stay meaningful while searching.
  const searched = useMemo(() => {
    const q = query.trim();
    return q ? searchExercises(q, catalog.length) : catalog;
  }, [query, catalog]);

  const list = useMemo(() => {
    const filtered = searched.filter(
      (e) =>
        inGroup(e, group) &&
        (!muscle || e.muscles.includes(muscle)) &&
        (!equipment || e.equipment === equipment),
    );
    return sort === 'az' ? [...filtered].sort((a, b) => a.name.localeCompare(b.name)) : filtered;
  }, [searched, group, muscle, equipment, sort]);

  // Facet counts: each row counts what the *other* filters leave behind.
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of searched) {
      if (muscle && !e.muscles.includes(muscle)) continue;
      if (equipment && e.equipment !== equipment) continue;
      counts[e.group] = (counts[e.group] ?? 0) + 1;
      if (e.popular) counts.popular = (counts.popular ?? 0) + 1;
    }
    return counts;
  }, [searched, muscle, equipment]);

  const allCount = useMemo(
    () => EXERCISE_GROUPS.reduce((sum, g) => sum + (groupCounts[g.id] ?? 0), 0),
    [groupCounts],
  );

  const equipmentCounts = useMemo(() => {
    const counts: Partial<Record<ExerciseEquipment, number>> = {};
    for (const e of searched) {
      if (!inGroup(e, group)) continue;
      if (muscle && !e.muscles.includes(muscle)) continue;
      counts[e.equipment] = (counts[e.equipment] ?? 0) + 1;
    }
    return counts;
  }, [searched, group, muscle]);

  // Muscle focus chips appear when a section splits into several muscles
  // (Back → Lats/Traps/…, Legs → Quads/Hamstrings/…).
  const muscleOptions = useMemo(() => {
    if (group === 'all' || group === 'popular')
      return [] as { muscle: ExerciseMuscle; count: number }[];
    const counts = new Map<ExerciseMuscle, number>();
    for (const e of searched) {
      if (e.group !== group) continue;
      if (equipment && e.equipment !== equipment) continue;
      for (const m of e.muscles) counts.set(m, (counts.get(m) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([m, count]) => ({ muscle: m, count }))
      .sort((a, b) => b.count - a.count || a.muscle.localeCompare(b.muscle));
  }, [searched, group, equipment]);

  const shown = list.slice(0, visible);
  const hasFilters = group !== 'all' || muscle !== null || equipment !== null || !!query.trim();

  // Paging resets whenever the result set changes shape.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [group, muscle, equipment, query, sort]);

  function selectGroup(next: GroupFilter) {
    setGroup(next);
    setMuscle(null); // muscle focus belongs to its section
  }

  function clearFilters() {
    setGroup('all');
    setMuscle(null);
    setEquipment(null);
    setQuery('');
  }

  return (
    <View className="gap-2">
      <SectionTitle>Exercise library</SectionTitle>

      <View className="flex-row items-center gap-2">
        <View className="border-border bg-card flex-1 flex-row items-center gap-2 rounded-xl border px-3">
          <Search color="#857D75" size={16} />
          <TextInput
            accessibilityLabel="Search exercises"
            placeholder="Search 1,300+ exercises…"
            placeholderTextColor="#857D75"
            className="text-foreground flex-1 py-2.5 text-sm"
            value={query}
            onChangeText={setQuery}
          />
          {query !== '' && (
            <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={8}>
              <X color="#857D75" size={16} />
            </Pressable>
          )}
        </View>
        <Pressable
          accessibilityLabel="Toggle alphabetical order"
          accessibilityRole="button"
          accessibilityState={{ selected: sort === 'az' }}
          onPress={() => setSort(sort === 'az' ? 'recommended' : 'az')}
          className="bg-card items-center rounded-xl border p-2.5"
          style={{
            borderColor: sort === 'az' ? '#D6532F' : '#E7E2DB',
            backgroundColor: sort === 'az' ? '#D6532F14' : 'transparent',
          }}
        >
          <ArrowDownAZ color={sort === 'az' ? '#D6532F' : '#857D75'} size={20} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2"
      >
        <LibraryChip
          label="All"
          count={allCount}
          active={group === 'all'}
          onPress={() => selectGroup('all')}
        />
        <LibraryChip
          label="Popular"
          count={groupCounts.popular ?? 0}
          active={group === 'popular'}
          onPress={() => selectGroup('popular')}
        />
        {EXERCISE_GROUPS.map((g) => (
          <LibraryChip
            key={g.id}
            label={g.label}
            count={groupCounts[g.id] ?? 0}
            active={group === g.id}
            onPress={() => selectGroup(g.id)}
          />
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="items-center gap-2"
      >
        <Text
          className="pr-1 text-xs font-semibold tracking-wide uppercase"
          style={{ color: '#857D75' }}
        >
          Equipment
        </Text>
        <LibraryChip label="Any" active={equipment === null} onPress={() => setEquipment(null)} />
        {EQUIPMENT_ORDER.filter((eq) => equipment === eq || (equipmentCounts[eq] ?? 0) > 0).map(
          (eq) => (
            <LibraryChip
              key={eq}
              label={EXERCISE_EQUIPMENT_LABELS[eq]}
              count={equipmentCounts[eq] ?? 0}
              active={equipment === eq}
              onPress={() => setEquipment(equipment === eq ? null : eq)}
            />
          ),
        )}
      </ScrollView>

      {muscleOptions.length >= 2 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="items-center gap-2"
        >
          <Text
            className="pr-1 text-xs font-semibold tracking-wide uppercase"
            style={{ color: '#857D75' }}
          >
            Focus
          </Text>
          {muscleOptions.map(({ muscle: m, count }) => (
            <LibraryChip
              key={m}
              label={EXERCISE_MUSCLE_LABELS[m]}
              count={count}
              active={muscle === m}
              onPress={() => setMuscle(muscle === m ? null : m)}
            />
          ))}
        </ScrollView>
      )}

      <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
        <Text className="text-sm" style={{ color: '#857D75' }}>
          {list.length} {list.length === 1 ? 'exercise' : 'exercises'}
        </Text>
        {status === 'loading' && (
          <View className="flex-row items-center gap-1.5">
            <ActivityIndicator size="small" color="#857D75" />
            <Text className="text-xs" style={{ color: '#857D75' }}>
              Syncing the full 1,300+ library…
            </Text>
          </View>
        )}
        {status === 'error' && (
          <Text className="text-xs" style={{ color: '#857D75' }}>
            Full library offline — showing curated 103
          </Text>
        )}
        {hasFilters && (
          <Pressable onPress={clearFilters} hitSlop={8}>
            <Text className="text-xs underline" style={{ color: '#D6532F' }}>
              Clear all
            </Text>
          </Pressable>
        )}
      </View>

      {shown.length === 0 ? (
        <Card className="items-center gap-1.5 py-8">
          <Dumbbell color="#C9C2B8" size={32} strokeWidth={1.5} />
          <Text className="text-foreground text-sm font-semibold">No exercises match</Text>
          <Text className="text-xs" style={{ color: '#857D75' }}>
            Try another name, or loosen the filters.
          </Text>
          {hasFilters && (
            <Pressable
              onPress={clearFilters}
              className="mt-1.5 rounded-full px-3 py-1.5"
              style={{ backgroundColor: '#F3F0EB' }}
            >
              <Text className="text-sm font-medium" style={{ color: '#D6532F' }}>
                Clear search &amp; filters
              </Text>
            </Pressable>
          )}
        </Card>
      ) : (
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
      )}

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
