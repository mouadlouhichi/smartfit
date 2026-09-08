import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import { Dumbbell } from 'lucide-react-native';
import { exerciseGifUrl, exerciseImages, matchExercise } from '@smartfit/core';

/**
 * Demonstration thumbnail for a (free-text) exercise name.
 *
 * Preferred source: the catalog's curated ExerciseDB-style animated GIFs —
 * looping illustrations with the target muscle highlighted in red (React
 * Native renders animated WebP/GIF natively). The default `thumb` variant
 * is a light 128px animated WebP; `variant="full"` requests the full-size
 * GIF for the how-to sheet.
 *
 * Exercises without a curated GIF — or when the GIF CDN fails to load —
 * fall back to the two-frame photo crossfade. Unknown names render a
 * neutral dumbbell tile so rows stay aligned.
 */
export function ExerciseDemo({
  name,
  size = 44,
  animated = true,
  radius = 10,
  variant = 'thumb',
}: {
  name: string;
  size?: number;
  /** Crossfade the fallback frames; false renders the static start position. */
  animated?: boolean;
  radius?: number;
  /** GIF size: light animated thumb for tiles, full GIF for the how-to sheet. */
  variant?: 'thumb' | 'full';
}) {
  const entry = useMemo(() => matchExercise(name), [name]);
  const [failedGifFor, setFailedGifFor] = useState<string | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  const gif = entry && failedGifFor !== entry.id ? exerciseGifUrl(entry, variant) : null;

  useEffect(() => {
    if (!entry || !animated || gif) return;
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
  }, [entry, animated, gif, progress]);

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

  if (gif) {
    return (
      /* eslint-disable-next-line jsx-a11y/alt-text -- React Native Image takes accessibilityLabel, not alt */
      <Image
        source={{ uri: gif }}
        accessibilityLabel={`${entry.name} demonstration`}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          resizeMode: 'contain',
        }}
        onError={() => setFailedGifFor(entry.id)}
      />
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
