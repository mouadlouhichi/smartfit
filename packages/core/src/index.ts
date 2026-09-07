/**
 * @smartfit/core — shared, framework-agnostic fitness domain.
 *
 * This package contains the data model, pure business logic, demo seed and
 * formatters used by every SmartFit app (web + mobile). It must not import React
 * or any platform API so it can run in the browser, in Node (tests/CI) and on
 * native (Metro) without changes.
 *
 * The conceptual model mirrors the reference finance app's split:
 *   activity category (what the session is) · session (logged work) ·
 *   schedule (the recurring plan) · goal (target that survives week rollover) ·
 *   plan (training strategy) · body log (composition / measurements).
 */
export * from './types';
export * from './constants';
export * from './utils';
export * from './fitness';
export * from './format';
export * from './seed';
