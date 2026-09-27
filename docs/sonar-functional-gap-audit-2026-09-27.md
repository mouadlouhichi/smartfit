# SmartFit vs Sonar Health — functional gap audit

**Audit date:** 27 September 2026
**Status:** Preliminary product comparison; no application code changed
**Question:** What does Sonar Health appear to offer that SmartFit is missing, and what should SmartFit prioritize?

## 1. Scope, evidence and confidence

- **Sonar:** reviewed the public Sonar website, current App Store description/version notes, and Sonar's public developer documentation. The public site and store listing are product claims, not proof that every path works for every user or device.
- **SmartFit:** reviewed the current repository's domain model, web and Expo routes, README, and the current MVP/feature-expansion audits. A feature not found in this checkout is treated as **not implemented in this codebase**, not as proof that no separate deployment has it.
- **Not tested:** I could not sign into or operate the Sonar mobile app. There was no SmartFit production account or physical iOS/Android device available for permission, sync, notification, or wearable testing. This is a code-and-public-information audit, not a hands-on usability or clinical validation.

Confidence is **high** for SmartFit gaps visible in the source; **medium** for Sonar capabilities described in current public materials; and **low** for Sonar's actual in-app interaction details until screenshots or access are available.

## 2. Executive verdict

**Sonar and SmartFit solve adjacent, not identical, jobs.** Sonar's center of gravity is *collect health signals from many places, interpret them, and surface daily health trends*. SmartFit's center of gravity is *plan and execute training* (with a substantial gym-management product alongside it).

SmartFit already has a more detailed **strength-training execution loop** than Sonar's public positioning describes: workout templates and scheduling, guided set logging, reps/load/RPE, rest timers, records, exercise guidance, goals, and a GPS run workflow. It also has useful nutrition logging, body trends, and a local-first privacy model.

The largest missing layer is **connected, time-based health data**. SmartFit currently has no HealthKit/Health Connect or wearable/provider sync, no sleep or continuous-vitals data model, no measured stress/energy signal, and no health-data trend/correlation layer. Its “readiness” calculation is based on logged training and planned rest—not on sleep, HRV, or other biometrics. The existing AI coach is likewise a training coach, not a cross-domain health copilot.

**Recommendation:** do not clone all of Sonar. If SmartFit wants to move toward this category, first build an optional, privacy-conscious health-data foundation and a small, explainable recovery/sleep experience. Keep SmartFit's strength-training and running depth as the differentiator. Defer broad provider coverage, community benchmarks, and medical-style recommendations until user demand and governance are clear.

## 3. What Sonar appears to offer

Based on public materials available on the audit date, Sonar combines:

