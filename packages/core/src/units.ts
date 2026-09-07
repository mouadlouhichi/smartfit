/**
 * Unit handling.
 *
 * SmartFit stores every measurement in a canonical metric unit — kilograms for
 * mass, centimetres for circumferences, kilometres for distance — and converts
 * only at the display/input boundary. That keeps aggregation, goals and charts
 * unit-agnostic while still letting a user work in pounds and miles.
 */
import type { BodyUnit, DistanceUnit, UserProfile, WeightUnit } from './types';

export const KG_PER_LB = 0.45359237;
export const KM_PER_MI = 1.609344;
export const CM_PER_IN = 2.54;

/** Circumference unit implied by the user's mass unit (metric vs imperial). */
export type LengthUnit = 'cm' | 'in';

export function lengthUnitFor(weightUnit: WeightUnit): LengthUnit {
  return weightUnit === 'lb' ? 'in' : 'cm';
}

// ── Mass ────────────────────────────────────────────────────────────────
export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;

/** Canonical kg -> the user's display unit. */
export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kgToLb(kg) : kg;
}
/** The user's display unit -> canonical kg. */
export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? lbToKg(value) : value;
}

// ── Distance ────────────────────────────────────────────────────────────
export const kmToMi = (km: number) => km / KM_PER_MI;
export const miToKm = (mi: number) => mi * KM_PER_MI;

export function fromKm(km: number, unit: DistanceUnit): number {
  return unit === 'mi' ? kmToMi(km) : km;
}
export function toKm(value: number, unit: DistanceUnit): number {
  return unit === 'mi' ? miToKm(value) : value;
}

// ── Length / circumference ──────────────────────────────────────────────
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (inch: number) => inch * CM_PER_IN;

export function fromCm(cm: number, unit: LengthUnit): number {
  return unit === 'in' ? cmToIn(cm) : cm;
}
export function toCm(value: number, unit: LengthUnit): number {
  return unit === 'in' ? inToCm(value) : value;
}

/**
 * The display unit for a body measurement, given the user's preferences.
 * Percentages and custom entries are unitless / already in the stored unit.
 */
export function bodyDisplayUnit(
  bodyUnit: BodyUnit,
  profile: Pick<UserProfile, 'weightUnit'>,
): string {
  switch (bodyUnit) {
    case 'weight':
      return profile.weightUnit;
    case 'bodyfat':
      return '%';
    case 'waist':
    case 'chest':
    case 'arms':
      return lengthUnitFor(profile.weightUnit);
    default:
      return '';
  }
}

/** Canonical stored value -> the value to show for this measurement. */
export function bodyValueToDisplay(
  value: number,
  bodyUnit: BodyUnit,
  profile: Pick<UserProfile, 'weightUnit'>,
): number {
  switch (bodyUnit) {
    case 'weight':
      return fromKg(value, profile.weightUnit);
    case 'waist':
    case 'chest':
    case 'arms':
      return fromCm(value, lengthUnitFor(profile.weightUnit));
    default:
      return value;
  }
}

/** A value typed by the user -> the canonical value to store. */
export function bodyValueToCanonical(
  value: number,
  bodyUnit: BodyUnit,
  profile: Pick<UserProfile, 'weightUnit'>,
): number {
  switch (bodyUnit) {
    case 'weight':
      return toKg(value, profile.weightUnit);
    case 'waist':
    case 'chest':
    case 'arms':
      return toCm(value, lengthUnitFor(profile.weightUnit));
    default:
      return value;
  }
}
