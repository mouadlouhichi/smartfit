import React from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatMinutes, INTENSITY_META, WEEKDAYS_LONG } from '@smartfit/core';
import { useStore } from '@/lib/store';
import { Card } from '@/components/ui';
import { CategoryIcon } from '@/components/CategoryIcon';

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
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-28 gap-4">
        <View>
          <Text className="text-2xl font-bold text-foreground">Training plan</Text>
          <Text className="text-sm text-muted-foreground">
            {state.schedule.filter((s) => s.active).length} active sessions · tap the switch to rest a day.
          </Text>
        </View>

        {WEEKDAYS_LONG.map((day, i) => {
          const items = (byDay.get(i) ?? []).sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay));
          const isToday = i === today;
          return (
            <Card key={day} className={isToday ? 'border-primary' : ''}>
              <View className="flex-row items-center justify-between">
                <Text className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                  {day} {isToday ? '· today' : ''}
                </Text>
                {items.length === 0 && <Text className="text-xs text-muted-foreground">Rest</Text>}
              </View>
              <View className="mt-2 gap-2">
                {items.map((s) => {
                  const cat = state.categories.find((c) => c.id === s.categoryId);
                  const meta = INTENSITY_META[s.intensity];
                  return (
                    <View key={s.id} className="flex-row items-center gap-3 rounded-xl bg-muted/60 p-3">
                      <View
                        className="h-9 w-9 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${cat?.color ?? '#64748b'}1a` }}
                      >
                        <CategoryIcon name={cat?.icon ?? 'activity'} color={cat?.color ?? '#64748b'} size={16} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-foreground">{s.title}</Text>
                        <Text className="text-xs text-muted-foreground">
                          {s.timeOfDay} · {formatMinutes(s.durationMin)} ·{' '}
                          <Text style={{ color: meta.color }}>{meta.label}</Text>
                        </Text>
                      </View>
                      <Switch
                        value={s.active}
                        onValueChange={(v) => updateSchedule(s.id, { active: v })}
                        trackColor={{ true: '#C8F135', false: '#1B2113' }}
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
