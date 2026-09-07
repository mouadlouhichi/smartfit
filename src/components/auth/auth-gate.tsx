'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/auth-context';
import { useStore } from '@/lib/store-context';
import { Skeleton } from '@/components/ui/skeleton';

function LoadingShell() {
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

/**
 * Guards the authenticated app.
 *
 * Two responsibilities, both of which must apply to *every* dashboard route
 * rather than just the index:
 *
 *  1. Authentication — in cloud mode a signed-out visitor goes to /login.
 *     In local mode there is no account, so it passes straight through.
 *  2. Onboarding — a profile that hasn't completed setup is sent to
 *     /onboarding. This used to live only in `dashboard/page.tsx`, so any deep
 *     link (a bookmark, the footer's "Open dashboard", a shared URL) dropped a
 *     brand-new user into an empty app with no way to configure it.
 */
export function AuthGate({
  children,
  requireOnboarding = true,
}: {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}) {
  const { mode, user, initializing } = useAuth();
  const { ready, state } = useStore();
  const router = useRouter();
  const pathname = usePathname();

  const needsAuth = mode === 'cloud';
  const authed = mode === 'local' || !!user;
  const onboarded = state.profile.onboardingDone;
  const onOnboarding = pathname?.startsWith('/onboarding') ?? false;

  useEffect(() => {
    if (initializing) return;
    if (needsAuth && !user) {
      router.replace('/login');
      return;
    }
    if (requireOnboarding && ready && !onboarded && !onOnboarding) {
      router.replace('/onboarding');
    }
  }, [initializing, needsAuth, user, ready, onboarded, onOnboarding, requireOnboarding, router]);

  // Hold the shell until we know both who the user is and what their data says,
  // so we never flash an empty dashboard before redirecting.
  const blocked =
    initializing ||
    (needsAuth && !authed) ||
    !ready ||
    (requireOnboarding && !onboarded && !onOnboarding);

  if (blocked) return <LoadingShell />;

  return <>{children}</>;
}
