'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Check,
  Flag,
  Footprints,
  Gauge,
  Loader2,
  MapPin,
  Mountain,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Timer,
  Trash2,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '../confirm-context';
import { RouteMap } from '../route-map';
import { ShareSheet } from '../share-sheet';
import { StatCard } from '../stat-card';
import { useStore } from '@/lib/store-context';
import {
  computeRunStats,
  fmtDuration,
  fmtKm,
  fmtPace,
  haversineMeters,
  hasProAccess,
  isTrackedRun,
  runAchievements,
  runTotals,
  toISODate,
  DEFAULT_WEEK_START,
  type GeoPoint,
  type Intensity,
  type RunSplit,
  type RunStats,
} from '@smartfit/core';
import {
  buzz,
  chime,
  clearRunDraft,
  intensityForPace,
  keepScreenAwake,
  readRunDraft,
  saveRunDraft,
  timeOfDayLabel,
  watchGps,
  type RunDraft,
} from '@/lib/run-sensors';
import { cn } from '@/lib/utils';

/** Only fixes that moved this far are stored — standing still adds nothing. */
const MIN_MOVE_M = 4;
/** Below this speed a stretch reads as standing still (~1.4 km/h). */
const STOP_SPEED_MPS = 0.4;

interface Lap {
  index: number;
  distanceKm: number;
  durationSec: number;
}

type Phase = 'idle' | 'live' | 'summary';

interface LiveState {
  distanceM: number;
  elevationGainM: number;
  movingSec: number;
  stoppedSec: number;
  /** Distance and time already banked for finished kilometres. */
  lastSplitAt: number;
  splitStartedAt: number;
  splits: RunSplit[];
}

const BLANK_LIVE: LiveState = {
  distanceM: 0,
  elevationGainM: 0,
  movingSec: 0,
  stoppedSec: 0,
  lastSplitAt: 0,
  splitStartedAt: 0,
  splits: [],
};

/**
 * The dedicated run experience.
 *
 * Record → live → summary, built for a phone in a hand or an armband:
 *  - distance, moving time and pace are the only things that ever dominate
 *  - auto-pause with an honest indicator, laps, and split cues (haptic + tone)
 *  - live route, elevation and calories, screen kept awake while recording
 *  - best efforts, per-kilometre splits and records against your own history
 *  - a share sheet with Strava-style transparent cards
 *  - crash recovery: an interrupted run is offered back after a reload
 */
