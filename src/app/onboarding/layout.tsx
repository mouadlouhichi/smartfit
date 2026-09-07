'use client';

import { AuthGate } from '@/components/auth/auth-gate';

/**
 * In cloud mode onboarding still requires sign-in (the login page routes
 * first-time users here); in local mode the gate passes through. The
 * onboarding check itself is disabled — this *is* the onboarding.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate requireOnboarding={false}>{children}</AuthGate>;
}
