import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  CalendarCheck2,
  Home,
  LineChart,
  Plus,
  Target,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { createTranslator, resolveLocale } from '@smartfit/core';
import { useStore } from '@/lib/store';
import { useQuickActions } from '@/components/QuickActionsProvider';

const VOLT = '#f3ff47';
const INK = '#101010';
const INACTIVE = 'rgba(255,255,255,0.55)';

const ICONS: Record<string, LucideIcon> = {
  index: Home,
  plan: CalendarCheck2,
  progress: LineChart,
  goals: Target,
  profile: UserRound,
};

const LABEL_KEYS: Record<
  string,
  | 'nav.short.home'
  | 'nav.short.plan'
  | 'nav.short.progress'
  | 'nav.short.goals'
  | 'nav.short.profile'
> = {
  index: 'nav.short.home',
  plan: 'nav.short.plan',
  progress: 'nav.short.progress',
  goals: 'nav.short.goals',
  profile: 'nav.short.profile',
};

const SPRING = { damping: 22, stiffness: 280, mass: 0.85 } as const;

type FloatingTabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string) => void;
  };
};

/** Floating dark-pill tabs with an elevated quick-add action and sliding Volt indicator. */
export function FloatingTabBar({ state, navigation }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { state: storeState } = useStore();
  const { openQuickActions } = useQuickActions();
  const locale = resolveLocale(storeState.profile.locale);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const [barWidth, setBarWidth] = useState(Math.min(screenW - 28, 420));
  const activeRoute = state.routes[state.index];

  // Coach is a pushed, hidden route rather than a sixth navigation destination.
  const hidden = activeRoute?.name === 'coach' || activeRoute?.name === 'run';
  const visibleRoutes = state.routes.filter((route) => Boolean(ICONS[route.name]));
  const visibleIndex = visibleRoutes.findIndex((route) => route.key === activeRoute?.key);
  const slotCount = visibleRoutes.length + 1;
  const innerW = Math.max(0, barWidth - 12);
  const itemW = slotCount ? innerW / slotCount : 0;
  const activeSlot = visibleIndex < 2 ? visibleIndex : visibleIndex + 1;
  const pillX = useSharedValue(Math.max(0, activeSlot) * itemW);

  useEffect(() => {
    pillX.value = withSpring(Math.max(0, activeSlot) * itemW, SPRING);
  }, [activeSlot, itemW, pillX]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: Math.max(itemW, 0),
  }));

  if (hidden) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + 12,
        alignItems: 'center',
      }}
    >
      <View
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        style={{
          width: Math.min(screenW - 28, 420),
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 999,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          backgroundColor: 'rgba(18,18,18,0.96)',
          paddingVertical: 4,
          paddingHorizontal: 6,
          shadowColor: '#000',
          shadowOpacity: 0.5,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: 16,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: 6,
              borderRadius: 999,
              backgroundColor: VOLT,
            },
            pillStyle,
          ]}
        />
        {visibleRoutes.map((route, index) => {
          const focused = route.key === activeRoute?.key;
          const Icon = ICONS[route.name] ?? Home;
          const labelKey = LABEL_KEYS[route.name];
          return (
            <React.Fragment key={route.key}>
              {index === 2 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('quickActions.open')}
                  onPress={openQuickActions}
                  style={{
                    width: itemW,
                    minHeight: 52,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 22,
                      backgroundColor: VOLT,
                      shadowColor: VOLT,
                      shadowOpacity: 0.28,
                      shadowRadius: 11,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 7,
                    }}
                  >
                    <Plus color={INK} size={23} strokeWidth={2.8} />
                  </View>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={labelKey ? t(labelKey) : route.name}
                accessibilityState={{ selected: focused }}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    void Haptics.selectionAsync().catch(() => {});
                    navigation.navigate(route.name);
                  }
                }}
                style={{
                  width: itemW,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                }}
              >
                <Icon color={focused ? INK : INACTIVE} size={22} strokeWidth={focused ? 2.6 : 2} />
              </Pressable>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}
