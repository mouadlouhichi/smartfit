import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { StoreProvider } from '@/lib/store';
import { CosmicBackground } from '@/components/CosmicBackground';
import { OnboardingGate } from '@/components/OnboardingGate';
import '../global.css';

/**
 * Application root.
 *
 * Provides the store (and the OLED ground) for *every* route, then hands off to
 * a plain stack. The tab bar lives one level down in `(tabs)/_layout.tsx` so the
 * pre-app screens — onboarding, and the welcome/entry screen — can render
 * full-bleed without navigation chrome.
 */
export default function RootLayout() {
  return (
    <StoreProvider>
      {/* OLED cosmic wallpaper sits behind every screen. */}
      <CosmicBackground />
      {/* The Volt system is dark-first: light content on the near-black ground. */}
      <StatusBar style="light" />
      <OnboardingGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="onboarding"
            // Onboarding is a required step: no swipe-to-dismiss back into an
            // unconfigured app.
            options={{ gestureEnabled: false, animation: 'fade' }}
          />
        </Stack>
      </OnboardingGate>
    </StoreProvider>
  );
}
