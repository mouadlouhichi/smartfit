'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Check,
  Flag,
  Gauge,
  Loader2,
  MapPin,
  Mountain,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Square,
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
import { RunHome } from './run-home';
import dynamic from 'next/dynamic';

/**
 * MapLibre + its CSS live in their own chunk: the basemap only downloads when
 * a screen with a map on it mounts, and never on the server.
 */
const RunMap = dynamic(() => import('./run-map').then((m) => m.RunMap), {
  ssr: false,
  loading: () => null,
});
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
  /** Manual pause: the big round button. Fixes keep arriving, time goes to `stoppedSec`. */
  const [held, setHeld] = useState(false);
  /** Latest GPS fix — the "you are here" dot, shown even before a route exists. */
  const [head, setHead] = useState<GeoPoint | null>(null);
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
  const heldRef = useRef(false);
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
    heldRef.current = false;
    setHeld(false);
    setHead(restored?.points.at(-1) ?? null);
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
        setHead(point);
        const last = lastFixRef.current;
        const now = Date.now();
        const dtSec = last?.t ? (point.t! - last.t) / 1000 : 0;
        const meters = last ? haversineMeters(last, point) : 0;

        // Held (manual pause): the clock for this run stands still. The fix is
        // consumed so resuming does not teleport the distance, and the time
        // goes to stoppedSec exactly like auto-pause would put it.
        if (heldRef.current && last) {
          liveRef.current = {
            ...liveRef.current,
            stoppedSec: liveRef.current.stoppedSec + dtSec,
          };
          setLive(liveRef.current);
          lastFixRef.current = point;
          return;
        }

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

  const toggleHold = useCallback(() => {
    const next = !heldRef.current;
    heldRef.current = next;
    setHeld(next);
    buzz(next ? [60, 40, 60] : 50);
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
    const kcal = estimateSessionCalories(Math.max(1, Math.round(live.movingSec / 60)), intensity);

    return (
      <LiveStage
        elapsedSec={elapsedSec}
        distanceM={live.distanceM}
        avgPace={avgPace}
        currentPace={currentPace}
        elevationGainM={live.elevationGainM}
        stoppedSec={live.stoppedSec}
        calories={kcal}
        held={held}
        autoPaused={autoPaused}
        gps={gps}
        accuracy={accuracy}
        gpsNote={gpsNote}
        head={head}
        points={points}
        splits={live.splits}
        pctToNextKm={pctToNextKm}
        currentSplitM={currentSplitM}
        currentSplitSec={currentSplitSec}
        laps={laps.length}
        onLap={() => {
          const lap: Lap = {
            index: laps.length + 1,
            distanceKm: live.distanceM / 1000,
            durationSec: Math.round(live.movingSec),
          };
          setLaps((l) => [...l, lap]);
          buzz(60);
          toast(`Lap ${laps.length + 1} · ${fmtDuration(Math.round(live.movingSec))}`);
        }}
        onHold={toggleHold}
        onFinish={finish}
        onDiscard={() => void discard()}
      />
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

      <RunHome runs={history} onStart={() => beginRecording()} />
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

/**
 * The live view, laid out like the watch face it is standing in for: the map
 * owns the top of the screen with the status and the clock floating on it,
 * the kilometre you are in gets a player-style progress chip, six numbers sit
 * in a hairline grid (pace, distance, calories / time, climb, stopped), and
 * three round buttons do the only three things a run ever needs mid-stride.
 */
function LiveStage({
  elapsedSec,
  distanceM,
  avgPace,
  currentPace,
  elevationGainM,
  stoppedSec,
  calories,
  held,
  autoPaused,
  gps,
  accuracy,
  gpsNote,
  head,
  points,
  splits,
  pctToNextKm,
  currentSplitM,
  currentSplitSec,
  laps,
  onLap,
  onHold,
  onFinish,
  onDiscard,
}: {
  elapsedSec: number;
  distanceM: number;
  avgPace: number;
  currentPace: number;
  elevationGainM: number;
  stoppedSec: number;
  calories: number;
  held: boolean;
  autoPaused: boolean;
  gps: 'idle' | 'acquiring' | 'ready' | 'weak' | 'error';
  accuracy: number | null;
  gpsNote: string | null;
  head: GeoPoint | null;
  points: GeoPoint[];
  splits: RunSplit[];
  pctToNextKm: number;
  currentSplitM: number;
  currentSplitSec: number;
  laps: number;
  onLap: () => void;
  onHold: () => void;
  onFinish: () => void;
  onDiscard: () => void;
}) {
  const [mapDown, setMapDown] = useState(false);
  const km = distanceM / 1000;
  const hasGeo = points.length >= 2 || head !== null;
  return (
    <div className="grid gap-4">
      {/* Map hero */}
      <div className="border-border relative min-h-[17rem] overflow-hidden rounded-[2rem] border bg-[#141110] sm:min-h-[21rem]">
        <span
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px),' +
              'linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />
        <span
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_35%,rgba(0,0,0,0.55)_100%)]"
        />
        {mapDown ? (
          <div className="absolute inset-0 grid place-items-center px-6">
            <p className="text-center text-xs font-bold text-white/60">
              {points.length >= 2 ? (
                <>
                  The basemap can&apos;t start on this device — your route and stats keep recording.
                </>
              ) : (
                <>
                  The basemap can&apos;t start on this device — recording still works; your route
                  draws here.
                </>
              )}
            </p>
          </div>
        ) : hasGeo ? (
          <>
            {/* The map mounts from the first fix: you see yourself before you move. */}
            {points.length >= 2 && (
              /* Vector underlay: the route is visible before tiles or WebGL are. */
              <RouteMap
                route={points}
                stroke="#ff7a4d"
                className="absolute inset-0 z-0 h-full w-full p-6 opacity-70"
              />
            )}
            <RunMap
              points={points}
              position={head}
              accuracy={accuracy}
              showFlag={false}
              onUnavailable={() => setMapDown(true)}
              className="absolute inset-0 z-[1]"
            />
            {points.length < 2 && (
              <p className="absolute bottom-10 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/55 px-3.5 py-1.5 text-[11px] font-bold whitespace-nowrap text-white/75 backdrop-blur-sm">
                You&apos;re on the map — the route draws itself once you move.
              </p>
            )}
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <p className="flex items-center gap-2 text-xs font-bold text-white/60">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff7a4d]" aria-hidden />
              {gps === 'error'
                ? 'No GPS yet — the map appears with your first fix.'
                : 'Finding your position — the map appears with your first fix.'}
            </p>
          </div>
        )}

        {/* Floating status + clock */}
        <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold backdrop-blur-sm',
              held
                ? 'bg-white/85 text-[#1c0e0a]'
                : autoPaused
                  ? 'bg-amber-400/25 text-amber-100'
                  : 'bg-black/45 text-white/90',
            )}
            role="status"
            aria-live="polite"
          >
            {held ? (
              <>
                <Pause className="h-3.5 w-3.5" aria-hidden /> Paused
              </>
            ) : autoPaused ? (
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs font-bold text-white/85 backdrop-blur-sm">
              <Flag className="h-3.5 w-3.5" aria-hidden /> {laps} lap{laps === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <span className="absolute top-4 right-4 z-10 rounded-full bg-black/45 px-3.5 py-1.5 font-mono text-xl font-extrabold text-white tabular-nums backdrop-blur-sm">
          {fmtDuration(elapsedSec)}
        </span>
        <span className="absolute bottom-4 left-4 z-10 text-[10px] font-bold tracking-wide text-white/50 uppercase">
          Live route
        </span>
      </div>

      {gpsNote && (
        <p className="-mt-2 text-xs font-bold text-amber-600 dark:text-amber-300">{gpsNote}</p>
      )}

      {/* The kilometre you are in, player-style */}
      <div className="bg-card border-border flex items-center gap-3 rounded-2xl border p-3">
        <span className="bg-primary/12 text-primary grid h-11 w-11 shrink-0 place-items-center rounded-full font-mono text-base font-extrabold tabular-nums">
          {splits.length + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-bold">Kilometre {splits.length + 1}</span>
            <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
              {Math.round(currentSplitM)} m · {fmtDuration(Math.round(currentSplitSec))}
            </span>
          </span>
          <span
            className="bg-secondary mt-1.5 block h-2 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={Math.round(pctToNextKm)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress to next kilometre"
          >
            <span
              className="block h-full rounded-full bg-[linear-gradient(90deg,var(--primary),var(--chart-1))] transition-all duration-500"
              style={{ width: `${Math.max(3, pctToNextKm)}%` }}
            />
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-mono text-xl leading-none font-extrabold tabular-nums">
            {fmtPace(currentPace)}
          </span>
          <span className="text-muted-foreground block text-[10px] font-bold uppercase">
            now /km
          </span>
        </span>
      </div>

      {/* Six numbers, hairline grid */}
      <div className="bg-card border-border grid grid-cols-3 overflow-hidden rounded-2xl border">
        {[
          { label: 'Avg pace', value: fmtPace(avgPace), unit: '/km' },
          { label: 'Distance', value: km.toFixed(2), unit: 'km' },
          { label: 'Calories', value: `${calories}`, unit: 'kcal' },
          { label: 'Time', value: fmtDuration(elapsedSec), unit: 'moving+stop' },
          { label: 'Elevation', value: `${Math.round(elevationGainM)}`, unit: 'm' },
          { label: 'Stopped', value: fmtDuration(Math.round(stoppedSec)), unit: 'auto+held' },
        ].map((cell, i) => (
          <div
            key={cell.label}
            className={cn(
              'px-3 py-3 text-center sm:py-4',
              i % 3 > 0 && 'border-border border-l',
              i >= 3 && 'border-border border-t',
            )}
          >
            <p className="text-muted-foreground text-[10px] font-bold tracking-wide uppercase">
              {cell.label}
            </p>
            <p className="mt-1 font-mono text-2xl leading-none font-extrabold tabular-nums sm:text-3xl">
              {cell.value}
              <span className="text-muted-foreground ml-1 text-[10px] font-bold">{cell.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Three round buttons */}
      <div className="flex items-start justify-center gap-6 py-1 sm:gap-10">
        <RoundControl label="Lap" onClick={onLap}>
          <Flag className="h-5 w-5" aria-hidden />
        </RoundControl>
        <RoundControl label={held ? 'Resume' : 'Pause'} onClick={onHold} big>
          {held ? (
            <Play className="h-8 w-8 fill-current" aria-hidden />
          ) : (
            <Pause className="h-8 w-8 fill-current" aria-hidden />
          )}
        </RoundControl>
        <RoundControl label="Finish" onClick={onFinish}>
          <Square className="h-5 w-5 fill-current" aria-hidden />
        </RoundControl>
      </div>
      <p className="text-muted-foreground -mt-2 text-center text-[11px] font-medium">
        Auto-pause stops the clock whenever you stop moving. Pause stops it whenever you want.
      </p>

      {/* Splits, as a strip */}
      {splits.length > 0 && (
        <div className="-mx-1 flex [scrollbar-width:none] gap-2 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden">
          {splits.map((split) => (
            <span
              key={split.index}
              className="bg-card border-border flex shrink-0 items-baseline gap-2 rounded-xl border px-3 py-2"
            >
              <span className="text-[10px] font-bold tracking-wide uppercase">
                KM {split.index}
              </span>
              <span className="font-mono text-sm font-extrabold tabular-nums">
                {fmtDuration(split.durationSec)}
              </span>
              <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
                {fmtPace(split.paceMinPerKm)}/km
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDiscard}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" aria-hidden /> Discard run
        </Button>
      </div>
    </div>
  );
}

function RoundControl({
  label,
  onClick,
  big = false,
  children,
}: {
  label: string;
  onClick: () => void;
  big?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="grid justify-items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(
          'grid place-items-center rounded-full transition-transform active:scale-95',
          big
            ? 'bg-primary text-primary-foreground shadow-primary/40 h-20 w-20 shadow-xl'
            : 'bg-card text-foreground hover:border-primary/50 border-border h-14 w-14 border',
        )}
      >
        {children}
      </button>
      <span className="text-muted-foreground text-[10px] font-bold tracking-wide uppercase">
        {label}
      </span>
    </span>
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
          <div className="relative h-64 w-full overflow-hidden rounded-2xl">
            <RouteMap
              route={points}
              stroke="#ff7a4d"
              className="absolute inset-0 z-0 h-full w-full p-4 opacity-70"
            />
            <RunMap points={points} follow={false} className="absolute inset-0 z-[1]" />
            {/* If the basemap cannot start, the vector underlay above remains. */}
          </div>
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
