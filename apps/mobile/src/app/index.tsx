import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarCheck2, Clock, Flame, Footprints, Plus, Trash2 } from 'lucide-react-native';
import { Pressable } from 'react-native';
import {
  currentStreak,
  formatCalories,
  formatDistance,
  formatMinutes,
  goalProgress,
  thisWeek,
  todaysFocus,
  getPlan,
  relativeDay,
  INTENSITY_META,
} from '@smartfit/core';
import { useStore } from '@/lib/store';
import { Badge, Card, ProgressBar } from '@/components/ui';
import { CategoryIcon } from '@/components/CategoryIcon';
import { LogWorkoutModal } from '@/components/LogWorkoutModal';
import { SessionDetailModal } from '@/components/SessionDetailModal';
import type { WorkoutSession } from '@smartfit/core';

export default function HomeScreen() {
  const { state, ready, deleteSession } = useStore();
  const [logOpen, setLogOpen] = useState(false);
  const [detailSession, setDetailSession] = useState<WorkoutSession | null>(null);

  if (!ready) {
    return (
      <SafeAreaView className="bg-background flex-1">
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted-foreground">Loading your training…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const week = thisWeek(state);
  const streak = currentStreak(state);
  const plan = getPlan(state.profile.planId);
  const focus = todaysFocus(state);
  const recent = state.sessions.slice(0, 4);
  const topGoal = state.goals[0];
  const gp = topGoal ? goalProgress(state, topGoal) : null;

  const stats = [
    { icon: Flame, label: 'Streak', value: `${streak}`, sub: 'days', color: '#F59E0B' },
    {
      icon: CalendarCheck2,
      label: 'Workouts',
      value: `${week.workouts}`,
      sub: 'this week',
      color: '#16A34A',
    },
    {
      icon: Clock,
      label: 'Active',
      value: formatMinutes(week.minutes),
      sub: 'this week',
      color: '#0EA5E9',
    },
    {
      icon: Footprints,
      label: 'Distance',
      value: formatDistance(week.distance),
      sub: formatCalories(week.calories),
      color: '#8B5CF6',
    },
  ];

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-28 gap-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-muted-foreground text-sm">{plan.name}</Text>
            <Text className="text-foreground text-2xl font-bold">SmartFit</Text>
          </View>
          <Pressable
            onPress={() => setLogOpen(true)}
            className="bg-primary h-12 w-12 items-center justify-center rounded-full"
          >
            <Plus color="#FDF6F2" size={24} />
          </Pressable>
        </View>

        {/* Today */}
        <Card className="bg-primary">
          <Text className="text-primary-foreground/80 text-sm font-medium">Today</Text>
          <Text className="text-primary-foreground mt-1 text-lg font-bold">
            {focus ?? 'Rest & recover'}
          </Text>
          <Text className="text-primary-foreground/80 mt-1 text-sm">
            {week.workouts > 0
              ? `${week.workouts} session${week.workouts === 1 ? '' : 's'} logged this week`
              : 'No sessions logged yet this week'}
          </Text>
        </Card>

        {/* Stats */}
        <View className="flex-row flex-wrap gap-3">
          {stats.map((s) => (
            <View key={s.label} className="min-w-[44%] flex-1">
              <Card>
                <View className="flex-row items-center gap-3">
                  <View
                    className="h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${s.color}1a` }}
                  >
                    <s.icon color={s.color} size={20} />
                  </View>
                  <View>
                    <Text className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      {s.label}
                    </Text>
                    <Text className="text-foreground text-xl font-bold">{s.value}</Text>
                  </View>
                </View>
                <Text className="text-muted-foreground mt-2 text-xs">{s.sub}</Text>
              </Card>
            </View>
          ))}
        </View>

        {topGoal && gp && (
          <Card>
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground font-semibold">{topGoal.name}</Text>
              <Text className="text-muted-foreground text-sm">
                {gp.current}/{gp.target}
              </Text>
            </View>
            <View className="mt-3">
              <ProgressBar value={gp.pct} />
            </View>
          </Card>
        )}

        <View>
          <Text className="text-muted-foreground mb-2 text-sm font-semibold tracking-wide uppercase">
            Recent workouts
          </Text>
          <View className="gap-2">
            {recent.length === 0 && (
              <Card>
                <Text className="text-muted-foreground text-sm">
                  Nothing logged yet — tap + to start.
                </Text>
              </Card>
            )}
            {recent.map((s) => {
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
                        style={{ backgroundColor: `${cat?.color ?? '#64748b'}1a` }}
                      >
                        <CategoryIcon
                          name={cat?.icon ?? 'activity'}
                          color={cat?.color ?? '#64748b'}
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
                      <Trash2 color="#DC2626" size={18} />
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
