import { BODY_UNIT_META } from './constants';
import type { BodyUnit, DistanceUnit, UserProfile, WeightUnit } from './types';
import { bodyDisplayUnit, bodyValueToDisplay, fromKg, fromKm } from './units';

export function formatMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

export function formatNumber(n: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(n);
}

export function formatCalories(kcal: number): string {
  return `${formatNumber(Math.round(kcal), 0)} kcal`;
}

/**
 * Tonnage: kg under the bar × reps, rendered in the athlete's weight unit.
 * Rolls up to tonnes above 1,000 kg so long histories stay readable
 * ("12.4 t" rather than "12,400 kg").
 */
export function formatVolume(kg: number, unit: WeightUnit = 'kg'): string {
  const display = fromKg(kg, unit);
  // Roll up to tonnes only in metric — "2.2 t" is meaningless to a lb user,
  // who gets a plain grouped number instead.
  if (unit === 'kg' && display >= 1000) return `${formatNumber(display / 1000)} t`;
  return `${formatNumber(Math.round(display), 0)} ${unit}`;
}

/** A single set, the way the runner writes it: "8 × 60 kg" / "45s" / "2 km". */
export function formatSet(
  set: { reps?: number; weight?: number; distance?: number; duration?: number },
  unit: WeightUnit = 'kg',
): string {
  if ((set.weight ?? 0) > 0 && (set.reps ?? 0) > 0) {
    return `${set.reps} × ${formatWeight(set.weight!, unit)}`;
  }
  if ((set.reps ?? 0) > 0) return `${set.reps} reps`;
  if ((set.distance ?? 0) > 0) return formatDistance(set.distance!, 'km');
  if ((set.duration ?? 0) > 0) return formatMinutes(set.duration!);
  return '—';
}

/**
 * Distance is stored in kilometres and rendered in the athlete's unit.
 * Pass the profile's `distanceUnit` at every call site — the default only
 * exists so the canonical value can be shown in unit-agnostic contexts.
 */
export function formatDistance(km: number, unit: DistanceUnit = 'km'): string {
  return `${formatNumber(round1(fromKm(km, unit)))} ${unit}`;
}

/** Body mass is stored in kilograms and rendered in the athlete's unit. */
export function formatWeight(kg: number, unit: WeightUnit = 'kg'): string {
  return `${formatNumber(round1(fromKg(kg, unit)))} ${unit}`;
}

/** Render any body measurement in the athlete's preferred units. */
export function formatBodyValue(
  value: number,
  bodyUnit: BodyUnit,
  profile: Pick<UserProfile, 'weightUnit'>,
  label?: string,
): string {
  const display = bodyValueToDisplay(value, bodyUnit, profile);
  const suffix = bodyUnit === 'custom' ? '' : bodyDisplayUnit(bodyUnit, profile);
  const rounded = formatNumber(round1(display));
  return suffix ? `${rounded} ${suffix}` : `${rounded}${label ? ` ${label}` : ''}`;
}

/** Human label for a body measurement type. */
export function bodyLabel(bodyUnit: BodyUnit, custom?: string): string {
  if (bodyUnit === 'custom') return custom?.trim() || 'Measurement';
  return BODY_UNIT_META[bodyUnit]?.label ?? bodyUnit;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function relativeDay(iso: string, now = new Date()): string {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return formatDateLabel(iso);
}
