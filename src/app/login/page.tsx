'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { Wordmark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/firebase/auth-context';
import { useStore } from '@/lib/store-context';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

type View = 'signin' | 'signup' | 'reset';

export default function LoginPage() {
  const router = useRouter();
  const {
    mode,
    signIn,
    signUp,
    signInWithGoogle,
    resetPassword,
    loading,
    initializing,
    authError,
    authInfo,
    clearError,
    user,
  } = useAuth();
  const { state, ready } = useStore();

  const [view, setView] = useState<View>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isSignUp = view === 'signup';
  const isReset = view === 'reset';
  const cloud = mode === 'cloud';

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    try {
      if (isReset) {
        await resetPassword(email.trim());
        setView('signin');
        return;
      }
      if (isSignUp) {
        await signUp(email.trim(), password, name.trim() || undefined);
      } else {
        await signIn(email.trim(), password);
      }
      // The gateway effect below routes once auth state settles.
    } catch {
      /* surfaced via authError */
    }
  }

  async function handleGoogle() {
    clearError();
    try {
      await signInWithGoogle();
    } catch {
      /* surfaced via authError */
    }
  }

  /**
   * Gateway.
   *
   * Cloud: once signed in and hydrated, a profile that hasn't finished setup
   * goes to onboarding; everyone else goes to the dashboard.
   *
   * Local (no Firebase configured): there is no account to sign in to, so this
   * page has nothing to offer — send visitors straight on rather than asking
   * them to "log in" with a name, which authenticated nothing.
   */
  useEffect(() => {
    if (cloud) {
      if (initializing || !user || !ready) return;
    } else if (!ready) {
      return;
    }
    router.replace(state.profile.onboardingDone ? '/dashboard' : '/onboarding');
  }, [cloud, initializing, user, ready, state.profile.onboardingDone, router]);

  // Resolving auth, or bouncing a local-mode visitor onward.
  if (!cloud || initializing) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center"
        role="status"
        aria-label="Loading"
      >
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8">
        <Wordmark />
      </Link>

      <Card className="w-full max-w-sm">
        <CardContent className="p-6">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {isReset ? 'Reset your password' : isSignUp ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isReset
              ? "Enter your email and we'll send you a reset link."
              : isSignUp
                ? 'Sign up to sync your training across every device.'
                : 'Sign in to pick up right where you left off.'}
          </p>

          <form onSubmit={handleEmail} className="mt-5 grid gap-4">
            {isSignUp && (
              <div className="grid gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="What should we call you?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            {!isReset && (
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => {
                      clearError();
                      setView('reset');
                    }}
                    className="text-primary text-xs font-medium hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
                {isSignUp && (
                  <p className="text-muted-foreground text-xs">At least 6 characters.</p>
                )}
              </div>
            )}

            {authError && (
              <p
                role="alert"
                className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs font-medium"
              >
                {authError}
              </p>
            )}
            {authInfo && (
              <p
                role="status"
                className="bg-accent text-accent-foreground rounded-lg px-3 py-2 text-xs font-medium"
              >
                {authInfo}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isReset ? (
                <>
                  Send reset link <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  {isSignUp ? 'Create account' : 'Sign in'} <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {isReset ? (
            <p className="text-muted-foreground mt-5 text-center text-sm">
              <button
                type="button"
                onClick={() => {
                  clearError();
                  setView('signin');
                }}
                className="text-primary font-semibold hover:underline"
              >
                Back to sign in
              </button>
            </p>
          ) : (
            <>
              <div className="text-muted-foreground my-4 flex items-center gap-3 text-xs">
                <span className="bg-border h-px flex-1" /> or{' '}
                <span className="bg-border h-px flex-1" />
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={handleGoogle}
                className="w-full"
              >
                <GoogleMark /> Continue with Google
              </Button>

              <p className="text-muted-foreground mt-5 text-center text-sm">
                {isSignUp ? 'Already have an account?' : 'New to SmartFit?'}{' '}
                <button
                  type="button"
                  onClick={() => {
                    clearError();
                    setView(isSignUp ? 'signin' : 'signup');
                  }}
                  className="text-primary font-semibold hover:underline"
                >
                  {isSignUp ? 'Sign in' : 'Create one'}
                </button>
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-6 flex max-w-sm items-center justify-center gap-1.5 text-center text-xs">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        Your training data is private to your account. See our{' '}
        <Link href="/privacy" className="hover:text-foreground underline underline-offset-2">
          privacy policy
        </Link>
        .
      </p>
    </div>
  );
}
