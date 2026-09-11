'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Ruler, Target, UserRound } from 'lucide-react';
import { Logo, Wordmark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store-context';
import { useAuth } from '@/lib/firebase/auth-context';
import {
  GYM_PROGRAMS,
  GOAL_METRIC_META,
  PLANS,
  formatWeight,
  fromKg,
  getGymProgram,
  suggestProgram,
  suggestedToSchedule,
  toKg,
  uid,
} from '@smartfit/core';
import { toISODate } from '@smartfit/core';
import { env } from '@/lib/env';

const STEPS = ['Welcome', 'About you', 'Strategy', 'First goal', 'Ready'] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { state, completeOnboarding, flushWrites, cloud } = useStore();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  // Prefill from whatever the account already knows: the profile if it has a
  // name, otherwise the display name the provider gave us (Google always
  // supplies one; email sign-up supplies it when the field was filled in).
  const [name, setName] = useState(state.profile.name?.trim() || (user?.displayName ?? ''));
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>(state.profile.weightUnit ?? 'kg');
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'mi'>(state.profile.distanceUnit ?? 'km');
  const [restDays, setRestDays] = useState(state.profile.weeklyRestDays ?? 2);
  const [planId, setPlanId] = useState(state.profile.planId ?? env.defaultPlan);
  const [goalMetric, setGoalMetric] = useState<'workouts' | 'minutes'>('workouts');
  const [goalTarget, setGoalTarget] = useState('4');
  // Optional: activate the suggested-program engine from day one.
  const [targetWeight, setTargetWeight] = useState(
    state.profile.targetWeightKg != null
      ? String(Number(fromKg(state.profile.targetWeightKg, weightUnit).toFixed(1)))
      : '',
  );
  const [gymId, setGymId] = useState(state.profile.gymId ?? '');
  // The finish write must land before the redirect, or a reload right after
  // "Enter dashboard" could resurrect this page.
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function finish() {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    const goalName = goalMetric === 'workouts' ? 'Train this week' : 'Active minutes this week';
    const goalDate = toISODate(new Date());
    const existingGoal = state.goals.find(
      (goal) =>
        goal.name === goalName &&
        goal.startDate === goalDate &&
        goal.metric === goalMetric &&
        goal.cadence === 'weekly',
    );
    const firstGoal =
      Number(goalTarget) > 0
        ? (existingGoal ?? {
            id: uid('goal'),
            name: goalName,
            metric: goalMetric,
            cadence: 'weekly' as const,
            target: Number(goalTarget),
            startDate: goalDate,
            createdAt: Date.now(),
          })
        : undefined;
    // The profile, first goal, and (when a gym was selected) starter week are
    // committed by one Firestore batch, so the dashboard cannot claim
    // onboarding is complete while promised setup is still in another queue.
    const targetKg = parsedTargetWeight();
    const profilePatch = {
      // The name is required by `canNext`, so there is never an invented
      // stand-in identity to fall back to.
      name: name.trim(),
      weightUnit,
      distanceUnit,
      weeklyRestDays: restDays,
      planId,
      ...(targetKg != null ? { targetWeightKg: targetKg } : {}),
      ...(gymId ? { gymId } : {}),
    };
    const gymProgram = getGymProgram(gymId);
    const starterState = {
      ...state,
      profile: { ...state.profile, ...profilePatch },
    };
    const starterSchedule =
      state.schedule.length === 0 && gymProgram
        ? suggestedToSchedule(suggestProgram(starterState, gymProgram))
        : [];
    completeOnboarding(profilePatch, firstGoal, starterSchedule);
    try {
      // On-device this resolves immediately; in cloud mode it stays on this
      // page and explains the problem when the batch cannot be saved.
      await flushWrites();
      router.replace('/dashboard');
    } catch {
      setSaveError("We couldn't save your setup. Check your connection and try again.");
      setSaving(false);
    }
  }

  function changeWeightUnit(next: 'kg' | 'lb') {
    const current = targetWeight.trim();
    if (current !== '') {
      const kg = toKg(Number(current), weightUnit);
      if (Number.isFinite(kg)) {
        setTargetWeight(String(Number(fromKg(kg, next).toFixed(1))));
      }
    }
    setWeightUnit(next);
  }

  /** Null when left empty; `canNext` keeps invalid values off this path. */
  function parsedTargetWeight(): number | null {
    const trimmed = targetWeight.trim();
    if (trimmed === '') return null;
    const kg = toKg(Number(trimmed), weightUnit);
    return Number.isFinite(kg) && kg >= 20 && kg <= 400 ? Math.round(kg * 10) / 10 : null;
  }

  const nameOk = name.trim().length > 0;
  const targetWeightOk =
    targetWeight.trim() === '' ||
    (() => {
      const kg = toKg(Number(targetWeight), weightUnit);
      return Number.isFinite(kg) && kg >= 20 && kg <= 400;
    })();
  const canNext = step === 1 ? nameOk && targetWeightOk : true;

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <Wordmark />
        <span className="text-muted-foreground text-sm">
          Step {step + 1} of {STEPS.length}
        </span>
      </header>

      {/* Progress */}
      <div className="mx-auto flex w-full max-w-md gap-1.5 px-5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i <= step ? 'bg-primary' : 'bg-secondary',
            )}
          />
        ))}
      </div>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-8">
        {step === 0 && (
          <div className="animate-fade-in text-center">
            <Logo size={72} className="mx-auto" />
            <h1 className="mt-6 text-3xl font-bold tracking-tight">Welcome to SmartFit</h1>
            <p className="text-muted-foreground mt-3">
              In the next minute we&apos;ll set up your training strategy and your first goal.{' '}
              {cloud
                ? 'Everything syncs privately to your account — no wearable required.'
                : 'Your data stays on this device — no account, no wearable required.'}
            </p>
            <div className="mt-6 grid gap-2 text-left text-sm">
              {[
                'Pick a proven training split',
                'Schedule your week in one tap',
                'Log workouts and watch trends build',
              ].map((t) => (
                <div
                  key={t}
                  className="border-border bg-card flex items-center gap-2 rounded-xl border p-3"
                >
                  <Check className="text-primary h-4 w-4" /> {t}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="animate-fade-in grid gap-5">
            <div className="text-primary flex items-center gap-2">
              <UserRound className="h-5 w-5" />
              <h2 className="text-xl font-bold">About you</h2>
            </div>
            <Field id="ob-name" label="What should we call you?">
              <Input
                autoFocus
                placeholder="Your name"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field id="ob-unit" label="Preferred weight unit">
              <Select
                value={weightUnit}
                onChange={(e) => changeWeightUnit(e.target.value as 'kg' | 'lb')}
              >
                <option value="kg">Kilograms (kg)</option>
                <option value="lb">Pounds (lb)</option>
              </Select>
            </Field>
            <Field id="ob-dist" label="Preferred distance unit">
              <Select
                value={distanceUnit}
                onChange={(e) => setDistanceUnit(e.target.value as 'km' | 'mi')}
              >
                <option value="km">Kilometres (km)</option>
                <option value="mi">Miles (mi)</option>
              </Select>
            </Field>
            <Field id="ob-rest" label="Rest days per week">
              <Select value={restDays} onChange={(e) => setRestDays(Number(e.target.value))}>
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n} day{n > 1 ? 's' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              id="ob-target-weight"
              label={`Target weight (${weightUnit}) — optional`}
              hint="Powers the suggested gym program: the weekly mix adapts to how far you are from it."
              error={
                targetWeightOk
                  ? null
                  : `Enter a weight between ${formatWeight(20, weightUnit)} and ${formatWeight(
                      400,
                      weightUnit,
                    )}.`
              }
            >
              <Input
                type="number"
                min={20}
                max={400}
                step="0.5"
                inputMode="decimal"
                placeholder="e.g. 78"
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in grid gap-4">
            <div className="text-primary flex items-center gap-2">
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
                    planId === p.id
                      ? 'border-primary bg-primary/5 ring-primary/30 ring-2'
                      : 'border-border bg-card hover:border-primary/40',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-muted-foreground text-xs font-medium">
                      {p.sessionsPerWeek}× / week
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">{p.description}</p>
                </button>
              ))}
            </div>
            <Field
              id="ob-gym"
              label="Your gym — optional"
              hint="Picking it unlocks a suggested week built from the gym's real class timetable."
            >
              <Select value={gymId} onChange={(e) => setGymId(e.target.value)}>
                <option value="">No gym — build my week manually</option>
                {GYM_PROGRAMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in grid gap-5">
            <div className="text-primary flex items-center gap-2">
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
                    goalMetric === m
                      ? 'border-primary bg-primary/5 ring-primary/30 ring-2'
                      : 'border-border bg-card',
                  )}
                >
                  <span className="font-semibold">{GOAL_METRIC_META[m].label}</span>
                  <span className="text-muted-foreground text-sm">per week</span>
                </button>
              ))}
            </div>
            <Field id="ob-target" label={`Target (${GOAL_METRIC_META[goalMetric].unit})`}>
              <Input
                type="number"
                min={1}
                // step="any": the metric step ladders (e.g. 30 min from min=1)
                // invalidated the prefilled target and blocked progression.
                step="any"
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
              />
            </Field>
          </div>
        )}

        {step === 4 && (
          <div className="animate-fade-in text-center">
            <span className="bg-primary text-primary-foreground mx-auto flex h-16 w-16 items-center justify-center rounded-full">
              <Check className="h-8 w-8" />
            </span>
            <h2 className="mt-6 text-2xl font-bold">You&apos;re all set, {name.trim()}!</h2>
            <Card className="mt-6 text-left">
              <CardContent className="grid gap-2 p-5 text-sm">
                <Row label="Strategy" value={PLANS.find((p) => p.id === planId)?.name ?? ''} />
                <Row label="Rest days / week" value={String(restDays)} />
                <Row label="Weight unit" value={weightUnit} />
                <Row label="Distance unit" value={distanceUnit} />
                <Row
                  label="First goal"
                  value={`${goalTarget} ${GOAL_METRIC_META[goalMetric].unit} / week`}
                />
                {GYM_PROGRAMS.find((p) => p.id === gymId) && (
                  <Row label="Gym" value={GYM_PROGRAMS.find((p) => p.id === gymId)?.name ?? ''} />
                )}
                {parsedTargetWeight() != null && (
                  <Row
                    label="Target weight"
                    value={formatWeight(parsedTargetWeight() ?? 0, weightUnit)}
                  />
                )}
              </CardContent>
            </Card>
            <p className="text-muted-foreground mt-4 text-sm">
              That&apos;s everything — your plan and first goal are ready.{' '}
              {gymId
                ? 'Your suggested gym week will be scheduled automatically.'
                : 'Schedule your first session from the Plan tab, then log it as you go.'}{' '}
              {cloud
                ? 'Everything syncs privately to your account.'
                : 'Everything stays on this device.'}
            </p>
          </div>
        )}
      </main>

      <footer className="mx-auto flex w-full max-w-md flex-wrap items-center justify-between gap-3 px-5 py-6">
        {saveError && (
          <p role="alert" className="text-destructive order-last w-full text-xs">
            {saveError}
          </p>
        )}
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
          <Button onClick={() => void finish()} disabled={!nameOk || saving}>
            {saving ? 'Saving…' : 'Enter dashboard'} <ArrowRight className="h-4 w-4" />
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
