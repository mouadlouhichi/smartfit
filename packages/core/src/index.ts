/**
 * @smartfit/core — shared, framework-agnostic fitness domain.
 *
 * This package contains the data model, pure business logic, state validation,
 * the coach engine and formatters used by every SmartFit app (web + mobile).
 * It must not import React or any platform API so it can run in the browser,
 * in Node (tests/CI) and on native (Metro) without changes.
 *
 * The conceptual model mirrors the reference finance app's split:
 *   activity category (what the session is) · session (logged work) ·
 *   schedule (the recurring plan) · goal (target that survives week rollover) ·
 *   plan (training strategy) · body log (composition / measurements) ·
 *   meal log (fuel in, versus the energy each session burns).
 *
 * NOTE: the demo-data generator lives behind the `@smartfit/core/seed` subpath
 * so it is never pulled into an app bundle. Import it only from scripts/tests.
 */
export * from './colors';
export * from './types';
export * from './constants';
export * from './utils';
export * from './units';
export * from './state';
export * from './fitness';
export * from './training';
export * from './geo';
export * from './run';
export * from './program';
export * from './pro';
export * from './nutrition';
export * from './format';
export * from './coach';
export * from './exercises';
export * from './extended-catalog';
export * from './suggestions';
export * from './gym';
