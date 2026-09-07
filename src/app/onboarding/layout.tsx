'use client';

import { AuthGate } from '@/components/auth/auth-gate';

// In cloud mode onboarding requires sign-in (the login page is the gateway and
// routes first-time users here). In local mode the gate passes straight through.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
