import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CalendarCheck2,
  Flame,
  Footprints,
  Scale,
  Timer,
  Utensils,
  type LucideIcon,
} from 'lucide-react-native';
import {
  activityPeriod,
  bodyValueToDisplay,
  categoryBreakdown,
  checkInHistory,
  createTranslator,
  formatCalories,
  formatDateLabel,
  formatDateRangeLabel,
  formatDistance,
  formatLocaleNumber,
  formatMinutes,
  INTENSITY_META,
  pendingCheckIn,
  resolveLocale,
  round,
  sumMeals,
  weeklySeries,
  type MealSource,
  type PendingCheckIn,
} from '@smartfit/core';
import { useStore } from '@/lib/store';
import { useQuickActions } from '@/components/QuickActionsProvider';
import { Badge, Button, Card, ProgressBar, SectionTitle } from '@/components/ui';
import { BarChart } from '@/components/BarChart';
import { CategoryIcon } from '@/components/CategoryIcon';
import { LineChart } from '@/components/LineChart';
import { WeeklyReviewCard } from '@/components/WeeklyReviewCard';

const RANGES = [
  { key: 'weekly', days: 7 },
  { key: 'monthly', days: 30 },
  { key: 'quarter', days: 90 },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

type MetricIcon = LucideIcon;

const MEAL_SOURCE_KEYS: Record<MealSource | 'unknown', string> = {
  manual: 'progress.mobile.mealSource.manual',
  scan: 'progress.mobile.mealSource.estimate',
  photo: 'progress.mobile.mealSource.photo',
  voice: 'progress.mobile.mealSource.voice',
  'voice+scan': 'progress.mobile.mealSource.voiceScan',
  unknown: 'progress.mobile.mealSource.unknown',
};

const CATEGORY_KEYS: Record<string, string> = {
  'cat-strength': 'progress.mobile.category.strength',
  'cat-cardio': 'progress.mobile.category.cardio',
  'cat-hiit': 'progress.mobile.category.hiit',
  'cat-mobility': 'progress.mobile.category.mobility',
  'cat-sports': 'progress.mobile.category.sports',
  'cat-rest': 'progress.mobile.category.rest',
  __unknown__: 'progress.mobile.category.other',
};

export default function ProgressScreen() {
  const { state } = useStore();
  const { openWorkout, openMeal, openMeasurement } = useQuickActions();
  const locale = resolveLocale(state.profile.locale);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const [range, setRange] = useState<RangeKey>('weekly');
  const [now, setNow] = useState(() => new Date());
  const [answeredReview, setAnsweredReview] = useState<PendingCheckIn | null>(null);

  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
    }, []),
  );

  const rangeOption = RANGES.find((item) => item.key === range)!;
  const period = useMemo(
    () => activityPeriod(state, rangeOption.days, 0, now),
    [state, rangeOption.days, now],
  );
  const previous = useMemo(
    () => activityPeriod(state, rangeOption.days, rangeOption.days, now),
    [state, rangeOption.days, now],
  );
  const rangeLabel = formatDateRangeLabel(period.from, period.to, locale);
  const breakdown = useMemo(() => categoryBreakdown(state, period.sessions), [state, period]);
  const totalCategoryMinutes = breakdown.reduce((total, row) => total + row.minutes, 0);
  const intensity = useMemo(
    () =>
      (['low', 'moderate', 'high'] as const)
        .map((key) => ({
          key,
          label: t(`progress.mobile.intensity.${key}`),
          color: INTENSITY_META[key].color,
          count: period.sessions.filter((session) => session.intensity === key).length,
        }))
        .filter((item) => item.count > 0),
    [period, t],
  );
  const weekly = useMemo(
    () =>
      weeklySeries(state, 8, now).map((week) => ({
        ...week,
        label: formatChartDate(week.key, locale),
      })),
    [state, now, locale],
  );
  const recentWeeksHaveSessions = weekly.some((week) => week.workouts > 0);
  const weeklyMinutes = weekly.reduce((total, week) => total + week.minutes, 0);

  const meals = useMemo(
    () => state.meals.filter((meal) => meal.date >= period.from && meal.date <= period.to),
    [state.meals, period.from, period.to],
  );
  const mealTotals = useMemo(() => sumMeals(meals), [meals]);
  const mealSources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const meal of meals) {
      const key = meal.source ?? 'unknown';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].map(([source, count]) => ({
      source,
      count,
      label: t(
        MEAL_SOURCE_KEYS[source as keyof typeof MEAL_SOURCE_KEYS] ?? MEAL_SOURCE_KEYS.unknown,
      ),
    }));
  }, [meals, t]);

  const weightPoints = useMemo(
    () =>
      state.bodyLogs
        .filter((log) => log.unit === 'weight')
        .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
        .slice(-8)
        .map((log) => ({
          date: log.date,
          label: formatDateLabel(log.date, locale),
          value: round(bodyValueToDisplay(log.value, 'weight', state.profile), 1),
        })),
    [state.bodyLogs, state.profile, locale],
  );
  const bodyUnit = state.profile.weightUnit;
  const latestWeight = weightPoints.at(-1)?.value;
  const weightChange =
    weightPoints.length > 1
      ? round(weightPoints[weightPoints.length - 1].value - weightPoints[0].value, 1)
      : null;

  const pendingReview = useMemo(() => pendingCheckIn(state, now), [state, now]);
  const reviewToShow = pendingReview ?? answeredReview;
  const history = useMemo(() => checkInHistory(state).slice(0, 4), [state]);

  const showReviewAsAnswered = () => {
    if (pendingReview) setAnsweredReview(pendingReview);
  };

  const weeklyRows = weekly.map((week) =>
    t('progress.chart.weekRow', {
      label: week.label,
      minutes: week.minutes,
      workouts: week.workouts,
    }),
  );

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4 pb-28">
        <View className="gap-1">
          <Text className="text-primary text-[11px] font-bold tracking-[0.18em] uppercase">
            {t('progress.eyebrow')}
          </Text>
          <Text className="text-foreground text-2xl font-extrabold">{t('progress.title')}</Text>
          <Text className="text-muted-foreground text-sm leading-5">
            {t('progress.mobile.subtitle')}
          </Text>
          <Text className="text-muted-foreground mt-1 text-xs">
            {t('progress.sessionsLogged', { count: state.sessions.length })}
          </Text>
        </View>

        <View accessibilityRole="tablist" accessibilityLabel={t('progress.range.aria')}>
          <View className="bg-secondary flex-row rounded-full p-1">
            {RANGES.map((item) => {
              const selected = range === item.key;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="tab"
                  accessibilityLabel={t(`progress.range.${item.key}`)}
                  accessibilityState={{ selected }}
                  onPress={() => setRange(item.key)}
                  className={`min-h-10 flex-1 items-center justify-center rounded-full px-2 ${selected ? 'bg-primary' : ''}`}
                >
                  <Text
                    className={`text-xs font-bold ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                  >
                    {t(`progress.range.${item.key}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Card>
          <View className="mb-3 flex-row items-center justify-between gap-2">
            <SectionTitle>{t('progress.window', { count: rangeOption.days })}</SectionTitle>
            <Text className="text-muted-foreground text-xs font-semibold">{rangeLabel}</Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            <MetricTile
              icon={CalendarCheck2}
              label={t('progress.stat.sessions')}
              value={String(period.workouts)}
              change={periodChange(
                period.workouts,
                previous.workouts,
                previous.workouts > 0,
                (n) => String(n),
                t,
              )}
            />
            <MetricTile
              icon={Timer}
              label={t('progress.stat.activeTime')}
              value={formatMinutes(period.minutes)}
              change={periodChange(
                period.minutes,
                previous.minutes,
                previous.workouts > 0,
                formatMinutes,
                t,
              )}
            />
            <MetricTile
              icon={Flame}
              label={t('progress.mobile.caloriesEstimated')}
              value={formatCalories(period.calories)}
              change={periodChange(
                period.calories,
                previous.calories,
                previous.workouts > 0,
                formatCalories,
                t,
              )}
            />
            <MetricTile
              icon={Footprints}
              label={t('progress.stat.distance')}
              value={formatDistance(period.distance, state.profile.distanceUnit)}
              change={periodChange(
                period.distance,
                previous.distance,
                previous.workouts > 0,
                (n) => formatDistance(n, state.profile.distanceUnit),
                t,
              )}
            />
          </View>
          {previous.workouts > 0 ? (
            <Text className="text-muted-foreground mt-2 text-[10px]">
              {t('progress.mobile.comparedWith', {
                range: formatDateRangeLabel(previous.from, previous.to, locale),
              })}
            </Text>
          ) : null}
          <View className="border-border mt-3 border-t pt-3">
            <Text className="text-muted-foreground text-xs leading-5">
              {t('progress.mobile.source.sessions')}
            </Text>
            {period.sessions.length === 0 ? (
              <View className="mt-3 gap-2">
                <Text className="text-muted-foreground text-sm">
                  {t('progress.mobile.emptyPeriod')}
                </Text>
                <Button label={t('progress.mobile.addWorkout')} onPress={openWorkout} />
              </View>
            ) : null}
          </View>
        </Card>

        <Card>
          <View className="mb-3 flex-row items-center justify-between gap-2">
            <SectionTitle>{t('progress.volume.title')}</SectionTitle>
            {weeklyMinutes > 0 ? (
              <Text className="text-primary text-xs font-bold tabular-nums">
                {t('progress.volume.total', { value: formatMinutes(weeklyMinutes) })}
              </Text>
            ) : null}
          </View>
          {recentWeeksHaveSessions ? (
            <BarChart
              data={weekly.map((week) => ({ label: week.label, value: week.minutes }))}
              accessibilityLabel={t('progress.volume.aria')}
              accessibilityDetails={weeklyRows}
            />
          ) : (
            <Text className="text-muted-foreground py-4 text-sm">
              {t('progress.mobile.weeks.empty')}
            </Text>
          )}
        </Card>

        <Card>
          <SectionTitle>{t('progress.mix.title')}</SectionTitle>
          {breakdown.length > 0 ? (
            <View className="gap-3">
              {breakdown.map(({ category, minutes }) => {
                const categoryKey = CATEGORY_KEYS[category.id];
                return (
                  <View key={category.id} className="flex-row items-center gap-3">
                    <View
                      className="h-9 w-9 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${category.color}1a` }}
                    >
                      <CategoryIcon name={category.icon} color={category.color} size={16} />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row justify-between gap-2">
                        <Text className="text-foreground flex-1 text-sm font-medium">
                          {categoryKey ? t(categoryKey) : category.name}
                        </Text>
                        <Text className="text-muted-foreground text-xs">
                          {formatMinutes(minutes)}
                        </Text>
                      </View>
                      <View className="mt-1.5">
                        <ProgressBar
                          value={(minutes / Math.max(1, totalCategoryMinutes)) * 100}
                          color={category.color}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text className="text-muted-foreground text-sm">
              {t('progress.mobile.category.empty')}
            </Text>
          )}
        </Card>

        <Card>
          <SectionTitle>{t('progress.intensity.title')}</SectionTitle>
          {period.workouts > 0 ? (
            <View className="gap-3">
              {intensity.map((item) => (
                <View key={item.key}>
                  <View className="mb-1.5 flex-row justify-between">
                    <Text className="text-foreground text-sm font-medium">{item.label}</Text>
                    <Text className="text-muted-foreground text-xs tabular-nums">
                      {item.count} · {Math.round((item.count / period.workouts) * 100)}%
                    </Text>
                  </View>
                  <ProgressBar value={(item.count / period.workouts) * 100} color={item.color} />
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-muted-foreground text-sm">
              {t('progress.mobile.intensity.empty')}
            </Text>
          )}
        </Card>

        <Card>
          <View className="mb-2 flex-row items-center gap-2">
            <Utensils color="#f3ff47" size={17} />
            <Text className="text-foreground text-base font-bold">
              {t('progress.mobile.nutrition.title')}
            </Text>
          </View>
          <Text className="text-muted-foreground mb-3 text-xs leading-5">
            {t('progress.mobile.nutrition.subtitle')}
          </Text>
          {meals.length > 0 ? (
            <>
              <View className="flex-row gap-2">
                <NutritionStat
                  label={t('progress.mobile.nutrition.calories')}
                  value={formatCalories(mealTotals.calories)}
                />
                <NutritionStat
                  label={t('progress.mobile.nutrition.protein')}
                  value={`${Math.round(mealTotals.protein)} g`}
                />
              </View>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {mealSources.map(({ source, count, label }) => (
                  <Badge key={source} color={source === 'scan' ? '#f3ff47' : undefined}>
                    {label} · {count}
                  </Badge>
                ))}
              </View>
            </>
          ) : (
            <View className="gap-3">
              <Text className="text-muted-foreground text-sm">
                {t('progress.mobile.nutrition.empty')}
              </Text>
              <Button label={t('progress.mobile.addMeal')} onPress={openMeal} variant="secondary" />
            </View>
          )}
        </Card>

        <Card>
          <View className="mb-2 flex-row items-center gap-2">
            <Scale color="#f3ff47" size={18} />
            <Text className="text-foreground text-base font-bold">
              {t('progress.mobile.body.title')}
            </Text>
          </View>
          <Text className="text-muted-foreground mb-3 text-xs leading-5">
            {t('progress.mobile.body.subtitle')}
          </Text>
          {weightPoints.length === 0 ? (
            <View className="gap-3">
              <Text className="text-muted-foreground text-sm">
                {t('progress.mobile.body.empty')}
              </Text>
              <Button
                label={t('progress.mobile.addWeighIn')}
                onPress={openMeasurement}
                variant="secondary"
              />
            </View>
          ) : (
            <>
              <View className="flex-row items-end justify-between gap-2">
                <View>
                  <Text className="text-muted-foreground text-xs">
                    {t('progress.mobile.body.latest')}
                  </Text>
                  <Text className="text-foreground mt-1 text-3xl font-extrabold tabular-nums">
                    {formatLocaleNumber(latestWeight!, locale)}{' '}
                    <Text className="text-muted-foreground text-base font-semibold">
                      {bodyUnit}
                    </Text>
                  </Text>
                </View>
                {weightChange != null ? (
                  <View className="items-end">
                    <Text className="text-muted-foreground text-xs">
                      {t('progress.mobile.body.change')}
                    </Text>
                    <Text className="text-foreground mt-1 text-sm font-bold tabular-nums">
                      {weightChange > 0 ? '+' : ''}
                      {formatLocaleNumber(weightChange, locale)} {bodyUnit}
                    </Text>
                  </View>
                ) : null}
              </View>
              {weightPoints.length > 1 ? (
                <View className="mt-3">
                  <Text className="text-muted-foreground mb-2 text-xs">
                    {formatDateRangeLabel(weightPoints[0].date, weightPoints.at(-1)!.date, locale)}
                  </Text>
                  <LineChart
                    data={weightPoints}
                    accessibilityLabel={`${t('progress.mobile.body.chartAria')}, ${bodyUnit}`}
                    formatValue={(value) => `${formatLocaleNumber(value, locale)} ${bodyUnit}`}
                  />
                </View>
              ) : (
                <Text className="text-muted-foreground mt-3 text-sm">
                  {t('progress.mobile.body.single')}
                </Text>
              )}
            </>
          )}
        </Card>

        {reviewToShow ? (
          <WeeklyReviewCard
            pending={reviewToShow}
            answered={!pendingReview}
            onAnswered={showReviewAsAnswered}
          />
        ) : null}

        {history.length > 0 ? (
          <Card>
            <SectionTitle>{t('checkin.history')}</SectionTitle>
            <View className="gap-2">
              {history.map((entry) => (
                <View key={entry.id} className="bg-secondary/60 rounded-xl px-3 py-2.5">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="text-foreground text-xs font-semibold">
                      {t('checkin.weekOf', { week: formatDateLabel(entry.weekOf, locale) })}
                    </Text>
                    <Text className="text-primary text-xs font-bold">
                      {t(`checkin.feeling.${entry.feeling}`)}
                    </Text>
                  </View>
                  <Text className="text-muted-foreground mt-1 text-xs">
                    {t('checkin.session', { count: entry.workouts })} ·{' '}
                    {t('checkin.minutes', { count: entry.minutes })}
                    {entry.notes ? ` · ${entry.notes}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  change,
}: {
  icon: MetricIcon;
  label: string;
  value: string;
  change: string | null;
}) {
  return (
    <View className="bg-secondary/60 min-w-[47%] flex-1 rounded-xl p-3">
      <View className="flex-row items-center gap-1.5">
        <Icon color="#f3ff47" size={14} />
        <Text className="text-muted-foreground flex-1 text-[10px] font-semibold uppercase">
          {label}
        </Text>
      </View>
      <Text className="text-foreground mt-2 text-lg font-extrabold tabular-nums">{value}</Text>
      {change ? (
        <Text className="text-muted-foreground mt-1 text-[10px]" accessibilityLabel={change}>
          {change}
        </Text>
      ) : null}
    </View>
  );
}

function NutritionStat({ label, value }: { label: string; value: string }) {
  return (
    <View className="bg-secondary/60 min-w-[47%] flex-1 rounded-xl p-3">
      <Text className="text-muted-foreground text-[10px] font-semibold uppercase">{label}</Text>
      <Text className="text-foreground mt-1.5 text-lg font-extrabold tabular-nums">{value}</Text>
    </View>
  );
}

function periodChange(
  current: number,
  previous: number,
  hasPrevious: boolean,
  format: (value: number) => string,
  translate: ReturnType<typeof createTranslator>,
): string | null {
  if (!hasPrevious) return null;
  const difference = current - previous;
  const value = `${difference > 0 ? '+' : difference < 0 ? '−' : ''}${format(Math.abs(difference))}`;
  return translate('progress.mobile.compare', { value });
}

function formatChartDate(iso: string, locale: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}
