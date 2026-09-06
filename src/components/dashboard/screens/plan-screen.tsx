'use client';

import { useMemo, useState } from 'react';
import { CalendarCheck2, Clock, Plus, Tag, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { CategoryIcon } from '@/components/category-icon';
import { INTENSITY_META, PLANS, WEEKDAYS, WEEKDAYS_LONG } from '@smartfit/core';
import { getPlan } from '@smartfit/core';
import { formatCalories, formatDateLabel, formatMinutes } from '@smartfit/core';
import { cn } from '@/lib/utils';
import type { ScheduledWorkout } from '@smartfit/core';

export function PlanScreen() {
  const { state, updateProfile, updateSchedule, deleteSchedule } = useStore();
  const { openModal } = useModals();
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
          <h1 className="text-2xl font-bold tracking-tight">Training plan</h1>
          <p className="text-sm text-muted-foreground">Your weekly structure and complete workout log.</p>
        </div>
        <Button onClick={() => openModal('schedule')}>
          <Plus className="h-4 w-4" /> Schedule session
        </Button>
      </div>

      {/* Plan strategy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck2 className="h-4 w-4 text-primary" /> Strategy
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Training strategy</label>
            <Select value={state.profile.planId} onChange={(e) => updateProfile({ planId: e.target.value as typeof plan.id })}>
              {PLANS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.sessionsPerWeek}×/week
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">{plan.description}</p>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Weekly split</label>
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
                      i === today && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
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
        <h2 className="text-sm font-semibold text-muted-foreground">Your week</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {WEEKDAYS_LONG.map((day, i) => {
            const items = scheduledByDay.get(i) ?? [];
            const isToday = i === today;
            return (
              <Card key={day} className={cn(isToday && 'border-primary/50 ring-1 ring-primary/30')}>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className={cn('text-sm font-semibold', isToday && 'text-primary')}>
                      {day} {isToday && '· today'}
                    </span>
                    {items.length === 0 && <span className="text-xs text-muted-foreground">Rest</span>}
                  </div>
                  <div className="grid gap-2">
                    {items.map((s) => {
                      const cat = state.categories.find((c) => c.id === s.categoryId);
                      const meta = INTENSITY_META[s.intensity];
                      return (
                        <div key={s.id} className="flex items-center gap-3 rounded-xl bg-secondary/60 p-2.5">
                          <span
                            className="flex h-9 w-9 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${cat?.color}1a`, color: cat?.color }}
                          >
                            <CategoryIcon name={cat?.icon ?? 'activity'} size={16} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{s.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.timeOfDay} · {formatMinutes(s.durationMin)} ·{' '}
                              <span style={{ color: meta.color }}>{meta.label}</span>
                            </p>
                          </div>
                          <Switch checked={s.active} onCheckedChange={(v) => updateSchedule(s.id, { active: v })} />
                          <button
                            onClick={() => deleteSchedule(s.id)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Delete scheduled session"
                          >
                            <Trash2 className="h-4 w-4" />
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
            <Clock className="h-4 w-4 text-primary" /> Workout log
          </CardTitle>
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 w-40">
            <option value="all">All types</option>
            {state.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </CardHeader>
        <CardContent className="grid gap-2">
          {log.length === 0 && <p className="text-sm text-muted-foreground">No workouts match this filter.</p>}
          {log.map((s) => {
            const cat = state.categories.find((c) => c.id === s.categoryId);
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${cat?.color}1a`, color: cat?.color }}
                >
                  <CategoryIcon name={cat?.icon ?? 'activity'} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateLabel(s.date)} · {formatMinutes(s.durationMin)} · {formatCalories(s.calories)}
                    {s.distanceKm ? ` · ${s.distanceKm} km` : ''}
                  </p>
                </div>
                <Badge variant="secondary">{cat?.name}</Badge>
              </div>
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
