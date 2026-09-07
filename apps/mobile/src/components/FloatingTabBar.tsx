import React, { useEffect, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { CalendarCheck2, Home, LineChart, Target, UserRound, type LucideIcon } from 'lucide-react-native';

const EMBER = '#D6532F';
const INK = '#181615';
const INACTIVE = 'rgba(255,255,255,0.55)';

const ICONS: Record<string, LucideIcon> = {
  index: Home,
  plan: CalendarCheck2,
  progress: LineChart,
  goals: Target,
  profile: UserRound,
};

const SPRING = { damping: 22, stiffness: 280, mass: 0.85 } as const;

type FloatingTabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

/** Floating dark-pill tab bar with a sliding ember indicator. */
export function FloatingTabBar({ state, navigation }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const [barWidth, setBarWidth] = useState(Math.min(screenW - 28, 420));

  const innerW = Math.max(0, barWidth - 12);
  const itemW = state.routes.length ? innerW / state.routes.length : 0;
  const pillX = useSharedValue(state.index * itemW);

  useEffect(() => {
    pillX.value = withSpring(state.index * itemW, SPRING);
  }, [state.index, itemW, pillX]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: Math.max(itemW, 0),
  }));

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 12, alignItems: 'center' }}>
      <View
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        style={{
          width: Math.min(screenW - 28, 420),
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 999,
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.08)',
          backgroundColor: 'rgba(24,22,21,0.96)',
          paddingVertical: 4,
          paddingHorizontal: 6,
          shadowColor: '#000',
          shadowOpacity: 0.5,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: 16,
        }}
      >
        {/* sliding ember pill */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: 6,
              borderRadius: 999,
              backgroundColor: EMBER,
            },
            pillStyle,
          ]}
        />
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const Icon = ICONS[route.name] ?? Home;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}
            >
              <Icon color={focused ? INK : INACTIVE} size={22} strokeWidth={focused ? 2.6 : 2} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
