import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { StoreProvider } from '@/lib/store';
import { AuthProvider } from '@/lib/firebase/auth-context';
import { CosmicBackground } from '@/components/CosmicBackground';
import { AuthGate } from '@/components/AuthGate';
import { OnboardingGate } from '@/components/OnboardingGate';
import '../global.css';

/**
 * Application root.
 *
 * Provides the store (and the OLED ground) for *every* route, then hands off to
 * a plain stack. The tab bar lives one level down in `(tabs)/_layout.tsx` so the
 * pre-app screens — login, onboarding — can render full-bleed without chrome.
 *
 * Gate order matters and mirrors the web: authenticate first, then require
 * onboarding. A signed-out visitor should never be walked through profile setup
 * that will be discarded the moment they sign in.
 */
export default function RootLayout() {
  return (
    <StoreProvider>
      <AuthProvider>
        {/* OLED cosmic wallpaper sits behind every screen. */}
        <CosmicBackground />
        {/* The Volt system is dark-first: light content on the near-black ground. */}
        <StatusBar style="light" />
        <AuthGate>
          <OnboardingGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="login" options={{ gestureEnabled: false, animation: 'fade' }} />
              <Stack.Screen
                name="onboarding"
                // Onboarding is a required step: no swipe-to-dismiss back into an
                // unconfigured app.
                options={{ gestureEnabled: false, animation: 'fade' }}
              />
            </Stack>
          </OnboardingGate>
        </AuthGate>
      </AuthProvider>
    </StoreProvider>
  );
}