export function RunRecord({ onSaved }: { onSaved?: () => void }) {
  const { state, addSession, estimateSessionCalories } = useStore();
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [phase, setPhase] = useState<Phase>('idle');
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [live, setLive] = useState<LiveState>(BLANK_LIVE);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [autoPaused, setAutoPaused] = useState(false);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [gps, setGps] = useState<'idle' | 'acquiring' | 'ready' | 'weak' | 'error'>('idle');
  const [gpsNote, setGpsNote] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [draft, setDraft] = useState<RunDraft | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  // Summary state (title/notes/intensity are editable before saving).
  const [summary, setSummary] = useState<RunStats | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [intensity, setIntensity] = useState<Intensity>('moderate');
  const [saving, setSaving] = useState(false);

  const startedAtRef = useRef<number | null>(null);
  const watchRef = useRef<{ stop: () => void } | null>(null);
  const releaseWakeLockRef = useRef<(() => void) | null>(null);
  const liveRef = useRef<LiveState>(BLANK_LIVE);
  const pendingEleRef = useRef(0);
  const lastFixRef = useRef<GeoPoint | null>(null);
  const dirtyRef = useRef(0);

  const history = useMemo(() => state.sessions.filter(isTrackedRun), [state.sessions]);
  const thisWeek = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const from = toISODate(weekAgo);
    return runTotals(history.filter((s) => s.date >= from));
  }, [history]);

  /* ── recovery: offer an interrupted run back ─────────────────────── */
  useEffect(() => {
    const saved = readRunDraft();
    if (!saved) return;
    // Older than 12 hours is stale — nobody wants a run they abandoned.
    if (Date.now() - saved.savedAt > 12 * 60 * 60 * 1000) {
      clearRunDraft();
      return;
    }
    setDraft(saved);
  }, []);

  /* ── GPS ─────────────────────────────────────────────────────────── */
  const beginRecording = useCallback((restored?: RunDraft) => {
    startedAtRef.current = restored?.startedAt ?? Date.now();
    setGps('acquiring');
    setGpsNote(null);
    setAutoPaused(false);
    setLaps([]);
    pendingEleRef.current = 0;

    if (restored) {
      // Rebuild the counters the live HUD shows from the stored trace.
      const stats = computeRunStats(restored.points);
      liveRef.current = {
        distanceM: stats.distanceKm * 1000,
        elevationGainM: stats.elevationGainM,
        movingSec: stats.movingSec,
        stoppedSec: stoppedFrom(stats),
        lastSplitAt: lastFullKm(stats),
        splitStartedAt: 0,
        splits: stats.splits,
      };
      lastFixRef.current = restored.points.at(-1) ?? null;
      setLive(liveRef.current);
      setPoints(restored.points);
      const elapsed = Math.round((restored.savedAt - restored.startedAt) / 1000);
      setElapsedSec(Math.max(elapsed, stats.elapsedSec));
    } else {
      liveRef.current = BLANK_LIVE;
      lastFixRef.current = null;
      setLive(BLANK_LIVE);
      setPoints([]);
      setElapsedSec(0);
    }

    watchRef.current?.stop();
    watchRef.current = watchGps({
      onFix: ({ point, accuracy: acc }) => {
        setGps('ready');
        setAccuracy(Math.round(acc));
        const last = lastFixRef.current;
        const now = Date.now();
        const dtSec = last?.t ? (point.t! - last.t) / 1000 : 0;
        const meters = last ? haversineMeters(last, point) : 0;

        if (last && meters < MIN_MOVE_M) return; // jitter / standing still
        if (last && dtSec > 30) {
          // Long gap (tunnel, lost signal): count it as paused, no distance.
          liveRef.current = {
            ...liveRef.current,
            stoppedSec: liveRef.current.stoppedSec + dtSec,
          };
          lastFixRef.current = point;
          return;
        }

        const speed = dtSec > 0 ? meters / dtSec : 0;
        const stopped = last !== null && dtSec >= 3 && speed < STOP_SPEED_MPS;
        // Elevation uses the same accumulate-then-commit rule as the
        // analytics, so the live number matches the final one.
        let gain = 0;
        if (!stopped && last?.ele !== undefined && point.ele !== undefined) {
          pendingEleRef.current += point.ele - last.ele;
          if (Math.abs(pendingEleRef.current) >= 1) {
            gain = Math.max(0, pendingEleRef.current);
            pendingEleRef.current = 0;
          }
        }

        const nextLive: LiveState = stopped
          ? { ...liveRef.current, stoppedSec: liveRef.current.stoppedSec + dtSec }
          : {
              ...liveRef.current,
              distanceM: liveRef.current.distanceM + meters,
              movingSec: liveRef.current.movingSec + dtSec,
              elevationGainM: liveRef.current.elevationGainM + gain,
            };

        // Split cue: a finished kilometre buzzes and chimes, like a watch.
        const km = Math.floor(nextLive.distanceM / 1000);
        if (km > nextLive.lastSplitAt) {
          const splitDistance = km - nextLive.lastSplitAt;
          const durationSec = nextLive.movingSec - nextLive.splitStartedAt;
          nextLive.splits = [
            ...nextLive.splits,
            {
              index: km,
              distanceKm: splitDistance,
              durationSec: Math.round(durationSec),
              paceMinPerKm: durationSec / 60 / splitDistance,
              elevationGainM: 0,
              partial: false,
            },
          ];
          nextLive.lastSplitAt = km;
          nextLive.splitStartedAt = nextLive.movingSec;
          buzz([90, 60, 90]);
          chime('split');
        }

        setAutoPaused(stopped);
        liveRef.current = nextLive;
        setLive(nextLive);
        lastFixRef.current = point;
        setPoints((prev) => {
          const next = [...prev, point];
          dirtyRef.current += 1;
          return next;
        });
      },
      onError: (message) => {
        setGps('error');
        setGpsNote(message);
      },
      onPoorAccuracy: (acc) => {
        setGps('weak');
        setAccuracy(Math.round(acc));
      },
    });

    releaseWakeLockRef.current = keepScreenAwake();
    setPhase('live');
    buzz([40, 40, 40]);
    chime('start');
  }, []);

  const stopWatch = useCallback(() => {
    watchRef.current?.stop();
    watchRef.current = null;
    releaseWakeLockRef.current?.();
    releaseWakeLockRef.current = null;
  }, []);

  // Elapsed-time ticker (keeps running through pauses — that is wall clock).
  useEffect(() => {
    if (phase !== 'live') return;
    const t = setInterval(() => {
      const started = startedAtRef.current;
      if (started) setElapsedSec(Math.round((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Persist a recovery draft every few fixes, and whenever we pause or finish.
  useEffect(() => {
    if (phase !== 'live' || points.length < 2) return;
    if (dirtyRef.current < 5 && points.length > 6) return;
    dirtyRef.current = 0;
    saveRunDraft({ startedAt: startedAtRef.current ?? Date.now(), points, savedAt: Date.now() });
  }, [points, phase]);

  // Warn before losing a run to a reload.
  useEffect(() => {
    if (phase !== 'live') return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  useEffect(() => stopWatch, [stopWatch]);

  /* ── finish / discard ────────────────────────────────────────────── */
  const finish = useCallback(() => {
    stopWatch();
    const stats = computeRunStats(points);
    // Keep the laps the athlete tapped, in addition to the kilometre splits.
    setSummary(stats);
    setIntensity(intensityForPace(stats.avgPaceMinPerKm));
    setTitle(`${timeOfDayLabel()} run`);
    setPhase('summary');
    clearRunDraft();
    setDraft(null);
    chime('finish');
    buzz([80, 60, 80]);
  }, [points, stopWatch]);

  const discard = useCallback(async () => {
    const ok = await confirmDialog({
      title: 'Discard this run?',
      body: 'The route and every stat from this session will be lost. This cannot be undone.',
      confirmLabel: 'Discard run',
      destructive: true,
    });
    if (!ok) return;
    stopWatch();
    clearRunDraft();
    setDraft(null);
    setSummary(null);
    setPoints([]);
    setLive(BLANK_LIVE);
    liveRef.current = BLANK_LIVE;
    setElapsedSec(0);
    setLaps([]);
    setPhase('idle');
  }, [confirmDialog, stopWatch]);

  const save = useCallback(async () => {
    if (!summary) return;
    const durationMin = Math.max(1, Math.round(summary.movingSec / 60));
    setSaving(true);
    try {
      addSession({
        date: toISODate(new Date(startedAtRef.current ?? Date.now())),
        categoryId: 'cat-cardio',
        title: title.trim() || 'Run',
        durationMin,
        intensity,
        calories: estimateSessionCalories(durationMin, intensity),
        distanceKm: summary.distanceKm,
        route: points.length >= 2 ? points : undefined,
        movingTimeMin: Math.round((summary.movingSec / 60) * 10) / 10,
        elevationGainM: summary.elevationGainM,
        splits: summary.splits,
        exercises: [],
        notes: notes.trim() || undefined,
      });
      toast('Run saved to your log');
      // Reset the recorder for the next outing.
      setPhase('idle');
      setPoints([]);
      setLive(BLANK_LIVE);
      liveRef.current = BLANK_LIVE;
      setElapsedSec(0);
      setSummary(null);
      setNotes('');
      setLaps([]);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }, [
    addSession,
    estimateSessionCalories,
    intensity,
    notes,
    onSaved,
    points,
    summary,
    title,
    toast,
  ]);

  /* ── render ──────────────────────────────────────────────────────── */

  if (phase === 'summary' && summary) {
    return (
      <RunSummary
        stats={summary}
        points={points}
        laps={laps}
        title={title}
        notes={notes}
        intensity={intensity}
        history={state.sessions}
        saving={saving}
        onTitle={setTitle}
        onNotes={setNotes}
        onIntensity={setIntensity}
        onSave={() => void save()}
        onDiscard={() => void discard()}
        onShare={() => setShareOpen(true)}
        shareOpen={shareOpen}
        onCloseShare={() => setShareOpen(false)}
        watermark={!hasProAccess(state)}
      />
    );
  }

  if (phase === 'live') {
    const avgPace = live.distanceM > 0 ? live.movingSec / 60 / (live.distanceM / 1000) : 0;
    const currentSplitM = live.distanceM - live.lastSplitAt * 1000;
    const currentSplitSec = live.movingSec - live.splitStartedAt;
    const currentPace = currentSplitM > 0 ? currentSplitSec / 60 / (currentSplitM / 1000) : 0;
    const pctToNextKm = Math.min(100, (currentSplitM / 1000) * 100);

    return (
      <div className="grid gap-5">
        <LiveStage
          elapsedSec={elapsedSec}
          distanceM={live.distanceM}
          avgPace={avgPace}
          currentPace={currentPace}
          elevationGainM={live.elevationGainM}
          autoPaused={autoPaused}
          gps={gps}
          accuracy={accuracy}
          gpsNote={gpsNote}
          points={points}
          splits={live.splits}
          pctToNextKm={pctToNextKm}
          currentSplitM={currentSplitM}
          currentSplitSec={currentSplitSec}
          laps={laps.length}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Button
            variant="secondary"
            onClick={() => {
              const lap: Lap = {
                index: laps.length + 1,
                distanceKm: live.distanceM / 1000,
                durationSec: Math.round(live.movingSec),
              };
              setLaps((l) => [...l, lap]);
              buzz(60);
              toast(`Lap ${laps.length + 1} · ${fmtDuration(Math.round(live.movingSec))}`);
            }}
            className="h-14"
          >
            <Flag className="h-5 w-5" aria-hidden /> Lap
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (autoPaused) return;
              buzz(30);
              toast('Auto-pause is on — the clock keeps running', 'info');
            }}
            className="h-14"
            disabled
          >
            <Zap className="h-5 w-5" aria-hidden /> Auto-pause on
          </Button>
          <Button variant="destructive" onClick={() => void discard()} className="h-14">
            <Trash2 className="h-5 w-5" aria-hidden /> Discard
          </Button>
          <Button onClick={finish} className="h-14">
            <Check className="h-5 w-5" aria-hidden /> Finish
          </Button>
        </div>
      </div>
    );
  }

  /* ── idle ─────────────────────────────────────────────────────────── */
  return (
    <div className="grid gap-5">
      {draft && (
        <div className="border-primary/30 bg-primary/5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
          <div className="min-w-0">
            <p className="text-sm font-bold">Unfinished run found</p>
            <p className="text-muted-foreground text-xs">
              {new Date(draft.startedAt).toLocaleString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
                weekday: 'short',
              })}{' '}
              · {fmtKm(computeRunStats(draft.points).distanceKm)} recorded — nothing was lost.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                clearRunDraft();
                setDraft(null);
              }}
            >
              Discard
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setDraft(null);
                beginRecording(draft);
              }}
            >
              <RotateCcw className="h-4 w-4" aria-hidden /> Resume
            </Button>
          </div>
        </div>
      )}

      <div className="card-hero relative overflow-hidden p-5 text-white sm:p-7">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(224,94,54,0.55),transparent_70%)]"
        />
        <div className="relative grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] sm:items-center">
          <div className="grid gap-4">
            <p className="hero-muted eyebrow">Tracked run</p>
            <h2 className="font-display text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">
              Press start and run.
            </h2>
            <p className="hero-muted max-w-md text-sm leading-relaxed">
              Your route, pace, splits, elevation and best efforts are recorded on this device.
              Auto-pause stops the clock whenever you stop moving, and the screen stays awake.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="hero-tile inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold">
                <Gauge className="h-3.5 w-3.5" aria-hidden /> Splits + best efforts
              </span>
              <span className="hero-tile inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold">
                <Mountain className="h-3.5 w-3.5" aria-hidden /> Elevation
              </span>
              <span className="hero-tile inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold">
                <Share2 className="h-3.5 w-3.5" aria-hidden /> Transparent share
              </span>
            </div>
            <div className="mt-1">
              <Button
                size="lg"
                onClick={() => beginRecording()}
                className="shadow-primary/30 h-14 gap-2.5 px-7 text-base shadow-lg"
              >
                <Play className="h-5 w-5" aria-hidden /> Start run
              </Button>
            </div>
          </div>

          <div className="grid gap-3 rounded-3xl border border-white/10 bg-black/25 p-4 backdrop-blur-sm">
            <p className="eyebrow text-white/60">Last 7 days</p>
            {history.length === 0 ? (
              <p className="text-sm text-white/70">
                No tracked runs yet — your first one shows up here.
              </p>
            ) : (
              <>
                <p className="font-display text-3xl font-extrabold tracking-tight">
                  {thisWeek.distanceKm >= 1
                    ? `${Math.round(thisWeek.distanceKm * 10) / 10} km`
                    : `${Math.round(thisWeek.distanceKm * 1000)} m`}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-white/80">
                    <b className="text-white">{thisWeek.runs}</b> runs
                  </span>
                  <span className="text-white/80">
                    <b className="text-white">{Math.round(thisWeek.movingMin)}</b> min
                  </span>
                  <span className="text-white/80">
                    <b className="text-white">{thisWeek.elevationGainM}</b> m climb
                  </span>
                  <span className="text-white/80">
                    <b className="text-white">
                      {fmtPace(avgPaceOf(thisWeek.distanceKm, thisWeek.movingMin))}
                    </b>{' '}
                    /km avg
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function stoppedFrom(stats: RunStats): number {
  return Math.max(0, stats.elapsedSec - stats.movingSec);
}

function lastFullKm(stats: RunStats): number {
  return stats.splits.filter((s) => !s.partial).length;
}

function avgPaceOf(km: number, minutes: number): number {
  return km > 0 ? minutes / km : 0;
}

/* ── live stage ──────────────────────────────────────────────────────── */

function LiveStage({
  elapsedSec,
  distanceM,
  avgPace,
  currentPace,
  elevationGainM,
  autoPaused,
  gps,
  accuracy,
  gpsNote,
  points,
  splits,
  pctToNextKm,
  currentSplitM,
  currentSplitSec,
  laps,
}: {
  elapsedSec: number;
  distanceM: number;
  avgPace: number;
  currentPace: number;
  elevationGainM: number;
  autoPaused: boolean;
  gps: 'idle' | 'acquiring' | 'ready' | 'weak' | 'error';
  accuracy: number | null;
  gpsNote: string | null;
  points: GeoPoint[];
  splits: RunSplit[];
  pctToNextKm: number;
  currentSplitM: number;
  currentSplitSec: number;
  laps: number;
}) {
  const km = distanceM / 1000;
  return (
    <div className="card-hero relative overflow-hidden p-5 text-white sm:p-7">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(224,94,54,0.5),transparent_70%)]"
      />

      {/* Status row */}
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold',
              autoPaused ? 'bg-amber-400/20 text-amber-200' : 'bg-white/10 text-white/85',
            )}
            role="status"
            aria-live="polite"
          >
            {autoPaused ? (
              <>
                <Pause className="h-3.5 w-3.5" aria-hidden /> Auto-paused
              </>
            ) : gps === 'acquiring' ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Finding GPS…
              </>
            ) : gps === 'weak' ? (
              <>
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> Weak GPS
                {accuracy ? ` · ±${accuracy} m` : ''}
              </>
            ) : gps === 'error' ? (
              <>
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> GPS problem
              </>
            ) : (
              <>
                <MapPin className="h-3.5 w-3.5 text-emerald-300" aria-hidden /> Recording
                {accuracy ? ` · ±${accuracy} m` : ''}
              </>
            )}
          </span>
          {laps > 0 && (
            <span className="hero-tile inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold">
              <Flag className="h-3.5 w-3.5" aria-hidden /> {laps} lap{laps === 1 ? '' : 's'}
            </span>
          )}
        </span>
        <span className="font-mono text-2xl font-extrabold tabular-nums">
          {fmtDuration(elapsedSec)}
        </span>
      </div>

      {gpsNote && <p className="relative mt-2 text-xs text-amber-200">{gpsNote}</p>}

      {/* Headline: distance */}
      <div className="relative mt-5 flex items-end gap-3">
        <span className="font-mono text-6xl leading-none font-extrabold tabular-nums sm:text-7xl">
          {km >= 10 ? km.toFixed(2) : km.toFixed(2)}
        </span>
        <span className="pb-1 text-lg font-extrabold text-white/70">km</span>
      </div>

      {/* Pace row */}
      <div className="relative mt-4 grid grid-cols-3 gap-3">
        <LiveMetric label="Current pace" value={`${fmtPace(currentPace)}`} unit="/km" />
        <LiveMetric label="Average pace" value={`${fmtPace(avgPace)}`} unit="/km" />
        <LiveMetric label="Elevation" value={`${Math.round(elevationGainM)}`} unit="m gain" />
      </div>

      {/* Split progress */}
      <div className="relative mt-5">
        <div className="flex items-center justify-between text-[11px] font-bold text-white/70">
          <span className="eyebrow">Kilometre {splits.length + 1}</span>
          <span className="tabular-nums">
            {Math.round(currentSplitM)} m · {fmtDuration(Math.round(currentSplitSec))}
          </span>
        </div>
        <div
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15"
          role="progressbar"
          aria-valuenow={Math.round(pctToNextKm)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progress to next kilometre"
        >
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#f0a37f,#c8f135)] transition-all duration-500"
            style={{ width: `${Math.max(3, pctToNextKm)}%` }}
          />
        </div>
      </div>

      <div className="relative mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]">
        {/* Live route */}
        <div className="relative flex min-h-[12rem] items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black/25 p-3">
          {points.length >= 2 ? (
            <RouteMap route={points} className="h-48 w-full" stroke="#ff7a4d" />
          ) : (
            <p className="text-center text-xs text-white/60">
              Your route appears here once the GPS settles.
            </p>
          )}
          <span className="absolute right-3 bottom-3 text-[10px] font-bold tracking-wide text-white/50 uppercase">
            Live route
          </span>
        </div>

        {/* Recent splits */}
        <div className="rounded-3xl border border-white/10 bg-black/25 p-3">
          <p className="eyebrow text-white/60">Splits</p>
          {splits.length === 0 ? (
            <p className="mt-2 text-xs text-white/60">
              Kilometre splits land here as you pass each one.
            </p>
          ) : (
            <ul className="mt-2 grid gap-1.5">
              {splits.slice(-4).map((split) => (
                <li
                  key={split.index}
                  className="flex items-center justify-between gap-2 text-xs text-white/85"
                >
                  <span className="font-bold">KM {split.index}</span>
                  <span className="font-mono tabular-nums">{fmtDuration(split.durationSec)}</span>
                  <span className="text-white/60 tabular-nums">{fmtPace(split.paceMinPerKm)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function LiveMetric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
      <p className="text-[10px] font-bold tracking-wide text-white/60 uppercase">{label}</p>
      <p className="mt-0.5 font-mono text-xl font-extrabold tabular-nums">
        {value}
        <span className="ml-1 text-[11px] font-bold text-white/55">{unit}</span>
      </p>
    </div>
  );
}

/* ── summary ─────────────────────────────────────────────────────────── */

function RunSummary({
  stats,
  points,
  laps,
  title,
  notes,
  intensity,
  history,
  saving,
  onTitle,
  onNotes,
  onIntensity,
  onSave,
  onDiscard,
  onShare,
  shareOpen,
  onCloseShare,
  watermark,
}: {
  stats: RunStats;
  points: GeoPoint[];
  laps: Lap[];
  title: string;
  notes: string;
  intensity: Intensity;
  history: Parameters<typeof runAchievements>[1];
  saving: boolean;
  onTitle: (v: string) => void;
  onNotes: (v: string) => void;
  onIntensity: (v: Intensity) => void;
  onSave: () => void;
  onDiscard: () => void;
  onShare: () => void;
  shareOpen: boolean;
  onCloseShare: () => void;
  watermark: boolean;
}) {
  const achievements = useMemo(
    () =>
      runAchievements(
        { distanceKm: stats.distanceKm, stats, elevationGainM: stats.elevationGainM },
        history,
      ),
    [history, stats],
  );
  const records = achievements.filter((a) => a.isRecord);

  return (
    <div className="grid gap-5">
      <div className="card-hero relative overflow-hidden p-5 text-white sm:p-7">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-20 right-0 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(224,94,54,0.5),transparent_70%)]"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="hero-muted eyebrow">Run complete</p>
            <div className="mt-2 flex items-end gap-3">
              <span className="font-mono text-5xl leading-none font-extrabold tabular-nums sm:text-6xl">
                {stats.distanceKm.toFixed(2)}
              </span>
              <span className="pb-1 text-lg font-extrabold text-white/70">km</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/80">
              <span className="flex items-center gap-1.5">
                <Timer className="h-4 w-4" aria-hidden />
                <b className="text-white">{fmtDuration(stats.movingSec)}</b> moving
              </span>
              <span className="flex items-center gap-1.5">
                <Gauge className="h-4 w-4" aria-hidden />
                <b className="text-white">{fmtPace(stats.avgPaceMinPerKm)}</b> /km
              </span>
              <span className="flex items-center gap-1.5">
                <Mountain className="h-4 w-4" aria-hidden />
                <b className="text-white">{stats.elevationGainM}</b> m climb
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onShare} className="gap-2">
              <Share2 className="h-4 w-4" aria-hidden /> Share
            </Button>
          </div>
        </div>

        {records.length > 0 && (
          <div className="relative mt-5 flex flex-wrap gap-2">
            {records.map((record) => (
              <span
                key={record.label}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#c8f135] px-3 py-1.5 text-xs font-extrabold text-[#141110]"
              >
                <Zap className="h-3.5 w-3.5" aria-hidden /> {record.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Timer} label="Elapsed" value={fmtDuration(stats.elapsedSec)} />
        <StatCard
          icon={Pause}
          label="Stopped"
          value={fmtDuration(Math.max(0, stats.elapsedSec - stats.movingSec))}
          sub="Auto-paused"
        />
        <StatCard icon={Gauge} label="Best pace" value={`${fmtPace(stats.bestPaceMinPerKm)}`} />
        <StatCard icon={Activity} label="Laps" value={laps.length} sub="Tapped manually" />
      </div>

      {points.length >= 2 && (
        <div className="border-border bg-card rounded-3xl border p-4 shadow-sm sm:p-5">
          <p className="eyebrow text-muted-foreground mb-3">Route</p>
          <RouteMap route={points} className="h-64 w-full" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border-border bg-card rounded-3xl border p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow text-muted-foreground">Splits</p>
            <span className="text-muted-foreground text-xs tabular-nums">
              {stats.splits.length} km total
            </span>
          </div>
          <ul className="mt-3 grid gap-2">
            {stats.splits.map((split) => (
              <li key={split.index} className="grid gap-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="tabular-nums">
                    {split.partial
                      ? `${(split.distanceKm * 1000).toFixed(0)} m`
                      : `KM ${split.index}`}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {fmtDuration(split.durationSec)} · {fmtPace(split.paceMinPerKm)} /km
                  </span>
                </div>
                <div className="bg-secondary h-2 overflow-hidden rounded-full">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      split.partial ? 'bg-muted-foreground/40' : 'bg-primary',
                    )}
                    style={{ width: `${splitWidth(split.paceMinPerKm, stats.splits)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid content-start gap-4">
          {stats.bestEfforts.length > 0 && (
            <div className="border-border bg-card rounded-3xl border p-4 shadow-sm sm:p-5">
              <p className="eyebrow text-muted-foreground">Best efforts</p>
              <ul className="mt-3 grid gap-2">
                {stats.bestEfforts.map((effort) => (
                  <li key={effort.label} className="flex items-center justify-between text-sm">
                    <span className="font-bold">{effort.label}</span>
                    <span className="text-muted-foreground tabular-nums">
                      <b className="text-foreground font-mono">{fmtDuration(effort.durationSec)}</b>{' '}
                      · {fmtPace(effort.paceMinPerKm)} /km
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-border bg-card grid gap-4 rounded-3xl border p-4 shadow-sm sm:p-5">
            <Field id="run-title" label="Title">
              <Input
                value={title}
                maxLength={120}
                onChange={(e) => onTitle(e.target.value)}
                placeholder="Morning run"
              />
            </Field>
            <Field id="run-intensity" label="Effort">
              <Select value={intensity} onChange={(e) => onIntensity(e.target.value as Intensity)}>
                <option value="low">Easy</option>
                <option value="moderate">Steady</option>
                <option value="high">Hard</option>
              </Select>
            </Field>
            <Field id="run-notes" label="Notes" hint="How did it feel? (optional)">
              <Input
                value={notes}
                maxLength={2000}
                onChange={(e) => onNotes(e.target.value)}
                placeholder="Legs felt strong…"
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onSave} disabled={saving} className="h-12 flex-1 sm:flex-none">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Check className="h-4 w-4" aria-hidden />
          )}
          Save run
        </Button>
        <Button variant="outline" onClick={onShare} className="h-12">
          <Share2 className="h-4 w-4" aria-hidden /> Share card
        </Button>
        <Button
          variant="ghost"
          onClick={onDiscard}
          className="text-destructive hover:text-destructive h-12"
        >
          <Trash2 className="h-4 w-4" aria-hidden /> Discard
        </Button>
      </div>

      <ShareSheet
        open={shareOpen}
        onClose={onCloseShare}
        watermark={watermark}
        filename={`smartfit-run-${toISODate(new Date())}.png`}
        routeAvailable={points.length >= 2}
        data={{
          title: title.trim() || 'Run',
          dateLabel: new Date().toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          distanceKm: stats.distanceKm,
          movingSec: stats.movingSec,
          paceMinPerKm: stats.avgPaceMinPerKm,
          elevationGainM: stats.elevationGainM,
          splits: stats.splits,
          efforts: stats.bestEfforts,
          achievements,
          route: points,
        }}
      />
    </div>
  );
}

function splitWidth(pace: number, splits: RunSplit[]): number {
  const paced = splits.filter((s) => s.paceMinPerKm > 0).map((s) => s.paceMinPerKm);
  if (paced.length === 0 || pace <= 0) return 20;
  const best = Math.min(...paced);
  const worst = Math.max(...paced);
  if (worst === best) return 100;
  // Faster → longer bar (100% at best, 35% at slowest).
  return Math.round(35 + (65 * (worst - pace)) / (worst - best));
}
