/**
 * Centralized haptic helper so the whole app uses consistent feedback
 * intensities for taps, confirmations, errors and milestones. Exports are
 * no-ops on platforms that don't support expo-haptics (e.g. web), so they
 * can be called unconditionally.
 */
import { Platform } from 'react-native';

let Haptics: typeof import('expo-haptics') | null = null;
let tried = false;

function load() {
  if (tried) return Haptics;
  tried = true;
  if (Platform.OS === 'web') return null;
  try {
    Haptics = require('expo-haptics');
  } catch {
    Haptics = null;
  }
  return Haptics;
}

async function runAsync<T>(fn: () => Promise<T> | T): Promise<void> {
  const h = load();
  if (!h) return;
  try {
    await Promise.resolve(fn());
  } catch {
    /* ignore */
  }
}

export const haptics = {
  /** Light tap on key presses / button taps. */
  tap: () => runAsync(() => Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Slightly heavier — tab switches, checkboxes. */
  medium: () => runAsync(() => Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Heavy — set completed, rep logged. */
  heavy: () => runAsync(() => Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  /** Soft tick for segmented-control changes. */
  selection: () => runAsync(() => Haptics?.selectionAsync?.()),
  /** Success — goal achieved, workout finished. */
  success: () =>
    runAsync(() => Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Warning / error — validation failure. */
  warning: () =>
    runAsync(() => Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => runAsync(() => Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
