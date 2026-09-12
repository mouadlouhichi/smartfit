'use client';

import { useMemo } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronsRight,
  Flame,
  Footprints,
  Gauge,
  Mountain,
  Play,
  Share2,
  Timer,
} from 'lucide-react';
import { useStore } from '@/lib/store-context';
import {
  fmtDuration,
  startOfWeek,
  thisWeek,
  toISODate,
  weekStartOf,
  weeklySeries,
  currentStreak,
  type WorkoutSession,
} from '@smartfit/core';
import { timeOfDayLabel } from '@/lib/run-sensors';
import { cn } from '@/lib/utils';

/**
 * The Record tab's home stage — the screen you see before and between runs.
 *
 * Modelled on the rhythm of a dedicated running app: a greeting, one bold
 * promise, this week's distance as the hero number with its delta against
 * last week, the week drawn as seven bars with today lit up, and a single
 * unmissable way to start. Everything is computed from the local log, so an
 * empty week and a record week get the same honest treatment.
 */
export function RunHome({ runs, onStart }: { runs: WorkoutSession[]; onStart: () => void }) {
  const { state } = useStore();

  // The Record tab is deliberately about tracked runs, not every logged
  // cardio session. Keep the hero totals, comparison and bars on the same
  // dataset so a manually logged bike ride cannot make the headline disagree
  // with the chart beneath it.
  const trackedState = useMemo(() => ({ ...state, sessions: runs }), [state, runs]);
  const week = useMemo(() => thisWeek(trackedState), [trackedState]);
  const lastWeek = useMemo(() => weeklySeries(trackedState, 2)[0], [trackedState]);
  const streak = useMemo(() => currentStreak(trackedState), [trackedState]);
  const days = useMemo(() => weekBars(trackedState, runs), [trackedState, runs]);
  const firstName = (state.profile?.name ?? '').trim().split(/\s+/)[0];
  const first = runs.length === 0;

  const deltaPct =
    lastWeek && lastWeek.distance > 0.05
      ? ((week.distance - lastWeek.distance) / lastWeek.distance) * 100
      : null;

  return (
    <div className="card-hero relative overflow-hidden p-5 text-white sm:p-7">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(243,255,71,0.5),transparent_70%)]"
      />
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-center">
        {/* Copy + the one button that matters */}
        <div className="grid gap-4">
          <p className="hero-muted flex flex-wrap items-center gap-2 text-sm font-bold">
            {firstName
              ? `Good ${timeOfDayLabel().toLowerCase()}, ${firstName}`
              : `Good ${timeOfDayLabel().toLowerCase()}`}
            {streak > 0 && (
              <span className="hero-tile inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px]">
                <Flame className="h-3 w-3 text-[#f3ff47]" aria-hidden />
                {streak}-day streak
              </span>
            )}
          </p>
          <h2 className="font-display text-3xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl">
            {first ? 'Start your running journey.' : 'Run your way to better health.'}
          </h2>
          <p className="hero-muted max-w-md text-sm leading-relaxed">
            {first
              ? 'Take the first step toward a healthier, more active life. Your route, pace, splits and records are worked out on this device and never leave it.'
              : 'GPS recording with auto-pause, kilometre splits, elevation and best efforts — recorded on this device, ready to share when you finish.'}
          </p>

          <button
            type="button"
            onClick={onStart}
            className="group hover:border-primary/60 inline-flex max-w-sm items-center gap-3 rounded-full border border-white/15 bg-black/25 py-2 pr-5 pl-2 text-left backdrop-blur-sm transition-colors"
          >
            <span className="bg-primary text-primary-foreground shadow-primary/40 grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-lg transition-transform group-hover:scale-105">
              <Play className="h-5 w-5 fill-current" aria-hidden />
            </span>
            <span className="flex-1 text-base font-extrabold">Start run</span>
            <ChevronsRight
              className="h-4 w-4 text-white/50 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </button>

          <div className="hero-muted flex flex-wrap items-center gap-2 text-[11px] font-bold">
            <span className="hero-tile inline-flex items-center gap-1.5 rounded-full px-2.5 py-1">
              <Gauge className="h-3 w-3" aria-hidden /> Splits + best efforts
            </span>
            <span className="hero-tile inline-flex items-center gap-1.5 rounded-full px-2.5 py-1">
              <Mountain className="h-3 w-3" aria-hidden /> Elevation
            </span>
            <span className="hero-tile inline-flex items-center gap-1.5 rounded-full px-2.5 py-1">
              <Share2 className="h-3 w-3" aria-hidden /> Transparent share
            </span>
          </div>
        </div>

        {/* The week, at a glance */}
        <div className="grid gap-3">
          <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#f3ff47,#cbe02c)] p-5 text-[#141414] shadow-lg">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/10 px-2.5 py-1 text-[11px] font-bold">
              <Footprints className="h-3 w-3" aria-hidden /> Your distance · this week
            </span>
            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="font-mono text-5xl leading-none font-extrabold tabular-nums">
                {week.distance.toFixed(2)}
                <span className="ml-1 text-lg font-extrabold text-[#141414]/75">km</span>
              </p>
              <RunnerMark className="h-24 w-24 shrink-0 text-[#141414]/85" />
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#141414]/85">
              {deltaPct === null ? (
                week.distance > 0 ? (
                  'First kilometres of the week — build from here.'
                ) : (
                  'No runs yet this week.'
                )
              ) : (
                <>
                  {deltaPct >= 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {deltaPct >= 0 ? 'Up' : 'Down'} {Math.abs(deltaPct).toFixed(1)}% vs last week (
                  {lastWeek.distance.toFixed(1)} km)
                </>
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <WeekTile
              icon={<Timer className="h-4 w-4" aria-hidden />}
              tint="bg-sky-400/20 text-sky-200"
              label="Moving time"
              value={fmtDuration(Math.round(week.minutes * 60))}
            />
            <WeekTile
              icon={<Mountain className="h-4 w-4" aria-hidden />}
              tint="bg-emerald-400/20 text-emerald-200"
              label="Climb"
              value={`${Math.round(days.reduce((a, d) => a + d.elevationGainM, 0))} m`}
            />
          </div>

          <WeekBars days={days} />
        </div>
      </div>
    </div>
  );
}

/* ── the week as seven bars, today lit up ─────────────────────────────── */

interface DayBar {
  iso: string;
  label: string;
  distanceKm: number;
  elevationGainM: number;
  today: boolean;
}

function weekBars(state: Parameters<typeof thisWeek>[0], runs: WorkoutSession[]): DayBar[] {
  const start = startOfWeek(new Date(), weekStartOf(state));
  const todayIso = toISODate(new Date());
  const out: DayBar[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = toISODate(d);
    const dayRuns = runs.filter((r) => r.date === iso);
    out.push({
      iso,
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      distanceKm: dayRuns.reduce((a, r) => a + (r.distanceKm ?? 0), 0),
      elevationGainM: dayRuns.reduce((a, r) => a + (r.elevationGainM ?? 0), 0),
      today: iso === todayIso,
    });
  }
  return out;
}

function WeekBars({ days }: { days: DayBar[] }) {
  const max = Math.max(0.001, ...days.map((d) => d.distanceKm));
  const weekKm = days.reduce((a, d) => a + d.distanceKm, 0);
  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow text-white/60">This week, day by day</p>
        <p className="font-mono text-sm font-extrabold tabular-nums">
          {weekKm >= 10 ? weekKm.toFixed(1) : weekKm.toFixed(2)} km
        </p>
      </div>
      <div
        className="mt-3 grid grid-cols-7 items-end gap-2"
        role="img"
        aria-label={`Distance per day this week, ${weekKm.toFixed(1)} kilometres total`}
      >
        {days.map((d) => (
          <div key={d.iso} className="grid justify-items-center gap-1.5">
            <div className="flex h-20 w-full items-end overflow-hidden rounded-lg bg-white/8">
              <div
                title={`${d.label} · ${d.distanceKm.toFixed(2)} km`}
                className={cn(
                  'w-full rounded-lg transition-all duration-500',
                  d.today
                    ? 'bg-[linear-gradient(180deg,#f3ff47,#f3ff47)]'
                    : d.distanceKm > 0
                      ? 'bg-[#f3ff47]/45'
                      : 'bg-white/10',
                )}
                style={{
                  height: `${d.distanceKm > 0 ? Math.max(10, (d.distanceKm / max) * 100) : 6}%`,
                }}
              />
            </div>
            <span
              className={cn(
                'text-[10px] font-bold tracking-wide uppercase',
                d.today ? 'text-[#f3ff47]' : 'text-white/45',
              )}
            >
              {d.label.slice(0, 3)}
            </span>
          </div>
        ))}
      </div>
      <ul className="sr-only" aria-label="Daily run distances">
        {days.map((d) => (
          <li key={`${d.iso}-text`}>
            {d.label}: {d.distanceKm.toFixed(2)} kilometres, {Math.round(d.elevationGainM)} metres
            elevation
          </li>
        ))}
      </ul>
      {weekKm === 0 && (
        <p className="mt-2 text-[11px] text-white/55">
          Every run you record lights up its day — today&apos;s bar is the bright one.
        </p>
      )}
    </div>
  );
}

function WeekTile({
  icon,
  tint,
  label,
  value,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-sm">
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', tint)}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold tracking-wide text-white/55 uppercase">
          {label}
        </span>
        <span className="block font-mono text-lg leading-tight font-extrabold tabular-nums">
          {value}
        </span>
      </span>
    </div>
  );
}

/**
 * A road-sign runner, drawn the same way as every other glyph in the app:
 * round-capped strokes, no raster assets. Leans forward, arms and legs mid
 * stride, two speed lines behind — recognisable at 24 px and at 240.
 */
export function RunnerMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Runner">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* speed lines */}
        <path d="M6 40h14" opacity={0.45} strokeWidth={5} />
        <path d="M2 54h12" opacity={0.3} strokeWidth={5} />
        {/* torso */}
        <path d="M60 27 L49 52" />
        {/* arms: front drives up, back swings low */}
        <path d="M58 31 L73 40 L86 32" />
        <path d="M58 33 L44 42 L33 37" />
        {/* legs: front knee up, back leg trailing off the toe */}
        <path d="M49 52 L67 61 L63 86" />
        <path d="M49 52 L34 64 L18 60" />
      </g>
      <circle cx={64} cy={15} r={9} fill="currentColor" />
    </svg>
  );
}
