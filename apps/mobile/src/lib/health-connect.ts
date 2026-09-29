/**
 * Health Connect integration (Android) for SmartFit.
 *
 * Uses react-native-health-connect to read steps, active calories,
 * resting HR, HRV, respiratory rate, SpO2, sleep sessions, and exercises
 * from Google Health Connect in the background.
 *
 * The module is deliberately defensive: imports are done dynamically so
 * the JS bundle does not crash on iOS / web / when the native module is
 * unavailable, and every call catches errors and returns a typed result.
 */
import { Platform } from 'react-native';
import { toISODate } from '@smartfit/core';
import type { SleepLog, SleepStages, VitalsLog } from '@smartfit/core';

// Permissions the user is asked to grant. Maps cleanly to the record types
// we read below.
export const HEALTH_PERMISSIONS = [
  { accessType: 'read' as const, recordType: 'Steps' as const },
  { accessType: 'read' as const, recordType: 'ActiveCaloriesBurned' as const },
  { accessType: 'read' as const, recordType: 'TotalCaloriesBurned' as const },
  { accessType: 'read' as const, recordType: 'RestingHeartRate' as const },
  { accessType: 'read' as const, recordType: 'HeartRateVariabilityRmssd' as const },
  { accessType: 'read' as const, recordType: 'RespiratoryRate' as const },
  { accessType: 'read' as const, recordType: 'OxygenSaturation' as const },
  { accessType: 'read' as const, recordType: 'SleepSession' as const },
  { accessType: 'read' as const, recordType: 'ExerciseSession' as const },
] as const;

export type SyncStatus =
  | 'idle'
  | 'checking-availability'
  | 'requesting-permissions'
  | 'syncing'
  | 'ok'
  | 'unavailable'
  | 'permission-denied'
  | 'error';

export interface SyncResult {
  status: SyncStatus;
  message?: string;
  daysSynced: number;
  sleepLogs: SleepLog[];
  vitalsLogs: VitalsLog[];
}

let hcModule: any = null;
let triedLoad = false;

function loadHC(): any | null {
  if (triedLoad) return hcModule;
  triedLoad = true;
  if (Platform.OS !== 'android') return null;
  try {
    // Dynamic require so Metro does not pull the native module into iOS/web bundles.
    hcModule = require('react-native-health-connect');
  } catch {
    hcModule = null;
  }
  return hcModule;
}

/** True when Health Connect is installed and the SDK is available. */
export async function isHealthConnectAvailable(): Promise<boolean> {
  const hc = loadHC();
  if (!hc) return false;
  try {
    return (await hc.isHealthConnectAvailable?.()) === true;
  } catch {
    return false;
  }
}

/** Prompt the user to install Health Connect from Play Store if missing. */
export async function openHealthConnectPlayStore(): Promise<void> {
  const hc = loadHC();
  if (!hc) return;
  try {
    await hc.installHealthConnect?.();
  } catch {
    /* ignore */
  }
}

/**
 * Request the read permissions we need. Returns true if all were granted.
 */
export async function requestHealthPermissions(): Promise<boolean> {
  const hc = loadHC();
  if (!hc) return false;
  try {
    const granted = await hc.requestPermissionAllRecordTypes?.(
      HEALTH_PERMISSIONS.map((p) => ({
        accessType: p.accessType,
        recordType: p.recordType,
      })),
    );
    return !!granted;
  } catch {
    return false;
  }
}

/**
 * Query Health Connect for the trailing `days` days and return normalized
 * SleepLog + VitalsLog rows ready to be upserted into the SmartFit store.
 *
 * One SleepLog per wake-up day and one VitalsLog per calendar day is
 * produced; stages (deep/REM/light/awake) are derived from SleepStage
 * records when available.
 */