1. **Multi-source collection.** Its public materials promote connections to major wearable, fitness, and nutrition platforms. Its developer docs distinguish cloud-provider authorization from a separate mobile SDK path for native health stores; this is not simply a browser feature or one universal connection method. Availability depends on platform, provider, and permissions. [1](https://www.sonarhealth.co/) [4](https://docs.sonarhealth.co/device-connectivity/)
2. **Daily health scores.** Consumer materials describe Recovery, Sleep, Strain, Stress, Nutrition, and Energy Reserve. The public score API currently documents five daily score types—sleep, recovery, strain, nutrition, and stress—so the consumer surface and public API should not be assumed to have identical coverage. Scores are normalized, can be unavailable when inputs are missing, and use personal history for some signals. [1](https://apps.apple.com/us/app/sonar-health-performance/id1595073849) [2](https://docs.sonarhealth.co/health-scores/)
3. **Sleep, stress, energy, and vital trends.** The product listing describes sleep stages, HRV, resting heart rate, respiratory rate, blood oxygen, temperature, real-time stress analysis, and out-of-range notifications where supported by connected data. [1](https://apps.apple.com/us/app/sonar-health-performance/id1595073849)
4. **Broader workout analytics.** Sonar positions workouts as unified across sources and calls out heart-rate zones, cardio load, training balance, and daily strain targets. [1](https://apps.apple.com/us/app/sonar-health-performance/id1595073849)
5. **Cross-metric analysis and AI.** Its listing describes asking questions against health data, comparing multiple metrics, correlation views, trend insights, and peer benchmarks. [1](https://apps.apple.com/us/app/sonar-health-performance/id1595073849)
6. **A multi-surface experience.** The listing promotes an iPhone/Apple Watch app, widgets, and a desktop experience. It also describes personalized checkup/vaccine/screening recommendations—a much higher clinical/governance bar than ordinary training suggestions. [1](https://apps.apple.com/us/app/sonar-health-performance/id1595073849)

These are product-listing claims. They have not been independently tested in a signed-in Sonar account.

## 4. Side-by-side functional comparison

| Area | Sonar's public product position | SmartFit in this repository | Gap / audit conclusion |
|---|---|---|---|
| **Primary job** | Consolidate health data and translate it into daily health guidance. | Training tracker and gym platform: plan, log, run, measure progress, and manage gym workflows. | **Different positioning.** SmartFit should not treat every Sonar feature as a missing requirement. |
| **Training execution** | Unified imported workouts, heart-rate zones, cardio load/balance, and training summaries. | Strong structured-training loop: scheduled routines, exercise catalog, guided session runner, set-level reps/load/RPE, rest timer, PRs, goals, and GPS running with splits/route history. | **SmartFit strength.** Main gap is imported workout/heart-rate data and cross-source deduplication, not basic workout logging. |
| **Device/source connections** | Many cloud-provider integrations plus a separate native health-store SDK route; users grant source permissions. | No HealthKit, Health Connect, or wearable/provider connection flow found. Web can be local-first or use optional Firebase cloud storage; the Expo app stores data locally. | **Major gap** if the goal is a unified health app. No connect/disconnect UI, source status, last-sync state, or imported-data provenance. |
| **Sleep and vitals** | Sleep sessions/stages and daily or time-series metrics such as HR, HRV, RHR, and other supported vitals. | `FitnessState` contains sessions, schedule, goals, body logs, meals, and check-ins; no sleep, HR/HRV, steps, respiratory rate, temperature, or SpO₂ entities were found. | **Major gap.** SmartFit cannot answer questions about sleep quality or physiological recovery from current stored data. |
| **Readiness / recovery** | Recovery is informed by sleep, overnight vitals, personal baselines, and prior strain when available. | A readiness heuristic exists, but derives from SmartFit training history and planned rest. It is not a biomarker score. The numeric score/drivers are Pro-gated in the UI, while billing/entitlements are currently a preview. | **Partial and easy to misunderstand.** Rename/label it as training-load readiness unless/until biometric inputs exist. Do not present it as Sonar-equivalent recovery. |
| **Stress and energy** | Public listing describes live physiological stress and an intraday energy reserve/battery. | No measured stress or intraday energy model found. SmartFit has weekly self-reported check-ins and training-derived load signals. | **Major gap.** Weekly self-report is useful context but not continuous stress/energy monitoring. |
| **Nutrition** | Nutrition score and connected-source data are positioned alongside activity and sleep. | SmartFit has meal logs, calorie/macronutrient targets, meal planning/preferences, and text/photo scan paths. Calories and macros are manually logged or estimated; no external nutrition integration or daily health score is present. | **Partial.** Core food logging exists; the missing piece is connected nutrition data and its relationship to training/sleep, not a blank nutrition feature. |
| **Goals** | Goals can span multiple health categories in the public listing. | `GoalMetric` currently covers workouts, active minutes, calories burned, and distance. Fuel targets exist separately from the general goal system. | **Partial.** No general sleep, steps, hydration, or recovery goals. Expand only for metrics users can reliably collect. |
| **Coach / personalization** | Sonar AI is positioned as aware of connected health signals and personal context. | SmartFit has a deterministic local coach and optional provider-backed AI. Its generated context includes plan, weekly totals, goals, streak, recent sessions, and latest weight; it does not include logged meals, sleep, or vitals. | **Partial.** SmartFit already has a coach, but its context is much narrower and cannot reason across health domains. |
| **Trends and comparisons** | Customizable health trends, multi-metric comparison/correlation, and peer benchmarks are promoted. | SmartFit has workout-volume/progress analytics, records, body trends, and nutrition views. No cross-metric health trend/correlation or peer benchmark system was found. | **Partial.** Strong training analytics; no “what changed across sleep, stress, food, and training?” view. |
| **Reminders and alerts** | Listing describes notifications for vital readings outside typical ranges. | Scheduled workouts exist, but no push/local notification delivery or health-threshold alerting implementation was found; reminders are also listed as future work. | **Gap.** No nudge for a scheduled workout and no signal-based alert loop. Do not add alerts until opt-in, quiet hours, and thresholds are designed. |
| **Mobile, watch, and widgets** | iPhone/Apple Watch, widgets, and desktop surfaces are promoted. | Web is the more complete product and has an installable offline PWA shell. The Expo app is local-only and not full parity; its current routes omit several web areas, including run, coach, and fuel. No watch app, native widgets, or lock-screen complications were found. | **Major platform gap.** Having an Expo app does not mean native health/wearable parity. |
| **Privacy and user control** | Sonar publicly emphasizes privacy and offers connected-data controls. | SmartFit has a strong local-first/cloud-optional design, export/delete controls, and a deterministic on-device coach. A configured external AI provider can receive a compact summary; health imports would need explicit, separately scoped consent and data controls. | **SmartFit strength to preserve.** Do not trade the local-first option for integrations without clear consent, provenance, export, disconnect, and deletion behavior. |

## 5. SmartFit gaps ranked by value

### P0 — Correct the readiness promise (small change, high trust impact)

The nearest SmartFit analogue to Sonar Recovery is `readiness()` in `packages/core/src/training.ts`. It uses recent training volume/load, days since a high-intensity session, and planned rest; it does not use sleep or wearable vitals. The UI calls the surface “readiness,” and its numeric score and drivers are hidden behind a Pro gate even though paid Pro is not live.

**Recommended action:** call it **Training readiness** or **Training load**, add a one-line explanation of the signals it uses, show “not enough training history” honestly, and avoid phrasing that implies physiological or medical recovery. Treat a future biomarker-based recovery score as a separate feature with its own inputs and confidence state.

### P1 — Add an optional health-data connection foundation

If users want SmartFit to become a broader health tracker, start with the platform health stores rather than attempting dozens of individual OAuth integrations at once:

- iOS: evaluate a native HealthKit adapter.
- Android: evaluate Health Connect for the target Android versions and current platform constraints.
- Later: add direct/provider integrations only for sources users request and SmartFit can support reliably (for example, a small set of training or nutrition providers).

This is more than adding a “Connect” button. The first release needs granular permission rationale, source selection, sync status/last-sync time, disconnect/revocation, duplicate handling, timezone-safe timestamps, retry/error states, and a clear distinction between user-entered and imported data.

### P1 — Model the signals before inventing more scores

Add a versioned, owner-scoped health-sample model with at least metric type, value/unit, observed timestamp, timezone, source/provider, source record ID for deduplication, and any available quality/completeness metadata. Keep imported samples distinct from hand-entered workout/nutrition records where appropriate. Ensure export, account deletion, local persistence, and cloud rules cover the new data.

For a first useful slice, consider **sleep duration/stages, steps, workouts, resting heart rate, and HRV** where a source provides them. Add respiratory rate, blood oxygen, temperature, and more only after measuring availability and user demand. Missing data must stay missing; do not synthesize a healthy score from no inputs.

### P1 — Add a measured, explainable recovery/sleep experience

Once reliable signals arrive, show separate surfaces for **Training Load**, **Sleep**, and **Recovery**. Establish user-specific baselines over enough history; display the time window, data freshness, contributing signals, and why a score is unavailable. Explain that a score is a trend aid—not a diagnosis—and avoid comparing a training-only heuristic with a biometric score.

A minimal first dashboard could show sleep duration/trend, resting heart rate/HRV versus the user's own baseline, and recent training load. That offers meaningful context without copying every Sonar score.

### P1 — Extend coaching across domains, with consent

SmartFit's coach already has a valuable foundation, but `buildCoachContext()` currently summarizes training plan, weekly workouts, goals, streak, recent sessions, and latest weight—not meals, sleep, or physiological metrics. Extend only after these records are trustworthy. Send small, time-bounded summaries rather than raw continuous samples, make provider use visible, let the user choose which categories leave the device, and keep medical diagnosis/treatment out of scope.

A first cross-domain use case could be: “How did my sleep and training load change this week?” Answer with dates and source coverage, not unsupported causal claims.

### P1/P2 — Close the habit and trend loops

- Add opt-in local/push reminders for scheduled workouts, with quiet hours and easy disablement.
- Add a weekly review that combines training, body, and nutrition data the user actually logged.
- Add a Trends workspace for multi-week comparisons; add correlations only when both metrics have enough aligned observations and label correlation as non-causal.
- If goals expand beyond training, use typed goals for measurable metrics such as sleep duration, steps, or protein—not arbitrary scores with unclear data quality.

### P2 — Defer expensive or higher-risk parity

- **Broad direct integrations:** validate top requested providers first; platform health stores can cover many devices without SmartFit maintaining every provider OAuth lifecycle.
- **Watch apps, widgets, and lock-screen surfaces:** valuable after the native app has real health-sync and workout parity, not before.
- **Peer/community benchmarks:** require clear opt-in and a privacy model; they are not necessary to improve an individual athlete's training loop.
- **Medical screening/vaccine recommendations or sickness detection:** not a quick “AI feature.” Defer pending clinical expertise, validation, legal review, and a well-defined safety process.

Do not advertise Pro-only health features as purchasable until SmartFit's own server-verified billing and entitlement lifecycle is live; current repository documentation explicitly describes billing as a preview.

## 6. Recommended first milestone and acceptance criteria

A sensible “Sonar-inspired, still SmartFit” first milestone is **connected recovery context**, not a full health super-app:

1. A user can optionally connect a supported native health source and select data permissions; declining does not block onboarding or workout logging.
2. The user can see connection state, last sync, failures, and how to revoke access. Disconnecting stops future sync.
3. Imported workout records do not double-count manually logged or provider-imported sessions; timestamps respect source timezone and daylight-saving changes.
4. SmartFit can show an honest sleep/training/recovery view. Scores identify their inputs and history window and have a useful empty/insufficient-data state.
5. Imported health data is included in export/deletion, kept owner-scoped in local/cloud storage, and never shown to a gym or trainer without separate, explicit sharing consent.
6. Any AI feature that uses imported signals discloses the categories being sent and sends a bounded summary only. No diagnosis or treatment advice is presented.
7. Test on real supported iOS and Android devices: permission denied/re-granted, source disconnected, no network, stale data, duplicate sync, timezone boundaries, account change, export, and delete.

## 7. Bottom line

**What SmartFit is missing most versus Sonar is not another workout logger; it is automatic health-data collection and interpretation.** The core training experience is already a SmartFit advantage. The largest strategic opportunity is to connect a small set of trustworthy health signals to the existing training, nutrition, and coaching flows—without implying that today's training-volume readiness score is a biometric recovery score.

### Sources

**Sonar public sources**

- [Sonar public product website](https://www.sonarhealth.co/)
- [1](https://apps.apple.com/us/app/sonar-health-performance/id1595073849) — current consumer listing and feature/version notes.
- [2](https://docs.sonarhealth.co/health-scores/) — official score definitions, required inputs, and API behavior.
- [4](https://docs.sonarhealth.co/device-connectivity/) — official provider catalog and cloud/native connection distinction.

**SmartFit source paths reviewed**

- `packages/core/src/types.ts` — `FitnessState`, `WorkoutSession`, `BodyLog`, `MealLog`, and goal types.
- `packages/core/src/training.ts` (`readiness`) and `src/components/dashboard/readiness-card.tsx` — current training-derived readiness and UI gate.
- `src/lib/ai-coach.ts` (`buildCoachContext`) — context sent to the optional AI provider.
- `src/components/dashboard/screens/fuel-screen.tsx`, `src/components/dashboard/modals/MealModal.tsx`, and `src/app/api/meal-scan/route.ts` — nutrition/logging/scan paths.
- `apps/mobile/src/app/` and `apps/mobile/src/lib/store.tsx` — current Expo routes and AsyncStorage persistence.
- `docs/mvp-audit-2026-09-11.md`, `docs/feature-expansion-plan.md`, and `docs/persona-workflows.md` — current release, notification, native, and integration limits.
