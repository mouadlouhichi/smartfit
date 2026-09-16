import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowUpRight,
  CalendarCheck2,
  Check,
  Clock,
  Flame,
  Footprints,
  Plus,
  Target,
  Timer,
  Trash2,
} from 'lucide-react-native';
import {
  aggregate,
  currentStreak,
  formatCalories,
  formatDistance,
  formatMinutes,
  goalProgress,
  sessionsInRange,
  thisWeek,
  todaysFocus,
  getPlan,
  relativeDay,
  toISODate,
  INTENSITY_META,
  CATEGORY_FALLBACK_COLOR,
} from '@smartfit/core';
import { useStore } from '@/lib/store';
import { Card, ProgressBar } from '@/components/ui';
import { CategoryIcon } from '@/components/CategoryIcon';
import { LogWorkoutModal } from '@/components/LogWorkoutModal';
import { SessionDetailModal } from '@/components/SessionDetailModal';
import type { WorkoutSession } from '@smartfit/core';

/* Reference home: avatar greeting, streak tile, Health-Metrics 2×2 grid,
   program chips and the featured session card — one Volt layout everywhere. */

export default function HomeScreen() {
  const { state, ready, deleteSession } = useStore();
  const [logOpen, setLogOpen] = useState(false);
  const [detailSession, setDetailSession] = useState<WorkoutSession | null>(null);
  const [filter, setFilter] = useState('All type');

  const week = useMemo(() => thisWeek(state), [state]);
  const dayBars = useMemo(() => {
    const out: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const iso = toISODate(d);
      out.push(aggregate(sessionsInRange(state, iso, iso)).minutes);
    }
    return out;
  }, [state]);
  const maxBar = Math.max(1, ...dayBars);

  if (!ready) {
    return (
      <SafeAreaView className="bg-background flex-1">
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted-foreground">Loading your training…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const streak = currentStreak(state);
  const plan = getPlan(state.profile.planId);
  const focus = todaysFocus(state);
  const recent = state.sessions.slice(0, 6);
  const filtered =
    filter === 'All type'
      ? recent
      : recent.filter((s) => state.categories.find((c) => c.id === s.categoryId)?.name === filter);
  const topGoal = state.goals[0];
  const gp = topGoal ? goalProgress(state, topGoal) : null;
  const name = state.profile.name?.trim();
  const initial = (name?.[0] ?? 'S').toUpperCase();

  const metrics = [
    { icon: Timer, label: 'Active minutes', value: `${week.minutes}`, unit: 'min' },
    {
      icon: CalendarCheck2,
      label: 'Sessions',
      value: `${week.workouts}`,
      unit: 'workouts',
    },
    {
      icon: Footprints,
      label: 'Distance',
      value: week.distance.toFixed(1),
      unit: 'km',
    },
    {
      icon: Flame,
      label: 'Calories',
      value: formatCalories(week.calories),
      unit: 'kcal',
    },
  ];

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-28 gap-4">
        {/* ── Greeting row ── */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="bg-primary h-11 w-11 items-center justify-center rounded-full">
              <Text className="text-primary-foreground text-base font-extrabold">{initial}</Text>
            </View>
            <View>
              <Text className="text-muted-foreground text-xs">Welcome Back! 👋</Text>
              <Text className="text-foreground text-sm font-extrabold">{name || 'SmartFit'}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => setLogOpen(true)}
            accessibilityLabel="Log workout"
            className="bg-primary h-11 w-11 items-center justify-center rounded-full"
          >
            <Plus color="#101010" size={22} strokeWidth={2.6} />
          </Pressable>
        </View>

        {/* ── Streak tile ── */}
        <Card className="flex-row items-center gap-3">
          <View className="bg-primary h-14 w-14 items-center justify-center rounded-2xl">
            <Footprints color="#101010" size={24} strokeWidth={2.4} />
          </View>
          <View className="flex-1">
            <Text className="text-foreground text-lg font-extrabold">
              Training {streak} day{streak === 1 ? '' : 's'}
            </Text>
            <Text className="text-muted-foreground mt-0.5 text-xs">
              {week.workouts} session{week.workouts === 1 ? '' : 's'} · {week.distance.toFixed(1)}{' '}
              km · {formatMinutes(week.minutes)}
            </Text>
            <Text className="text-muted-foreground mt-0.5 text-xs">{plan.name}</Text>
          </View>
          <Pressable
            onPress={() => setLogOpen(true)}
            accessibilityLabel="Start workout"
            className="bg-primary h-11 w-11 items-center justify-center rounded-xl"
          >
            <ArrowUpRight color="#101010" size={22} strokeWidth={2.75} />
          </Pressable>
        </Card>

        {/* ── Health metrics ── */}
        <View>
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-foreground text-base font-extrabold">Health Metrics</Text>
            <Text className="text-muted-foreground text-xs">{focus ?? 'Rest & recover'}</Text>
          </View>
          <View className="flex-row flex-wrap gap-3">
            {metrics.map((m) => (
              <View
                key={m.label}
                className="bg-card border-border min-w-[44%] flex-1 rounded-3xl border p-4"
              >
                <View className="flex-row items-start justify-between">
                  <Text className="text-muted-foreground flex-1 text-sm font-semibold">
                    {m.label}
                  </Text>
                  <View className="bg-primary/10 h-8 w-8 items-center justify-center rounded-lg">
                    <m.icon color="#9CFF00" size={16} />
                  </View>
                </View>
                <Text className="text-foreground mt-3 text-2xl font-extrabold">{m.value}</Text>
                <View className="bg-secondary mt-2 self-start rounded-md px-2 py-0.5">
                  <Text className="text-muted-foreground text-[11px] font-bold">{m.unit}</Text>
                </View>
                {m.label === 'Active minutes' && (
                  <View className="mt-2 h-6 flex-row items-end gap-[3px]">
                    {dayBars.map((v, i) => (
                      <View
                        key={i}
                        className={`w-[5px] rounded-full ${v > 0 ? 'bg-primary' : 'bg-primary/20'}`}
                        style={{ height: Math.max(6, Math.round((v / maxBar) * 24)) }}
                      />
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* ── Goal ── */}
        {topGoal && gp && (
          <Card>
            <View className="flex-row items-center justify-between">
              <View className="flex-1 flex-row items-center gap-2">
                <Target color="#9CFF00" size={16} />
                <Text className="text-foreground font-semibold">{topGoal.name}</Text>
              </View>
              <Text className="text-muted-foreground text-sm">
                {gp.current}/{gp.target}
              </Text>
            </View>
            <View className="mt-3">
              <ProgressBar value={gp.pct} />
            </View>
          </Card>
        )}

        {/* ── Workout programs: chips + today's featured card ── */}
        <View>
          <Text className="text-foreground mb-3 text-base font-extrabold">Workout Programs</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2"
          >
            {['All type', ...state.categories.map((c) => c.name)].map((c) => (
              <Pressable
                key={c}
                onPress={() => setFilter(c)}
                className={`rounded-full px-4 py-2 ${filter === c ? 'bg-primary' : 'bg-secondary'}`}
              >
                <Text
                  className={`text-xs font-bold ${filter === c ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  {c}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Card className="mt-3">
            <Text className="text-muted-foreground text-xs font-semibold">Today</Text>
            <Text className="text-foreground mt-1 text-lg font-extrabold">
              {focus ?? 'Rest & recover'}
            </Text>
            <Text className="text-muted-foreground mt-1 text-xs">
              {week.workouts > 0
                ? `${week.workouts} session${week.workouts === 1 ? '' : 's'} logged this week`
                : 'No sessions logged yet this week'}
            </Text>
          </Card>
        </View>

        {/* ── Recent workouts ── */}
        <View>
          <Text className="text-foreground mb-2 text-base font-extrabold">Recent Workouts</Text>
          <View className="gap-2">
            {filtered.length === 0 && (
              <Card>
                <Text className="text-muted-foreground text-sm">
                  Nothing here yet — tap + to start.
                </Text>
              </Card>
            )}
            {filtered.map((s) => {
              const cat = state.categories.find((c) => c.id === s.categoryId);
              const meta = INTENSITY_META[s.intensity];
              return (
                <Card key={s.id}>
                  <View className="flex-row items-center gap-3">
                    <Pressable
                      className="flex-1 flex-row items-center gap-3"
                      onPress={() => setDetailSession(s)}
                    >
                      <View
                        className="h-10 w-10 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${cat?.color ?? CATEGORY_FALLBACK_COLOR}1a` }}
                      >
                        <CategoryIcon
                          name={cat?.icon ?? 'activity'}
                          color={cat?.color ?? CATEGORY_FALLBACK_COLOR}
                          size={18}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-foreground text-sm font-semibold">{s.title}</Text>
                        <Text className="text-muted-foreground text-xs">
                          {relativeDay(s.date)} · {formatMinutes(s.durationMin)} ·{' '}
                          <Text style={{ color: meta.color }}>{meta.label}</Text>
                          {s.distanceKm ? ` · ${formatDistance(s.distanceKm)}` : ''}
                          {s.exercises?.length
                            ? ` · ${s.exercises.length} exercise${s.exercises.length === 1 ? '' : 's'}`
                            : ''}
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable onPress={() => deleteSession(s.id)} hitSlop={8}>
                      <Trash2 color="#FF6B5E" size={18} />
                    </Pressable>
                  </View>
                </Card>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <LogWorkoutModal open={logOpen} onClose={() => setLogOpen(false)} />
      <SessionDetailModal session={detailSession} onClose={() => setDetailSession(null)} />
    </SafeAreaView>
  );
}
