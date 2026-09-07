'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/auth-context';
import { useStore } from '@/lib/store-context';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Protects dashboard routes. In cloud mode a signed-out visitor is sent to
 * /login; while auth/data initialise a neutral loading screen is shown.
 * In local mode (no Firebase configured) it passes straight through so the
 * app still works with on-device data.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { mode, user, initializing } = useAuth();
  const { ready } = useStore();
  const router = useRouter();

  const needsAuth = mode === 'cloud';
  const authed = mode === 'local' || !!user;

  useEffect(() => {
    if (!initializing && needsAuth && !user) {
      router.replace('/login');
    }
  }, [initializing, needsAuth, user, router]);

  if (needsAuth && (!authed || !ready)) {
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

  return <>{children}</>;
}
