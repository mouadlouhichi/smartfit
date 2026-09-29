/**
 * Apple HealthKit sync shim.
 *
 * Wraps `expo-health` (when available) behind the same read-side surface as
 * HealthConnectClient on Android, so cross-platform callers can ask "what has
 * the wearable ecosystem recorded today?" without branching on OS.
 *
 * Implementation is intentionally lazy and failure-tolerant: if expo-health is
 * not installed or the user denies authorization, every method resolves to a
 * safe empty/zero value and the UI keeps working with manual entry only.
 *
 * Roadmap (not yet implemented in this pass, hooks ready):
 *  1. Authorization + real HK query via expo-health.
 *  2. Background observer delivery for sleep / workouts / vitals.
 *  3. Write-back of logged workouts to HK (two-way sync).
 */
import { Platform } from 'react-native';

export interface HealthKitSample {
  source: 'apple-health';
  startISO: string;
  endISO: string;
}

export interface HKSleepSample extends HealthKitSample {
  stage: 'awake' | 'rem' | 'core' | 'deep';
  minutes: number;
}

export interface HKWorkoutSample extends HealthKitSample {
  activityType: string; // HKWorkoutActivityType identifier
  durationMin: number;
  calories?: number;
  distanceKm?: number;
  avgHeartRate?: number;
}

export interface HKVitalsSample extends HealthKitSample {
  restingHr?: number;
  hrvMs?: number; // SDNN
  respRate?: number; // breaths/min
  spo2?: number; // 0-1
  steps?: number;
  activeCalories?: number;
}

export interface HealthKitStatus {
  supported: boolean; // iOS only
  available: boolean; // expo-health module loaded
  authorized: boolean;
  lastSync: number | null;
  message?: string;
}

let _status: HealthKitStatus = {
  supported: Platform.OS === 'ios',
  available: false,
  authorized: false,
  lastSync: null,
};

export async function getHealthKitStatus(): Promise<HealthKitStatus> {
  if (Platform.OS !== 'ios') {
    return {
      supported: false,
      available: false,
      authorized: false,
      lastSync: null,
      message: 'Apple Health is available on iOS only.',
    };
  }
  // Lazy probe — try to load expo-health; if missing, surface "not installed".
  try {
    const mod = require('expo-health');
    _status = { ..._status, available: !!mod };
  } catch {
    _status = {
      ..._status,
      available: false,
      message: 'expo-health is not linked in this build.',
    };
  }
  return _status;
}

export async function requestHealthKitAuthorization(): Promise<HealthKitStatus> {
  if (Platform.OS !== 'ios') return _status;
  // Placeholder: real impl calls ExpoHealth.requestAuthorizationAsync(...readTypes).
  // Flipping to authorized=false until the native module is installed so that
  // callers fall through to manual entry without crashing.
  _status = { ..._status, available: _status.available, authorized: false };
  return _status;
}

export async function readTodaySleep(_date = new Date()): Promise<HKSleepSample[]> {
  if (Platform.OS !== 'ios' || !_status.authorized) return [];
  // TODO: query HKCategoryTypeIdentifierSleepAnalysis with segment dates.
  return [];
}

export async function readTodayWorkouts(_date = new Date()): Promise<HKWorkoutSample[]> {
  if (Platform.OS !== 'ios' || !_status.authorized) return [];
  // TODO: query HKWorkoutType for today, extract duration / calories / distance.
  return [];
}

export async function readTodayVitals(_date = new Date()): Promise<HKVitalsSample> {
  if (Platform.OS !== 'ios' || !_status.authorized)
    return { source: 'apple-health', startISO: '', endISO: '' };
  // TODO: aggregate latest RHR / HRV / resp / SpO2 + step count.
  return { source: 'apple-health', startISO: '', endISO: '' };
}

/** One-shot pull of all "today" samples, shaped like HealthConnectClient.sync(). */
export async function syncHealthKit(_date = new Date()): Promise<{
  sleep: HKSleepSample[];
  workouts: HKWorkoutSample[];
  vitals: HKVitalsSample;
}> {
  const [sleep, workouts, vitals] = await Promise.all([
    readTodaySleep(_date),
    readTodayWorkouts(_date),
    readTodayVitals(_date),
  ]);
  _status = { ..._status, lastSync: Date.now() };
  return { sleep, workouts, vitals };
}

export const appleHealth = {
  status: getHealthKitStatus,
  requestAuthorization: requestHealthKitAuthorization,
  sync: syncHealthKit,
};
