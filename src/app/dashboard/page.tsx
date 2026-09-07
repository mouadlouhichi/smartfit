'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useStore } from '@/lib/store-context';
import { OverviewScreen } from '@/components/dashboard/screens/overview-screen';

export default function DashboardPage() {
  const { state, ready } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (ready && !state.profile.onboardingDone) router.replace('/onboarding');
  }, [ready, state.profile.onboardingDone, router]);

  if (!ready || !state.profile.onboardingDone) return null;
  return <OverviewScreen />;
}
