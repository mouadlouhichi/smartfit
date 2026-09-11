'use client';

import { useMemo } from 'react';
import { Footprints, MapPin, Route as RouteIcon, Timer, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '../empty-state';
import { RouteMap } from '../route-map';
import { useModals } from '../modal-context';
import { useStore } from '@/lib/store-context';
import {
  computeRunStats,
  fmtDuration,
  fmtKm,
  fmtPace,
  isTrackedRun,
  runTotals,
  startOfWeek as startOfWeekDate,
  toISODate,
  weekStartOf,
  type WorkoutSession,
} from '@smartfit/core';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Run history — the athlete's own feed.
 *
 * Newest first, grouped by week, each row a compact card with the route
 * thumbnail, the three numbers that matter (distance · pace · time) and the
 * extras a tracked run adds (elevation, splits count). Tapping a row opens the
 * existing session detail, so history stays in one place.
 */
export function RunHistory({
  sessions,
  loading = false,
  onRecord,
}: {
  sessions: WorkoutSession[];
  loading?: boolean;
  /** Jump to the record tab (the empty state's call to action). */
  onRecord?: () => void;
}) {
  const { openWith } = useModals();
  const { state } = useStore();
  const runs = useMemo(
    () =>
      sessions
        .filter(isTrackedRun)
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt)),
    [sessions],
  );

  const groups = useMemo(() => {
    const weekStart = toISODate(startOfWeekDate(new Date(), weekStartOf(state)));
    const out: { label: string; runs: WorkoutSession[] }[] = [];
    for (const run of runs) {
      const label = run.date >= weekStart ? 'This week' : 'Earlier';
      const group = out.find((g) => g.label === label);
      if (group) group.runs.push(run);
      else out.push({ label, runs: [run] });
    }
    return out;
  }, [runs, state]);

  const totals = useMemo(() => runTotals(runs), [runs]);

  if (loading && runs.length === 0) {
    return (
      <div className="grid gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-3xl" />
        ))}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <EmptyState
        icon={Footprints}
        title="No tracked runs yet"
        body="Record a run and it lands here with its route, splits and best efforts — ready to share."
        action={onRecord ? <Button onClick={onRecord}>Record a run</Button> : undefined}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div className="border-border bg-card grid grid-cols-2 gap-4 rounded-3xl border p-4 shadow-sm sm:grid-cols-4 sm:p-5">
        <Total label="Runs" value={`${totals.runs}`} />
        <Total label="Distance" value={fmtKm(totals.distanceKm)} />
        <Total label="Moving time" value={fmtDuration(totals.movingMin * 60)} />
        <Total label="Climb" value={`${totals.elevationGainM} m`} />
      </div>

      {groups.map((group) => (
        <section key={group.label} className="grid gap-3">
          <div className="flex items-center justify-between">
            <h3 className="eyebrow text-muted-foreground">{group.label}</h3>
            <span className="text-muted-foreground text-xs tabular-nums">
              {runTotals(group.runs).runs} runs · {fmtKm(runTotals(group.runs).distanceKm)}
            </span>
          </div>
          {group.runs.map((run) => {
            const stats = runStatsOf(run);
            return (
              <button
                key={run.id}
                type="button"
                onClick={() => openWith({ kind: 'session-detail', session: run })}
                className="border-border bg-card hover:border-primary/40 grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-4 rounded-3xl border p-3 text-left shadow-sm transition-colors sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:p-4"
              >
                <span className="bg-secondary flex h-20 w-full items-center justify-center overflow-hidden rounded-2xl sm:h-24">
                  {run.route && run.route.length >= 2 ? (
                    <RouteMap route={run.route} className="h-full w-full p-1.5" />
                  ) : (
                    <RouteIcon className="text-muted-foreground h-6 w-6" aria-hidden />
                  )}
                </span>

                <span className="min-w-0">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-display truncate text-base font-extrabold tracking-tight sm:text-lg">
                      {run.title}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {new Date(`${run.date}T00:00:00`).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </span>

                  <span className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="text-primary h-3.5 w-3.5" aria-hidden />
                      <b className="font-mono text-sm tabular-nums">
                        {fmtKm(run.distanceKm ?? stats.distanceKm)}
                      </b>
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Timer className="h-3.5 w-3.5" aria-hidden />
                      <b className="text-foreground font-mono tabular-nums">
                        {fmtDuration((run.movingTimeMin ?? run.durationMin) * 60)}
                      </b>
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      <b className="text-foreground font-mono tabular-nums">
                        {fmtPace(paceOf(run))}
                      </b>
                      /km
                    </span>
                    {(run.elevationGainM ?? 0) > 0 && (
                      <span className="text-muted-foreground tabular-nums">
                        ↑ {run.elevationGainM} m
                      </span>
                    )}
                  </span>

                  {run.splits && run.splits.length > 1 && (
                    <span className="mt-2 flex items-end gap-1" aria-hidden>
                      {run.splits.slice(0, 14).map((split, i) => (
                        <span
                          key={i}
                          className={
                            split.partial
                              ? 'bg-muted-foreground/30 w-1.5 rounded-sm'
                              : 'bg-primary/70 w-1.5 rounded-sm'
                          }
                          style={{ height: `${barHeight(split.paceMinPerKm, run.splits!)}px` }}
                        />
                      ))}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-extrabold tabular-nums sm:text-xl">{value}</p>
    </div>
  );
}

function paceOf(run: WorkoutSession): number {
  const km = run.distanceKm ?? 0;
  const minutes = run.movingTimeMin ?? run.durationMin;
  if (km <= 0 || minutes <= 0) return 0;
  return minutes / km;
}

function runStatsOf(run: WorkoutSession) {
  return run.route && run.route.length >= 2
    ? computeRunStats(run.route)
    : { distanceKm: run.distanceKm ?? 0 };
}

/** Faster splits make taller bars; 8–26 px keeps a row compact. */
function barHeight(pace: number, splits: { paceMinPerKm: number }[]): number {
  const paced = splits.map((s) => s.paceMinPerKm).filter((p) => p > 0);
  if (paced.length === 0 || pace <= 0) return 8;
  const best = Math.min(...paced);
  const worst = Math.max(...paced);
  if (worst === best) return 22;
  return Math.round(8 + (18 * (worst - pace)) / (worst - best));
}
