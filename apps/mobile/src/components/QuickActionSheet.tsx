import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Activity,
  ClipboardPlus,
  Dumbbell,
  Footprints,
  HeartPulse,
  LineChart,
  Moon,
  Sparkles,
  Target,
  Utensils,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { createTranslator, resolveLocale } from '@smartfit/core';
import { useStore } from '@/lib/store';

export type QuickAction =
  | 'workout'
  | 'meal'
  | 'run'
  | 'measurement'
  | 'sleep'
  | 'vitals'
  | 'goals'
  | 'plan'
  | 'progress'
  | 'coach';

type ActionOption = {
  id: QuickAction;
  label: string;
  icon: LucideIcon;
  iconColor: string;
};

const ACTIONS: ActionOption[] = [
  { id: 'workout', label: 'Log workout', icon: Dumbbell, iconColor: '#f3ff47' },
  { id: 'meal', label: 'Log meal', icon: Utensils, iconColor: '#f3ff47' },
  { id: 'run', label: 'Start run', icon: Footprints, iconColor: '#f3ff47' },
  { id: 'measurement', label: 'Weight / Measure', icon: ClipboardPlus, iconColor: '#f3ff47' },
  { id: 'sleep', label: 'Log sleep', icon: Moon, iconColor: '#8b5cf6' },
  { id: 'vitals', label: 'Log vitals', icon: HeartPulse, iconColor: '#f43f5e' },
  { id: 'goals', label: 'Goals', icon: Target, iconColor: '#f3ff47' },
  { id: 'plan', label: 'Plan', icon: Activity, iconColor: '#f3ff47' },
  { id: 'progress', label: 'Trends', icon: LineChart, iconColor: '#f3ff47' },
  { id: 'coach', label: 'Coach', icon: Sparkles, iconColor: '#f3ff47' },
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
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)' }}
        />
        <SafeAreaView
          edges={['bottom']}
          style={{
            backgroundColor: '#161616',
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            padding: 20,
            paddingTop: 12,
            maxHeight: '82%',
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                height: 5,
                width: 36,
                borderRadius: 4,
                marginBottom: 16,
              }}
            />
            <View
              style={{
                width: '100%',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <View style={{ flex: 1, paddingRight: 16 }}>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>
                  Quick actions
                </Text>
                <Text style={{ color: '#9ca3af', marginTop: 4, fontSize: 13 }}>
                  Log something, start a workout, or jump to a tool.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  height: 40,
                  width: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X color="#d4d4d4" size={19} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 12,
              paddingBottom: 16,
            }}
          >
            {ACTIONS.map(({ id, label, icon: Icon, iconColor }) => (
              <Pressable
                key={id}
                accessibilityRole="button"
                onPress={() => onSelect(id)}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? 'rgba(255,255,255,0.06)' : '#0E0E0E',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                  minHeight: 112,
                  flexGrow: 1,
                  justifyContent: 'space-between',
                  borderRadius: 18,
                  padding: 16,
                  width: '47%',
                })}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    backgroundColor: `${iconColor}20`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon color={iconColor} size={20} strokeWidth={2.2} />
                </View>
                <Text style={{ color: '#fff', marginTop: 16, fontSize: 13, fontWeight: '700' }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
