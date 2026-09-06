'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Ruler, Target, UserRound } from 'lucide-react';
import { Logo, Wordmark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store-context';
import { GOAL_METRIC_META, PLANS } from '@/lib/constants';
import { toISODate } from '@/lib/fitness';

const STEPS = ['Welcome', 'About you', 'Strategy', 'First goal', 'Ready'] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { state, updateProfile, addGoal } = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(state.profile.name ?? '');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>(state.profile.weightUnit ?? 'kg');
  const [restDays, setRestDays] = useState(state.profile.weeklyRestDays ?? 2);
  const [planId, setPlanId] = useState(state.profile.planId ?? 'full-body');
  const [goalMetric, setGoalMetric] = useState<'workouts' | 'minutes'>('workouts');
  const [goalTarget, setGoalTarget] = useState('4');

  function finish() {
    updateProfile({ name: name.trim() || 'Athlete', weightUnit, weeklyRestDays: restDays, planId });
    if (Number(goalTarget) > 0) {
      addGoal({
        name: goalMetric === 'workouts' ? 'Train this week' : 'Active minutes this week',
        metric: goalMetric,
        cadence: 'weekly',
        target: Number(goalTarget),
        startDate: toISODate(new Date()),
      });
    }
    // Mark onboarding complete last so the dashboard redirect stops firing.
    setTimeout(() => {
      updateProfile({ onboardingDone: true });
      router.replace('/dashboard');
    }, 0);
  }

  const canNext = step === 1 ? name.trim().length > 0 : true;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between px-5 py-4">
        <Wordmark />
        <span className="text-sm text-muted-foreground">
          Step {step + 1} of {STEPS.length}
        </span>
      </header>

      {/* Progress */}
      <div className="mx-auto flex w-full max-w-md gap-1.5 px-5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= step ? 'bg-primary' : 'bg-secondary')}
          />
        ))}
      </div>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-8">
        {step === 0 && (
          <div className="text-center animate-fade-in">
            <Logo size={72} className="mx-auto" />
            <h1 className="mt-6 text-3xl font-bold tracking-tight">Welcome to SmartFit</h1>
            <p className="mt-3 text-muted-foreground">
              In the next minute we&apos;ll set up your training strategy and your first goal. Your data stays on this
              device — no account, no wearable required.
            </p>
            <div className="mt-6 grid gap-2 text-left text-sm">
              {['Pick a proven training split', 'Schedule your week in one tap', 'Log workouts and watch trends build'].map(
                (t) => (
                  <div key={t} className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
                    <Check className="h-4 w-4 text-primary" /> {t}
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-5 animate-fade-in">
            <div className="flex items-center gap-2 text-primary">
              <UserRound className="h-5 w-5" />
              <h2 className="text-xl font-bold">About you</h2>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ob-name">What should we call you?</Label>
              <Input
                id="ob-name"
                autoFocus
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ob-unit">Preferred weight unit</Label>
              <Select id="ob-unit" value={weightUnit} onChange={(e) => setWeightUnit(e.target.value as 'kg' | 'lb')}>
                <option value="kg">Kilograms (kg)</option>
                <option value="lb">Pounds (lb)</option>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ob-rest">Rest days per week</Label>
              <Select id="ob-rest" value={restDays} onChange={(e) => setRestDays(Number(e.target.value))}>
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n} day{n > 1 ? 's' : ''}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 animate-fade-in">
            <div className="flex items-center gap-2 text-primary">
              <Target className="h-5 w-5" />
              <h2 className="text-xl font-bold">Choose your strategy</h2>
            </div>
            <div className="grid gap-2">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlanId(p.id)}
                  className={cn(
                    'rounded-2xl border p-4 text-left transition-all',
                    planId === p.id ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'border-border bg-card hover:border-primary/40',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-xs font-medium text-muted-foreground">{p.sessionsPerWeek}× / week</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-5 animate-fade-in">
            <div className="flex items-center gap-2 text-primary">
              <Ruler className="h-5 w-5" />
              <h2 className="text-xl font-bold">Your first weekly goal</h2>
            </div>
            <div className="grid gap-2">
              {(['workouts', 'minutes'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setGoalMetric(m);
                    setGoalTarget(m === 'workouts' ? '4' : '150');
                  }}
                  className={cn(
                    'flex items-center justify-between rounded-2xl border p-4 text-left transition-all',
                    goalMetric === m ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'border-border bg-card',
                  )}
                >
                  <span className="font-semibold">{GOAL_METRIC_META[m].label}</span>
                  <span className="text-sm text-muted-foreground">per week</span>
                </button>
              ))}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ob-target">
                Target ({GOAL_METRIC_META[goalMetric].unit})
              </Label>
              <Input
                id="ob-target"
                type="number"
                min={1}
                step={GOAL_METRIC_META[goalMetric].step}
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="text-center animate-fade-in">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-8 w-8" />
            </span>
            <h2 className="mt-6 text-2xl font-bold">You&apos;re all set, {name.trim() || 'Athlete'}!</h2>
            <Card className="mt-6 text-left">
              <CardContent className="grid gap-2 p-5 text-sm">
                <Row label="Strategy" value={PLANS.find((p) => p.id === planId)?.name ?? ''} />
                <Row label="Rest days / week" value={String(restDays)} />
                <Row label="Weight unit" value={weightUnit} />
                <Row
                  label="First goal"
                  value={`${goalTarget} ${GOAL_METRIC_META[goalMetric].unit} / week`}
                />
              </CardContent>
            </Card>
            <p className="mt-4 text-sm text-muted-foreground">
              We&apos;ve loaded a few sample sessions so the charts aren&apos;t empty. Log your own any time — erase the
              demo from Profile whenever you like.
            </p>
          </div>
        )}
      </main>

      <footer className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-5 py-6">
        <Button
          variant="ghost"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => canNext && setStep((s) => s + 1)} disabled={!canNext}>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={finish}>
            Enter dashboard <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </footer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
