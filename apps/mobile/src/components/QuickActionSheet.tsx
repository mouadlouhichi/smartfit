import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Activity,
  ClipboardPlus,
  Dumbbell,
  Footprints,
  LineChart,
  Sparkles,
  Target,
  Utensils,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { createTranslator, resolveLocale } from '@smartfit/core';
import { useStore } from '@/lib/store';

export type QuickAction =
  'workout' | 'meal' | 'run' | 'measurement' | 'goals' | 'plan' | 'progress' | 'coach';

type ActionOption = {
  id: QuickAction;
  labelKey:
    | 'quickActions.workout'
    | 'quickActions.meal'
    | 'quickActions.run'
    | 'quickActions.measurement'
    | 'quickActions.goals'
    | 'quickActions.plan'
    | 'quickActions.progress'
    | 'quickActions.coach';
  icon: LucideIcon;
};

const ACTIONS: ActionOption[] = [
  { id: 'workout', labelKey: 'quickActions.workout', icon: Dumbbell },
  { id: 'meal', labelKey: 'quickActions.meal', icon: Utensils },
  { id: 'run', labelKey: 'quickActions.run', icon: Footprints },
  { id: 'measurement', labelKey: 'quickActions.measurement', icon: ClipboardPlus },
  { id: 'goals', labelKey: 'quickActions.goals', icon: Target },
  { id: 'plan', labelKey: 'quickActions.plan', icon: Activity },
  { id: 'progress', labelKey: 'quickActions.progress', icon: LineChart },
  { id: 'coach', labelKey: 'quickActions.coach', icon: Sparkles },
];

export function QuickActionSheet({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (action: QuickAction) => void;
}) {
  const { state } = useStore();
  const locale = resolveLocale(state.profile.locale);
  const t = useMemo(() => createTranslator(locale), [locale]);

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('action.close')}
          onPress={onClose}
          className="absolute inset-0 bg-black/60"
        />
        <SafeAreaView
          edges={['bottom']}
          className="bg-card border-border rounded-t-[30px] border-t px-5 pt-3"
          style={{ maxHeight: '82%', paddingBottom: 16 }}
        >
          <View className="mb-5 items-center">
            <View className="bg-muted mb-4 h-1.5 w-10 rounded-full" />
            <View className="w-full flex-row items-start justify-between">
              <View className="flex-1 pr-4">
                <Text className="text-foreground text-xl font-bold">{t('quickActions.title')}</Text>
                <Text className="text-muted-foreground mt-1 text-sm">
                  {t('quickActions.description')}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('action.close')}
                onPress={onClose}
                className="bg-muted h-10 w-10 items-center justify-center rounded-full"
              >
                <X color="#d4d4d4" size={19} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="flex-row flex-wrap gap-3 pb-4"
          >
            {ACTIONS.map(({ id, labelKey, icon: Icon }) => (
              <Pressable
                key={id}
                accessibilityRole="button"
                onPress={() => onSelect(id)}
                className="bg-background border-border min-h-[112px] flex-grow justify-between rounded-2xl border p-4 active:opacity-80"
                style={{ width: '47%' }}
              >
                <View className="bg-primary/10 h-10 w-10 items-center justify-center rounded-full">
                  <Icon color="#f3ff47" size={19} strokeWidth={2.2} />
                </View>
                <Text className="text-foreground mt-4 text-sm font-semibold">{t(labelKey)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
