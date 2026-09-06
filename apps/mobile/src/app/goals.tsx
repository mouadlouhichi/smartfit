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
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-28 gap-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">Goals</Text>
            <Text className="text-sm text-muted-foreground">
              {done}/{goals.length} hit this period
            </Text>
          </View>
          <Pressable onPress={() => setOpen(true)} className="h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Plus color="#0B0E09" size={24} />
          </Pressable>
        </View>

        {goals.length === 0 && (
          <Card>
            <View className="items-center gap-2 py-6">
              <Target color="#C8F135" size={32} />
              <Text className="text-center text-sm text-muted-foreground">
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
                  <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                    <CategoryIcon name={meta.icon} color="#C8F135" size={20} />
                  </View>
                  <View>
                    <Text className="font-semibold text-foreground">{g.name}</Text>
                    <Text className="text-xs text-muted-foreground">
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
                  <Text className="text-sm font-semibold text-foreground">
                    {p.current} <Text className="font-normal text-muted-foreground">/ {p.target} {meta.unit}</Text>
                  </Text>
                  {p.done ? (
                    <View className="flex-row items-center gap-1">
                      <CheckCircle2 color="#C8F135" size={16} />
                      <Text className="text-xs font-semibold text-primary">Done</Text>
                    </View>
                  ) : (
                    <Text className="text-xs text-muted-foreground">{Math.round(p.pct)}%</Text>
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
        <View className="flex-1 bg-background p-5">
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-lg font-bold text-foreground">New goal</Text>
            <Pressable onPress={() => setOpen(false)} className="rounded-full p-2 active:bg-muted">
              <X color="#9BA886" size={22} />
            </Pressable>
          </View>
          <ScrollView contentContainerClassName="gap-4 pt-4">
            <View>
              <Text className="mb-1.5 text-sm font-medium text-foreground/80">Metric</Text>
              <View className="flex-row flex-wrap gap-2">
                {METRICS.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setMetric(m)}
                    className="rounded-full border px-3 py-2"
                    style={{ borderColor: metric === m ? '#C8F135' : '#273019', backgroundColor: metric === m ? '#C8F13522' : 'transparent' }}
                  >
                    <Text style={{ color: metric === m ? '#C8F135' : '#9BA886' }} className="text-sm font-medium">
                      {GOAL_METRIC_META[m].label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View>
              <Text className="mb-1.5 text-sm font-medium text-foreground/80">Reset</Text>
              <View className="flex-row gap-2">
                {(['weekly', 'monthly'] as GoalCadence[]).map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCadence(c)}
                    className="flex-1 rounded-full border py-2"
                    style={{ borderColor: cadence === c ? '#C8F135' : '#273019', backgroundColor: cadence === c ? '#C8F13522' : 'transparent' }}
                  >
                    <Text className="text-center text-sm font-medium capitalize" style={{ color: cadence === c ? '#C8F135' : '#9BA886' }}>
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View>
              <Text className="mb-1.5 text-sm font-medium text-foreground/80">
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
