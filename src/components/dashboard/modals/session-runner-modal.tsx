'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronsLeft,
  ChevronsRight,
  Dumbbell,
  Flag,
  Flame,
  History,
  Minus,
  Pause,
  Play,
  Plus,
  Share2,
  Sparkles,
  Timer,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { ExerciseImage } from '@/components/exercise-image';
import { ExercisePicker } from '@/components/exercise-picker';
import { Select } from '@/components/ui/select';
import {
  categoryById,
  estimateExercisesCalories,
  latestBodyWeightKg,
  toISODate,
} from '@smartfit/core';
import {
  REST_PRESETS,
  REST_STEP_SECONDS,
  estimatedOneRepMax,
  formatSet,
  formatSetDistance,
  formatVolume,
  formatWeight,
  hasProAccess,
  isPersonalRecord,
  lastPerformance,
  measureForExerciseName,
  progressionTarget,
  suggestedExercisesForCategory,
  suggestedRestSeconds,
  summariseLiveSession,
  type ProgressionTarget,
  type SessionSummary,
  type WorkoutSetKind,
} from '@smartfit/core';
import { renderWorkoutPng, shareOrDownloadPng } from '@/lib/route-art';
import { ProgressAchievementModal } from './progress-achievement-modal';
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
  kind: WorkoutSetKind;
  rpe: string;
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
  const [celebrate, setCelebrate] = useState<{ title: string; prCount: number } | null>(null);
  const nextId = useRef(1);

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
    const first = last?.sets.find((set) => set.kind !== 'warmup') ?? last?.sets[0];
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
      kind: 'working',
      rpe: '',
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
              kind: prev?.kind ?? 'working',
              rpe: prev?.rpe ?? '',
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
    const pr = set.kind !== 'warmup' && isPersonalRecord(state, ex.name, weight, reps);
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

  function setKind(exId: number, setId: number, kind: WorkoutSetKind) {
    updateSet(exId, setId, { kind, isPR: false });
  }

  function setRpe(exId: number, setId: number, value: string) {
    updateSet(exId, setId, { rpe: value });
  }

  function removeExercise(exId: number) {
    setExercises((xs) => xs.filter((x) => x.id !== exId));
    setActiveIndex((i) => Math.max(0, Math.min(i, exercises.length - 2)));
  }

  function finishToSummary() {
    setRunning(false);
    setScreen('summary');
  }

  function saveSession() {
    const durationMin = Math.max(1, Math.round(seconds / 60));
    const core = exercises.map(toCoreExercise).filter((x) => x.sets.length > 0);
    addSession({
      date: toISODate(new Date()),
      categoryId: run.categoryId,
      title: run.title,
      durationMin,
      intensity: run.intensity,
      // Price the work actually logged. The intensity-based estimate is the
      // fallback for sessions with no exercises (e.g. a bare timed entry).
      calories:
        core.length > 0
          ? estimateExercisesCalories(core, latestBodyWeightKg(state) ?? undefined)
          : estimateSessionCalories(durationMin, run.intensity),
      exercises: core,
      scheduleId: run.scheduleId,
    });
    setRunning(false);
    const prCount = summary?.personalRecords.length ?? 0;
    // Celebrate first (the reference "Today's progress" sheet), then close.
    setCelebrate({ title: run.title, prCount });
  }

  return (
    <div
      className="session-shell fixed inset-0 z-50 flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={`Live session: ${run.title}`}
    >
      {celebrate && (
        <ProgressAchievementModal
          workoutTitle={celebrate.title}
          prCount={celebrate.prCount}
          onDone={() => {
            setCelebrate(null);
            closeModal();
            toast(
              celebrate.prCount > 0
                ? `Session logged — ${celebrate.prCount} PR${celebrate.prCount === 1 ? '' : 's'}!`
                : `Session logged — keep the streak alive!`,
              'success',
            );
          }}
        />
      )}
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="relative flex items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 min-[380px]:gap-3">
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
        {/* The running clock stays visible even when the ring scrolls away. */}
        <div className="shrink-0 text-right">
          <p
            className="font-display text-xl leading-none font-extrabold tabular-nums"
            aria-label="Elapsed time"
          >
            {clock(seconds)}
          </p>
          <button
            onClick={() => setRunning((r) => !r)}
            className="press mt-1 flex items-center gap-1 text-[11px] font-bold tracking-wide uppercase"
            style={{ color: running ? 'var(--chart-1)' : 'rgba(237,235,230,0.6)' }}
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

      {screen === 'summary' && summary ? (
        <SummaryScreen
          summary={summary}
          durationMin={Math.max(1, Math.round(seconds / 60))}
          weightUnit={state.profile.weightUnit}
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
          setKind={setKind}
          setRpe={setRpe}
          completeSet={completeSet}
          removeExercise={removeExercise}
          restLeft={restLeft}
          restTotal={restTotal}
          setRestLeft={setRestLeft}
          setRestTotal={setRestTotal}
          seconds={seconds}
          running={running}
          setRunning={setRunning}
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
          ...(s.kind !== 'working' ? { kind: s.kind } : {}),
          ...(s.rpe !== '' ? { rpe: Number(s.rpe) } : {}),
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
  setKind: (exId: number, setId: number, kind: WorkoutSetKind) => void;
  setRpe: (exId: number, setId: number, value: string) => void;
  completeSet: (ex: LiveExercise, set: LiveSet) => void;
  removeExercise: (exId: number) => void;
  restLeft: number;
  restTotal: number;
  setRestLeft: (n: number) => void;
  setRestTotal: (n: number) => void;
  /** Live session clock (shared with the header). */
  seconds: number;
  running: boolean;
  setRunning: (r: boolean) => void;
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const isDistance = p.active ? measureForExerciseName(p.active.name) === 'distance' : false;

  // The set the athlete is working right now: first un-done, else the last.
  const currentSet =
    p.active?.sets.find((s) => !s.done) ?? (p.active?.sets.length ? p.active.sets.at(-1) : null);
  const currentNo = currentSet ? p.active!.sets.indexOf(currentSet) + 1 : 0;
  const doneCount = p.active?.sets.filter((s) => s.done).length ?? 0;
  const nextExercise = p.exercises[p.activeIndex + 1];

  /** Bump a numeric set field by `step` (clamped ≥ 0), writing back as text. */
  function bump(field: 'reps' | 'weight' | 'distanceM', step: number) {
    if (!p.active || !currentSet) return;
    const raw = currentSet[field];
    const base = raw === '' ? 0 : Number(raw);
    const next = Math.max(0, Math.round((base + step) * 100) / 100);
    p.setRep(p.active.id, currentSet.id, field, next === 0 ? '' : String(next));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {p.active ? (
          <div key={p.active.id} className="slide-in-right">
            {/* ── Cinematic exercise hero — the Axel live-workout stage ── */}
            <div className="relative overflow-hidden rounded-3xl bg-[#0d0f08]">
              <div className="flex h-52 w-full items-center justify-center overflow-hidden p-3 min-[380px]:h-56">
                <ExerciseImage
                  name={p.active.name}
                  variant="full"
                  className="exercise-demo-tile--dark h-full w-full rounded-2xl bg-white"
                  animated
                />
              </div>
              {/* Scrim only at the very top, where the chrome sits — the
                  caption now lives in its own band below the art. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-20"
                style={{
                  background: 'linear-gradient(180deg, rgba(5,4,4,0.65) 0%, rgba(5,4,4,0) 100%)',
                }}
              />
              {/* Set progress over the art. Removing an exercise lives on
                  its pill in the bottom navigator, not here — the stage stays
                  clean like the reference. */}
              <div className="absolute inset-x-3 top-3 flex items-start gap-2">
                {/* One dash per exercise in the session — the reference's
                    green progress track. Completed and current read volt;
                    upcoming stay dim. */}
                <div
                  className="flex min-w-0 flex-1 items-center gap-1"
                  role="progressbar"
                  aria-valuemin={1}
                  aria-valuemax={p.exercises.length}
                  aria-valuenow={p.activeIndex + 1}
                  aria-label={`Exercise ${p.activeIndex + 1} of ${p.exercises.length}`}
                >
                  {p.exercises.map((x, i) => {
                    const complete = x.sets.length > 0 && x.sets.every((st) => st.done);
                    return (
                      <span
                        key={x.id}
                        aria-hidden
                        className={cn(
                          'h-1 min-w-0 flex-1 rounded-full transition-colors',
                          complete || i <= p.activeIndex ? 'bg-volt' : 'bg-white/20',
                        )}
                      />
                    );
                  })}
                </div>
              </div>
              {/* Name + history — a solid band under the art so the copy is
                  always legible regardless of the demo's brightness. */}
              <div className="relative border-t border-white/8 bg-[#0a0b06] px-4 pt-4 pb-4">
                <p className="text-volt text-[11px] font-extrabold tracking-[0.18em] uppercase">
                  {currentSet
                    ? `Set ${currentNo} / ${p.active.sets.length}`
                    : `${p.active.sets.length} sets`}
                </p>
                <h3 className="title-italic mt-2 text-[1.75rem] text-balance min-[380px]:text-[2rem]">
                  {p.active.name}
                </h3>
                <p className="session-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                  {last ? (
                    <span className="inline-flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5" aria-hidden />
                      {isDistance
                        ? `Last: ${formatSet(last.sets[0])}`
                        : `Last: ${last.bestReps} × ${formatWeight(last.bestWeight, unit)}`}
                    </span>
                  ) : (
                    <span>First time logging this one.</span>
                  )}
                  {target && target.kind !== 'repeat' && (
                    <span
                      className="inline-flex items-center gap-1.5 font-bold"
                      style={{ color: '#B4E761' }}
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="truncate">Pro target · {target.rationale}</span>
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* ── Control deck: steppers flank the ring timer ─────────────
                Pulled up close under the stage so the dial reads as part of
                the hero rather than floating mid-screen. */}
            <div className="-mt-1 flex items-center justify-between gap-2 min-[380px]:gap-3">
              <SetStepper
                label={isDistance ? ' reps ' : 'Reps'}
                value={currentSet?.reps || ''}
                step={1}
                onMinus={() => bump('reps', -1)}
                onPlus={() => bump('reps', 1)}
              />
              <RingTimer
                seconds={p.seconds}
                running={p.running}
                restLeft={p.restLeft}
                restTotal={p.restTotal}
                onToggle={() => p.setRunning(!p.running)}
                onSkip={() => {
                  p.setRestLeft(0);
                  p.setRestTotal(0);
                }}
                onAdd={() => p.setRestLeft(p.restLeft + REST_STEP_SECONDS)}
              />
              {isDistance ? (
                <SetStepper
                  label="Metres"
                  value={currentSet?.distanceM || ''}
                  step={50}
                  onMinus={() => bump('distanceM', -50)}
                  onPlus={() => bump('distanceM', 50)}
                />
              ) : (
                <SetStepper
                  label={`Weight (${unit})`}
                  value={currentSet?.weight || ''}
                  step={2.5}
                  onMinus={() => bump('weight', -2.5)}
                  onPlus={() => bump('weight', 2.5)}
                />
              )}
            </div>

            {/* Complete-set CTA */}
            {currentSet && !currentSet.done ? (
              <button
                onClick={() => p.completeSet(p.active!, currentSet)}
                aria-label={`Complete set ${currentNo}`}
                className="press btn-volt mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-extrabold"
              >
                <Check className="h-5 w-5" strokeWidth={3} aria-hidden /> Complete set {currentNo}
              </button>
            ) : (
              <div className={cn('mt-5 grid gap-2', !nextExercise && 'grid-cols-2')}>
                <button
                  onClick={() => p.addSet(p.active!.id)}
                  className="press session-tile flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-2xl px-2 text-sm font-bold"
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">Add set</span>
                </button>
                {!nextExercise && (
                  <button
                    onClick={p.finish}
                    className="press flex h-12 items-center justify-center gap-1.5 rounded-2xl text-sm font-bold"
                    style={{ background: 'rgba(138,210,0,0.14)', color: '#B4E761' }}
                  >
                    <Flag className="h-4 w-4" aria-hidden /> Wrap up
                  </button>
                )}
              </div>
            )}

            {/* ── Sets table ─────────────────────────────────────────────── */}
            <div className="mt-6">
              {/* Removing the exercise lives with its sets now that the
                  navigator is a next-up preview rather than a pill queue. */}
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold tracking-[0.16em] text-[rgba(237,235,230,0.55)] uppercase">
                  Sets
                </p>
                <button
                  onClick={() => p.removeExercise(p.active!.id)}
                  aria-label={`Remove ${p.active.name} from this session`}
                  className="press session-muted flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-bold transition-colors hover:bg-white/10"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Remove
                </button>
              </div>
              <div className="mb-2 grid grid-cols-[1.5rem_1fr_1fr_2.75rem] gap-2 text-[10px] font-bold tracking-wide text-[rgba(237,235,230,0.55)] uppercase min-[380px]:grid-cols-[2rem_1fr_1fr_3rem]">
                <span>Set</span>
                <span className="text-center">Reps</span>
                <span className="text-center">
                  {isDistance ? 'Distance (m)' : `Weight (${unit})`}
                </span>
                <span className="text-center">✓</span>
              </div>
              <div className="grid gap-2">
                {p.active.sets.map((s, idx) => {
                  const e1rm =
                    s.kind !== 'warmup' && Number(s.weight) > 0 && Number(s.reps) > 0
                      ? estimatedOneRepMax(Number(s.weight), Number(s.reps))
                      : 0;
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        'grid grid-cols-[1.5rem_1fr_1fr_2.75rem] items-center gap-2 rounded-xl px-2 py-1.5 min-[380px]:grid-cols-[2rem_1fr_1fr_3rem]',
                        s.done ? 'bg-[rgba(138,210,0,0.12)]' : 'session-tile',
                        s.isPR && 'pr-flash',
                      )}
                    >
                      <span className="text-center text-sm font-bold text-[rgba(237,235,230,0.7)]">
                        {idx + 1}
                      </span>
                      <input
                        inputMode="numeric"
                        value={s.reps}
                        onChange={(e) =>
                          p.setRep(p.active!.id, s.id, 'reps', e.target.value.replace(/[^\d]/g, ''))
                        }
                        placeholder="8"
                        aria-label={`Reps, set ${idx + 1}`}
                        className="session-input h-11 w-full text-base"
                      />
                      {isDistance ? (
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
                          style={{ color: s.isPR ? 'var(--chart-1)' : '#8AD200' }}
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
                          <Check className="h-4 w-4 text-[#0d1102]" aria-hidden />
                        </button>
                      )}
                      {e1rm > 0 && (
                        <span className="col-span-4 -mt-1 pb-0.5 text-right text-[10px] text-[rgba(237,235,230,0.5)]">
                          e1RM ≈ {formatWeight(e1rm, unit)}
                        </span>
                      )}
                      <div className="col-span-4 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                        <Select
                          value={s.kind}
                          aria-label={`Set type, set ${idx + 1}`}
                          onChange={(e) =>
                            p.setKind(p.active!.id, s.id, e.target.value as WorkoutSetKind)
                          }
                          className="session-select h-10 w-full text-xs sm:h-10"
                        >
                          <option value="working">Working set</option>
                          <option value="warmup">Warm-up</option>
                          <option value="drop">Drop set</option>
                          <option value="failure">Failure set</option>
                        </Select>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          step={1}
                          inputMode="numeric"
                          value={s.rpe}
                          onChange={(e) =>
                            p.setRpe(
                              p.active!.id,
                              s.id,
                              e.target.value.replace(/[^\d]/g, '').slice(0, 2),
                            )
                          }
                          placeholder="RPE (optional)"
                          aria-label={`RPE 1 to 10, set ${idx + 1}`}
                          className="session-input h-9 w-full text-xs"
                        />
                      </div>
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

            {/* Add-exercise — collapsed by default (mid-workout calm). */}
            <div className="mt-3">
              {pickerOpen ? (
                <div className="session-tile rounded-2xl p-3">
                  <ExercisePicker
                    value={p.draft}
                    onChange={p.setDraft}
                    placeholder="Add an exercise (e.g. Bench press)"
                    ariaLabel="Add exercise"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => p.addExercise(p.draft)}
                      disabled={!p.draft.trim()}
                      className="press flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-bold disabled:opacity-40"
                      style={{ background: 'var(--chart-1)', color: '#0d1102' }}
                    >
                      <Plus className="h-4 w-4" aria-hidden /> Add exercise
                    </button>
                    <button
                      onClick={() => setPickerOpen(false)}
                      className="press session-tile flex h-11 items-center justify-center rounded-xl px-4 text-sm font-bold"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setPickerOpen(true)}
                  className="press session-tile flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl text-sm font-bold"
                >
                  <Plus className="h-4 w-4" aria-hidden /> Add exercise to session
                </button>
              )}
            </div>
          </div>
        ) : (
          <EmptyRunner categoryId={p.run.categoryId} onAdd={(name) => p.addExercise(name)} />
        )}
      </div>

      {/* ── Next-up navigator — the reference's preview card ──────────────
          One card showing the exercise that comes next (its demo, its name)
          with prev/next controls, rather than a scrolling queue of pills.
          Hidden on a single-exercise session, where there is nothing to
          navigate to. */}
      {p.exercises.length > 1 && p.active && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-3 rounded-[1.25rem] bg-[#15170f] p-2.5">
            <ExerciseImage
              name={(nextExercise ?? p.exercises[0]).name}
              animated={false}
              className="h-12 w-12 shrink-0 rounded-2xl bg-white"
            />
            <div className="min-w-0 flex-1">
              <p className="session-muted text-[10px] font-bold tracking-[0.16em] uppercase">
                {nextExercise ? 'Next up' : 'Last exercise'}
              </p>
              <p className="truncate text-sm leading-tight font-bold">
                {(nextExercise ?? p.active).name}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => p.setActiveIndex(p.activeIndex - 1)}
                disabled={p.activeIndex === 0}
                aria-label="Previous exercise"
                className="press grid h-9 w-9 place-items-center rounded-full bg-white/8 text-[rgba(237,235,230,0.75)] transition-colors hover:bg-white/15 disabled:opacity-35"
              >
                <ChevronsLeft className="h-4 w-4" aria-hidden />
              </button>
              <button
                onClick={() => p.setActiveIndex(p.activeIndex + 1)}
                disabled={!nextExercise}
                aria-label="Next exercise"
                className="press btn-volt flex h-9 items-center gap-1 rounded-full pr-2.5 pl-3.5 text-sm font-extrabold transition-transform hover:-translate-y-0.5 disabled:opacity-35 disabled:hover:translate-y-0"
              >
                Next
                <ChevronsRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Finish bar ───────────────────────────────────────────────────
          Not sticky: on a short phone a pinned slab plus the navigator ate
          the stage. It sits at the end of the flow and scrolls with it. */}
      <div className="px-4 pt-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={p.finish}
          className="press btn-volt flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-extrabold min-[380px]:h-14 min-[380px]:text-base"
        >
          <Flag className="h-5 w-5 shrink-0" aria-hidden />
          <span className="truncate">Finish session</span>
        </button>
      </div>
    </div>
  );
}

