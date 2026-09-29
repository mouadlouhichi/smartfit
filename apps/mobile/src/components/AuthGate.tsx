import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/lib/firebase/auth-context';

/** Volt lime, so the hold screen matches the rest of the app. */
const VOLT = '#f3ff47';

/**
 * Authentication guard.
 *
 * The native twin of the web's `AuthGate`, minus the onboarding half — that
 * lives in `OnboardingGate`, which wraps this one so setup is enforced *before*
 * sign-in is even considered.
 *
 * In cloud mode a signed-out visitor is sent to `/login`. In local mode there
 * are no accounts, so it passes straight through — which is what keeps the
 * local-first build working with no backend at all.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { mode, user, initializing } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  const needsAuth = mode === 'cloud';
  const onLogin = segments[0] === 'login';

  useEffect(() => {
    if (initializing) return;
    if (needsAuth && !user && !onLogin) {
      router.replace('/login');
    } else if (user && onLogin) {
      // Already signed in: don't leave them staring at the form.
      router.replace('/');
    }
  }, [initializing, needsAuth, user, onLogin, router]);

  // Hold the shell until we know who the user is, so we never flash the
  // dashboard before redirecting.
  const blocked = initializing || (needsAuth && !user && !onLogin) || (user && onLogin);

  if (blocked) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator color={VOLT} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}
