'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, Mail, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { Wordmark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/ui/field';
import { useAuth } from '@/lib/firebase/auth-context';
import { useStore } from '@/lib/store-context';
import { AxelAppShowcase } from '@/components/axel/design-components';

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

  useEffect(() => {
    if (!cloud || initializing || !user || !ready) return;
    router.replace(state.profile.onboardingDone ? '/dashboard' : '/onboarding');
  }, [cloud, initializing, user, ready, state.profile.onboardingDone, router]);

  if (!cloud) {
    return (
      <AuthStage>
        <Card className="w-full max-w-md overflow-hidden">
          <CardContent className="p-5 sm:p-7">
            <div className="mb-5 flex items-center justify-between gap-3">
              <span className="bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black tracking-[0.16em] uppercase">
                <ShieldCheck className="h-3.5 w-3.5" /> Local access
              </span>
              <span className="text-xs font-extrabold text-white/40">9:41</span>
            </div>
            <h1 className="axel-title text-[3.2rem] sm:text-[3.8rem]">Welcome back</h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              No accounts or servers are configured for this preview — the login UI keeps the
              extracted component language, and your training continues on this device.
            </p>
            <div className="mt-6 grid gap-4" aria-hidden="true">
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input value="local@smartfit.app" disabled readOnly />
              </div>
              <div className="grid gap-1.5">
                <Label>Password</Label>
                <Input value="••••••••" disabled readOnly />
              </div>
            </div>
            <Button className="mt-6 w-full" onClick={() => router.replace('/dashboard')}>
              Continue on this device <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </AuthStage>
    );
  }

  if (cloud && (initializing || user)) {
    return (
      <div
        className="bg-background flex min-h-dvh items-center justify-center"
        role="status"
        aria-label="Loading"
      >
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <AuthStage>
      <Card className="w-full max-w-md overflow-hidden">
        <CardContent className="p-5 sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <span className="bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black tracking-[0.16em] uppercase">
              <Sparkles className="h-3.5 w-3.5" /> Mobile first
            </span>
            <span className="text-xs font-extrabold text-white/40">9:41</span>
          </div>

          <h1 className="axel-title text-[3.2rem] sm:text-[3.8rem]">
            {isReset ? 'Reset access' : isSignUp ? 'Build your routine' : 'Welcome back'}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            {isReset
              ? "Enter your email and we'll send you a reset link."
              : isSignUp
                ? 'Create your account and keep the AXEL-style SmartFit components across every page.'
                : 'Sign in to pick up your program, guided sets and progress exactly where you left off.'}
          </p>

          <form onSubmit={handleEmail} className="mt-6 grid gap-4">
            {isSignUp && (
              <Field id="name" label="Name">
                <Input
                  placeholder="What should we call you?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </Field>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2" />
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="pl-11"
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
                    className="text-primary text-xs font-extrabold transition-colors hover:underline"
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
                className="bg-destructive/10 text-destructive rounded-2xl px-3 py-2 text-xs font-bold"
              >
                {authError}
              </p>
            )}
            {authInfo && (
              <p
                role="status"
                className="bg-accent text-accent-foreground rounded-2xl px-3 py-2 text-xs font-bold"
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
                className="text-primary font-extrabold transition-colors hover:underline"
              >
                Back to sign in
              </button>
            </p>
          ) : (
            <>
              <div className="text-muted-foreground my-5 flex items-center gap-3 text-xs font-bold">
                <span className="h-px flex-1 bg-white/10" /> or{' '}
                <span className="h-px flex-1 bg-white/10" />
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
                {isSignUp ? 'Already have an account?' : 'New to SmartFit?'}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  clearError();
                  setView(isSignUp ? 'signin' : 'signup');
                }}
                className="mt-2 w-full"
              >
                {isSignUp ? 'Sign in instead' : 'Create an account'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-5 max-w-md text-center text-xs leading-relaxed">
        <ShieldCheck className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
        Your training data is private to your account. See our{' '}
        <Link href="/privacy" className="hover:text-foreground underline underline-offset-2">
          privacy policy
        </Link>
        .
      </p>
    </AuthStage>
  );
}

function AuthStage({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-background text-foreground grid min-h-dvh overflow-hidden lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
      <section className="relative min-h-[42dvh] overflow-hidden px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-10 sm:px-8 lg:min-h-dvh lg:px-12 lg:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(28rem_28rem_at_50%_10%,rgba(156,255,0,0.18),transparent_62%)]" />
        <div className="relative z-10 flex h-full min-h-[22rem] flex-col justify-between gap-6 lg:min-h-0">
          <Link href="/" aria-label="SmartFit home" className="w-fit">
            <Wordmark />
          </Link>

          <div className="grid gap-5">
            <p className="text-right text-xs font-bold text-white/50 lg:text-sm">Callour Studio</p>
            <h2 className="axel-title max-w-[16rem] text-[4.1rem] text-white sm:max-w-xl sm:text-[5.8rem] lg:text-[7.5rem]">
              Build your routine
            </h2>
            <AxelAppShowcase className="h-[15rem] w-full sm:h-[22rem] lg:h-[36rem]" />
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-white/55">Callour Studio</span>
              <span className="text-primary inline-flex items-center gap-2 text-sm font-black tracking-tight uppercase">
                <Zap className="h-4 w-4 fill-current" /> Feel the change
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background relative z-20 -mt-8 flex flex-col items-center justify-center rounded-t-[2rem] px-4 py-8 shadow-[0_-24px_60px_rgba(0,0,0,0.55)] sm:px-8 lg:mt-0 lg:rounded-none lg:px-10">
        {children}
      </section>
    </main>
  );
}
