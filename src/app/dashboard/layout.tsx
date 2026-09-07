'use client';

import { useStore } from '@/lib/store-context';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { AuthGate } from '@/components/auth/auth-gate';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <DashboardReady>{children}</DashboardReady>
    </AuthGate>
  );
}

function DashboardReady({ children }: { children: React.ReactNode }) {
  const { ready } = useStore();
  if (!ready) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }
  return <DashboardShell>{children}</DashboardShell>;
}
