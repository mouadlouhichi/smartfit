import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Plus, Target, Trash2, X } from 'lucide-react-native';
import {
  GOAL_METRIC_META,
  goalProgress,
  toISODate,
  type GoalCadence,
  type GoalMetric,
} from '@smartfit/core';
import { useStore } from '@/lib/store';
import { Button, Card, Input, ProgressBar } from '@/components/ui';
import { CategoryIcon } from '@/components/CategoryIcon';

const METRICS: GoalMetric[] = ['workouts', 'minutes', 'calories', 'distance'];

export default function GoalsScreen() {
  const { state, addGoal, deleteGoal } = useStore();
  const [open, setOpen] = useState(false);
  const [metric, setMetric] = useState<GoalMetric>('workouts');
  const [cadence, setCadence] = useState<GoalCadence>('weekly');
  const [target, setTarget] = useState('5');

  const goals = useMemo(() => state.goals.map((g) => ({ g, p: goalProgress(state, g) })), [state]);
  const done = goals.filter((x) => x.p.done).length;

  function create() {
    const meta = GOAL_METRIC_META[metric];
    addGoal({
      name: `${meta.label} goal`,
      metric,
      cadence,
      target: Number(target) || 1,
      startDate: toISODate(new Date()),
    });
    setOpen(false);
  }

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-28 gap-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-foreground text-2xl font-bold">Goals</Text>
            <Text className="text-muted-foreground text-sm">
              {done}/{goals.length} hit this period
            </Text>
          </View>
          <Pressable
            onPress={() => setOpen(true)}
            className="bg-primary h-12 w-12 items-center justify-center rounded-full"
          >
            <Plus color="#101010" size={24} />
          </Pressable>
        </View>

        {goals.length === 0 && (
          <Card>
            <View className="items-center gap-2 py-6">
              <Target color="#f3ff47" size={32} />
              <Text className="text-muted-foreground text-center text-sm">
                Set a weekly or monthly target to stay accountable.
              </Text>
            </View>
          </Card>
        )}

        {goals.map(({ g, p }) => {
          const meta = GOAL_METRIC_META[g.metric];
          return (
            <Card key={g.id} className={p.done ? 'border-primary' : ''}>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-row items-center gap-3">
                  <View className="bg-primary/10 h-11 w-11 items-center justify-center rounded-xl">
                    <CategoryIcon name={meta.icon} color="#f3ff47" size={20} />
                  </View>
                  <View>
                    <Text className="text-foreground font-semibold">{g.name}</Text>
                    <Text className="text-muted-foreground text-xs">
                      {meta.label} · resets {g.cadence}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => deleteGoal(g.id)} hitSlop={8}>
                  <Trash2 color="#DC2626" size={18} />
                </Pressable>
              </View>
              <View className="mt-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-foreground text-sm font-semibold">
                    {p.current}{' '}
                    <Text className="text-muted-foreground font-normal">
                      / {p.target} {meta.unit}
                    </Text>
                  </Text>
                  {p.done ? (
                    <View className="flex-row items-center gap-1">
                      <CheckCircle2 color="#f3ff47" size={16} />
                      <Text className="text-primary text-xs font-semibold">Done</Text>
                    </View>
                  ) : (
                    <Text className="text-muted-foreground text-xs">{Math.round(p.pct)}%</Text>
                  )}
                </View>
                <View className="mt-2">
                  <ProgressBar value={p.pct} />
                </View>
              </View>
            </Card>
          );
        })}
      </ScrollView>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View className="bg-background flex-1 p-5">
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-foreground text-lg font-bold">New goal</Text>
            <Pressable onPress={() => setOpen(false)} className="active:bg-muted rounded-full p-2">
              <X color="#a3a3a3" size={22} />
            </Pressable>
          </View>
          <ScrollView contentContainerClassName="gap-4 pt-4">
            <View>
              <Text className="text-foreground/80 mb-1.5 text-sm font-medium">Metric</Text>
              <View className="flex-row flex-wrap gap-2">
                {METRICS.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setMetric(m)}
                    className="rounded-full border px-3 py-2"
                    style={{
                      borderColor: metric === m ? '#f3ff47' : '#2b2b2b',
                      backgroundColor: metric === m ? '#f3ff4722' : 'transparent',
                    }}
                  >
                    <Text
                      style={{ color: metric === m ? '#f3ff47' : '#a3a3a3' }}
                      className="text-sm font-medium"
                    >
                      {GOAL_METRIC_META[m].label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View>
              <Text className="text-foreground/80 mb-1.5 text-sm font-medium">Reset</Text>
              <View className="flex-row gap-2">
                {(['weekly', 'monthly'] as GoalCadence[]).map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCadence(c)}
                    className="flex-1 rounded-full border py-2"
                    style={{
                      borderColor: cadence === c ? '#f3ff47' : '#2b2b2b',
                      backgroundColor: cadence === c ? '#f3ff4722' : 'transparent',
                    }}
                  >
                    <Text
                      className="text-center text-sm font-medium capitalize"
                      style={{ color: cadence === c ? '#f3ff47' : '#a3a3a3' }}
                    >
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View>
              <Text className="text-foreground/80 mb-1.5 text-sm font-medium">
                Target ({GOAL_METRIC_META[metric].unit})
              </Text>
              <Input keyboardType="numeric" value={target} onChangeText={setTarget} />
            </View>
            <Button label="Create goal" onPress={create} />
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
