import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import { Dumbbell } from 'lucide-react-native';
import { exerciseImages, matchExercise } from '@smartfit/core';

/**
 * Demonstration thumbnail for a (free-text) exercise name.
 *
 * The shared catalog maps the name to the open exercise dataset, which
 * provides two frames per movement (start & end position). Crossfading
 * them on a loop gives a GIF-style preview. Unknown names render a
 * neutral dumbbell tile so rows stay aligned.
 */
export function ExerciseDemo({
  name,
  size = 44,
  animated = true,
  radius = 10,
}: {
  name: string;
  size?: number;
  /** Crossfade the frames; false renders the static start position. */
  animated?: boolean;
  radius?: number;
}) {
  const entry = useMemo(() => matchExercise(name), [name]);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!entry || !animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1300),
        Animated.timing(progress, {
          toValue: 1,
          duration: 350,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(1300),
        Animated.timing(progress, {
          toValue: 0,
          duration: 350,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [entry, animated, progress]);

  if (!entry) {
    return (
      <View
        accessibilityElementsHidden
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: '#ECEAE6',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Dumbbell color="#857D75" size={size * 0.5} strokeWidth={1.75} />
      </View>
    );
  }

  const [start, end] = exerciseImages(entry);
  const frameStyle = {
    position: 'absolute' as const,
    width: size,
    height: size,
    borderRadius: radius,
    resizeMode: 'contain' as const,
  };

  return (
    <View style={{ width: size, height: size }}>
      <Animated.Image
        source={{ uri: start }}
        accessibilityLabel={`${entry.name} demonstration`}
        style={
          animated
            ? {
                ...frameStyle,
                opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              }
            : frameStyle
        }
      />
      {animated && (
        <Animated.Image source={{ uri: end }} style={{ ...frameStyle, opacity: progress }} />
      )}
    </View>
  );
}
