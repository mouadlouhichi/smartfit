import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CalendarCheck2,
  Clock,
  Flame,
  Footprints,
  Plus,
  Trash2,
} from 'lucide-react-native';
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

export default function HomeScreen() {
  const { state, ready, deleteSession } = useStore();
  const [logOpen, setLogOpen] = useState(false);

  if (!ready) {
    return (
      <SafeAreaView className="flex-1 bg-background">
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
    { icon: CalendarCheck2, label: 'Workouts', value: `${week.workouts}`, sub: 'this week', color: '#16A34A' },
    { icon: Clock, label: 'Active', value: formatMinutes(week.minutes), sub: 'this week', color: '#0EA5E9' },
    { icon: Footprints, label: 'Distance', value: formatDistance(week.distance), sub: formatCalories(week.calories), color: '#8B5CF6' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-28 gap-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-sm text-muted-foreground">
              {plan.name}
            </Text>
            <Text className="text-2xl font-bold text-foreground">SmartFit</Text>
          </View>
          <Pressable
            onPress={() => setLogOpen(true)}
            className="h-12 w-12 items-center justify-center rounded-full bg-primary"
          >
            <Plus color="#0B0E09" size={24} />
          </Pressable>
        </View>

        {/* Today */}
        <Card className="bg-primary">
          <Text className="text-sm font-medium text-primary-foreground/80">Today</Text>
          <Text className="mt-1 text-lg font-bold text-primary-foreground">
            {focus ?? 'Rest & recover'}
          </Text>
          <Text className="mt-1 text-sm text-primary-foreground/80">
            {week.workouts > 0 ? `${week.workouts} session${week.workouts === 1 ? '' : 's'} logged this week` : 'No sessions logged yet this week'}
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
                    <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {s.label}
                    </Text>
                    <Text className="text-xl font-bold text-foreground">{s.value}</Text>
                  </View>
                </View>
                <Text className="mt-2 text-xs text-muted-foreground">{s.sub}</Text>
              </Card>
            </View>
          ))}
        </View>

        {topGoal && gp && (
          <Card>
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold text-foreground">{topGoal.name}</Text>
              <Text className="text-sm text-muted-foreground">
                {gp.current}/{gp.target}
              </Text>
            </View>
            <View className="mt-3">
              <ProgressBar value={gp.pct} />
            </View>
          </Card>
        )}

        <View>
          <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent workouts
          </Text>
          <View className="gap-2">
            {recent.length === 0 && (
              <Card>
                <Text className="text-sm text-muted-foreground">Nothing logged yet — tap + to start.</Text>
              </Card>
            )}
            {recent.map((s) => {
              const cat = state.categories.find((c) => c.id === s.categoryId);
              const meta = INTENSITY_META[s.intensity];
              return (
                <Card key={s.id}>
                  <View className="flex-row items-center gap-3">
                    <View
                      className="h-10 w-10 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${cat?.color ?? '#64748b'}1a` }}
                    >
                      <CategoryIcon name={cat?.icon ?? 'activity'} color={cat?.color ?? '#64748b'} size={18} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-foreground">{s.title}</Text>
                      <Text className="text-xs text-muted-foreground">
                        {relativeDay(s.date)} · {formatMinutes(s.durationMin)} ·{' '}
                        <Text style={{ color: meta.color }}>{meta.label}</Text>
                        {s.distanceKm ? ` · ${formatDistance(s.distanceKm)}` : ''}
                      </Text>
                    </View>
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
    </SafeAreaView>
  );
}
