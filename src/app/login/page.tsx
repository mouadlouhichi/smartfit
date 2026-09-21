'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { isValidSlug, tenantPath } from '@smartfit/core';

/**
 * Same-app absolute paths only: `/admin` passes, while `//evil.com`,
 * `https://evil.com` and `login` (relative) do not. Gated surfaces (e.g. the
 * platform-admin shell) set `?next=` so a sign-in lands back where it started —
 * without this check that convenience would be an open redirect.
 */
function isSafeNextPath(path: string | null): path is string {
  return !!path && /^\/(?!\/)/.test(path) && path !== '/login';
}
import { Wordmark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/ui/field';
import { useAuth } from '@/lib/firebase/auth-context';
import { useStore } from '@/lib/store-context';
import { OrbitHero, VoltHeadline, PillCta } from '@/components/volt/volt-kit';

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
   * Only an already-authenticated visitor is redirected: a signed-out one
   * came here to sign in, so they must always get the form. A `?next=` param
   * (set by gated surfaces such as /admin) wins — the visitor explicitly
   * started there. A `?gym=` param (set by every "join this gym" link on a
   * tenant site) sends them back to that gym instead of the dashboard —
   * signing in to book a class and landing on a personal dashboard is a dead
   * end. A **platform admin** lands on `/admin`, their console — walking an
   * operator through member setup (weight, plan, gym, goal) reads as a bug,
   * with or without a completed profile. Everyone else: a profile that hasn't
   * finished setup goes to onboarding first; the gym is one tap from there.
   */
  useEffect(() => {
    if (!cloud || initializing || !user || !ready) return;
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    if (isSafeNextPath(next)) {
      router.replace(next);
      return;
    }
    const gym = params.get('gym');
    if (gym && isValidSlug(gym)) {
      router.replace(tenantPath(gym));
      return;
    }
    const memberRoute = state.profile.onboardingDone ? '/dashboard' : '/onboarding';
    // Cached token read: the claim was minted at sign-in, and this gateway
    // only runs for a just-signed-in user. On a read failure, fall through to
    // the member route rather than blocking the redirect.
    user
      .getIdTokenResult(false)
      .then((res) =>
        router.replace(res.claims?.sfRole === 'platform-admin' ? '/admin' : memberRoute),
      )
      .catch(() => router.replace(memberRoute));
  }, [cloud, initializing, user, ready, state.profile.onboardingDone, router]);

  // A local-mode deployment has no accounts at all — showing a sign-in form
  // that can only fail with a configuration error sends visitors in circles.
  // The dashboard is open in this mode, so offer the one useful action.
  if (!cloud) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
        <Link href="/" className="mb-8">
          <Wordmark />
        </Link>
        <OrbitHero size={200} className="mb-6" />
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 text-center">
            <span className="bg-primary/10 text-primary mx-auto flex h-12 w-12 items-center justify-center rounded-2xl">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h1 className="font-display mt-4 text-xl font-bold tracking-tight">
              This SmartFit runs on-device
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              No accounts or servers are configured for this deployment — your training lives in
              this browser only.
            </p>
            <PillCta
              label="Continue on this device"
              className="mt-5 w-full"
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                const next = params.get('next');
                const gym = params.get('gym');
                router.replace(
                  isSafeNextPath(next)
                    ? next
                    : gym && isValidSlug(gym)
                      ? tenantPath(gym)
                      : '/dashboard',
                );
              }}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Only while auth is resolving, or while bouncing an already-signed-in user.
  if (cloud && (initializing || user)) {
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
    // Split screen: the reference welcome art on the left, the form on the
    // right. On mobile the art stacks above the card as a compact hero.
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* ── Brand panel ──────────────────────────────────────────── */}
      <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-center lg:gap-10 lg:pr-16 lg:pl-14">
        {/* volt glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-24 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(138,210,0,0.16),transparent_65%)]"
        />
        <Link href="/" className="relative" aria-label="SmartFit home">
          <Wordmark />
        </Link>

        <div className="relative grid justify-items-start gap-8">
          <OrbitHero size={300} />
          <VoltHeadline className="max-w-xl text-[2.6rem]" />
          <p className="text-muted-foreground max-w-md text-base">
            Plan your week, log every session and watch the trends build — privately, on your terms.
            No wearable required.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {['Plan', 'Log', 'Progress', 'Run'].map((chip) => (
              <span
                key={chip}
                className="border-border text-muted-foreground rounded-full border px-4 py-1.5 text-sm font-bold"
              >
                {chip}
              </span>
            ))}
          </div>
          <PillCta
            label={isSignUp ? 'Continue below' : 'Get started'}
            onClick={() => {
              clearError();
              setView('signup');
              // The field mounts with the new view — focus it on the next frame.
              requestAnimationFrame(() => {
                document.getElementById('email')?.focus({ preventScroll: false });
              });
            }}
          />
        </div>
      </aside>

      {/* ── Form panel ───────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        {/* Mobile hero — same art, compact */}
        <div className="mb-6 flex flex-col items-center gap-4 text-center lg:hidden">
          <Link href="/" aria-label="SmartFit home">
            <Wordmark />
          </Link>
          <OrbitHero size={170} />
          <VoltHeadline className="text-2xl sm:text-3xl" />
        </div>

        <div className="auth-card w-full max-w-md">
          <div className="relative grid gap-1 p-6 sm:p-8">
            <h1 className="font-display text-[1.75rem] leading-tight font-extrabold tracking-tight">
              {isReset ? 'Reset your password' : isSignUp ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isReset
                ? "Enter your email and we'll send you a reset link."
                : isSignUp
                  ? 'Sign up to sync your training across every device.'
                  : 'Sign in to pick up right where you left off.'}
            </p>

            <form onSubmit={handleEmail} className="mt-6 grid gap-3.5">
              {isSignUp && (
                <Field id="name" label="Name">
                  <Input
                    placeholder="What should we call you?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    className="h-12 rounded-xl"
                  />
                </Field>
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
                    className="h-12 rounded-xl pl-10"
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
                      className="text-primary text-xs font-medium transition-colors hover:underline"
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
                    className="h-12 rounded-xl"
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

              <Button
                type="submit"
                disabled={loading}
                className="btn-volt h-12 w-full rounded-xl text-[15px] font-extrabold hover:brightness-[1.03]"
              >
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
                  className="text-primary rounded font-bold underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
                >
                  Back to sign in
                </button>
              </p>
            ) : (
              <>
                <div className="text-muted-foreground my-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[11px] font-bold tracking-[0.18em] uppercase">
                  <span className="bg-border h-px" />
                  or
                  <span className="bg-border h-px" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={handleGoogle}
                  className="h-12 w-full rounded-xl"
                >
                  <GoogleMark /> Continue with Google
                </Button>

                {/* A text button, not a second outlined slab: switching mode
                    is a minor action and should not compete with the primary
                    submit or the Google option. */}
                <p className="text-muted-foreground mt-6 text-center text-sm">
                  {isSignUp ? 'Already have an account?' : 'New to SmartFit?'}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      clearError();
                      setView(isSignUp ? 'signin' : 'signup');
                    }}
                    className="text-primary rounded font-bold underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
                  >
                    {isSignUp ? 'Sign in' : 'Create an account'}
                  </button>
                </p>
              </>
            )}
          </div>
        </div>

        <p className="text-muted-foreground mt-6 max-w-sm text-center text-xs">
          <ShieldCheck className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
          Your training data is private to your account. See our{' '}
          <Link href="/privacy" className="hover:text-foreground underline underline-offset-2">
            privacy policy
          </Link>
          . Looking for your gym?{' '}
          <Link href="/gyms" className="hover:text-foreground underline underline-offset-2">
            Find it on SmartFit
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
