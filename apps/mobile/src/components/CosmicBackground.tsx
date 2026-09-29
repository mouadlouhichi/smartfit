import React, { useMemo } from 'react';
import { View, Platform, useWindowDimensions } from 'react-native';

/**
 * OLED-friendly cosmic wallpaper.
 *
 * On native: renders a radial purple/volt nebula gradient over pure black,
 * with a static star field seeded from a lightweight PRNG (zero JS animation
 * cost — wallpaper only, no re-renders).
 *
 * On web: defers to a CSS radial gradient because pointer events need to pass
 * through and there's no native animated driver.
 */
export function CosmicBackground() {
  const { width, height } = useWindowDimensions();

  const stars = useMemo(() => {
    // Deterministic pseudo-random so we don't re-seed on every render.
    let seed = 1337;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: rand() * 100,
      y: rand() * 100,
      size: rand() * 1.6 + 0.4,
      opacity: rand() * 0.7 + 0.2,
    }));
  }, []);

  if (Platform.OS === 'web') {
    return (
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          background:
            'radial-gradient(1200px 800px at 15% 10%, rgba(139,92,246,0.18), transparent 60%),' +
            'radial-gradient(900px 700px at 85% 90%, rgba(138,210,0,0.12), transparent 55%),' +
            'radial-gradient(600px 600px at 50% 50%, rgba(249,115,22,0.06), transparent 60%),' +
            '#000',
        }}
      />
    );
  }

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        backgroundColor: '#000',
      }}
    >
      {/* Nebula blobs */}
      <View
        style={{
          position: 'absolute',
          left: -width * 0.25,
          top: -height * 0.1,
          width: width * 0.9,
          height: width * 0.9,
          borderRadius: width,
          backgroundColor: 'rgba(139,92,246,0.22)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: -width * 0.3,
          bottom: -height * 0.1,
          width: width * 0.85,
          height: width * 0.85,
          borderRadius: width,
          backgroundColor: 'rgba(138,210,0,0.14)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: width * 0.25,
          top: height * 0.4,
          width: width * 0.6,
          height: width * 0.6,
          borderRadius: width,
          backgroundColor: 'rgba(249,115,22,0.07)',
        }}
      />

      {/* Star field */}
      {stars.map((s) => (
        <View
          key={s.id}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            borderRadius: s.size,
            backgroundColor: '#fff',
            opacity: s.opacity,
          }}
        />
      ))}
    </View>
  );
}
