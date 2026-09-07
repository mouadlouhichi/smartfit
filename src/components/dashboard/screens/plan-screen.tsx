'use client';

import { useMemo, useState } from 'react';
import { CalendarCheck2, ChevronRight, Clock, Pencil, Plus, Tag } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { EmptyState } from '../empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { CategoryIcon } from '@/components/category-icon';
import { INTENSITY_META, PLANS, WEEKDAYS, WEEKDAYS_LONG } from '@smartfit/core';
import { categoryById, getPlan } from '@smartfit/core';
import { formatCalories, formatDateLabel, formatDistance, formatMinutes } from '@smartfit/core';
import { cn } from '@/lib/utils';
import type { ScheduledWorkout } from '@smartfit/core';

export function PlanScreen() {
  const { state, updateProfile, updateSchedule } = useStore();
  const { openModal, openWith } = useModals();
  const [filter, setFilter] = useState('all');

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

      {/* Plan strategy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck2 className="text-primary h-4 w-4" /> Strategy
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="plan-strategy" className="text-muted-foreground text-xs font-medium">
              Training strategy
            </label>
            <Select
              id="plan-strategy"
              value={state.profile.planId}
              onChange={(e) => updateProfile({ planId: e.target.value as typeof plan.id })}
            >
              {PLANS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.sessionsPerWeek}×/week
                </option>
              ))}
            </Select>
            <p className="text-muted-foreground text-xs">{plan.description}</p>
          </div>
          <div className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">Weekly split</span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d, i) => {
                const slot = plan.split.find((s) => s.weekday === i);
                const cat = state.categories.find((c) => c.id === slot?.categoryId);
                return (
                  <span
                    key={d}
                    className={cn(
                      'flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-semibold',
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
          </div>
        </CardContent>
      </Card>

      {/* Week schedule */}
      <div className="grid gap-3">
        <h2 className="text-muted-foreground text-sm font-semibold">Your week</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {WEEKDAYS_LONG.map((day, i) => {
            const items = scheduledByDay.get(i) ?? [];
            const isToday = i === today;
            return (
              <Card key={day} className={cn(isToday && 'border-primary/50 ring-primary/30 ring-1')}>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className={cn('text-sm font-semibold', isToday && 'text-primary')}>
                      {day} {isToday && '· today'}
                    </span>
                    {items.length === 0 && (
                      <span className="text-muted-foreground text-xs">Rest</span>
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
                            className="flex h-9 w-9 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${cat?.color}1a`, color: cat?.color }}
                          >
                            <CategoryIcon name={cat?.icon ?? 'activity'} size={16} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{s.title}</p>
                            <p className="text-muted-foreground text-xs">
                              {s.timeOfDay} · {formatMinutes(s.durationMin)} ·{' '}
                              <span style={{ color: meta.color }}>{meta.label}</span>
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

      {/* Training log */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="text-primary h-4 w-4" /> Workout log
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
                className="border-border hover:border-primary/50 hover:bg-secondary/40 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${cat.color}1a`, color: cat.color }}
                >
                  <CategoryIcon name={cat.icon} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDateLabel(s.date)} · {formatMinutes(s.durationMin)} ·{' '}
                    {formatCalories(s.calories)}
                    {s.distanceKm !== undefined
                      ? ` · ${formatDistance(s.distanceKm, state.profile.distanceUnit)}`
                      : ''}
                    {s.exercises && s.exercises.length > 0
                      ? ` · ${s.exercises.length} exercise${s.exercises.length === 1 ? '' : 's'}`
                      : ''}
                  </p>
                </div>
                <Badge variant="secondary" className="hidden sm:inline-flex">
                  {cat.name}
                </Badge>
                <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Button variant="ghost" className="self-start" onClick={() => openModal('category')}>
        <Tag className="h-4 w-4" /> Manage activity types
      </Button>
    </div>
  );
}
