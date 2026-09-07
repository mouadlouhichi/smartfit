import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bodyDisplayUnit,
  bodyValueToCanonical,
  bodyValueToDisplay,
  formatBodyValue,
  formatDistance,
  formatWeight,
  fromKm,
  kgToLb,
  lbToKg,
  toKg,
  toKm,
} from '../src/index.ts';

const metric = { weightUnit: 'kg' } as const;
const imperial = { weightUnit: 'lb' } as const;

test('mass conversions round-trip', () => {
  for (const kg of [0, 55, 72.5, 105]) {
    assert.ok(Math.abs(lbToKg(kgToLb(kg)) - kg) < 1e-9);
  }
  assert.ok(Math.abs(kgToLb(100) - 220.462) < 0.01);
});

test('distance conversions round-trip', () => {
  assert.ok(Math.abs(toKm(fromKm(21.0975, 'mi'), 'mi') - 21.0975) < 1e-9);
  assert.ok(Math.abs(fromKm(42.195, 'mi') - 26.2187) < 0.001);
  assert.equal(fromKm(10, 'km'), 10);
});

test('formatDistance renders the athletes unit', () => {
  assert.equal(formatDistance(10, 'km'), '10 km');
  assert.equal(formatDistance(1.609344, 'mi'), '1 mi');
  // Default keeps the canonical unit for unit-agnostic contexts.
  assert.equal(formatDistance(5), '5 km');
});

test('formatWeight renders the athletes unit', () => {
  assert.equal(formatWeight(100, 'kg'), '100 kg');
  assert.match(formatWeight(100, 'lb'), /220\.5 lb/);
});

test('body measurements convert on the way in and out', () => {
  // 80 kg stored, shown as pounds
  assert.ok(Math.abs(bodyValueToDisplay(80, 'weight', imperial) - 176.37) < 0.01);
  // 176.37 lb typed in, stored as kg
  assert.ok(Math.abs(bodyValueToCanonical(176.37, 'weight', imperial) - 80) < 0.01);
  // Circumferences follow the same system
  assert.equal(bodyDisplayUnit('waist', metric), 'cm');
  assert.equal(bodyDisplayUnit('waist', imperial), 'in');
  assert.ok(Math.abs(bodyValueToDisplay(80, 'waist', imperial) - 31.496) < 0.01);
});

test('percentages and custom values are never converted', () => {
  assert.equal(bodyValueToDisplay(18.5, 'bodyfat', imperial), 18.5);
  assert.equal(bodyValueToCanonical(18.5, 'bodyfat', imperial), 18.5);
  assert.equal(bodyValueToDisplay(42, 'custom', imperial), 42);
  assert.equal(bodyDisplayUnit('bodyfat', imperial), '%');
});

test('an input value survives a display round-trip', () => {
  for (const unit of ['weight', 'waist'] as const) {
    const typed = 82.4;
    const stored = bodyValueToCanonical(typed, unit, imperial);
    const shown = bodyValueToDisplay(stored, unit, imperial);
    assert.ok(Math.abs(shown - typed) < 1e-9, `${unit} round-trip`);
  }
});

test('formatBodyValue labels the users unit', () => {
  assert.equal(formatBodyValue(80, 'weight', metric), '80 kg');
  assert.match(formatBodyValue(80, 'weight', imperial), /176\.4 lb/);
  assert.equal(formatBodyValue(18.5, 'bodyfat', metric), '18.5 %');
});

test('toKg and toKm are identity for canonical units', () => {
  assert.equal(toKg(70, 'kg'), 70);
  assert.equal(toKm(5, 'km'), 5);
});
