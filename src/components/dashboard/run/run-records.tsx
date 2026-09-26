'use client';

import { useMemo } from 'react';
import { Award, Flame, Gauge, Mountain, Route as RouteIcon, Trophy } from 'lucide-react';
import { EmptyState } from '../empty-state';
import {
  fmtDuration,
  fmtKm,
  fmtPace,
  isTrackedRun,
  runTotals,
  type WorkoutSession,
} from '@smartfit/core';
import { formatDateLabel } from '@smartfit/core';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n-context';

interface PersonalBest {
  key: string;
  label: string;
  value: string;
  detail: string;
  icon: typeof Award;
}

/**
 * Records — the athlete's "you" tab.
 *
 * Every personal best is derived from their own logged runs (never invented):
 * longest distance, fastest 1 km / 5 km windows (from stored splits), biggest
 * climb and fastest average pace. The 8-week trend underneath is the honest
 * context for those numbers.
 */
export function RunRecords({ sessions }: { sessions: WorkoutSession[] }) {
  const { t, locale } = useI18n();
  const runs = useMemo(
    () =>
      sessions
        .filter(isTrackedRun)
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [sessions],
  );

  const records = useMemo<PersonalBest[]>(() => {
    if (runs.length === 0) return [];
    const out: PersonalBest[] = [];

    const longest = runs.reduce((best, s) =>
      (s.distanceKm ?? 0) > (best.distanceKm ?? 0) ? s : best,
    );
    if ((longest.distanceKm ?? 0) > 0) {
      out.push({
        key: 'longest',
        label: t('run.record.longest'),
        value: fmtKm(longest.distanceKm!),
        detail: formatDateLabel(longest.date, locale),
        icon: RouteIcon,
      });
    }

    const climb = runs.reduce((best, s) =>
      (s.elevationGainM ?? 0) > (best.elevationGainM ?? 0) ? s : best,
    );
    if ((climb.elevationGainM ?? 0) > 0) {
      out.push({
        key: 'climb',
        label: t('run.record.climb'),
        value: `${climb.elevationGainM} m`,
        detail: t('run.record.on', { date: formatDateLabel(climb.date, locale) }),
        icon: Mountain,
      });
    }

    for (const target of [
      { km: 1, label: t('run.record.fastest1km') },
      { km: 5, label: t('run.record.fastest5km') },
    ]) {
      const best = bestWindow(runs, target.km);
      if (best) {
        out.push({
          key: `fastest-${target.km}`,
          label: target.label,
          value: fmtDuration(best.seconds),
          detail: `${fmtPace(best.seconds / 60 / target.km)} /km · ${formatDateLabel(best.date, locale)}`,
          icon: Gauge,
        });
      }
    }

    const paced = runs
      .map((s) => ({
        pace: paceOf(s),
        date: s.date,
        km: s.distanceKm ?? 0,
      }))
      .filter((r) => r.pace > 0 && r.km >= 1)
      .sort((a, b) => a.pace - b.pace);
    if (paced.length > 0) {
      out.push({
        key: 'avg-pace',
        label: t('run.record.avgPace'),
        value: `${fmtPace(paced[0].pace)} /km`,
        detail: `${fmtKm(paced[0].km)} ${t('run.record.on', { date: formatDateLabel(paced[0].date, locale) })}`,
        icon: Flame,
      });
    }

    return out;
  }, [runs, t, locale]);

  const totals = useMemo(() => runTotals(runs), [runs]);
  const trend = useMemo(() => eightWeekTrend(runs), [runs]);

  if (runs.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title={t('run.records.emptyTitle')}
        body={t('run.records.emptyBody')}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {records.map((record) => (
          <div
            key={record.key}
            className="border-border bg-card flex items-center gap-4 rounded-3xl border p-4 shadow-sm"
          >
            <span className="bg-primary/10 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
              <record.icon className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
                {record.label}
              </p>
              <p className="font-mono text-lg font-extrabold tabular-nums">{record.value}</p>
              <p className="text-muted-foreground truncate text-xs">{record.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-border bg-card rounded-3xl border p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow text-muted-foreground">
              {t('run.records.lastWeeks', { count: 8 })}
            </p>
            <p className="font-display mt-1 text-2xl font-extrabold tracking-tight">
              {fmtKm(trend.reduce((sum, w) => sum + w.km, 0))}
            </p>
            <p className="text-muted-foreground text-xs">
              {t('run.records.across', { count: trend.reduce((sum, w) => sum + w.runs, 0) })}
            </p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
                {t('run.total.allTime')}
              </p>
              <p className="font-mono text-lg font-extrabold tabular-nums">
                {fmtKm(totals.distanceKm)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
                {t('run.total.time')}
              </p>
              <p className="font-mono text-lg font-extrabold tabular-nums">
                {fmtDuration(Math.round(totals.movingMin * 60))}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
                {t('run.total.climb')}
              </p>
              <p className="font-mono text-lg font-extrabold tabular-nums">
                {totals.elevationGainM} m
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex h-32 items-end gap-2">
          {trend.map((week) => {
            const max = Math.max(1, ...trend.map((w) => w.km));
            const height = Math.max(4, (week.km / max) * 100);
            return (
              <div key={week.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className="text-muted-foreground text-[10px] tabular-nums">
                  {week.km >= 1 ? Math.round(week.km * 10) / 10 : ''}
                </span>
                <span
                  className={cn(
                    'w-full rounded-t-lg',
                    week.km > 0 ? 'bg-primary/80' : 'bg-secondary',
                  )}
                  style={{ height: `${week.km > 0 ? height : 3}%` }}
                  aria-hidden
                />
                <span className="text-muted-foreground truncate text-[10px] font-semibold">
                  {week.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function paceOf(run: WorkoutSession): number {
  const km = run.distanceKm ?? 0;
  const minutes = run.movingTimeMin ?? run.durationMin;
  if (km <= 0 || minutes <= 0) return 0;
  return minutes / km;
}

/** Fastest `km`-length window across stored splits (walking whole kilometres). */
function bestWindow(runs: WorkoutSession[], km: number): { seconds: number; date: string } | null {
  let best: { seconds: number; date: string } | null = null;
  for (const run of runs) {
    const splits = (run.splits ?? []).filter((s) => !s.partial);
    if (splits.length < km) continue;
    for (let i = 0; i + km <= splits.length; i++) {
      let seconds = 0;
      for (let k = i; k < i + km; k++) seconds += splits[k].durationSec;
      if (best === null || seconds < best.seconds) best = { seconds, date: run.date };
    }
  }
  return best;
}

/** Weekly distance, oldest → newest, ending with the current week. */
function eightWeekTrend(runs: WorkoutSession[]): { label: string; km: number; runs: number }[] {
  const weeks: { label: string; km: number; runs: number }[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const monday = new Date(now);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  for (let i = 7; i >= 0; i--) {
    const start = new Date(monday);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const inWeek = runs.filter((run) => {
      const d = new Date(`${run.date}T00:00:00`);
      return d >= start && d <= end;
    });
    weeks.push({
      label: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      km: inWeek.reduce((sum, run) => sum + (run.distanceKm ?? 0), 0),
      runs: inWeek.length,
    });
  }
  return weeks;
}
