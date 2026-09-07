'use client';

import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { AuthGate } from '@/components/auth/auth-gate';

/**
 * Every dashboard route is gated: authenticated (in cloud mode) *and*
 * onboarded. The gate renders a skeleton until both are settled.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <DashboardShell>{children}</DashboardShell>
    </AuthGate>
  );
}
