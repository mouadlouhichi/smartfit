# Sonar-inspired SmartFit rollout

**Status:** Phase 1 is implemented in this branch. This is a SmartFit roadmap inspired by the Sonar comparison audit, not a claim of Sonar API integration or feature parity.

## Guardrails

- Keep SmartFit's B2B2C surfaces and tenant boundaries intact; gym staff, members and direct consumers remain distinct product contexts.
- Use the existing SmartFit store and verified capabilities. A screenshot, product listing or API catalog is not proof that a connection, recommendation, biometric lock or AI answer works.
- Make missing data explicit. Do not present unavailable sleep, recovery, nutrition or stress inputs as measured zeroes or fabricate a health score.
- Ask for narrowly scoped consent before any future health-source access. Do not imply write-back to Apple Health or Health Connect.
- The Expo app currently stores fitness data in local AsyncStorage. Do not describe it as cloud-synced or as having the web app's full set of capture surfaces.

## Phase 1 — Fast capture and a clear coach entry point (implemented)

- Add a shared quick-actions entry point to the personal web dashboard and Expo navigation, while retaining direct workout logging.
- Keep each menu honest to its platform: web offers workout, meal, measurement, run, goals, plan, progress and coach; native offers the existing workout, measurement, goals, plan and progress surfaces plus the new local coach. Native meal/run capture is not included yet.
- Add a mobile coach backed by the deterministic `answerCoach` engine. It reads the local fitness state, makes no AI/network claim, visibly states the on-device boundary, and shows a training/wellness—not medical—disclaimer.
- Store body entries in canonical kg/cm while accepting the athlete's preferred display units.
- Add native haptic feedback and retain the Volt flame mark's shadow/depth across generated app-icon assets and the web logo.
- Keep English and French copy in parity for new shared strings.

## Phase 2 — Native capture parity

- Add mobile meal capture that reuses SmartFit's nutrition model and clearly distinguishes typed/user-confirmed values from estimates.
- Add a native run flow with explicit location permission, foreground/background limitations, pause/resume and save/discard behavior. Route tracking must be opt-in and must never silently start.
- Preserve local-first behavior and offline recovery; do not imply cloud sync until mobile authentication and sync are actually implemented.

## Phase 3 — Cross-platform insights and weekly review

- Bring the web's useful progress, trend and weekly-review patterns to mobile, sharing domain calculations rather than reimplementing them per screen.
- Provide clear date ranges, source labels, empty/loading/error states and accessible charts.
- Base insights on real SmartFit workout, goal, meal and body logs. Add sleep/recovery/stress scores only after valid source data and a defensible baseline are available; never borrow Sonar's scale or call a SmartFit estimate a provider score without explicit methodology.

## Phase 4 — Optional health connections

- Evaluate iOS HealthKit and Android Health Connect capabilities separately, then request only the permissions required for a selected metric.
- Show connection state, last successful read, source provenance, duplicates/conflicts and a clear disconnect/delete path.
- Treat provider limitations and sync as asynchronous; avoid promises of write-back, complete historical import or a fixed baseline unless verified on-device.
- Keep health-source data separate from gym/tenant data unless an explicit, authorized product flow is designed and reviewed.

## Phase 5 — Sharing, notifications and advanced coaching

- Design granular, revocable sharing with a preview of exactly which fields and time range will be exposed; do not infer privacy behavior from a Share or QR control.
- Gate notifications behind clear preferences and quiet hours, with health-sensitive content minimized on lock screens.
- Only add server AI or health recommendations after grounding, consent, safety copy, fallback behavior and data-retention rules are tested. Keep the deterministic local coach available.

## Evidence source

The phase boundaries follow [`sonar-functional-gap-audit-2026-09-27.md`](./sonar-functional-gap-audit-2026-09-27.md) and the tenant/privacy constraints in [`feature-expansion-plan.md`](./feature-expansion-plan.md). Screenshot observations and vendor marketing remain qualified as such; undocumented runtime behavior is intentionally not asserted here.
