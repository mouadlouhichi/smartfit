import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Check,
  Dumbbell,
  Ruler,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react-native';
import {
  PLANS,
  createTranslator,
  fromKg,
  goalMetricLabel,
  goalMetricUnit,
  planDescription,
  planName,
  resolveLocale,
  seededGoalName,
  toISODate,
  toKg,
  uid,
  type FitnessGoal,
  type PlanId,
  type UserProfile,
} from '@smartfit/core';
import { useStore } from '@/lib/store';
import { Button, Card, Input, Label } from '@/components/ui';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';

/** Welcome → about you → strategy → first goal → ready. */
const STEP_COUNT = 5;

const VOLT = '#f3ff47';

type WeightUnit = UserProfile['weightUnit'];
type DistanceUnit = UserProfile['distanceUnit'];

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={cn(
        'flex-1 rounded-xl border px-4 py-3',
        selected ? 'border-primary bg-primary/15' : 'border-border bg-card',
      )}
    >
      <Text
        className={cn(
          'text-center text-sm font-semibold',
          selected ? 'text-primary' : 'text-foreground',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * First-run setup.
 *
 * This is the mobile twin of the web's `OnboardingForm`. Without it a fresh
 * install landed on the dashboard with an empty profile — no name, no units, no
 * plan — and no way to set any of them, because `profile.onboardingDone` was
 * never written anywhere in the native app.
 *
 * Differences from the web version, both deliberate:
 *  - No gym picker. The gym list is loaded server-side from live tenants
 *    (`loadGymPrograms`) and the native app has no server access, so rather than
 *    offer an invented static registry it omits the step. `profile.gymId` stays
 *    unset, which the program engine already treats as "no gym".
 *  - Everything is committed by `completeOnboarding` in a single state update,
 *    so the gate can never release on a half-written profile.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { state, completeOnboarding } = useStore();
  const t = useMemo(
    () => createTranslator(resolveLocale(state.profile.locale)),
    [state.profile.locale],
  );

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(state.profile.name ?? '');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(state.profile.weightUnit ?? 'kg');
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>(
    state.profile.distanceUnit ?? 'km',
  );
  const [restDays, setRestDays] = useState(state.profile.weeklyRestDays ?? 2);
  const [planId, setPlanId] = useState<PlanId>(state.profile.planId ?? 'full-body');
  const [targetWeight, setTargetWeight] = useState(
    state.profile.targetWeightKg != null
      ? String(Number(fromKg(state.profile.targetWeightKg, weightUnit).toFixed(1)))
      : '',
  );
  const [goalMetric, setGoalMetric] = useState<'workouts' | 'minutes'>('workouts');
  const [goalTarget, setGoalTarget] = useState('4');

  /** Null when left empty; validity is enforced by `canNext` before it matters. */
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

  function changeWeightUnit(next: WeightUnit) {
    // Keep the typed value meaningful when the unit flips underneath it.
    const current = targetWeight.trim();
    if (current !== '') {
      const kg = toKg(Number(current), weightUnit);
      if (Number.isFinite(kg)) {
        setTargetWeight(String(Number(fromKg(kg, next).toFixed(1))));
      }
    }
    setWeightUnit(next);
  }

  function finish() {
    if (saving || !nameOk || !targetWeightOk || !goalOk) return;
    setSaving(true);

    const targetKg = parsedTargetWeight();
    const goalDate = toISODate(new Date());
    const goalName = seededGoalName(goalMetric);
    const existingGoal = state.goals.find(
      (goal) =>
        goal.name === goalName &&
        goal.startDate === goalDate &&
        goal.metric === goalMetric &&
        goal.cadence === 'weekly',
    );
    const firstGoal: FitnessGoal | undefined =
      Number(goalTarget) > 0
        ? (existingGoal ?? {
            id: uid('goal'),
            name: goalName,
            metric: goalMetric,
            cadence: 'weekly',
            target: Number(goalTarget),
            startDate: goalDate,
            createdAt: Date.now(),
          })
        : undefined;

    completeOnboarding(
      {
        name: name.trim(),
        weightUnit,
        distanceUnit,
        weeklyRestDays: restDays,
        planId,
        ...(targetKg != null ? { targetWeightKg: targetKg } : {}),
      },
      firstGoal,
    );

    void haptics.success();
    setSaving(false);
    // The gate owns the redirect once `onboardingDone` flips, so this is only a
    // safety net for the case where the user is already on the tabs.
    router.replace('/');
  }

  function next() {
    if (!canNext) return;
    void haptics.selection();
    setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
  }

  function back() {
    void haptics.selection();
    setStep((s) => Math.max(s - 1, 0));
  }

  const isLast = step === STEP_COUNT - 1;

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      <View className="flex-row items-center justify-between px-5 py-4">
        <Text className="text-primary text-lg font-black tracking-tight">SmartFit</Text>
        <Text className="text-muted-foreground text-sm" accessibilityLiveRegion="polite">
          {t('onboarding.step', { current: step + 1, total: STEP_COUNT })}
        </Text>
      </View>

      {/* Progress rail — same five-segment idea as the web wizard. */}
      <View className="flex-row gap-1.5 px-5">
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <View
            key={i}
            className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-primary' : 'bg-border')}
          />
        ))}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {step === 0 && (
          <View className="gap-5">
            <View className="bg-primary/15 h-16 w-16 items-center justify-center rounded-2xl">
              <Sparkles color={VOLT} size={30} />
            </View>
            <Text className="text-foreground text-3xl leading-tight font-black">
              {t('onboarding.welcome.body')}
            </Text>
            <View className="gap-3">
              {[
                { icon: Dumbbell, text: t('onboarding.welcome.point.log') },
                { icon: Target, text: t('onboarding.welcome.point.week') },
                { icon: Ruler, text: t('onboarding.welcome.point.split') },
              ].map(({ icon: Icon, text }) => (
                <View key={text} className="flex-row items-start gap-3">
                  <Icon color={VOLT} size={18} style={{ marginTop: 2 }} />
                  <Text className="text-muted-foreground flex-1 text-sm leading-6">{text}</Text>
                </View>
              ))}
            </View>
            <Card className="flex-row items-start gap-3">
              <ShieldCheck color={VOLT} size={18} style={{ marginTop: 2 }} />
              <Text className="text-muted-foreground flex-1 text-xs leading-5">
                {t('onboarding.welcome.local')}
              </Text>
            </Card>
          </View>
        )}

        {step === 1 && (
          <View className="gap-5">
            <Text className="text-foreground text-2xl font-black">
              {t('onboarding.about.title')}
            </Text>

            <View className="gap-1.5">
              <Label>{t('onboarding.name.label')}</Label>
              <Input
                value={name}
                onChangeText={setName}
                placeholder={t('onboarding.name.placeholder')}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                accessibilityLabel={t('onboarding.name.label')}
              />
            </View>

            <View className="gap-1.5">
              <Label>{t('onboarding.weightUnit.label')}</Label>
              <View className="flex-row gap-2">
                <Choice
                  label="kg"
                  selected={weightUnit === 'kg'}
                  onPress={() => changeWeightUnit('kg')}
                />
                <Choice
                  label="lb"
                  selected={weightUnit === 'lb'}
                  onPress={() => changeWeightUnit('lb')}
                />
              </View>
            </View>

            <View className="gap-1.5">
              <Label>{t('onboarding.distanceUnit.label')}</Label>
              <View className="flex-row gap-2">
                <Choice
                  label="km"
                  selected={distanceUnit === 'km'}
                  onPress={() => setDistanceUnit('km')}
                />
                <Choice
                  label="mi"
                  selected={distanceUnit === 'mi'}
                  onPress={() => setDistanceUnit('mi')}
                />
              </View>
            </View>

            <View className="gap-1.5">
              <Label>{t('onboarding.rest.label')}</Label>
              <View className="flex-row gap-2">
                {[1, 2, 3, 4].map((d) => (
                  <Choice
                    key={d}
                    label={t('onboarding.rest.days', { count: d })}
                    selected={restDays === d}
                    onPress={() => setRestDays(d)}
                  />
                ))}
              </View>
            </View>

            <View className="gap-1.5">
              <Label>{t('onboarding.target.label', { unit: weightUnit })}</Label>
              <Input
                value={targetWeight}
                onChangeText={setTargetWeight}
                placeholder={t('onboarding.target.placeholder')}
                keyboardType="decimal-pad"
                accessibilityLabel={t('onboarding.target.label', { unit: weightUnit })}
              />
              <Text className="text-muted-foreground text-xs leading-5">
                {t('onboarding.target.hint')}
              </Text>
              {!targetWeightOk && (
                <Text className="text-destructive text-xs">
                  {t('onboarding.target.error', { min: 20, max: 400 })}
                </Text>
              )}
            </View>
          </View>
        )}

        {step === 2 && (
          <View className="gap-4">
            <Text className="text-foreground text-2xl font-black">
              {t('onboarding.strategy.title')}
            </Text>
            {PLANS.map((plan) => {
              const selected = plan.id === planId;
              return (
                <Pressable
                  key={plan.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    void haptics.selection();
                    setPlanId(plan.id);
                  }}
                  className={cn(
                    'rounded-2xl border p-4',
                    selected ? 'border-primary bg-primary/15' : 'border-border bg-card',
                  )}
                >
                  <View className="flex-row items-center justify-between gap-2">
                    <Text
                      className={cn(
                        'flex-1 text-base font-bold',
                        selected ? 'text-primary' : 'text-foreground',
                      )}
                    >
                      {planName(plan.id, t)}
                    </Text>
                    <Text className="text-muted-foreground text-xs">
                      {t('onboarding.strategy.perWeek', { count: plan.sessionsPerWeek })}
                    </Text>
                    {selected && <Check color={VOLT} size={18} />}
                  </View>
                  <Text className="text-muted-foreground mt-1.5 text-sm leading-6">
                    {planDescription(plan.id, t)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {step === 3 && (
          <View className="gap-5">
            <Text className="text-foreground text-2xl font-black">
              {t('onboarding.goal.title')}
            </Text>

            <View className="gap-1.5">
              <Label>{t('onboarding.goal.perWeek')}</Label>
              <View className="flex-row gap-2">
                <Choice
                  label={goalMetricLabel('workouts', t)}
                  selected={goalMetric === 'workouts'}
                  onPress={() => setGoalMetric('workouts')}
                />
                <Choice
                  label={goalMetricLabel('minutes', t)}
                  selected={goalMetric === 'minutes'}
                  onPress={() => setGoalMetric('minutes')}
                />
              </View>
            </View>

            <View className="gap-1.5">
              <Label>{t('onboarding.target.label', { unit: goalMetricUnit(goalMetric, t) })}</Label>
              <Input
                value={goalTarget}
                onChangeText={setGoalTarget}
                keyboardType="number-pad"
                accessibilityLabel={t('onboarding.goal.title')}
              />
              {!goalOk && (
                <Text className="text-destructive text-xs">{t('onboarding.goal.targetError')}</Text>
              )}
            </View>
          </View>
        )}

        {step === 4 && (
          <View className="gap-5">
            <View className="bg-primary/15 h-16 w-16 items-center justify-center rounded-2xl">
              <Check color={VOLT} size={30} />
            </View>
            <Text className="text-foreground text-2xl leading-tight font-black">
              {t('onboarding.done.title', { name: name.trim() })}
            </Text>
            <Card className="gap-3">
              <Row label={t('plan.strategy')} value={planName(planId, t)} />
              <Row label={t('onboarding.done.restDays')} value={String(restDays)} />
              <Row label={t('onboarding.done.weightUnit')} value={weightUnit} />
              <Row label={t('onboarding.done.distanceUnit')} value={distanceUnit} />
              <Row
                label={t('onboarding.done.firstGoal')}
                value={`${goalTarget} ${goalMetricUnit(goalMetric, t)} ${t('onboarding.goal.perWeek')}`}
              />
              {parsedTargetWeight() != null && (
                <Row
                  label={t('onboarding.done.targetWeight')}
                  value={`${targetWeight} ${weightUnit}`}
                />
              )}
            </Card>
            <Text className="text-muted-foreground text-sm leading-6">
              {t('onboarding.done.body')}
            </Text>
          </View>
        )}
      </ScrollView>

      <View className="flex-row gap-3 px-5 pt-2">
        {step > 0 && !isLast && (
          <Button
            label={t('onboarding.back')}
            variant="secondary"
            onPress={back}
            className="flex-1"
          />
        )}
        {step === 0 && (
          <Button label={t('onboarding.continue')} onPress={next} className="flex-1" />
        )}
        {step > 0 && !isLast && (
          <Button
            label={t('onboarding.continue')}
            onPress={next}
            disabled={!canNext}
            className="flex-1"
          />
        )}
        {isLast && (
          <Button
            label={saving ? t('onboarding.saving') : t('onboarding.finish')}
            onPress={finish}
            loading={saving}
            className="flex-1"
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="text-muted-foreground text-sm">{label}</Text>
      <Text className="text-foreground flex-1 text-right text-sm font-semibold">{value}</Text>
    </View>
  );
}
