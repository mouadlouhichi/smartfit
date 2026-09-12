import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { categoryBreakdown, formatMinutes, INTENSITY_META, weeklySeries } from '@smartfit/core';
import { useStore } from '@/lib/store';
import { Card, ProgressBar } from '@/components/ui';
import { BarChart } from '@/components/BarChart';
import { CategoryIcon } from '@/components/CategoryIcon';

export default function ProgressScreen() {
  const { state } = useStore();
  const series = useMemo(
    () => weeklySeries(state, 8).map((w) => ({ label: w.label.slice(0, 3), value: w.minutes })),
    [state],
  );
  const breakdown = useMemo(() => categoryBreakdown(state), [state]);
  const totalMin = breakdown.reduce((a, x) => a + x.minutes, 0);

  const intensity = (['low', 'moderate', 'high'] as const)
    .map((k) => ({
      key: k,
      label: INTENSITY_META[k].label,
      color: INTENSITY_META[k].color,
      count: state.sessions.filter((s) => s.intensity === k).length,
    }))
    .filter((x) => x.count > 0);
  const totalIntensity = intensity.reduce((a, x) => a + x.count, 0);

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-28 gap-4">
        <View>
          <Text className="text-foreground text-2xl font-bold">Progress</Text>
          <Text className="text-muted-foreground text-sm">
            Active minutes over the last 8 weeks.
          </Text>
        </View>

        <Card>
          <Text className="text-foreground mb-3 font-semibold">Weekly active minutes</Text>
          <BarChart data={series} color="#f3ff47" />
        </Card>

        <Card>
          <Text className="text-foreground mb-3 font-semibold">Time by activity</Text>
          <View className="gap-3">
            {breakdown.map(({ category, minutes }) => (
              <View key={category.id} className="flex-row items-center gap-3">
                <View
                  className="h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${category.color}1a` }}
                >
                  <CategoryIcon name={category.icon} color={category.color} size={16} />
                </View>
                <View className="flex-1">
                  <View className="flex-row justify-between">
                    <Text className="text-foreground text-sm font-medium">{category.name}</Text>
                    <Text className="text-muted-foreground text-xs">{formatMinutes(minutes)}</Text>
                  </View>
                  <View className="mt-1.5">
                    <ProgressBar value={(minutes / (totalMin || 1)) * 100} color={category.color} />
                  </View>
                </View>
              </View>
            ))}
            {breakdown.length === 0 && (
              <Text className="text-muted-foreground text-sm">No data yet.</Text>
            )}
          </View>
        </Card>

        <Card>
          <Text className="text-foreground mb-3 font-semibold">Intensity spread</Text>
          <View className="gap-3">
            {intensity.map((d) => (
              <View key={d.key}>
                <View className="flex-row justify-between">
                  <Text className="text-foreground text-sm font-medium">{d.label}</Text>
                  <Text className="text-muted-foreground text-xs">
                    {d.count} · {Math.round((d.count / (totalIntensity || 1)) * 100)}%
                  </Text>
                </View>
                <View className="mt-1.5">
                  <ProgressBar value={(d.count / (totalIntensity || 1)) * 100} color={d.color} />
                </View>
              </View>
            ))}
            {intensity.length === 0 && (
              <Text className="text-muted-foreground text-sm">No data yet.</Text>
            )}
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
