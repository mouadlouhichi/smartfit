'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Dumbbell,
  Flag,
  Flame,
  History,
  Navigation,
  Pause,
  Play,
  Plus,
  Share2,
  Sparkles,
  Timer,
  Trophy,
  X,
} from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { ExerciseImage } from '@/components/exercise-image';
import { ExercisePicker } from '@/components/exercise-picker';
import { categoryById, toISODate } from '@smartfit/core';
import {
  REST_PRESETS,
  REST_STEP_SECONDS,
  estimatedOneRepMax,
  formatSet,
  formatSetDistance,
  formatVolume,
  formatWeight,
  hasProAccess,
  haversineMeters,
  isPersonalRecord,
  lastPerformance,
  measureForExerciseName,
  progressionTarget,
  routeDistanceKm,
  simplifyRoute,
  suggestedExercisesForCategory,
  suggestedRestSeconds,
  summariseLiveSession,
  type GeoPoint,
  type ProgressionTarget,
  type SessionSummary,
} from '@smartfit/core';
import { renderRoutePng, renderWorkoutPng, shareOrDownloadPng } from '@/lib/route-art';
import { RouteMap } from '../route-map';
import { cn } from '@/lib/utils';

/* ── helpers ───────────────────────────────────────────────────────────── */

function clock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** A short confirmation the athlete feels in their pocket, when available. */
function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* no haptics — fine */
  }
}

/** A soft two-tone "rest is over" chime via WebAudio; never blocks the UI. */
let audioCtx: AudioContext | null = null;
function chime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx ?? new Ctx();
    const now = audioCtx.currentTime;
    [660, 880].forEach((freq, i) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.0001, now + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.3);
      osc.connect(gain).connect(audioCtx!.destination);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.32);
    });
  } catch {
    /* audio unavailable — silent */
  }
}

/* ── local state model ─────────────────────────────────────────────────── */

interface LiveSet {
  id: number;
  /** String-backed inputs; parsed at save time. */
  reps: string;
  weight: string;
  /** Metres input for distance-measured exercises (pool/running). */
  distanceM: string;
  done: boolean;
  isPR: boolean;
}

interface LiveExercise {
  id: number;
  name: string;
  sets: LiveSet[];
}

/**
 * Full-screen guided workout — the "start exercise" flow.
 *
 * Designed for a phone at arm's length mid-set (per the reference fitness-app
 * design): the running clock and the current exercise are the only things
 * above the fold, every control is 44px+ in the thumb zone, and the whole
 * thing is dark so it reads under bad gym lighting.
 *
 * It upgrades the old count-only runner into what the serious trackers ship:
 *  - per-set reps × weight logging, pre-filled from your last session
 *    (progressive overload — the feature Hevy/Strong/Fitbod all lead with)
 *  - an animated demo image per exercise
 *  - a rest timer with presets, +15s, skip, haptic + chime on completion
 *  - live personal-record detection with a celebration
 *  - a finish summary with tonnage, heaviest set and PRs before you save
 */
