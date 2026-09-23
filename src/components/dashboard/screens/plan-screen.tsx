'use client';

import { useMemo, useState } from 'react';
import {
  CalendarCheck2,
  ChevronRight,
  Clock,
  Download,
  History,
  Loader2,
  Moon,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Tag,
} from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useI18n } from '@/lib/i18n-context';
import { useModals } from '../modal-context';
import { useConfirm } from '../confirm-context';
import { useToast } from '@/components/ui/toast';
import { categoryArt } from '@/lib/category-art';
import { EmptyState } from '../empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { CategoryIcon } from '@/components/category-icon';
import { INTENSITY_META, PLANS, weekdayLabel, weekdayLabels } from '@smartfit/core';
import {
  categoryById,
  findGymProgram,
  getPlan,
  suggestProgram,
  suggestedToSchedule,
  suggestSummary,
} from '@smartfit/core';
import { formatCalories, formatDateLabel, formatDistance, formatMinutes } from '@smartfit/core';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { GymProgram, ScheduledWorkout } from '@smartfit/core';
import { ExerciseLibrary } from '../exercise-library';
import { ScreenHeader } from '../screen-header';
import { GymPicker } from '../gym/gym-picker';

/** Small neutral metadata pill used across rows. */
function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap tabular-nums">
      {children}
    </span>
  );
}

