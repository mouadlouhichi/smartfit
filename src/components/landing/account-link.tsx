'use client';

import Link from 'next/link';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/firebase/auth-context';
import { useStore } from '@/lib/store-context';
import { landingAccountState } from '@/lib/landing-session';

const LandingSession = createContext<ReturnType<typeof landingAccountState> | null>(null);

/** Resolve once per landing visit, shared by desktop/mobile navigation and every CTA. */
export function LandingSessionProvider({ children }: { children: ReactNode }) {
  const { user, initializing, mode } = useAuth();
  const { state, ready } = useStore();
  const [result, setResult] = useState<{ user: typeof user; home: string | null } | null>(null);

  useEffect(() => {
    if (initializing || !user) return;
    const controller = new AbortController();
    let active = true;
    // An unavailable role lookup must not leave the landing CTA disabled forever.
    const timeout = setTimeout(() => {
      controller.abort();
      if (active) setResult({ user, home: null });
      active = false;
    }, 8000);
    user
      .getIdToken()
      .then((token) =>
        fetch('/api/auth/home', {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
          signal: controller.signal,
        }),
      )
      .then((response) => (response.ok ? response.json() : { home: null }))
      .then((body: { home?: unknown }) => {
        if (active) setResult({ user, home: typeof body.home === 'string' ? body.home : null });
      })
      .catch(() => {
        if (active) setResult({ user, home: null });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [initializing, user]);

  const session = landingAccountState({
    initializing: initializing || (mode === 'local' && !ready),
    signedIn: !!user,
    returningLocal: mode === 'local' && ready && state.profile.onboardingDone,
    memberReady: ready,
    onboardingDone: state.profile.onboardingDone,
    // Never reuse another user's role during sign-out/account switches.
    resolvedHome: result?.user === user ? result?.home : undefined,
  });
  return <LandingSession.Provider value={session}>{children}</LandingSession.Provider>;
}

export function AccountLink({
  children,
  className,
  onClick,
  signedOutOnly = false,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  /** Secondary sign-in links disappear instead of duplicating the primary CTA. */
  signedOutOnly?: boolean;
}) {
  const session = useContext(LandingSession);
  if (!session) throw new Error('AccountLink needs LandingSessionProvider');
  if (signedOutOnly && (session.authenticated || session.pending)) return null;
  if (session.pending || !session.href)
    return (
      <span className={className} aria-disabled="true" aria-busy="true">
        {session.label}
      </span>
    );
  return (
    <Link href={session.href} className={className} onClick={onClick}>
      {session.authenticated ? session.label : children}
    </Link>
  );
}
