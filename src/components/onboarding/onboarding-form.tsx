'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Ruler, Target, UserRound } from 'lucide-react';
import { Wordmark } from '@/components/brand';
import { OrbitHero, VoltHeadline, PillCta, GradeRing } from '@/components/volt/volt-kit';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n-context';
import { useStore } from '@/lib/store-context';
import { useAuth } from '@/lib/firebase/auth-context';
import {
  PLANS,
  findGymProgram,
  goalMetricLabel,
  goalMetricUnit,
  planDescription,
  planName,
  seededGoalName,
  formatWeight,
  fromKg,
  suggestProgram,
  suggestedToSchedule,
  toKg,
  uid,
} from '@smartfit/core';
import type { GymProgram } from '@smartfit/core';
import Link from 'next/link';
import { toISODate } from '@smartfit/core';
import { env } from '@/lib/env';

/** Welcome → about you → strategy → first goal → ready. */
const STEP_COUNT = 5;

/**
 * The client half of onboarding. The gym list is *not* fetched here — the
 * server route loads the live tenants (`loadGymPrograms`) and passes them in,
 * so the picker offers real gyms and nothing else: no static registry, no
 * member-invented gyms.
 */
export function OnboardingForm({ gyms }: { gyms: GymProgram[] }) {
  const router = useRouter();
  const { t } = useI18n();
  const { state, completeOnboarding, flushWrites, cloud } = useStore();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // Announce the new step rather than leaving keyboard focus in the footer.
    if (step > 0) mainRef.current?.querySelector<HTMLElement>('h1, h2')?.focus();
  }, [step]);
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
    if (saving || !nameOk || !targetWeightOk || !goalOk) return;
    setSaving(true);
    setSaveError(null);
    const goalName = seededGoalName(goalMetric);
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
    const gymProgram = findGymProgram(gyms, gymId);
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
      setSaveError(t('onboarding.saveError'));
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
  const goalOk = Number.isFinite(Number(goalTarget)) && Number(goalTarget) >= 1;
  const canNext = step === 1 ? nameOk && targetWeightOk : step === 3 ? goalOk : true;

  return (
    <div className="onboarding bg-background text-foreground flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <Wordmark />
        <span aria-live="polite" aria-atomic="true" className="text-muted-foreground text-sm">
          {t('onboarding.step', { current: step + 1, total: STEP_COUNT })}
        </span>
      </header>

      {/* Progress */}
      <div aria-hidden="true" className="mx-auto flex w-full max-w-md gap-1.5 px-5">
        {Array.from({ length: STEP_COUNT }, (_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i <= step ? 'bg-primary' : 'bg-border',
            )}
          />
        ))}
      </div>

      <main
        ref={mainRef}
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-8"
      >
        {step === 0 && (
          <div className="animate-fade-in text-center">
            <OrbitHero size={230} className="mx-auto" />
            <VoltHeadline className="mx-auto mt-6 max-w-md text-[1.7rem] sm:text-3xl" />
            <p className="text-muted-foreground mx-auto mt-4 max-w-sm">
              {t('onboarding.welcome.body')}{' '}
              {cloud ? t('onboarding.welcome.sync') : t('onboarding.welcome.local')}
            </p>
            <div className="mx-auto mt-6 grid max-w-sm gap-2 text-left text-sm">
              {[
                t('onboarding.welcome.point.split'),
                t('onboarding.welcome.point.week'),
                t('onboarding.welcome.point.log'),
              ].map((point) => (
                <div
                  key={point}
                  className="border-border bg-card flex items-center gap-2.5 rounded-2xl border p-3.5 font-semibold"
                >
                  <span className="bg-primary/10 text-primary grid h-6 w-6 shrink-0 place-items-center rounded-full">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  {point}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="animate-fade-in grid gap-5">
            <div className="text-primary flex items-center gap-2">
              <UserRound className="h-5 w-5" />
              <h2 tabIndex={-1} className="text-xl font-bold">
                {t('onboarding.about.title')}
              </h2>
            </div>
            <Field id="ob-name" label={t('onboarding.name.label')}>
              <Input
                className="border-border bg-card"
                autoComplete="given-name"
                required
                placeholder={t('onboarding.name.placeholder')}
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field id="ob-unit" label={t('onboarding.weightUnit.label')}>
              <Select
                className="border-border bg-card"
                value={weightUnit}
                onChange={(e) => changeWeightUnit(e.target.value as 'kg' | 'lb')}
              >
                <option value="kg">{t('profile.unit.kilograms')}</option>
                <option value="lb">{t('profile.unit.pounds')}</option>
              </Select>
            </Field>
            <Field id="ob-dist" label={t('onboarding.distanceUnit.label')}>
              <Select
                className="border-border bg-card"
                value={distanceUnit}
                onChange={(e) => setDistanceUnit(e.target.value as 'km' | 'mi')}
              >
                <option value="km">{t('profile.unit.kilometres')}</option>
                <option value="mi">{t('profile.unit.miles')}</option>
              </Select>
            </Field>
            <Field id="ob-rest" label={t('onboarding.rest.label')}>
              <Select
                className="border-border bg-card"
                value={restDays}
                onChange={(e) => setRestDays(Number(e.target.value))}
              >
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {t('onboarding.rest.days', { count: n })}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              id="ob-target-weight"
              label={t('onboarding.target.label', { unit: weightUnit })}
              hint={t('onboarding.target.hint')}
              error={
                targetWeightOk
                  ? null
                  : t('onboarding.target.error', {
                      min: formatWeight(20, weightUnit),
                      max: formatWeight(400, weightUnit),
                    })
              }
            >
              <Input
                className="border-border bg-card"
                type="number"
                min={fromKg(20, weightUnit)}
                max={fromKg(400, weightUnit)}
                step="any"
                inputMode="decimal"
                placeholder={t('onboarding.target.placeholder')}
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
              <h2 tabIndex={-1} className="text-xl font-bold">
                {t('onboarding.strategy.title')}
              </h2>
            </div>
            <div className="grid gap-2">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={planId === p.id}
                  onClick={() => setPlanId(p.id)}
                  className={cn(
                    'focus-visible:ring-ring focus-visible:ring-offset-background rounded-3xl border p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none',
                    planId === p.id
                      ? 'border-primary bg-volt/[0.06]'
                      : 'border-border bg-card hover:border-volt/40',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold">
                      {planId === p.id && (
                        <span
                          aria-hidden="true"
                          className="bg-volt text-ink grid h-5 w-5 shrink-0 place-items-center rounded-full"
                        >
                          <Check className="h-3 w-3" strokeWidth={3.5} />
                        </span>
                      )}
                      {planName(p.id, t)}
                    </span>
                    <span className="text-muted-foreground text-xs font-medium">
                      {t('onboarding.strategy.perWeek', { count: p.sessionsPerWeek })}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">{planDescription(p.id, t)}</p>
                </button>
              ))}
            </div>
            <Field id="ob-gym" label={t('onboarding.gym.label')} hint={t('onboarding.gym.hint')}>
              <Select
                className="border-border bg-card"
                value={gymId}
                onChange={(e) => setGymId(e.target.value)}
              >
                <option value="">{t('onboarding.gym.none')}</option>
                {gyms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            {gyms.length > 0 && (
              <p className="text-muted-foreground -mt-2 text-xs">
                {t('onboarding.gym.live')}{' '}
                <Link href="/gyms" className="text-primary font-semibold hover:underline">
                  {t('onboarding.gym.browse')}
                </Link>
                .
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in grid gap-5">
            <div className="text-primary flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              <h2 tabIndex={-1} className="text-xl font-bold">
                {t('onboarding.goal.title')}
              </h2>
            </div>
            <div className="grid gap-2">
              {(['workouts', 'minutes'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={goalMetric === m}
                  onClick={() => {
                    setGoalMetric(m);
                    setGoalTarget(m === 'workouts' ? '4' : '150');
                  }}
                  className={cn(
                    'focus-visible:ring-ring focus-visible:ring-offset-background flex items-center justify-between gap-3 rounded-3xl border p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none',
                    goalMetric === m
                      ? 'border-primary bg-volt/[0.06]'
                      : 'border-border bg-card hover:border-volt/40',
                  )}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    {goalMetric === m && (
                      <span
                        aria-hidden="true"
                        className="bg-volt text-ink grid h-5 w-5 shrink-0 place-items-center rounded-full"
                      >
                        <Check className="h-3 w-3" strokeWidth={3.5} />
                      </span>
                    )}
                    {goalMetricLabel(m, t)}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {t('onboarding.goal.perWeek')}
                  </span>
                </button>
              ))}
            </div>
            <Field
              id="ob-target"
              label={t('goal.targetLabel', { unit: goalMetricUnit(goalMetric, t) })}
              error={goalOk ? null : t('onboarding.goal.targetError')}
            >
              <Input
                className="border-border bg-card"
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
            <div className="relative mx-auto grid w-fit place-items-center">
              <GradeRing value={100} size={96} label={t('onboarding.done.ring')} />
              <Check
                tabIndex={-1}
                aria-hidden="true"
                className="text-primary absolute h-7 w-7"
                strokeWidth={3}
              />
            </div>
            <h2 tabIndex={-1} className="mt-6 text-2xl font-bold">
              {t('onboarding.done.title', { name: name.trim() })}
            </h2>
            <Card className="mt-6 text-left">
              <CardContent className="grid gap-2 p-5 text-sm">
                <Row label={t('plan.strategy')} value={planName(planId, t)} />
                <Row label={t('onboarding.done.restDays')} value={String(restDays)} />
                <Row label={t('onboarding.done.weightUnit')} value={weightUnit} />
                <Row label={t('onboarding.done.distanceUnit')} value={distanceUnit} />
                <Row
                  label={t('onboarding.done.firstGoal')}
                  value={t('onboarding.done.goalValue', {
                    target: goalTarget,
                    unit: goalMetricUnit(goalMetric, t),
                  })}
                />
                {findGymProgram(gyms, gymId) && (
                  <Row
                    label={t('onboarding.done.gym')}
                    value={findGymProgram(gyms, gymId)?.name ?? ''}
                  />
                )}
                {parsedTargetWeight() != null && (
                  <Row
                    label={t('onboarding.done.targetWeight')}
                    value={formatWeight(parsedTargetWeight() ?? 0, weightUnit)}
                  />
                )}
              </CardContent>
            </Card>
            <p className="text-muted-foreground mt-4 text-sm">
              {t('onboarding.done.body')}{' '}
              {gymId ? t('onboarding.done.bodyGym') : t('onboarding.done.bodyManual')}{' '}
              {cloud ? t('onboarding.done.sync') : t('onboarding.done.local')}
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
          disabled={step === 0 || saving}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          <ArrowLeft className="h-4 w-4" /> {t('onboarding.back')}
        </Button>
        {step < STEP_COUNT - 1 ? (
          <PillCta
            label={t('onboarding.continue')}
            cap="arrow"
            disabled={!canNext}
            onClick={() => canNext && setStep((s) => s + 1)}
          />
        ) : (
          <PillCta
            label={saving ? t('onboarding.saving') : t('onboarding.finish')}
            loading={saving}
            disabled={!nameOk || !targetWeightOk || !goalOk}
            onClick={() => void finish()}
          />
        )}
      </footer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{value}</span>
    </div>
  );
}
