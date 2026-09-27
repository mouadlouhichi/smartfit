# SmartFit vs Sonar Health — functional gap audit

**Audit date:** 27 September 2026
**Status:** Preliminary product comparison; documentation only
**Question:** What does Sonar Health appear to offer that SmartFit is missing, and what should SmartFit prioritize?

## 1. Scope, evidence and confidence

- **Sonar:** reviewed its public website, App Store and Google Play listings, and public developer documentation. Store/website claims are not proof that each feature works for every account, device, or region.
- **SmartFit:** reviewed the current repository's domain model, web and Expo routes, README, and current MVP/feature-expansion audits. A feature not found in this checkout is treated as **not implemented in this codebase**, not as proof that no separate deployment has it.
- **Screenshot evidence:** the user supplied 13 iPhone screenshots covering onboarding, the Pro offer, a notification pre-prompt, and first-run Home sections for recovery, strain, energy/stress, sleep, training, nutrition, daily goals, and vital trends. I reviewed the visible screens, but did not operate the app.
- **Not tested:** I could not sign into or interact with Sonar. The screenshots do not expose taps, network/sync behavior, health permissions, error recovery, the full Trends/Activity/AI/settings flows, or subscription transactions. No SmartFit production account or physical device was available for parity testing. This remains a visual/code audit, not clinical validation.

Confidence is **high** for SmartFit gaps visible in source, **medium** for Sonar capabilities described in public materials, and **high for the visual details shown in the submitted screenshots**; behavior beyond those screens remains unverified.

## 2. Executive verdict

**Sonar and SmartFit solve adjacent, not identical, jobs.** Sonar's center of gravity is *collect health signals from many places, interpret them, and surface daily health trends*. SmartFit's center of gravity is *plan and execute training* (with a substantial gym-management product alongside it).

SmartFit already has a strong structured-training loop: recurring routines, guided set logging, reps/load/RPE, rest timers, records, exercise guidance, goals, and GPS running. It also has nutrition logging/scanning, body trends, and a local-first privacy model. Those are strengths to preserve—not features to replace with generic health cards.

The largest gap is **connected, time-based health data**. SmartFit currently has no HealthKit/Health Connect or wearable/provider sync, no sleep or continuous-vitals data model, no measured stress/energy signal, and no cross-domain health-trend layer. Its existing “readiness” score is real, but based on logged training and planned rest—not sleep, HRV, or other biometrics. SmartFit's coach is likewise a training coach, not a physiological health copilot.

**Recommendation:** do not clone every Sonar feature. If SmartFit wants to move toward this category, first build an optional, privacy-conscious health-data foundation, then add a small and explainable sleep/recovery experience. Keep SmartFit's training execution, running, and gym workflow as differentiators. Defer broad provider coverage, peer benchmarks, and medical-style recommendations until demand and governance are clear.

## 3. What Sonar appears to offer

Based on public materials available on the audit date:

