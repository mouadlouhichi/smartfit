import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useStore } from '@/lib/store';

/** Volt lime, so the hold screen matches the rest of the app. */
const VOLT = '#f3ff47';

/** Routes that exist *before* the app is configured. */
const PRE_APP_ROUTES = new Set(['onboarding', 'login']);

/**
 * Keeps a brand-new install out of an unconfigured app.
 *
 * Without this, a fresh install landed on the dashboard with an empty profile:
 * no name, no units, no plan, no first goal — and no way to set any of them,
 * which is exactly what "there is no onboarding" looked like.
 *
 * Mirrors the web's `AuthGate`, which enforces the same rule on every dashboard
 * route rather than only the index, so a deep link can't skip setup either.
 *
 * `login` is excluded so the two gates compose: sign-in is decided by
 * `AuthGate` (which wraps this one), and a signed-out cloud-mode visitor must
 * not be dragged through profile setup that signing in would discard.
 *
 * The store's `ready` flag is respected so we never flash the dashboard before
 * AsyncStorage has answered.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { state, ready } = useStore();
  const router = useRouter();
  const segments = useSegments();

  const onboarded = state.profile.onboardingDone;
  const inPreApp = PRE_APP_ROUTES.has(segments[0] ?? '');
  const onOnboarding = segments[0] === 'onboarding';

  useEffect(() => {
    if (!ready) return;
    if (!onboarded && !inPreApp) {
      router.replace('/onboarding');
    } else if (onboarded && onOnboarding) {
      // Onboarding finished (or was already done on an earlier run) — don't
      // leave the user staring at the wizard.
      router.replace('/');
    }
  }, [ready, onboarded, inPreApp, onOnboarding, router]);

  // Hold the shell while the local state loads, or while a redirect that has
  // not been applied yet would otherwise render the wrong screen for a frame.
  const blocked = !ready || (!onboarded && !inPreApp) || (onboarded && onOnboarding);

  if (blocked) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator color={VOLT} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}