export function PlanScreen() {
  const {
    state,
    updateProfile,
    updateSchedule,
    replaceSchedule,
    hasMoreSessions,
    loadingMore,
    loadEarlierSessions,
  } = useStore();
  const { openModal, openWith } = useModals();
  const { t, locale } = useI18n();
  const confirm = useConfirm();
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [pageError, setPageError] = useState<string | null>(null);

  // The selected gym is a tenant, resolved against the live list the
  // GymPicker loads; suggestions are built from its real timetable and
  // recomputed whenever the strategy, latest weight log or target changes.
  const [gymPrograms, setGymPrograms] = useState<GymProgram[]>([]);
  const gymProgram = useMemo(
    () => findGymProgram(gymPrograms, state.profile.gymId),
    [gymPrograms, state.profile.gymId],
  );
  // A gym whose timetable yields nothing importable (no published classes)
  // shows the card's explanatory state rather than an "Import 0" button.
  const suggested = useMemo(
    () => (gymProgram ? suggestProgram(state, gymProgram) : []),
    [state, gymProgram],
  );
  const mixLine = suggestSummary(state);

  async function importSuggestion() {
    const ok = await confirm({
      title: t('plan.import.title'),
      body: gymProgram
        ? t('plan.import.body', { program: gymProgram.name })
        : t('plan.import.bodyGeneric'),
      confirmLabel: t('plan.import.confirm'),
      destructive: true,
    });
    if (ok) {
      replaceSchedule(suggestedToSchedule(suggested));
      toast(t('plan.import.done', { count: suggested.length }));
    }
  }

  async function loadMore() {
    setPageError(null);
    try {
      await loadEarlierSessions();
    } catch (e) {
      setPageError(e instanceof Error ? e.message : t('plan.error.loadOlder'));
    }
  }

  const plan = getPlan(state.profile.planId);
  const today = new Date().getDay();

  const scheduledByDay = useMemo(() => {
    const map = new Map<number, ScheduledWorkout[]>();
    for (const s of state.schedule) {
      const arr = map.get(s.weekday) ?? [];
      arr.push(s);
      map.set(s.weekday, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay));
    return map;
  }, [state.schedule]);

  const log = useMemo(() => {
    const sorted = [...state.sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
    return filter === 'all' ? sorted : sorted.filter((s) => s.categoryId === filter);
  }, [state.sessions, filter]);

  return (
    <div className="grid gap-5">
      <ScreenHeader
        eyebrow={t('plan.eyebrow')}
        title={t('plan.title')}
        subtitle={t('plan.subtitle')}
        action={
          <Button onClick={() => openModal('schedule')}>
            <Plus className="h-4 w-4" /> {t('plan.schedule')}
          </Button>
        }
      />

      {/* ── Plan strategy ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl">
              <CalendarCheck2 className="h-4.5 w-4.5" aria-hidden />
            </span>
            {t('plan.strategy')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-lg font-extrabold tracking-tight">{plan.name}</p>
              <Badge variant="accent">{t('plan.perWeek', { count: plan.sessionsPerWeek })}</Badge>
            </div>
            <Field id="plan-strategy" label={t('plan.strategyLabel')} hint={plan.description}>
              <Select
                value={state.profile.planId}
                onChange={(e) => updateProfile({ planId: e.target.value as typeof plan.id })}
              >
                {PLANS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {t('plan.perWeek', { count: p.sessionsPerWeek })}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-2">
            <span className="text-muted-foreground text-xs font-medium">
              {t('plan.weeklySplit')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {weekdayLabels(locale, 'short').map((d, i) => {
                const slot = plan.split.find((s) => s.weekday === i);
                const cat = state.categories.find((c) => c.id === slot?.categoryId);
                return (
                  <span
                    key={d}
                    className={cn(
                      'flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-bold',
                      slot ? 'text-white' : 'bg-secondary text-muted-foreground',
                      i === today && 'ring-primary ring-offset-card ring-2 ring-offset-2',
                    )}
                    style={slot ? { backgroundColor: cat?.color ?? 'var(--primary)' } : undefined}
                    title={slot?.focus}
                  >
                    {d}
                  </span>
                );
              })}
            </div>
            <p className="text-muted-foreground text-xs">{t('plan.weeklySplitHint')}</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Your gym — real tenants, their live timetables ── */}
      <GymPicker programs={gymPrograms} onLoad={setGymPrograms} />

      {/* ── Quick import: the selected gym's suggested week ── */}
      {gymProgram && gymProgram.week.length > 0 && suggested.length > 0 && (
        <Card className="border-volt/20 bg-volt/5">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2.5 text-base">
              <span className="bg-volt text-ink flex h-9 w-9 items-center justify-center rounded-xl">
                <Sparkles className="h-4.5 w-4.5" aria-hidden />
              </span>
              {t('plan.quickImport')}
              <Badge variant="accent">{gymProgram.name}</Badge>
            </CardTitle>
            <p className="text-muted-foreground text-xs">{mixLine}</p>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ul className="grid gap-1.5">
              {suggested.slice(0, 3).map((s) => {
                const meta = INTENSITY_META[s.gymClass.intensity];
                return (
                  <li
                    key={`${s.weekday}-${s.time}-${s.gymClass.id}`}
                    className="bg-secondary/50 flex items-center gap-2.5 rounded-xl px-3 py-2 min-[480px]:gap-3"
                  >
                    <span className="w-[4.25rem] shrink-0">
                      <span className="block truncate text-xs font-bold tabular-nums">
                        {weekdayLabel(s.weekday, locale)}
                      </span>
                      <span className="text-muted-foreground block text-[11px] font-semibold tabular-nums">
                        {s.time}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {s.gymClass.name}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {formatMinutes(s.gymClass.minutes)}
                    </span>
                    <span
                      className="flex shrink-0 items-center gap-1.5 text-xs font-bold whitespace-nowrap"
                      style={{ color: meta.color }}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: meta.color }}
                        aria-hidden
                      />
                      {meta.label}
                    </span>
                  </li>
                );
              })}
              {suggested.length > 3 && (
                <li className="text-muted-foreground text-center text-xs">
                  +{suggested.length - 3} more classes
                </li>
              )}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">{gymProgram.hours}</p>
              <Button
                size="sm"
                onClick={importSuggestion}
                disabled={suggested.length === 0}
                data-testid="import-suggested-week"
                className="rounded-full"
              >
                <Download className="h-4 w-4" /> Import {suggested.length} sessions
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Week schedule ──────────────────────────────────────────────── */}
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t('plan.yourWeek')}</h2>
          <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-xs font-bold tabular-nums">
            {t('plan.activeSessions', { count: state.schedule.filter((x) => x.active).length })}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {weekdayLabels(locale, 'long').map((day, i) => {
            const items = scheduledByDay.get(i) ?? [];
            const isToday = i === today;
            return (
              <Card
                key={day}
                className={cn(
                  isToday && 'border-primary/50 ring-primary/25 ring-1',
                  !isToday && 'hover:shadow-md',
                )}
              >
                <CardContent className="p-4">
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold',
                          isToday
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground',
                        )}
                        aria-hidden
                      >
                        {day.slice(0, 1)}
                      </span>
                      <span className={cn('text-sm font-bold', isToday && 'text-primary')}>
                        {day}
                      </span>
                      {isToday && (
                        <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase">
                          {t('time.today')}
                        </span>
                      )}
                    </span>
                    {items.length === 0 && (
                      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium">
                        <Moon className="h-3.5 w-3.5" aria-hidden /> {t('plan.rest')}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-2">
                    {items.map((s) => {
                      const cat = state.categories.find((c) => c.id === s.categoryId);
                      const meta = INTENSITY_META[s.intensity];
                      return (
                        <div
                          key={s.id}
                          className={cn(
                            'bg-secondary/60 flex items-center gap-2 rounded-xl p-2.5 min-[480px]:gap-3',
                            !s.active && 'opacity-60',
                          )}
                        >
                          {categoryArt(s.categoryId) ? (
                            /* eslint-disable-next-line @next/next/no-img-element -- static export */
                            <img
                              src={categoryArt(s.categoryId) ?? ''}
                              alt=""
                              aria-hidden
                              className="h-10 w-10 shrink-0 rounded-lg object-cover shadow-sm"
                            />
                          ) : (
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                              style={{
                                backgroundColor: `color-mix(in srgb, ${cat?.color ?? 'var(--chart-2)'} 12%, transparent)`,
                                color: cat?.color ?? 'var(--primary)',
                              }}
                            >
                              <CategoryIcon name={cat?.icon ?? 'activity'} size={16} />
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">{s.title}</p>
                            <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
                              <span className="font-semibold capitalize">{s.timeOfDay}</span>
                              <span aria-hidden>·</span>
                              <span className="tabular-nums">{formatMinutes(s.durationMin)}</span>
                              <span aria-hidden>·</span>
                              <span className="inline-flex items-center gap-1">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: meta.color }}
                                  aria-hidden
                                />
                                {meta.label}
                              </span>
                              {(s.exercises?.length ?? 0) > 0 && (
                                <>
                                  <span aria-hidden>·</span>
                                  <span className="bg-primary/10 text-primary rounded-full px-1.5 py-px text-[10px] font-bold">
                                    {s.exercises!.length} exercises
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              openWith({
                                kind: 'runner',
                                title: s.title,
                                categoryId: s.categoryId,
                                intensity: s.intensity,
                                scheduleId: s.id,
                                exercises: s.exercises,
                              })
                            }
                            className="bg-primary text-primary-foreground shadow-primary/25 flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-md transition-transform hover:scale-105 active:scale-95"
                            aria-label={`Start ${s.title}`}
                          >
                            <Play className="ml-0.5 h-4 w-4" />
                          </button>
                          {/* The -m-2 p-2 hit-area trick works on an icon
                              button but not here: padding is added inside the
                              Switch's fixed h-6 w-11 track, inflating it so
                              the thumb slides out past the end. Expand the
                              touch target with a wrapper instead. */}
                          <span className="-m-2 flex shrink-0 p-2">
                            <Switch
                              checked={s.active}
                              onCheckedChange={(v) => updateSchedule(s.id, { active: v })}
                              aria-label={`${s.title} active`}
                            />
                          </span>
                          <button
                            onClick={() => openWith({ kind: 'schedule', schedule: s })}
                            className="text-muted-foreground hover:text-primary -m-2 shrink-0 p-2 transition-colors"
                            aria-label={`Edit ${s.title}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Exercise library — browse what to do, with how-to steps ───── */}
      <ExerciseLibrary />

      {/* ── Training log ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="gap-3 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between min-[480px]:space-y-0">
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
              <Clock className="h-4.5 w-4.5" aria-hidden />
            </span>
            {t('plan.log.title')}
            <span className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums">
              {log.length}
            </span>
          </CardTitle>
          <Select
            id="log-filter"
            aria-label={t('plan.log.filterAria')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 w-full min-[480px]:w-40"
          >
            <option value="all">{t('plan.log.allTypes')}</option>
            {state.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </CardHeader>
        <CardContent className="grid gap-2">
          {log.length === 0 &&
            (state.sessions.length === 0 ? (
              <EmptyState
                icon={Clock}
                title={t('plan.log.emptyTitle')}
                body={t('plan.log.emptyBody')}
                action={
                  <Button onClick={() => openModal('workout')}>{t('plan.log.emptyCta')}</Button>
                }
              />
            ) : (
              <p className="text-muted-foreground text-sm">{t('plan.log.noMatch')}</p>
            ))}
          {log.map((s) => {
            const cat = categoryById(state, s.categoryId);
            return (
              <button
                key={s.id}
                onClick={() => openWith({ kind: 'session-detail', session: s })}
                className="border-border hover:border-primary/50 hover:bg-secondary/40 flex w-full items-center gap-3 overflow-hidden rounded-xl border p-3 text-left transition-colors"
              >
                {/* Category colour rail */}
                <span
                  className="h-10 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: cat.color }}
                  aria-hidden
                />
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${cat.color}1f`, color: cat.color }}
                  aria-hidden
                >
                  <CategoryIcon name={cat.icon} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <MetaChip>{formatDateLabel(s.date)}</MetaChip>
                    <MetaChip>{formatMinutes(s.durationMin)}</MetaChip>
                    <MetaChip>{formatCalories(s.calories)}</MetaChip>
                    {s.distanceKm !== undefined && (
                      <MetaChip>
                        {formatDistance(s.distanceKm, state.profile.distanceUnit)}
                      </MetaChip>
                    )}
                    {s.exercises && s.exercises.length > 0 && (
                      <MetaChip>
                        {t('plan.log.exerciseCount', { count: s.exercises.length })}
                      </MetaChip>
                    )}
                  </div>
                </div>
                <Badge variant="secondary" className="max-w-[7rem] shrink-0 truncate">
                  {cat.name}
                </Badge>
                <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
              </button>
            );
          })}
          {hasMoreSessions && (
            <div className="mt-1 flex flex-col items-center gap-1.5 pt-1">
              <Button
                variant="outline"
                size="sm"
                disabled={loadingMore !== null}
                onClick={() => void loadMore()}
                className="rounded-full"
              >
                {loadingMore === 'sessions' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <History className="h-4 w-4" />
                )}
                {t('plan.log.loadEarlier')}
              </Button>
              <p className="text-muted-foreground text-[11px]">{t('plan.log.pagingHint')}</p>
              {pageError && <p className="text-destructive text-xs">{pageError}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="ghost" className="self-start" onClick={() => openModal('category')}>
        <Tag className="h-4 w-4" /> {t('plan.manageTypes')}
      </Button>
    </div>
  );
}
