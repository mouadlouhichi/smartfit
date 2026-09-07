'use client';

import { OverviewScreen } from '@/components/dashboard/screens/overview-screen';

// Auth + onboarding are enforced by the route group's layout (AuthGate), so
// every dashboard route is protected, not just this one.
export default function DashboardPage() {
  return <OverviewScreen />;
}
