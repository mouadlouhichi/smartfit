'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/firebase/auth-context';
import { Button } from '@/components/ui/button';
import { WorkspaceIllustration } from '@/components/ui/artwork';
import { ThemeToggle } from '@/components/theme-toggle';
export function FeatureShell({
  title,
  description,
  children,
  mode,
  loading,
  error,
  reload,
}: {
  title: string;
  description: string;
  children: ReactNode;
  mode: string;
  loading: boolean;
  error: string | null;
  reload: () => void;
}) {
  const { user, signOut, loading: authBusy, authError } = useAuth();
  return (
    <main className="mx-auto min-h-dvh max-w-6xl space-y-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <Link href="/" className="text-xl font-black">
          SmartFit
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/library">Training library</Link>
          <Link href="/support">Support</Link>
          <Link href="/login">My workspace</Link>
          {user && (
            <Button
              variant="ghost"
              size="sm"
              disabled={authBusy}
              onClick={() => {
                void signOut().catch(() => undefined);
              }}
            >
              Sign out
            </Button>
          )}
          <ThemeToggle />
        </nav>
      </header>
      <div className="flex items-center justify-between gap-4 overflow-hidden rounded-3xl border bg-gradient-to-br from-lime-500/10 via-transparent to-violet-500/10 p-5 sm:p-7">
        <div>
          <p className="text-muted-foreground text-xs tracking-widest uppercase">
            {mode === 'local' ? 'Demo workspace · session-only changes' : 'SmartFit workspace'}
          </p>
          <h1 className="mt-2 text-3xl font-black">{title}</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">{description}</p>
        </div>
        <WorkspaceIllustration
          kind={
            title.toLowerCase().includes('support') || title.includes('help')
              ? 'support'
              : title.includes('Coaching')
                ? 'coaching'
                : 'training'
          }
          className="hidden sm:block"
        />
      </div>
      {authError && (
        <p role="alert" className="text-destructive">
          {authError}
        </p>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-red-500/40 p-4">
          <p>{error}</p>
          <div className="mt-3 flex gap-3">
            <Button variant="outline" onClick={reload}>
              Retry
            </Button>
            <Button variant="outline" asChild>
              <Link href="/login">Sign in / switch account</Link>
            </Button>
          </div>
        </div>
      )}
      {loading ? (
        <p role="status" className="animate-pulse py-12">
          Loading workspace…
        </p>
      ) : (
        children
      )}
    </main>
  );
}