1. **Multi-source data ingestion.** Sonar promotes connections to wearable, fitness, and nutrition platforms. Its developer docs distinguish hosted cloud-provider connections from a native mobile SDK for on-device health stores; the paths and availability vary by platform and provider. The mobile SDK documentation says Apple Health on iOS is available and the Android Health Connect/Samsung Health SDK is in early access. [3](https://docs.sonarhealth.co/device-connectivity/) [6](https://docs.sonarhealth.co/mobile-sdk/)
2. **Normalization, deduplication, and consolidation.** The public API describes normalized daily metrics, workouts, sleep sessions, and time-series data. Metric-level consolidation can use `max`, `avg`, or `sum`, and providers can be excluded from a metric; workouts and sleep use session-specific deduplication/order rules. Historical synchronization and reconsolidation are asynchronous, not guaranteed to recalculate instantly. [4](https://docs.sonarhealth.co/data-model/) [5](https://docs.sonarhealth.co/consolidation/)
3. **Health metrics and scores.** The public metric catalog includes activity, nutrition (including water/fiber), sleep, vitals, body composition, and scores, subject to what a connected source provides; its provider catalog includes a glucose-monitor connection. The dedicated scores docs list five public API scores—sleep, recovery, strain, nutrition, and stress—on a 0–100 scale. The consumer listing also markets Energy Reserve, so app/API coverage should not be assumed identical. It lists current-day Recovery, Sleep, Strain, and Nutrition scores as free. [1](https://apps.apple.com/us/app/sonar-health-performance/id1595073849) [2](https://docs.sonarhealth.co/health-scores/) [3](https://docs.sonarhealth.co/device-connectivity/) [7](https://docs.sonarhealth.co/data-catalog/)
4. **Sleep and workout detail.** Public API examples include sleep duration, deep/light/REM stages, efficiency, and workout heart-rate traces. Recovery uses overnight HR/HRV and sleep when available; strain uses heart rate relative to resting and maximum heart rate. [2](https://docs.sonarhealth.co/health-scores/) [7](https://docs.sonarhealth.co/data-catalog/)
5. **Stress, energy, and vital trends.** Sonar's consumer listing promotes HRV, resting heart rate, respiratory rate, blood oxygen, temperature, notifications for out-of-range values, and intraday stress/energy features. Treat these as marketed capabilities; collection frequency and availability depend on source and permissions. [1](https://apps.apple.com/us/app/sonar-health-performance/id1595073849)
6. **Cross-metric analysis and AI.** The consumer listing describes customizable trend views, comparisons of up to six metrics, correlations, peer benchmarks, and an AI health assistant grounded in connected data. Its version notes describe saved personal context, configurable AI tone/length/voice input, and AI-generated Home/Trends insights refreshed as new data arrives; Sonar AI is listed as a Pro feature. A correlation view can show association; it does **not** establish cause and effect. [1](https://apps.apple.com/us/app/sonar-health-performance/id1595073849)
7. **Multi-surface product.** Public listings promote iPhone, Apple Watch, widgets, and a desktop experience; a Google Play listing exists for the Android app. The Android health-store SDK status is a separate question from app availability. Public materials also describe personalized checkup/vaccine/screening recommendations—a higher clinical and governance bar than ordinary training suggestions. [1](https://apps.apple.com/us/app/sonar-health-performance/id1595073849) [8](https://play.google.com/store/apps/details?id=com.sonarapp.health&hl=en)

These are public product/API descriptions. They have not been independently tested in a signed-in Sonar account.

### Claims that need qualification before using them as requirements

| Detailed claim | What the reviewed public evidence supports |
|---|---|
| “Bi-directional” HealthKit/Health Connect sync | The mobile SDK reads native health-store records and sends them to Sonar; an integrating app reads normalized Sonar results through its backend. A general Sonar-to-HealthKit write-back path was not documented. Android SDK support is currently described as early access. [6](https://docs.sonarhealth.co/mobile-sdk/) |
| Fixed 14-/30-day baselines | Sonar documents baselines relative to each user's rolling history, but the score docs reviewed do not specify a universal 14- or 30-day baseline window. [2](https://docs.sonarhealth.co/health-scores/) |
| Strain is a 0–21 score | The public score API defines `strain_score` on a 0–100 scale. Do not import another product's scale into the Sonar comparison. [2](https://docs.sonarhealth.co/health-scores/) |
| Immediate full recalculation after a source change | Provider history arrives progressively, and consolidation rebuilds are asynchronous. The docs describe sync events rather than an instant-recalculation guarantee. [4](https://docs.sonarhealth.co/data-model/) [5](https://docs.sonarhealth.co/consolidation/) |
| Sleep debt windows and exact bedtime recommendations | Public score docs describe sleep balance/bank and sleep-timing consistency. The exact sleep-debt horizon and personalized bedtime-recommendation flow were not verified in the reviewed app/docs. [2](https://docs.sonarhealth.co/health-scores/) |
| Biological-age calculation | The metric catalog contains `vo2_max`, but that is not evidence that Sonar computes a biological-age score. No biological-age feature was confirmed in the reviewed public materials. [7](https://docs.sonarhealth.co/data-catalog/) |
| Correlation means “cause and effect” | Sonar markets metric correlations; those show patterns/association and must not be presented as causal proof. [1](https://apps.apple.com/us/app/sonar-health-performance/id1595073849) |

## 4. Side-by-side functional comparison

| Area | Sonar's public product position | SmartFit in this repository | Gap / audit conclusion |
|---|---|---|---|
| **Primary job** | Consolidate health data and translate it into daily health guidance. | Training tracker and gym platform: plan, log, run, measure progress, and manage gym workflows. | **Different positioning.** SmartFit should not treat every Sonar feature as a missing requirement. |
| **Training execution** | Unified imported workouts, heart-rate zones, cardio load/balance, and training summaries. | Structured training loop: scheduled routines, exercise catalog, guided session runner, set-level reps/load/RPE, rest timer, PRs, goals, and GPS running with splits/route history. | **SmartFit strength.** The gap is imported workout/heart-rate data, HR-zone analysis, and cross-source deduplication—not basic workout logging. |
| **Cardiovascular strain** | HR-based strain score, workout heart-rate traces/zones, and daily strain-target guidance are promoted. | No heart-rate sample or zone model found; training readiness uses logged training load, while calories are estimates. | **Gap.** SmartFit cannot derive Sonar-style cardiovascular strain or adapt a daily target from heart-rate data. The Sonar public score API uses 0–100; a 0–21 scale was not verified. |
| **Device/source connections** | Hosted cloud providers plus a separate native health-store SDK route; connect/sync state is part of the documented API. | No HealthKit, Health Connect, wearable, or provider connection flow found. Web can be local-first or use optional Firebase cloud storage; Expo mobile stores locally. | **Major gap** if SmartFit's goal is a unified health app. No connect/disconnect UI, source status, last-sync state, or imported-data provenance. |
| **Sleep and vitals** | Sleep sessions/stages and daily or time-series metrics such as HR, HRV, resting HR, and other supported vitals. | `FitnessState` contains sessions, schedule, goals, body logs, meals, and check-ins; no sleep, HR/HRV, steps, respiratory rate, temperature, or SpO₂ entities were found. | **Major gap.** SmartFit cannot answer measured sleep-quality or physiological-recovery questions from current stored data. |
| **Readiness / recovery** | Recovery is informed by sleep, overnight vitals, personal baselines, and prior strain when available. | A readiness score exists. It uses recent training load, days since a hard session, and planned rest; the score/drivers are Pro-gated in the UI while billing remains a preview. | **Partial, not absent.** It is training-load readiness, not biometric recovery. Rename/explain it rather than claiming SmartFit has no readiness feature. |
| **Stress and energy** | Consumer materials describe physiological stress and intraday energy tracking. | No measured stress or intraday energy model found. SmartFit has weekly self-reported check-ins and training-derived load signals. | **Major gap.** A weekly self-report is useful context, but is not continuous stress/energy monitoring. |
| **Nutrition** | Nutrition score and connected-source data are positioned alongside activity and sleep. | SmartFit has meal logs, calorie/macronutrient targets, meal planning/preferences, local text/voice parsing, and a photo-scan route. Photo recognition is **not a simulation**: when configured, a vision provider identifies foods/portions, then SmartFit computes macros from its own food table. Photo scan requires provider configuration and is Pro-gated; manual logging remains available. | **Partial.** Food logging exists; the missing pieces are external nutrition sync and links between nutrition, sleep, and other health signals. |
| **Goals** | Goals span multiple health categories in the public listing. | `GoalMetric` covers workouts, active minutes, calories burned, and distance. Fuel targets are separate from the general goal system. | **Partial.** No general sleep, steps, hydration, or recovery goals. Add only for metrics users can reliably collect. |
| **Coach / personalization** | Sonar AI is positioned as aware of connected health signals and personal context; the listing describes configurable responses and saved context. | SmartFit has a deterministic local coach and optional provider-backed AI. Its generated context includes plan, weekly totals, goals, streak, recent sessions, and latest weight—not meals, sleep, or vitals. Chat history persists, but there is no user-editable, structured personal-context memory. | **Partial.** SmartFit has coaching, but not cross-domain physiological context or proactive health insights. Dashboard workout suggestions exist; continuous health insight/alerting does not. |
| **Trends and comparisons** | Customizable health trends, multi-metric comparison/correlation, and peer benchmarks are promoted. | SmartFit has workout-volume/progress analytics, records, body trends, and nutrition views. No cross-metric health trend/correlation or peer benchmark system was found. | **Partial.** Strong training analytics; no “what changed across sleep, stress, food, and training?” view. |
| **Reminders and alerts** | Listing describes notifications when vital values move outside typical ranges. | Scheduled workouts exist, but no push/local notification delivery or health-threshold alerting implementation was found; reminders are listed as future work. | **Gap.** No scheduled-session nudge or signal-based alert loop. Alerts need opt-in, quiet hours, and careful thresholds. |
| **Mobile, watch, and widgets** | iPhone/Apple Watch, widgets, Android app, and desktop experience are promoted. | Web is more complete and has an installable offline PWA shell. Expo is local-only, with no auth/cloud/onboarding parity; its routes omit web areas including run, coach, and fuel. No watch app, native widgets, or lock-screen complications were found. | **Major platform gap.** An Expo app does not yet mean native health/wearable parity. Wear OS support was not confirmed in the reviewed Sonar sources. |
| **Privacy and user control** | Sonar publicly emphasizes privacy and connected-data controls; its API returns normalized/consolidated data rather than raw provider payloads. | SmartFit has local-first/cloud-optional storage, export/delete controls, and a deterministic on-device coach. A configured external AI provider can receive a compact summary. | **SmartFit strength to preserve.** Health imports need separately scoped consent, provenance, export, disconnect, and deletion behavior. |

## 5. SmartFit gaps ranked by value

### P0 — Decide the product direction and correct the readiness promise

The nearest SmartFit analogue to Sonar Recovery is `readiness()` in `packages/core/src/training.ts`. It uses recent training volume/load, days since a high-intensity session, and planned rest; it does not use sleep or wearable vitals. The UI calls the surface “readiness,” and its numeric score/drivers are hidden behind a Pro gate even though paid Pro is not live.

**Immediate trust fix:** label this **Training readiness** or **Training load**, explain the signals it uses, and show “not enough training history” honestly. Do not imply biometric or medical recovery.

**Strategic gate:** wearable/health-data sync is P0 **only if** SmartFit chooses to compete as a broader health-tracking product. If SmartFit remains a training/gym product, keep health integrations as a deliberate optional roadmap item rather than expanding scope by imitation.

### P1 — Build a narrow, optional health-data foundation (if approved)

Start with the operating-system health stores before attempting dozens of provider integrations:

- iOS: evaluate a native HealthKit adapter.
- Android: evaluate Health Connect for target Android versions and Expo/native runtime constraints.
- Later: add direct providers only where users ask and SmartFit can support their authorization/sync lifecycle.

This is more than adding a “Connect” button. The first release needs permission rationale, source selection, sync state/last-sync time, disconnect/revocation, duplicate handling, timezone-safe timestamps, retry/error states, and a clear distinction between user-entered and imported data.

### P1 — Model signals before inventing more scores

Add a versioned, owner-scoped health-sample model with metric type, value/unit, observed timestamp, timezone, source/provider, source record ID for deduplication, and available quality/completeness metadata. Keep imported samples distinct from hand-entered workout/nutrition records where appropriate. Ensure export, account deletion, local persistence, and cloud rules cover the new data.

For a first slice, consider **sleep duration/stages, steps, workouts, resting heart rate, and HRV** where sources provide them. Add respiratory rate, blood oxygen, temperature, glucose, and other signals only after measuring availability and demand. Missing data must stay missing; do not synthesize a healthy score from no inputs.

### P1 — Extend the existing readiness feature with measured, explainable recovery

Once reliable signals arrive, show separate **Training Load**, **Sleep**, and **Recovery** surfaces. Establish user-specific baselines over enough history; display the data freshness, contributing signals, and why a score is unavailable. Explain that a score is a trend aid—not a diagnosis—and do not compare a training-only heuristic with a biometric score.

### P1/P2 — Connect coaching and trends after data quality is solved

SmartFit's `buildCoachContext()` currently summarizes training plan, weekly workouts, goals, streak, recent sessions, and latest weight—not meals, sleep, or physiological metrics. Extend only after those records are trustworthy. Send small, time-bounded summaries rather than raw continuous samples, make provider use visible, and let the user choose which categories leave the device.

A first useful insight could be: “How did my sleep and training load change this week?” Include dates and source coverage, and label correlations as non-causal. Avoid unsupported injury, sickness, or treatment advice.

### P2 — Close habit and product-surface gaps

- Add opt-in local/push reminders for scheduled workouts, with quiet hours and easy disablement.
- Add a weekly review that combines training, body, and nutrition data the user actually logged.
- Add a Trends workspace for multi-week comparisons; add correlation views only when metrics have enough aligned observations.
- After native health sync and mobile parity are proven, evaluate widgets, watch surfaces, and a broader provider catalog.
- Consider peer benchmarks only after defining an explicit privacy/consent model and validating that users want comparison features.
- If goals expand beyond training, use typed goals for measurable metrics such as sleep duration, steps, or protein—not arbitrary scores with unclear data quality.

### P3 — Defer clinical/high-governance parity

Personalized screening/vaccine recommendations, sickness detection, and any biological-age claim require clinical expertise, evidence review, legal/privacy review, careful uncertainty communication, and an ongoing safety process. They are not quick AI features. Sonar's metric catalog includes VO₂ max, but that alone does not establish a biological-age score; do not conflate the two.

Do not advertise Pro-only health features as purchasable until SmartFit's server-verified billing and entitlement lifecycle is live; current repository documentation describes billing as a preview.

## 6. Recommended first milestone and acceptance criteria

A sensible “Sonar-inspired, still SmartFit” milestone is **connected recovery context**, not a full health super-app:

1. A user can optionally connect a supported native health source and select data permissions; declining does not block onboarding or workout logging.
2. The user can see connection state, last sync, failures, and how to revoke access. Disconnecting stops future imports.
3. Imported workout records do not double-count manual or provider-imported sessions; timestamps respect source timezone and daylight-saving changes.
4. SmartFit can show an honest sleep/training/recovery view. Any score identifies its inputs/history window and has useful empty/insufficient-data states.
5. Imported health data is included in export/deletion, kept owner-scoped in local/cloud storage, and never shown to a gym or trainer without separate, explicit sharing consent.
6. Any AI feature that uses imported signals discloses the categories being sent and sends a bounded summary only. No diagnosis or treatment advice is presented.
7. Test on real supported iOS and Android devices: permission denied/re-granted, source disconnected, no network, stale data, duplicate sync, timezone boundaries, account change, export, and delete.

## 7. Bottom line

**What SmartFit is missing most versus Sonar is not another workout logger; it is automatic health-data collection and interpretation.** SmartFit already has training-derived readiness and real meal-scan paths, so those should be described accurately. The largest strategic opportunity—if health aggregation is a chosen direction—is to connect a small set of trustworthy signals to SmartFit's existing training, nutrition, and coaching flows while preserving its local-first option.

### Sources

**Sonar public sources**

- [1](https://apps.apple.com/us/app/sonar-health-performance/id1595073849) — consumer features, platform surfaces, and version notes.
- [2](https://docs.sonarhealth.co/health-scores/) — score definitions, inputs, scales, and API behavior.
- [3](https://docs.sonarhealth.co/device-connectivity/) — provider catalog and cloud/native connection distinction.
- [4](https://docs.sonarhealth.co/data-model/) — normalized data model, deduplication, timezones, and resources.
- [5](https://docs.sonarhealth.co/consolidation/) — metric consolidation rules and asynchronous reconsolidation.
- [6](https://docs.sonarhealth.co/mobile-sdk/) — native SDK direction, platform status, sync, and permissions.
- [7](https://docs.sonarhealth.co/data-catalog/) — public metric and score identifiers/units.
- [8](https://play.google.com/store/apps/details?id=com.sonarapp.health&hl=en) — Google Play consumer listing.
- [9](https://www.sonarhealth.co/) — public Sonar product website.

**SmartFit source paths reviewed**

- `packages/core/src/types.ts` — `FitnessState`, `WorkoutSession`, `BodyLog`, `MealLog`, and goal types.
- `packages/core/src/training.ts` (`readiness`) and `src/components/dashboard/readiness-card.tsx` — current training-derived readiness and UI gate.
- `src/lib/ai-coach.ts` (`buildCoachContext`) — context sent to the optional AI provider.
- `src/components/dashboard/screens/fuel-screen.tsx`, `src/components/dashboard/modals/MealModal.tsx`, and `src/app/api/meal-scan/route.ts` — nutrition/logging/scan paths.
- `apps/mobile/src/app/` and `apps/mobile/src/lib/store.tsx` — current Expo routes and AsyncStorage persistence.
- `docs/mvp-audit-2026-09-11.md`, `docs/feature-expansion-plan.md`, and `docs/persona-workflows.md` — current release, notification, native, and integration limits.

## 8. First-batch screenshot functional and UI/UX audit

**Evidence:** 13 user-provided iPhone screenshots, apparently covering profile basics/height, goal selection, optional health-history intake, the Sonar Pro offer, a notification pre-prompt, and first-run Home sections. This is a visual review of the displayed states, not interaction testing. The second signup step and the device-connection, Trends, Activity, AI response, and settings flows were not shown.

### Journey reconstructed from the screenshots

1. **Profile basics:** select metric/kg units, enter height, optionally enter weight/country; the height field opens a full-screen numeric keypad with a visible unit and Save button.
2. **Goals:** choose from health, weight, stress, energy/productivity, athletic-performance, and mindfulness goals. The shown state allows multiple selections.
3. **Additional health context:** add medications, medical conditions, family history, or allergies, then Finish.
4. **Monetization:** a Sonar Pro sheet promotes recovery/strain/sleep/nutrition analysis, multi-device sync, widgets, Apple Watch, benchmarks, AI, metrics, and historical data. It shows `$49.99 per year`, “Start free trial,” See Plans, Redeem, Restore, and a close control; the screenshots do not show trial duration or first renewal date.
5. **First app entry:** welcome/splash, then a personalized-notifications pre-prompt with Enable Notifications / Not Now.
6. **Home:** score rings, a strain target, energy/stress, sleep stages, training/cardio load, recent activity, nutrition/glucose, daily goals, and vital trends. Some cards have a sync CTA; others show locks and/or pending data.

### Findings and recommendations

| Priority | Screenshot evidence | Functional / UX risk | Recommended change |
|---|---|---|---|
| **High — data truth** | Home shows Recovery, Sleep, and Nutrition as `0%`; sleep stages, time awake, calories, and exercise minutes also appear as zero. Elsewhere the same first-run experience says “Pending data” and “Nothing to see here. Try syncing new workouts.” | A user can read “0” as a measured poor result rather than no connected data. This is especially sensitive for health scores. | Distinguish `Loading`, `No source connected`, `Permission missing`, `Sync pending`, `Insufficient history`, and a true measured zero. Use `—` / “No data yet” instead of a score of `0%` until there is valid input; pair the empty state with Connect/Sync. |
| **High — entitlement vs. data state** | Energy & Stress, Cardio Load, and vital cards show lock icons; some of those same areas also show “Pending data.” | The screen does not clearly tell users whether they need Pro, a connected source, permission, or time for sync. A lock can make a missing-data problem look like a paywall, or vice versa. | Separate the states and labels: e.g. “Connect a source” / “Waiting for data” versus “Pro feature.” Keep basic source and sync status visible on locked cards, and make the action clear. |
| **High — sensitive onboarding** | “Anything else?” invites medication, condition, family-history, and allergy details for “more precise recommendations and insights.” | These are sensitive health details. The screenshot does not show how each item is used, whether it is optional, who can access it, or whether it leaves the device. | Before entry, state the purpose and whether each field is optional; link to a concise privacy explanation; disclose any AI/provider use and how to edit/delete the profile later. Keep this step skippable and avoid implying diagnosis. |
| **High — trial clarity / timing** | Pro is shown immediately after personal/health onboarding and before a visible personalized result. `$49.99 per year` and “Start free trial” appear together, but the captured offer does not show trial length or when billing starts. | This creates a paywall before the user has seen value, and users may not understand the trial-to-paid transition from the captured screen. A close icon is present, but the free continuation path is not shown. | Show the trial duration, first charge date/amount, renewal cadence, and cancellation path beside the CTA; state what remains free. Consider offering the trial after the first useful dashboard insight instead of interrupting signup. Verify the exact terms in the native purchase sheet too. |
| **Medium — score guidance** | Home says “Keep today’s strain in the range: 10–30%.” The screenshots do not explain what the percentage is a percentage *of*, why that range applies today, or what inputs produced it. | Even an actionable recommendation can feel arbitrary when its scale, source, freshness, and rationale are hidden. | Add an info detail with the score/target definition, units, contributing data, last update, and reason for today's recommendation. If there is not enough source data, label the range as a generic/default target rather than personalized guidance. |
| **Medium — notifications** | The pre-prompt says “important changes in your overall health” and that preferences are in Profile; it offers Enable and Not Now. | The consent framing is good, but the types, frequency, examples, and quiet-hour controls are not visible. Asking before the user has seen a health insight may reduce opt-in. | Keep the two-choice pre-prompt, give concrete examples, explain frequency/control, and ask after the first relevant value moment. Make notification categories and quiet hours easy to change later. |
| **Medium — number formatting** | Daily steps render as `3.316` while the surrounding labels are English. | Depending on locale, that can mean 3,316 or 3.316 steps. | Format counts using the selected locale and avoid decimal precision for integer step counts; ensure the language and number-format locale are intentionally aligned. |
| **Medium — loading feedback** | A spinner is visible near the top of the first Home view; the splash is a static “Welcome to Sonar” screen. | A transient loading state is normal, but a long spinner or blank splash can look frozen. The screenshots cannot establish duration or recovery behavior. | Show what is loading, transition to a useful cached/empty state, and provide a retry/error state if sync or dashboard loading stalls. Do not block the rest of Home on one metric provider. |

### What is working well visually

- The onboarding has a clear sequence, short prompts, back/skip affordances, and large goal-selection targets. Selected goals are visually distinct.
- Height entry makes the unit explicit, uses a thumb-friendly keypad, and gives a clear Save action. The basics screen says users may share only what they prefer.
- The notification pre-prompt offers a clear decline path; the Pro sheet exposes Restore/Redeem and a dismiss control.
- Home groups the product's core concepts into scannable sections and includes a persistent Home/Trends/Activity/Sonar AI navigation bar plus a prominent add button.
- “Sync now,” “Edit Home,” and “Typical Range” are useful affordances. Keep them, but ensure they do not contradict the zero/pending/locked state of the data.
- The dark visual system and green primary actions are consistent across the submitted screens. Contrast, screen-reader names, dynamic type, and keyboard behavior cannot be certified from screenshots alone.

### Next screenshots that would complete the audit

When convenient, please send screenshots of:

1. **Connect devices/integrations:** provider list, permission explanation/system sheet, connected-source status, last sync, failed sync, and disconnect.
2. **Trends and score details:** Recovery/Sleep/Strain detail, score explanation, time-range controls, compare/correlation, and a populated-data example.
3. **Activity and a workout detail:** heart-rate zones/cardio load, workout source attribution, and the full sync flow.
4. **Sonar AI:** a question/answer, saved-memory controls, voice entry, and the privacy/provider disclosure.
5. **Profile/settings:** notification categories/quiet hours, health-data permissions/deletion, privacy controls, and subscription management/renewal details.

Redact names, email addresses, and personal health values if you prefer. These additional pages will let me replace the current “appears to / public listing claims” caveats with a screen-by-screen interaction audit where the screenshots provide evidence.