export async function syncHealthData(days = 14): Promise<SyncResult> {
  const empty: SyncResult = {
    status: 'idle',
    daysSynced: 0,
    sleepLogs: [],
    vitalsLogs: [],
  };

  if (Platform.OS !== 'android') {
    return { ...empty, status: 'unavailable', message: 'Health Connect is Android-only' };
  }
  const hc = loadHC();
  if (!hc) {
    return { ...empty, status: 'unavailable', message: 'react-native-health-connect not linked' };
  }

  try {
    const available = await hc.isHealthConnectAvailable();
    if (!available) {
      return {
        ...empty,
        status: 'unavailable',
        message: 'Health Connect is not installed on this device',
      };
    }

    // Permissions
    const perms = await hc.getGrantedPermissions?.();
    const grantedAll = HEALTH_PERMISSIONS.every(
      (p) =>
        Array.isArray(perms) &&
        perms.some((g: any) => g.recordType === p.recordType && g.accessType === p.accessType),
    );
    if (!grantedAll) {
      return {
        ...empty,
        status: 'permission-denied',
        message: 'Health Connect permissions not granted',
      };
    }

    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - Math.max(1, days));
    start.setHours(0, 0, 0, 0);
    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: start.toISOString(),
      endTime: now.toISOString(),
    };

    // Read steps
    let stepsTotalByDay = new Map<string, number>();
    let activeCaloriesByDay = new Map<string, number>();
    try {
      const steps = await hc.readRecords('Steps', { timeRangeFilter });
      for (const r of steps.records ?? []) {
        const d = toISODate(new Date(r.endTime ?? r.startTime));
        stepsTotalByDay.set(d, (stepsTotalByDay.get(d) ?? 0) + (r.count ?? 0));
      }
      const cals = await hc.readRecords('ActiveCaloriesBurned', { timeRangeFilter });
      const KCAL_PER_JOULE = 1 / 4184;
      for (const r of cals.records ?? []) {
        const d = toISODate(new Date(r.endTime ?? r.startTime));
        const kcal = (r.energy?.inJoules ?? 0) * KCAL_PER_JOULE;
        activeCaloriesByDay.set(d, (activeCaloriesByDay.get(d) ?? 0) + kcal);
      }
    } catch {
      /* optional — fall through if a record type is unsupported */
    }

    // Resting HR & HRV — aggregate per day (mean)
    const rhrByDay = new Map<string, number[]>();
    const hrvByDay = new Map<string, number[]>();
    const respByDay = new Map<string, number[]>();
    const spo2ByDay = new Map<string, number[]>();
    try {
      const rhr = await hc.readRecords('RestingHeartRate', { timeRangeFilter });
      for (const r of rhr.records ?? []) {
        const d = toISODate(new Date(r.time ?? r.startTime));
        if (typeof r.beatsPerMinute === 'number') {
          const arr = rhrByDay.get(d) ?? [];
          arr.push(r.beatsPerMinute);
          rhrByDay.set(d, arr);
        }
      }
      const hrv = await hc.readRecords('HeartRateVariabilityRmssd', { timeRangeFilter });
      for (const r of hrv.records ?? []) {
        const d = toISODate(new Date(r.time ?? r.startTime));
        const ms = r.heartRateVariability?.inMilliseconds;
        if (typeof ms === 'number') {
          const arr = hrvByDay.get(d) ?? [];
          arr.push(ms);
          hrvByDay.set(d, arr);
        }
      }
      const resp = await hc.readRecords('RespiratoryRate', { timeRangeFilter });
      for (const r of resp.records ?? []) {
        const d = toISODate(new Date(r.time ?? r.startTime));
        if (typeof r.rate === 'number') {
          const arr = respByDay.get(d) ?? [];
          arr.push(r.rate);
          respByDay.set(d, arr);
        }
      }
      const spo2 = await hc.readRecords('OxygenSaturation', { timeRangeFilter });
      for (const r of spo2.records ?? []) {
        const d = toISODate(new Date(r.time ?? r.startTime));
        if (typeof r.percentage === 'number') {
          const arr = spo2ByDay.get(d) ?? [];
          arr.push(r.percentage * 100);
          spo2ByDay.set(d, arr);
        }
      }
    } catch {
      /* optional */
    }

    // Sleep sessions → SleepLog rows
    const sleepByDay = new Map<string, SleepLog>();
    try {
      const sleeps = await hc.readRecords('SleepSession', { timeRangeFilter });
      for (const s of sleeps.records ?? []) {
        const startT = new Date(s.startTime);
        const endT = new Date(s.endTime);
        const durationMin = Math.max(0, Math.round((endT.getTime() - startT.getTime()) / 60_000));
        // The day the sleep *ends on* (the wake-up morning) is the date the
        // SleepLog should be attributed to, matching our model.
        const wakeIso = toISODate(endT);
        const stages: SleepStages = { deep: 0, rem: 0, light: 0, awake: 0 };
        if (Array.isArray(s.stages)) {
          for (const st of s.stages) {
            const mins = Math.max(
              0,
              Math.round(
                (new Date(st.endTime).getTime() - new Date(st.startTime).getTime()) / 60_000,
              ),
            );
            switch (st.stage) {
              case 'deep':
              case 'deepSleep':
                stages.deep += mins;
                break;
              case 'rem':
              case 'remSleep':
                stages.rem += mins;
                break;
              case 'light':
              case 'lightSleep':
                stages.light += mins;
                break;
              case 'awake':
              case 'awakeDuringSleep':
              case 'awakeInBed':
                stages.awake += mins;
                break;
            }
          }
        }
        const existing = sleepByDay.get(wakeIso);
        if (existing) {
          existing.durationMin += durationMin;
          existing.stages = existing.stages
            ? {
                deep: existing.stages.deep + stages.deep,
                rem: existing.stages.rem + stages.rem,
                light: existing.stages.light + stages.light,
                awake: existing.stages.awake + stages.awake,
              }
            : stages;
        } else {
          sleepByDay.set(wakeIso, {
            id: `hc-sleep-${wakeIso}`,
            date: wakeIso,
            durationMin,
            stages: stages.deep + stages.rem + stages.light + stages.awake > 0 ? stages : undefined,
            bedTime: `${String(startT.getHours()).padStart(2, '0')}:${String(startT.getMinutes()).padStart(2, '0')}`,
            wakeTime: `${String(endT.getHours()).padStart(2, '0')}:${String(endT.getMinutes()).padStart(2, '0')}`,
            source: 'health-connect',
            externalId: s.metadata?.id ?? `sleep-${s.startTime}-${s.endTime}`,
            createdAt: Date.now(),
          });
        }
      }
    } catch {
      /* optional */
    }

    // Build VitalsLog per day — aggregate overnight vitals into the morning day.
    const vitalsByDay = new Map<string, VitalsLog>();
    const allDays = new Set<string>([
      ...stepsTotalByDay.keys(),
      ...activeCaloriesByDay.keys(),
      ...rhrByDay.keys(),
      ...hrvByDay.keys(),
      ...respByDay.keys(),
      ...spo2ByDay.keys(),
    ]);

    const avg = (arr: number[] | undefined) =>
      arr && arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : undefined;

    for (const d of allDays) {
      const restingHR = avg(rhrByDay.get(d));
      const hrvRmssd = avg(hrvByDay.get(d));
      const respiratoryRate = avg(respByDay.get(d));
      const spo2 = avg(spo2ByDay.get(d));
      vitalsByDay.set(d, {
        id: `hc-vitals-${d}`,
        date: d,
        restingHR: restingHR ? Math.round(restingHR) : undefined,
        hrvRmssd: hrvRmssd ? Math.round(hrvRmssd) : undefined,
        respiratoryRate: respiratoryRate ? round1(respiratoryRate) : undefined,
        spo2: spo2 ? Math.round(spo2) : undefined,
        steps: stepsTotalByDay.get(d),
        activeCalories: activeCaloriesByDay.get(d)
          ? Math.round(activeCaloriesByDay.get(d)!)
          : undefined,
        source: 'health-connect',
        externalId: `hc-${d}`,
        createdAt: Date.now(),
      });
    }

    const out: VitalsLog[] = [];
    for (const v of vitalsByDay.values()) {
      // Only emit rows that have at least one real measurement to avoid empty rows
      if (v.restingHR || v.hrvRmssd || v.respiratoryRate || v.spo2 || v.steps || v.activeCalories) {
        out.push(v);
      }
    }

    const daysCovered = new Set([...sleepByDay.keys(), ...out.map((v) => v.date)]).size;

    return {
      status: 'ok',
      daysSynced: daysCovered,
      sleepLogs: [...sleepByDay.values()],
      vitalsLogs: out,
    };
  } catch (e: any) {
    return {
      ...empty,
      status: 'error',
      message: e?.message ?? String(e),
    };
  }
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