/* ── steppers flanking the ring ────────────────────────────────────────── */

function SetStepper({
  label,
  value,
  step,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  step: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="flex min-w-0 shrink flex-col items-center gap-2">
      {/* The reference's stepper: one large flat circle with a thin plus,
          the label directly beneath. Long-press (or the − affordance that
          appears once a value is set) handles decrements. */}
      <button
        type="button"
        onClick={onPlus}
        aria-label={`Increase ${label.trim()} by ${step}`}
        className="press grid h-16 w-16 place-items-center rounded-full bg-[#1a1c15] text-[#edebe6] transition-colors hover:bg-[#23261c] min-[380px]:h-[4.5rem] min-[380px]:w-[4.5rem]"
      >
        <Plus className="h-6 w-6" strokeWidth={2} aria-hidden />
      </button>
      <div className="flex flex-col items-center gap-1">
        <p className="text-[13px] leading-none font-bold text-[#edebe6]">{label}</p>
        {/* Value + decrement only once there is something to adjust, so the
            resting state matches the comp's clean plus-and-label pair. */}
        {value ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onMinus}
              aria-label={`Decrease ${label.trim()} by ${step}`}
              className="press session-muted grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/8"
            >
              <Minus className="h-3 w-3" aria-hidden />
            </button>
            <p className="font-display text-base leading-none font-extrabold tabular-nums">
              {value}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── the ring timer — the Axel countdown centerpiece ───────────────────── */

function RingTimer({
  seconds,
  running,
  restLeft,
  restTotal,
  onToggle,
  onSkip,
  onAdd,
}: {
  seconds: number;
  running: boolean;
  restLeft: number;
  restTotal: number;
  onToggle: () => void;
  onSkip: () => void;
  onAdd: () => void;
}) {
  // Gradient ids must be unique per instance or a second ring would reuse
  // the first one's defs.
  const gradId = useId();
  const resting = restLeft > 0;
  const urgent = resting && restLeft <= 10;
  // Ring geometry: 168px disc, 12px stroke.
  const R = 66;
  const C = 2 * Math.PI * R;
  const fraction = resting
    ? restTotal > 0
      ? restLeft / restTotal
      : 0
    : running
      ? (seconds % 60) / 60
      : 0;

  return (
    <div className="relative grid shrink-0 place-items-center">
      <button
        type="button"
        onClick={onToggle}
        aria-label={running ? 'Pause session clock' : 'Resume session clock'}
        className="press relative grid h-[clamp(7.5rem,34vw,168px)] w-[clamp(7.5rem,34vw,168px)] place-items-center rounded-full"
      >
        <svg
          viewBox="0 0 168 168"
          className="absolute inset-0 h-full w-full -rotate-90"
          aria-hidden
        >
          <defs>
            {/* The reference arc is not a flat stroke: it ramps from a deep
                green at the tail to a bright volt at the leading edge. */}
            <linearGradient id={`${gradId}-run`} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#4E7A00" />
              <stop offset="55%" stopColor="#8AD200" />
              <stop offset="100%" stopColor="#C6F94D" />
            </linearGradient>
            <linearGradient id={`${gradId}-rest`} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#5C5330" />
              <stop offset="60%" stopColor="#A8913F" />
              <stop offset="100%" stopColor="#E4D48A" />
            </linearGradient>
            <linearGradient id={`${gradId}-urgent`} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#6E9E00" />
              <stop offset="100%" stopColor="#D8FF6B" />
            </linearGradient>
          </defs>
          <circle
            cx="84"
            cy="84"
            r={R}
            fill="none"
            stroke="rgba(237,235,230,0.09)"
            strokeWidth="11"
          />
          <circle
            cx="84"
            cy="84"
            r={R}
            fill="none"
            stroke={`url(#${gradId}-${resting ? (urgent ? 'urgent' : 'rest') : 'run'})`}
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - fraction)}
            style={{
              transition: 'stroke-dashoffset 0.95s linear',
              filter: fraction > 0 ? 'drop-shadow(0 0 6px rgba(138,210,0,0.45))' : undefined,
            }}
            className={urgent ? 'rest-beat origin-center' : undefined}
          />
        </svg>
        <span className="relative grid place-items-center gap-0.5">
          <span className="session-muted text-[9px] font-bold tracking-[0.2em] uppercase">
            {resting ? 'Rest' : running ? 'Session' : 'Paused'}
          </span>
          <span
            className={cn(
              'font-display text-[1.35rem] leading-none font-extrabold italic tabular-nums min-[380px]:text-[1.6rem]',
              urgent && 'rest-beat',
            )}
          >
            {clock(resting ? restLeft : seconds)}
          </span>
          <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-full bg-white/10">
            {running ? (
              <Pause className="h-4 w-4" aria-hidden />
            ) : (
              <Play className="h-4 w-4" aria-hidden />
            )}
          </span>
        </span>
      </button>

      {/* Rest actions orbit the ring while it counts down. */}
      {resting && (
        <div className="absolute -bottom-3 flex gap-1.5">
          <button
            type="button"
            onClick={onAdd}
            className="glass press rounded-full px-3 py-1.5 text-[11px] font-bold"
          >
            +{REST_STEP_SECONDS}s
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="glass press rounded-full px-3 py-1.5 text-[11px] font-bold"
          >
            Skip rest
          </button>
        </div>
      )}
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
          <Dumbbell className="h-6 w-6 text-[rgba(237,235,230,0.7)]" aria-hidden />
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
              className="exercise-demo-tile--dark h-11 w-11 shrink-0 rounded-lg bg-white"
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

/* ── summary screen ────────────────────────────────────────────────────── */

function SummaryScreen({
  summary,
  durationMin,
  weightUnit,
  onShareWorkout,
  onSave,
  onBack,
}: {
  summary: SessionSummary;
  durationMin: number;
  weightUnit: 'kg' | 'lb';
  onShareWorkout: () => void;
  onSave: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="pro-surface sheen relative rounded-3xl p-4 text-center min-[380px]:p-5">
          <p className="eyebrow pro-muted">Session complete</p>
          <p className="font-display mt-1 text-4xl font-extrabold tabular-nums">{durationMin}m</p>
          {summary.personalRecords.length > 0 && (
            <div
              className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold"
              style={{ background: 'rgba(138,210,0,0.15)', color: '#B4E761' }}
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              {summary.personalRecords.length} personal record
              {summary.personalRecords.length === 1 ? '' : 's'}!
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 min-[380px]:gap-3">
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
          <StatTile icon={Flame} label="Calories" value={`${summary.calories} kcal`} />
        </div>

        {summary.personalRecords.length > 0 && (
          <div className="session-tile mt-4 rounded-2xl p-4">
            <p className="flex items-center gap-1.5 text-sm font-bold" style={{ color: '#B4E761' }}>
              <Trophy className="h-4 w-4" aria-hidden /> New records
            </p>
            <ul className="mt-2 grid gap-1.5">
              {summary.personalRecords.map((name) => (
                <li key={name} className="text-sm font-semibold text-[rgba(237,235,230,0.85)]">
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
          className="press btn-volt flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-extrabold"
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