export function SessionRunnerModal() {
  const { state, addSession, estimateSessionCalories } = useStore();
  const { open, payload, closeModal } = useModals();
  const toast = useToast();

  const isOpen = open === 'runner' && payload?.kind === 'runner';

  // Timers
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [restLeft, setRestLeft] = useState(0);
  const [restTotal, setRestTotal] = useState(0);

  // Exercises
  const [exercises, setExercises] = useState<LiveExercise[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [draft, setDraft] = useState('');
  const [screen, setScreen] = useState<'live' | 'summary'>('live');
  const nextId = useRef(1);

  // GPS walk tracking
  const [tracking, setTracking] = useState(false);
  const [distanceKm, setDistanceKm] = useState(0);
  const [geoError, setGeoError] = useState<string | null>(null);
  const routeRef = useRef<GeoPoint[]>([]);
  const watchIdRef = useRef<number | null>(null);

  // Reset to a fresh session every time the runner opens.
  useEffect(() => {
    if (!isOpen || !payload || payload.kind !== 'runner') return;
    setSeconds(0);
    setRunning(false);
    setRestLeft(0);
    setRestTotal(0);
    setActiveIndex(0);
    setDraft('');
    setScreen('live');
    routeRef.current = [];
    setDistanceKm(0);
    setGeoError(null);
    setTracking(false);

    const template = payload.exercises ?? [];
    const initial: LiveExercise[] = template.map((entry) => ({
      id: nextId.current++,
      name: entry.name,
      sets: [blankSetFrom(entry.name)],
    }));
    setExercises(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Elapsed-time clock.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  // Rest countdown; chime + haptic the moment it hits zero.
  useEffect(() => {
    if (restLeft <= 0) return;
    const t = setInterval(() => setRestLeft((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [restLeft > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (restLeft === 0 && restTotal > 0) {
      chime();
      buzz([120, 60, 120]);
      setRestTotal(0); // so it only fires once per countdown
    }
  }, [restLeft, restTotal]);

  // Always release the GPS watch when the runner closes or unmounts.
  useEffect(() => stopTracking, []);

  function stopTracking() {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined') {
      navigator.geolocation?.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    setTracking(false);
  }

  function toggleTracking() {
    if (tracking) {
      stopTracking();
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('GPS is not available on this device.');
      return;
    }
    setGeoError(null);
    setTracking(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        // Ignore low-confidence fixes (indoor / cold start).
        if (!Number.isFinite(accuracy) || accuracy > 50) return;
        const last = routeRef.current[routeRef.current.length - 1];
        const point: GeoPoint = { lat: latitude, lng: longitude, t: pos.timestamp };
        // Only record real movement (~5 m) so a standing start doesn't jitter.
        if (last && haversineMeters(last, point) < 5) return;
        routeRef.current = [...routeRef.current, point];
        setDistanceKm(routeDistanceKm(routeRef.current));
      },
      (err) => {
        setTracking(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied — enable it to track your route.'
            : 'Could not get a GPS fix.',
        );
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
  }

  async function shareMap() {
    try {
      const blob = await renderRoutePng(routeRef.current, {
        title: run.title,
        durationMin: Math.max(1, Math.round(seconds / 60)),
        distanceKm,
      });
      const result = await shareOrDownloadPng(blob, `smartfit-route-${toISODate(new Date())}.png`);
      toast(result === 'shared' ? 'Route shared' : 'Route saved to downloads');
    } catch {
      toast('Could not render the route map', 'info');
    }
  }

  /** Shareable "gym receipt" card — watermarked on free, clean on Pro. */
  async function shareWorkout() {
    if (screen !== 'summary' || !summary) return;
    try {
      const blob = await renderWorkoutPng(
        {
          title: run.title,
          dateLabel: new Date().toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          durationMin: Math.max(1, Math.round(seconds / 60)),
          sets: summary.sets,
          exercises: summary.exercises,
          volume: summary.volume,
          volumeUnit: state.profile.weightUnit,
          distance: summary.distance,
          personalRecords: summary.personalRecords,
        },
        { watermark: !hasProAccess(state) },
      );
      const result = await shareOrDownloadPng(
        blob,
        `smartfit-workout-${toISODate(new Date())}.png`,
      );
      toast(result === 'shared' ? 'Workout shared' : 'Workout card saved to downloads');
    } catch {
      toast('Could not render the workout card', 'info');
    }
  }

  if (!isOpen || !payload || payload.kind !== 'runner') return null;
  const run = payload;

  const category = categoryById(state, run.categoryId);
  const active = exercises[activeIndex] ?? null;
  const summary: SessionSummary | null =
    screen === 'summary' ? summariseLiveSession(state, exercises.map(toCoreExercise)) : null;

  function blankSetFrom(name: string): LiveSet {
    // Progressive overload: Pro pre-fills the next adaptive target
    // (progressionTarget); free pre-fills last session's numbers as-is.
    const pro = hasProAccess(state);
    const target = pro ? progressionTarget(state, name) : null;
    const last = lastPerformance(state, name);
    const first = last?.sets[0];
    return {
      id: nextId.current++,
      reps:
        target?.reps != null ? String(target.reps) : first?.reps != null ? String(first.reps) : '',
      weight:
        target?.weight != null
          ? String(target.weight)
          : first?.weight != null
            ? String(first.weight)
            : '',
      distanceM:
        target?.distance != null
          ? String(Math.round(target.distance * 1000))
          : first?.distance != null
            ? String(Math.round(first.distance * 1000))
            : '',
      done: false,
      isPR: false,
    };
  }

  function addExercise(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setExercises((xs) => [
      ...xs,
      { id: nextId.current++, name: trimmed, sets: [blankSetFrom(trimmed)] },
    ]);
    setActiveIndex(exercises.length);
    setDraft('');
  }

  function addSet(exId: number) {
    setExercises((xs) =>
      xs.map((x) => {
        if (x.id !== exId) return x;
        const prev = x.sets[x.sets.length - 1];
        return {
          ...x,
          sets: [
            ...x.sets,
            {
              id: nextId.current++,
              reps: prev?.reps ?? '',
              weight: prev?.weight ?? '',
              distanceM: prev?.distanceM ?? '',
              done: false,
              isPR: false,
            },
          ],
        };
      }),
    );
  }

  function updateSet(exId: number, setId: number, patch: Partial<LiveSet>) {
    setExercises((xs) =>
      xs.map((x) =>
        x.id === exId
          ? { ...x, sets: x.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }
          : x,
      ),
    );
  }

  /** Mark a set complete: detect a PR, start the suggested rest. */
  function completeSet(ex: LiveExercise, set: LiveSet) {
    const weight = Number(set.weight);
    const reps = Number(set.reps);
    const pr = isPersonalRecord(state, ex.name, weight, reps);
    updateSet(ex.id, set.id, { done: true, isPR: pr });
    setRestTotal(suggestedRestSeconds(run.intensity));
    setRestLeft(suggestedRestSeconds(run.intensity));
    if (pr) {
      toast(`New PR on ${ex.name}!`, 'success');
      buzz([80, 40, 80, 40, 200]);
    } else {
      buzz(60);
    }
  }

  function setRep(
    exId: number,
    setId: number,
    field: 'reps' | 'weight' | 'distanceM',
    value: string,
  ) {
    updateSet(exId, setId, { [field]: value } as Partial<LiveSet>);
  }

  function removeExercise(exId: number) {
    setExercises((xs) => xs.filter((x) => x.id !== exId));
    setActiveIndex((i) => Math.max(0, Math.min(i, exercises.length - 2)));
  }

  function finishToSummary() {
    setRunning(false);
    stopTracking(); // freeze the GPS trace before the summary renders it
    setScreen('summary');
  }

  function saveSession() {
    const durationMin = Math.max(1, Math.round(seconds / 60));
    const core = exercises.map(toCoreExercise).filter((x) => x.sets.length > 0);
    const route = routeRef.current.length >= 2 ? simplifyRoute(routeRef.current, 500) : undefined;
    addSession({
      date: toISODate(new Date()),
      categoryId: run.categoryId,
      title: run.title,
      durationMin,
      intensity: run.intensity,
      calories: estimateSessionCalories(durationMin, run.intensity),
      exercises: core,
      scheduleId: run.scheduleId,
      distanceKm: route ? Math.round(routeDistanceKm(route) * 100) / 100 : undefined,
      route,
    });
    setRunning(false);
    closeModal();
    const prCount = summary?.personalRecords.length ?? 0;
    toast(
      prCount > 0
        ? `Session logged — ${durationMin} min and ${prCount} PR${prCount === 1 ? '' : 's'}!`
        : `Session logged — ${durationMin} min of ${run.title}`,
      'success',
    );
  }

  return (
    <div
      className="session-shell fixed inset-0 z-50 flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={`Live session: ${run.title}`}
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="relative flex items-center gap-3 px-4 pt-4 pb-3">
        <button
          onClick={closeModal}
          aria-label="Close session"
          className="glass press flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base leading-tight font-extrabold">{run.title}</p>
          <p className="session-muted text-xs">
            {category?.name ?? 'Session'} ·{' '}
            {exercises.filter((x) => x.sets.some((s) => s.done)).length} of {exercises.length}{' '}
            exercises
          </p>
        </div>
        {/* The running clock is the one thing you must always see. */}
        <div className="text-right">
          <p
            className="font-display text-3xl leading-none font-extrabold tabular-nums"
            aria-label="Elapsed time"
          >
            {clock(seconds)}
          </p>
          <button
            onClick={() => setRunning((r) => !r)}
            className="press mt-1 flex items-center gap-1 text-[11px] font-bold tracking-wide uppercase"
            style={{ color: running ? 'var(--chart-1)' : 'rgba(247,242,234,0.6)' }}
          >
            {running ? (
              <Pause className="h-3 w-3" aria-hidden />
            ) : (
              <Play className="h-3 w-3" aria-hidden />
            )}
            {running ? 'Pause' : seconds > 0 ? 'Resume' : 'Start'}
          </button>
        </div>
      </header>

      {/* ── GPS walk-tracking chip (live screen only) ────────────────── */}
      {screen === 'live' && (
        <div className="px-4 pb-3">
          <button
            onClick={toggleTracking}
            className={cn(
              'press flex w-full items-center gap-3 rounded-2xl border p-3 text-left',
              tracking ? 'border-transparent' : 'session-tile border-transparent',
            )}
            style={tracking ? { background: 'rgba(200,241,53,0.12)' } : undefined}
            aria-pressed={tracking}
          >
            <span
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                tracking && 'animate-pulse-soft',
              )}
              style={{
                background: tracking ? 'rgba(200,241,53,0.2)' : 'rgba(247,242,234,0.07)',
                color: tracking ? '#c8f135' : 'rgba(247,242,234,0.6)',
              }}
            >
              <Navigation className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">
                {tracking ? 'Tracking your route' : 'Track walk / route'}
              </span>
              <span className="session-muted block text-xs tabular-nums">
                {geoError ??
                  (distanceKm > 0
                    ? `${distanceKm.toFixed(2)} km recorded`
                    : 'GPS maps your route for sharing')}
              </span>
            </span>
            <span
              className="text-sm font-extrabold tabular-nums"
              style={{ color: tracking ? '#c8f135' : 'rgba(247,242,234,0.7)' }}
            >
              {distanceKm.toFixed(2)} km
            </span>
          </button>
        </div>
      )}

      {screen === 'summary' && summary ? (
        <SummaryScreen
          summary={summary}
          durationMin={Math.max(1, Math.round(seconds / 60))}
          weightUnit={state.profile.weightUnit}
          route={routeRef.current}
          distanceKm={distanceKm}
          onShare={shareMap}
          onShareWorkout={shareWorkout}
          onSave={saveSession}
          onBack={() => setScreen('live')}
        />
      ) : (
        <LiveScreen
          state={state}
          run={run}
          exercises={exercises}
          activeIndex={activeIndex}
          active={active}
          setActiveIndex={setActiveIndex}
          draft={draft}
          setDraft={setDraft}
          addExercise={addExercise}
          addSet={addSet}
          setRep={setRep}
          completeSet={completeSet}
          removeExercise={removeExercise}
          restLeft={restLeft}
          restTotal={restTotal}
          setRestLeft={setRestLeft}
          setRestTotal={setRestTotal}
          finish={finishToSummary}
        />
      )}
    </div>
  );

  function toCoreExercise(x: LiveExercise) {
    return {
      name: x.name,
      sets: x.sets
        .filter((s) => s.reps !== '' || s.weight !== '' || s.distanceM !== '' || s.done)
        .map((s) => ({
          reps: s.reps !== '' ? Number(s.reps) : undefined,
          weight: s.weight !== '' ? Number(s.weight) : undefined,
          distance: s.distanceM !== '' ? Number(s.distanceM) / 1000 : undefined,
        })),
    };
  }
}

/* ── the live screen ───────────────────────────────────────────────────── */

interface LiveProps {
  state: ReturnType<typeof useStore>['state'];
  run: {
    title: string;
    categoryId: string;
    intensity: 'low' | 'moderate' | 'high';
    scheduleId?: string;
  };
  exercises: LiveExercise[];
  activeIndex: number;
  active: LiveExercise | null;
  setActiveIndex: (i: number) => void;
  draft: string;
  setDraft: (s: string) => void;
  addExercise: (name: string) => void;
  addSet: (exId: number) => void;
  setRep: (
    exId: number,
    setId: number,
    field: 'reps' | 'weight' | 'distanceM',
    value: string,
  ) => void;
  completeSet: (ex: LiveExercise, set: LiveSet) => void;
  removeExercise: (exId: number) => void;
  restLeft: number;
  restTotal: number;
  setRestLeft: (n: number) => void;
  setRestTotal: (n: number) => void;
  finish: () => void;
}

function LiveScreen(p: LiveProps) {
  const unit = p.state.profile.weightUnit;
  const last = useMemo(
    () => (p.active ? lastPerformance(p.state, p.active.name) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.active?.name],
  );
  // Pro members see the adaptive next target the first set was pre-filled
  // with; free members see their last numbers only.
  const target: ProgressionTarget | null = useMemo(
    () => (p.active && hasProAccess(p.state) ? progressionTarget(p.state, p.active.name) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.active?.name],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── Rest timer bar (sits just under the header, always visible) ─ */}
      {p.restLeft > 0 && (
        <div className="px-4 pb-3">
          <RestTimerBar
            restLeft={p.restLeft}
            restTotal={p.restTotal}
            onSkip={() => {
              p.setRestLeft(0);
              p.setRestTotal(0);
            }}
            onAdd={() => p.setRestLeft(p.restLeft + REST_STEP_SECONDS)}
          />
        </div>
      )}

      {/* ── Exercise stepper ─────────────────────────────────────────── */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
        {p.exercises.map((x, i) => {
          const done = x.sets.some((s) => s.done);
          return (
            <button
              key={x.id}
              onClick={() => p.setActiveIndex(i)}
              className={cn(
                'press flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold',
                i === p.activeIndex
                  ? 'border-transparent text-white'
                  : 'session-tile text-[rgba(247,242,234,0.75)]',
              )}
              style={i === p.activeIndex ? { background: 'var(--chart-1)' } : undefined}
            >
              {done ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <ExerciseImage name={x.name} className="h-6 w-6 rounded-md" animated={false} />
              )}
              <span className="max-w-[9rem] truncate">{x.name}</span>
            </button>
          );
        })}
      </div>

      {/* ── Active exercise card ─────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {p.active ? (
          <div key={p.active.id} className="slide-in-right">
            {/* Demo image + name + last performance */}
            <div className="session-tile overflow-hidden rounded-2xl">
              <div className="flex items-center gap-3 p-3">
                <ExerciseImage
                  name={p.active.name}
                  className="h-16 w-16 shrink-0 rounded-xl"
                  animated
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-extrabold">{p.active.name}</p>
                  {last ? (
                    <p className="session-muted mt-0.5 flex items-center gap-1.5 text-xs">
                      <History className="h-3.5 w-3.5" aria-hidden />
                      {measureForExerciseName(p.active.name) === 'distance' ? (
                        <>Last: {formatSet(last.sets[0])}</>
                      ) : (
                        <>
                          Last: {last.bestReps} × {formatWeight(last.bestWeight, unit)} ·{' '}
                          {formatSet(last.sets[0])}
                        </>
                      )}
                    </p>
                  ) : (
                    <p className="session-muted mt-0.5 text-xs">First time logging this one.</p>
                  )}
                  {target && target.kind !== 'repeat' && (
                    <p
                      className="mt-0.5 flex items-center gap-1.5 text-xs font-bold"
                      style={{ color: '#c8f135' }}
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="truncate">Pro target · {target.rationale}</span>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => p.removeExercise(p.active!.id)}
                  aria-label={`Remove ${p.active.name}`}
                  className="press session-tile flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[rgba(247,242,234,0.6)]"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {/* Sets table */}
              <div className="px-3 pb-3">
                <div className="mb-1 grid grid-cols-[2rem_1fr_1fr_3rem] gap-2 text-[10px] font-bold tracking-wide text-[rgba(247,242,234,0.55)] uppercase">
                  <span>Set</span>
                  <span className="text-center">Reps</span>
                  <span className="text-center">
                    {measureForExerciseName(p.active.name) === 'distance'
                      ? 'Distance (m)'
                      : `Weight (${unit})`}
                  </span>
                  <span className="text-center">✓</span>
                </div>
                <div className="grid gap-2">
                  {p.active.sets.map((s, idx) => {
                    const e1rm =
                      Number(s.weight) > 0 && Number(s.reps) > 0
                        ? estimatedOneRepMax(Number(s.weight), Number(s.reps))
                        : 0;
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          'grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2 rounded-xl px-2 py-1.5',
                          s.done ? 'bg-[rgba(200,241,53,0.12)]' : 'session-tile',
                          s.isPR && 'pr-flash',
                        )}
                      >
                        <span className="text-center text-sm font-bold text-[rgba(247,242,234,0.7)]">
                          {idx + 1}
                        </span>
                        <input
                          inputMode="numeric"
                          value={s.reps}
                          onChange={(e) =>
                            p.setRep(
                              p.active!.id,
                              s.id,
                              'reps',
                              e.target.value.replace(/[^\d]/g, ''),
                            )
                          }
                          placeholder="8"
                          aria-label={`Reps, set ${idx + 1}`}
                          className="session-input h-11 w-full text-base"
                        />
                        {measureForExerciseName(p.active!.name) === 'distance' ? (
                          <input
                            inputMode="numeric"
                            value={s.distanceM}
                            onChange={(e) =>
                              p.setRep(
                                p.active!.id,
                                s.id,
                                'distanceM',
                                e.target.value.replace(/[^\d]/g, ''),
                              )
                            }
                            placeholder="400"
                            aria-label={`Distance in metres, set ${idx + 1}`}
                            className="session-input h-11 w-full text-base"
                          />
                        ) : (
                          <input
                            inputMode="decimal"
                            value={s.weight}
                            onChange={(e) =>
                              p.setRep(
                                p.active!.id,
                                s.id,
                                'weight',
                                e.target.value.replace(/[^\d.]/g, ''),
                              )
                            }
                            placeholder="60"
                            aria-label={`Weight, set ${idx + 1}`}
                            className="session-input h-11 w-full text-base"
                          />
                        )}
                        {s.done ? (
                          <span
                            className="flex items-center justify-center gap-0.5 text-[11px] font-bold"
                            style={{ color: s.isPR ? 'var(--chart-1)' : '#c8f135' }}
                          >
                            {s.isPR && (
                              <Trophy className="h-3.5 w-3.5" aria-label="Personal record" />
                            )}
                            <Check className="h-4 w-4" aria-hidden />
                          </span>
                        ) : (
                          <button
                            onClick={() => p.completeSet(p.active!, s)}
                            aria-label={`Complete set ${idx + 1}`}
                            className="press mx-auto flex h-11 w-11 items-center justify-center rounded-full"
                            style={{ background: 'var(--chart-1)' }}
                          >
                            <Check className="h-4 w-4 text-white" aria-hidden />
                          </button>
                        )}
                        {e1rm > 0 && (
                          <span className="col-span-4 -mt-1 pb-0.5 text-right text-[10px] text-[rgba(247,242,234,0.5)]">
                            e1RM ≈ {formatWeight(e1rm, unit)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => p.addSet(p.active!.id)}
                  className="press session-tile mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold"
                >
                  <Plus className="h-4 w-4" aria-hidden /> Add set
                </button>
              </div>
            </div>

            {/* Exercise stepper nav */}
            <div className="mt-3 flex items-center justify-between">
              <button
                disabled={p.activeIndex === 0}
                onClick={() => p.setActiveIndex(p.activeIndex - 1)}
                className="press session-tile flex h-11 items-center gap-1 rounded-full px-4 text-sm font-bold disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
              </button>
              <span className="session-muted text-sm font-semibold tabular-nums">
                {p.activeIndex + 1} / {p.exercises.length}
              </span>
              <button
                disabled={p.activeIndex >= p.exercises.length - 1}
                onClick={() => p.setActiveIndex(p.activeIndex + 1)}
                className="press session-tile flex h-11 items-center gap-1 rounded-full px-4 text-sm font-bold disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        ) : (
          <EmptyRunner categoryId={p.run.categoryId} onAdd={(name) => p.addExercise(name)} />
        )}

        {/* Add-exercise field */}
        <div className="mt-4">
          <ExercisePicker
            value={p.draft}
            onChange={p.setDraft}
            placeholder="Add an exercise (e.g. Bench press)"
            ariaLabel="Add exercise"
          />
          <button
            onClick={() => p.addExercise(p.draft)}
            disabled={!p.draft.trim()}
            className="press mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold disabled:opacity-40"
            style={{ background: 'var(--chart-1)' }}
          >
            <Plus className="h-4 w-4" aria-hidden /> Add exercise
          </button>
        </div>
      </div>

      {/* ── Thumb-zone finish bar ────────────────────────────────────── */}
      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={p.finish}
          className="press flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-extrabold text-white shadow-lg"
          style={{ background: 'linear-gradient(120deg,#e05e36,#c4451f)' }}
        >
          <Flag className="h-5 w-5" aria-hidden /> Finish session
        </button>
      </div>
    </div>
  );
}

/* ── empty state with tap-to-add suggestions ───────────────────────────── */

/**
 * First-run / no-routine state. Rather than a dead end, it offers a curated,
 * balanced starter list for the session's category (from the shared catalog,
 * with demo tiles) so a tap builds a real session — and the free-text field
 * below still takes anything.
 */
function EmptyRunner({ categoryId, onAdd }: { categoryId: string; onAdd: (name: string) => void }) {
  const suggestions = useMemo(() => suggestedExercisesForCategory(categoryId, 6), [categoryId]);
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="session-tile flex h-14 w-14 items-center justify-center rounded-2xl">
          <Dumbbell className="h-6 w-6 text-[rgba(247,242,234,0.7)]" aria-hidden />
        </span>
        <p className="text-sm font-bold">No exercises yet</p>
        <p className="session-muted max-w-[18rem] text-xs">
          Tap a suggestion to build your session, or add any lift below — SmartFit pre-fills your
          last numbers.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {suggestions.map((s) => (
          <button
            key={s.id}
            onClick={() => onAdd(s.name)}
            className="session-tile press flex items-center gap-2.5 rounded-xl p-2.5 text-left"
          >
            <ExerciseImage
              name={s.name}
              className="h-11 w-11 shrink-0 rounded-lg"
              animated={false}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{s.name}</span>
              <span className="session-muted block text-[10px] capitalize">{s.equipment}</span>
            </span>
            <Plus className="h-4 w-4 shrink-0" style={{ color: 'var(--chart-1)' }} aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── rest timer ────────────────────────────────────────────────────────── */

function RestTimerBar({
  restLeft,
  restTotal,
  onSkip,
  onAdd,
}: {
  restLeft: number;
  restTotal: number;
  onSkip: () => void;
  onAdd: () => void;
}) {
  const pct = restTotal > 0 ? Math.min(100, (restLeft / restTotal) * 100) : 0;
  const urgent = restLeft <= 10;
  return (
    <div className="glass flex items-center gap-3 rounded-2xl p-3">
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          urgent && 'rest-beat',
        )}
        style={{
          background: 'color-mix(in oklab, var(--chart-1) 25%, transparent)',
          color: 'var(--chart-1)',
        }}
      >
        <Coffee className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-bold">Rest</p>
          <p
            className={cn(
              'font-display text-xl font-extrabold tabular-nums',
              urgent && 'rest-beat',
            )}
            style={{ color: 'var(--chart-1)' }}
          >
            {clock(restLeft)}
          </p>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[rgba(247,242,234,0.12)]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: 'var(--chart-1)',
              transition: 'width 0.4s linear',
            }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <button
          onClick={onAdd}
          className="press session-tile min-h-11 rounded-full px-3 py-1 text-xs font-bold"
        >
          +{REST_STEP_SECONDS}s
        </button>
        <button
          onClick={onSkip}
          className="press session-tile min-h-11 rounded-full px-3 py-1 text-xs font-bold"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

/* ── summary screen ────────────────────────────────────────────────────── */

function SummaryScreen({
  summary,
  durationMin,
  weightUnit,
  route,
  distanceKm,
  onShare,
  onShareWorkout,
  onSave,
  onBack,
}: {
  summary: SessionSummary;
  durationMin: number;
  weightUnit: 'kg' | 'lb';
  route: GeoPoint[];
  distanceKm: number;
  onShare: () => void;
  onShareWorkout: () => void;
  onSave: () => void;
  onBack: () => void;
}) {
  const hasRoute = route.length >= 2;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="pro-surface sheen relative rounded-3xl p-5 text-center">
          <p className="eyebrow pro-muted">Session complete</p>
          <p className="font-display mt-1 text-4xl font-extrabold tabular-nums">{durationMin}m</p>
          {summary.personalRecords.length > 0 && (
            <div
              className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold"
              style={{ background: 'rgba(200,241,53,0.15)', color: '#e3f88a' }}
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              {summary.personalRecords.length} personal record
              {summary.personalRecords.length === 1 ? '' : 's'}!
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatTile icon={Dumbbell} label="Sets" value={`${summary.sets}`} />
          {summary.distance > 0 && summary.volume === 0 ? (
            <StatTile icon={Flame} label="Distance" value={formatSetDistance(summary.distance)} />
          ) : (
            <StatTile
              icon={Flame}
              label="Volume"
              value={formatVolume(summary.volume, weightUnit)}
            />
          )}
          <StatTile icon={Timer} label="Exercises" value={`${summary.exercises}`} />
        </div>

        {hasRoute && (
          <div className="session-tile mt-4 flex items-center gap-4 rounded-2xl p-4">
            <div className="bg-card relative h-28 w-28 shrink-0 overflow-hidden rounded-xl">
              <RouteMap route={route} className="h-full w-full" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Your route</p>
              <p className="session-muted text-xs tabular-nums">
                {distanceKm.toFixed(2)} km · {durationMin} min
              </p>
            </div>
            <button
              onClick={onShare}
              className="press flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold"
              style={{ background: 'var(--chart-1)', color: '#fff' }}
            >
              <Share2 className="h-4 w-4" aria-hidden /> Share
            </button>
          </div>
        )}

        {summary.personalRecords.length > 0 && (
          <div className="session-tile mt-4 rounded-2xl p-4">
            <p className="flex items-center gap-1.5 text-sm font-bold" style={{ color: '#e3f88a' }}>
              <Trophy className="h-4 w-4" aria-hidden /> New records
            </p>
            <ul className="mt-2 grid gap-1.5">
              {summary.personalRecords.map((name) => (
                <li key={name} className="text-sm font-semibold text-[rgba(247,242,234,0.85)]">
                  {name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={onShareWorkout}
          className="press session-tile flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold"
        >
          <Share2 className="h-4 w-4" aria-hidden /> Share workout card
        </button>
        <button
          onClick={onSave}
          className="press flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-extrabold text-white shadow-lg"
          style={{ background: 'linear-gradient(120deg,#e05e36,#c4451f)' }}
        >
          <Check className="h-5 w-5" aria-hidden /> Save session
        </button>
        <button
          onClick={onBack}
          className="press session-tile flex h-11 w-full items-center justify-center rounded-2xl text-sm font-bold"
        >
          Keep training
        </button>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Dumbbell;
  label: string;
  value: string;
}) {
  return (
    <div className="session-tile flex flex-col items-center gap-1 rounded-2xl p-3 text-center">
      <Icon className="h-4 w-4" style={{ color: 'var(--chart-1)' }} aria-hidden />
      <p className="font-display text-lg leading-tight font-extrabold tabular-nums">{value}</p>
      <p className="session-muted text-[10px] font-semibold tracking-wide uppercase">{label}</p>
    </div>
  );
}
