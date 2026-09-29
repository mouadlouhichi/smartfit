import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CalendarCheck2, Check, ChevronRight, Flame } from 'lucide-react-native';
import {
  checkInActions,
  checkInStreak,
  createTranslator,
  formatDateRangeLabel,
  formatLocaleNumber,
  fromKg,
  recordCheckIn,
  resolveLocale,
  round,
  type PendingCheckIn,
} from '@smartfit/core';
import { useStore } from '@/lib/store';
import { Button, Card, Input } from '@/components/ui';

const FEELINGS = [1, 2, 3, 4, 5] as const;

export function WeeklyReviewCard({
  pending,
  answered = false,
  onAnswered,
}: {
  pending: PendingCheckIn;
  answered?: boolean;
  onAnswered?: () => void;
}) {
  const { state, addCheckIn } = useStore();
  const locale = resolveLocale(state.profile.locale);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const [feeling, setFeeling] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [notes, setNotes] = useState('');
  const review = pending.review;
  const actions = useMemo(() => checkInActions(state, review, t), [state, review, t]);
  const streak = checkInStreak(state);
  const deltaKg = review.weightDeltaKg;
  const delta = deltaKg == null ? null : round(fromKg(deltaKg, state.profile.weightUnit), 1);
  const range = formatDateRangeLabel(review.from, review.to, locale);

  function submit() {
    addCheckIn(recordCheckIn(state, { feeling, notes }));
    onAnswered?.();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  return (
    <Card className="border-primary/50">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 flex-row gap-3">
          <View className="bg-primary/10 h-10 w-10 items-center justify-center rounded-xl">
            <CalendarCheck2 color="#f3ff47" size={19} />
          </View>
          <View className="flex-1">
            <Text className="text-primary text-[11px] font-bold tracking-widest uppercase">
              {answered ? t('checkin.title') : t('checkin.due')}
            </Text>
            <Text className="text-foreground mt-0.5 text-base font-bold">
              {t('checkin.weekOf', { week: range })}
            </Text>
          </View>
        </View>
        {streak > 0 ? (
          <View className="bg-secondary flex-row items-center gap-1 rounded-full px-2.5 py-1.5">
            <Flame color="#f3ff47" size={13} />
            <Text className="text-foreground text-[10px] font-semibold">
              {t('checkin.streak', { count: streak })}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="mt-4 flex-row flex-wrap gap-2">
        <Stat
          label={t('checkin.stat.sessions')}
          value={
            review.planned > 0 ? `${review.workouts}/${review.planned}` : String(review.workouts)
          }
          detail={t('checkin.session', { count: review.workouts })}
        />
        <Stat label={t('checkin.stat.minutes')} value={String(review.minutes)} detail="min" />
        <Stat
          label={t('checkin.stat.meals')}
          value={String(review.mealsLogged)}
          detail={t('unit.meals', { count: review.mealsLogged })}
        />
        <Stat
          label={t('checkin.stat.weight')}
          value={
            delta == null ? '—' : `${delta > 0 ? '+' : ''}${formatLocaleNumber(delta, locale)}`
          }
          detail={state.profile.weightUnit}
        />
      </View>

      <Text className="text-muted-foreground mt-3 text-xs">
        {delta == null
          ? t(review.weighedIn ? 'checkin.weightNoComparison' : 'checkin.weightNotLogged')
          : Math.abs(delta) < 0.1
            ? t('checkin.weightFlat')
            : t('checkin.weight', {
                delta: `${delta > 0 ? '+' : ''}${formatLocaleNumber(delta, locale)} ${state.profile.weightUnit}`,
              })}
      </Text>

      <Text className="text-muted-foreground mt-4 text-sm leading-5">
        {t(review.headlineMessage.key, review.headlineMessage.vars)}
      </Text>

      {review.goalsHit.length > 0 || review.goalsMissed.length > 0 ? (
        <View className="mt-3 gap-1.5">
          {review.goalsHit.length > 0 ? (
            <Text className="text-primary text-xs font-semibold">
              {t('checkin.goalsHit', { list: review.goalsHit.join(', ') })}
            </Text>
          ) : null}
          {review.goalsMissed.length > 0 ? (
            <Text className="text-muted-foreground text-xs">
              {t('checkin.goalsMissed', { list: review.goalsMissed.join(', ') })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {answered ? (
        <View className="mt-4 gap-3">
          <View className="flex-row items-center gap-2">
            <Check color="#f3ff47" size={16} />
            <Text className="text-primary text-sm font-semibold">
              {t('checkin.done', { xp: 30 })}
            </Text>
          </View>
          <ActionList actions={actions} title={t('checkin.nextWeek')} />
        </View>
      ) : (
        <View className="mt-4 gap-3">
          <View>
            <Text className="text-foreground mb-2 text-sm font-semibold">
              {t('checkin.feeling')}
            </Text>
            <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
              {FEELINGS.map((value) => {
                const selected = feeling === value;
                const label = t(`checkin.feeling.${value}`);
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setFeeling(value);
                      void Haptics.selectionAsync().catch(() => {});
                    }}
                    className={`rounded-full border px-3 py-2 ${selected ? 'border-primary bg-primary/10' : 'border-border bg-background'}`}
                  >
                    <Text
                      className={`text-xs font-semibold ${selected ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View>
            <Text className="text-foreground mb-1.5 text-sm font-semibold">
              {t('checkin.notes')}
            </Text>
            <Input
              value={notes}
              onChangeText={setNotes}
              placeholder={t('checkin.notesPlaceholder')}
              maxLength={400}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{ height: 84, paddingTop: 10 }}
              accessibilityLabel={t('checkin.notes')}
            />
          </View>
          <Button label={t('checkin.submit')} onPress={submit} />
          <ActionList actions={actions} title={t('checkin.nextWeek')} />
        </View>
      )}
    </Card>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <View className="bg-secondary/60 min-w-[44%] flex-1 rounded-xl px-3 py-2.5">
      <Text className="text-muted-foreground text-[10px] font-semibold uppercase">{label}</Text>
      <View className="mt-1 flex-row items-baseline gap-1">
        <Text className="text-foreground text-lg font-extrabold tabular-nums">{value}</Text>
        <Text className="text-muted-foreground text-[10px]">{detail}</Text>
      </View>
    </View>
  );
}

function ActionList({ actions, title }: { actions: string[]; title: string }) {
  return (
    <View className="bg-secondary/60 rounded-xl p-3">
      <Text className="text-muted-foreground text-[10px] font-bold tracking-wide uppercase">
        {title}
      </Text>
      <View className="mt-2 gap-2">
        {actions.map((action) => (
          <View key={action} className="flex-row items-start gap-2">
            <ChevronRight color="#f3ff47" size={15} />
            <Text className="text-foreground flex-1 text-xs leading-5">{action}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
