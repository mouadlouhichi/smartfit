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
  Plus,
  Sparkles,
  Tag,
} from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { useConfirm } from '../confirm-context';
import { EmptyState } from '../empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { CategoryIcon } from '@/components/category-icon';
import { INTENSITY_META, PLANS, WEEKDAYS, WEEKDAYS_LONG } from '@smartfit/core';
import {
  categoryById,
  getGymProgram,
  getPlan,
  suggestProgram,
  suggestedToSchedule,
  suggestSummary,
} from '@smartfit/core';
import { formatCalories, formatDateLabel, formatDistance, formatMinutes } from '@smartfit/core';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ScheduledWorkout } from '@smartfit/core';

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
  const confirm = useConfirm();
  const [filter, setFilter] = useState('all');
  const [pageError, setPageError] = useState<string | null>(null);

  // Selected gym program (Profile → Gym program): suggestions are built from
  // its real timetable and recomputed whenever the strategy, latest weight
  // log or target weight changes.
  const gymProgram = useMemo(() => getGymProgram(state.profile.gymId), [state.profile.gymId]);
  const suggested = useMemo(
    () => (gymProgram ? suggestProgram(state, gymProgram) : []),
    [state, gymProgram],
  );
  const mixLine = suggestSummary(state);

  async function importSuggestion() {
    const ok = await confirm({
      title: 'Import suggested week?',
      body: `Your current scheduled sessions are replaced with the ${
        gymProgram?.name ?? 'gym'
      } classes shown here.`,
      confirmLabel: 'Replace my week',
      destructive: true,
    });
    if (ok) replaceSchedule(suggestedToSchedule(suggested));
  }

  async function loadMore() {
    setPageError(null);
    try {
      await loadEarlierSessions();
    } catch (e) {
      setPageError(e instanceof Error ? e.message : 'Could not load older workouts.');
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Training plan</h1>
          <p className="text-muted-foreground text-sm">
            Your weekly structure and complete workout log.
          </p>
        </div>
        <Button onClick={() => openModal('schedule')}>
          <Plus className="h-4 w-4" /> Schedule session
        </Button>
      </div>

      {/* ── Plan strategy ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl">
              <CalendarCheck2 className="h-4.5 w-4.5" aria-hidden />
            </span>
            Strategy
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-lg font-extrabold tracking-tight">{plan.name}</p>
              <Badge variant="accent">{plan.sessionsPerWeek}×/week</Badge>
            </div>
            <Field id="plan-strategy" label="Training strategy" hint={plan.description}>
              <Select
                value={state.profile.planId}
                onChange={(e) => updateProfile({ planId: e.target.value as typeof plan.id })}
              >
                {PLANS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.sessionsPerWeek}×/week
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-2">
            <span className="text-muted-foreground text-xs font-medium">Weekly split</span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d, i) => {
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
            <p className="text-muted-foreground text-xs">
              Coloured days follow the strategy&rsquo;s focus — hover a day to see it.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Suggested program (gym-aware) ──────────────────────────────── */}
      {gymProgram == null ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                <Sparkles className="h-4.5 w-4.5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Suggested program</p>
                <p className="text-muted-foreground text-xs">
                  Pick your gym in Profile to unlock a weekly program built from its real class
                  timetable — tuned to your target weight.
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/profile">Choose gym</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2.5 text-base">
              <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl">
                <Sparkles className="h-4.5 w-4.5" aria-hidden />
              </span>
              Suggested program
              <Badge variant="accent">{gymProgram.name}</Badge>
            </CardTitle>
            <p className="text-muted-foreground text-xs">{mixLine}</p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {suggested.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No matching classes on your training days — try another strategy or add sessions
                manually.
              </p>
            ) : (
              <ul className="grid gap-1.5">
                {suggested.map((s) => {
                  const meta = INTENSITY_META[s.gymClass.intensity];
                  return (
                    <li
                      key={`${s.weekday}-${s.time}-${s.gymClass.id}`}
                      className="bg-secondary/50 flex items-center gap-3 rounded-xl px-3 py-2"
                    >
                      <span className="w-11 text-xs font-bold tabular-nums">
                        {WEEKDAYS_LONG[s.weekday]}
                      </span>
                      <span className="text-muted-foreground w-11 text-xs font-semibold tabular-nums">
                        {s.time}
                      </span>
                      <span className="flex-1 truncate text-sm font-semibold">
                        {s.gymClass.name}
                      </span>
                      <span className="text-muted-foreground hidden text-xs tabular-nums sm:inline">
                        {formatMinutes(s.gymClass.minutes)}
                      </span>
                      <span
                        className="flex items-center gap-1.5 text-xs font-bold whitespace-nowrap"
                        style={{ color: meta.color }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: meta.color }}
                          aria-hidden
                        />
                        {meta.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">{gymProgram.hours}</p>
              <Button
                size="sm"
                onClick={importSuggestion}
                disabled={suggested.length === 0}
                data-testid="import-suggested-week"
              >
                <Download className="h-4 w-4" /> Import into my plan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Week schedule ──────────────────────────────────────────────── */}
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Your week</h2>
          <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-xs font-bold tabular-nums">
            {state.schedule.filter((s) => s.active).length} active session
            {state.schedule.filter((s) => s.active).length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {WEEKDAYS_LONG.map((day, i) => {
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
                          Today
                        </span>
                      )}
                    </span>
                    {items.length === 0 && (
                      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium">
                        <Moon className="h-3.5 w-3.5" aria-hidden /> Rest
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
                            'bg-secondary/60 flex items-center gap-3 rounded-xl p-2.5',
                            !s.active && 'opacity-60',
                          )}
                        >
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                            style={{
                              backgroundColor: `${cat?.color ?? '#bd4220'}1f`,
                              color: cat?.color ?? 'var(--primary)',
                            }}
                          >
                            <CategoryIcon name={cat?.icon ?? 'activity'} size={16} />
                          </span>
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
                            </p>
                          </div>
                          <Switch
                            checked={s.active}
                            onCheckedChange={(v) => updateSchedule(s.id, { active: v })}
                            aria-label={`${s.title} active`}
                          />
                          <button
                            onClick={() => openWith({ kind: 'schedule', schedule: s })}
                            className="text-muted-foreground hover:text-primary transition-colors"
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

      {/* ── Training log ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl">
              <Clock className="h-4.5 w-4.5" aria-hidden />
            </span>
            Workout log
            <span className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums">
              {log.length}
            </span>
          </CardTitle>
          <Select
            id="log-filter"
            aria-label="Filter workout log by activity type"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 w-40"
          >
            <option value="all">All types</option>
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
                title="Nothing logged yet"
                body="Once you log a workout it shows up here. Tap any entry to see the exercises, notes and distance you recorded — or to fix a mistake."
                action={<Button onClick={() => openModal('workout')}>Log a workout</Button>}
              />
            ) : (
              <p className="text-muted-foreground text-sm">No workouts match this filter.</p>
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
                        {s.exercises.length} exercise{s.exercises.length === 1 ? '' : 's'}
                      </MetaChip>
                    )}
                  </div>
                </div>
                <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
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
                Load earlier workouts
              </Button>
              <p className="text-muted-foreground text-[11px]">
                Long histories load in pages — older workouts stay in your account until you do.
              </p>
              {pageError && <p className="text-destructive text-xs">{pageError}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="ghost" className="self-start" onClick={() => openModal('category')}>
        <Tag className="h-4 w-4" /> Manage activity types
      </Button>
    </div>
  );
}
