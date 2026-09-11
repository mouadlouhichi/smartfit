'use client';

/**
 * Device plumbing for the run tracker: GPS watch, haptics, audio cues, screen
 * wake lock and crash-recovery drafts.
 *
 * Every call degrades silently — a browser without vibration, WebAudio or
 * Wake Lock still records a perfectly good run, it just does it quietly.
 */

import type { GeoPoint } from '@smartfit/core';

/* ── haptics + audio ─────────────────────────────────────────────────── */

export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* no haptics — fine */
  }
}

let audioCtx: AudioContext | null = null;

/** A short two-tone cue (WebAudio; created lazily on a user gesture). */
export function chime(kind: 'split' | 'start' | 'finish' = 'split') {
  try {
    const Ctx =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx ?? new Ctx();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') void ctx.resume();
    const notes = kind === 'split' ? [740, 990] : kind === 'start' ? [520, 700] : [880, 660, 520];
    const now = ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      const at = now + i * 0.13;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.11, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.32);
    });
  } catch {
    /* audio unavailable — silent */
  }
}

/* ── screen wake lock ────────────────────────────────────────────────── */

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

/**
 * Keep the screen on while recording (the single most requested tracker
 * feature that a web app can actually deliver). Returns a release function;
 * the lock is re-acquired when the tab becomes visible again.
 */
export function keepScreenAwake(): () => void {
  let sentinel: WakeLockSentinelLike | null = null;
  let released = false;
  const nav = navigator as Navigator & {
    wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
  };

  const acquire = async () => {
    if (released || sentinel || !nav.wakeLock) return;
    try {
      sentinel = await nav.wakeLock.request('screen');
    } catch {
      sentinel = null; // battery saver / unsupported — recording continues
    }
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') void acquire();
  };

  void acquire();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    released = true;
    document.removeEventListener('visibilitychange', onVisible);
    void sentinel?.release().catch(() => undefined);
    sentinel = null;
  };
}

/* ── GPS ─────────────────────────────────────────────────────────────── */

export interface GpsFix {
  point: GeoPoint;
  /** Metres — used for the "GPS accuracy" badge, never for the route. */
  accuracy: number;
}

export interface GpsWatch {
  stop: () => void;
}

/**
 * Start a high-accuracy position watch.
 *
 * Fixes are handed over raw (with their accuracy) — the caller decides what to
 * keep. Accuracy > 35 m is a cold start or an urban canyon; those are reported
 * as `poor` so the UI can say so instead of silently drawing a wild route.
 */
export function watchGps(handlers: {
  onFix: (fix: GpsFix) => void;
  onError: (message: string) => void;
  onPoorAccuracy?: (accuracy: number) => void;
}): GpsWatch {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    handlers.onError('GPS is not available in this browser.');
    return { stop: () => undefined };
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy, altitude } = pos.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      if (Number.isFinite(accuracy) && accuracy > 35) {
        handlers.onPoorAccuracy?.(accuracy);
        return;
      }
      const point: GeoPoint = { lat: latitude, lng: longitude, t: pos.timestamp };
      if (typeof altitude === 'number' && Number.isFinite(altitude)) point.ele = altitude;
      handlers.onFix({ point, accuracy: Number.isFinite(accuracy) ? accuracy : 0 });
    },
    (err) => {
      handlers.onError(
        err.code === err.PERMISSION_DENIED
          ? 'Location permission denied — allow it to record your route.'
          : err.code === err.POSITION_UNAVAILABLE
            ? 'No GPS signal yet — move into the open and try again.'
            : 'GPS timed out. Still trying…',
      );
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 20_000 },
  );
  return {
    stop: () => navigator.geolocation.clearWatch(id),
  };
}

/* ── crash recovery ──────────────────────────────────────────────────── */

export interface RunDraft {
  startedAt: number;
  points: GeoPoint[];
  /** Seconds of recorded moving/elapsed time when the draft was written. */
  savedAt: number;
}

const DRAFT_KEY = 'smartfit.run.draft.v1';
const draftKey = (owner?: string | null) =>
  owner ? `${DRAFT_KEY}.${owner}` : `${DRAFT_KEY}.local`;

/**
 * Persist an in-progress run so a reload or a killed tab can recover it.
 * The owner is part of the key: a GPS trace must never become visible to the
 * next Firebase account that signs in on the same device.
 */
export function saveRunDraft(draft: RunDraft, owner?: string | null) {
  try {
    localStorage.setItem(draftKey(owner), JSON.stringify(draft));
  } catch {
    /* storage full / private mode — the run simply is not recoverable */
  }
}

export function readRunDraft(owner?: string | null): RunDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(owner));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunDraft;
    if (!Array.isArray(parsed.points) || parsed.points.length < 2) return null;
    if (typeof parsed.startedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearRunDraft(owner?: string | null) {
  try {
    localStorage.removeItem(draftKey(owner));
  } catch {
    /* ignore */
  }
}

/** Remove every account-scoped draft during a deliberate account wipe. */
export function clearAllRunDrafts() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key === DRAFT_KEY || key?.startsWith(`${DRAFT_KEY}.`)) localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

/* ── misc ────────────────────────────────────────────────────────────── */

/** "Morning" / "Afternoon" / "Evening" / "Night" — run naming like Strava's. */
export function timeOfDayLabel(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Night';
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  if (h < 22) return 'Evening';
  return 'Night';
}

/** Estimated intensity from pace, so the calorie estimate matches the effort. */
export function intensityForPace(paceMinPerKm: number): 'low' | 'moderate' | 'high' {
  if (!Number.isFinite(paceMinPerKm) || paceMinPerKm <= 0) return 'moderate';
  if (paceMinPerKm < 5.4) return 'high';
  if (paceMinPerKm < 7.2) return 'moderate';
  return 'low';
}
