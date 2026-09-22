# SmartFit functional expansion — all personas

## Source of truth

- User specification: `docs/muscle_monster_complete_functional_requirements.md`, added in commit `c2fc5f7`.
- Baseline application: `7c77a18` (session-aware landing), including the admin/studio upgrade `4df979e`.
- Scope: the specification's 98 sections, including 101 named `FR-*` requirements, plus existing SmartFit tenant workflows.
- This document is an **initial source-code gap assessment and implementation backlog**, not a claim that the specification has been implemented or release-tested.

## Architecture and product constraints

1. Extend the current Next.js + Firebase/Firestore + Expo + `@smartfit/core` architecture. The specification calls its PostgreSQL/backend choices a possible architecture; it does not require replacing a working tenant system.
2. Keep gym-owned records in the existing tenant architecture. Do not restore the retired personal custom-gym UI or create a parallel gym registry.
3. Personal training records remain private. A gym relationship or support role does not grant unrestricted access to a member's personal workout/body/nutrition data. Use explicit assignments, consent and limited aggregates where appropriate.
4. Subscription entitlements and authorization roles are separate. Premium membership must never grant administrative permissions.
5. Keep three distinct money flows: a member's personal app subscription, a member's gym membership, and a gym's platform contract. Existing cash/transfer recording is not verified app-store subscription billing.
6. All new roles require server/API and Firestore enforcement, not just navigation visibility. Existing persona-specific login homes and explicit `next`/`gym` intents must keep working.
7. Preserve local/on-device mode as an explicit product mode. The specification's restrictions on unauthenticated cloud guests must not silently delete or disable existing on-device data.
8. Keep signup/onboarding independent of platform-data availability. A failed gym-list lookup must not make signup fail.
9. Retain historical exercise/workout snapshots when content changes. Catalog IDs, publication revisions and personal execution records serve different purposes.
10. A provider integration is not complete because a toggle exists. Purchase verification, notification delivery, health permissions and wearable sync need real integrations and platform verification.

## Persona coverage

| Persona | Current foundation | Required expansion | Authorization boundary |
| --- | --- | --- | --- |
| Visitor/prospect | Marketing, sign-in, tenant directory/storefront, gym application/join journeys | Public exercise/workout previews, contextual registration, clear free/premium explanations | Published public content only; no cloud private records |
| Free member | Dashboard, schedules, runner, goals, body/weight logs, exercise library, bookings, progress | Complete assessment/preferences, constraint-based plan generation, workout/favorites library, reminders, support | Own account and own memberships; product-configured free limits |
| Premium member | Pro presentation and subscription stamp exist | Verified entitlements, restore, expiry/refund/grace handling, advanced features | Own account; verified feature access, not a new privileged role |
| Gym owner | Console, roster, timetable, payments, membership tiers, storefront studio, revenue | Scoped content/plan assignments, challenges, member follow-up, operational reporting and staff capabilities | Owned tenant; private member data only when explicitly shared |
| Gym staff | Front desk, attendance, roster, booking operations, payment collection | Clear daily workload, permitted follow-up/support tasks, narrowly scoped content/assignment actions | Assigned tenant and explicit capabilities; no automatic owner/financial rights |
| Trainer/coach | Instructor references exist; no distinct trainer role in current RBAC | Assigned members/classes, workout/plan assignment, feedback and shared-progress review | Assignment-scoped tenant access; not an alias for owner or all staff |
| Platform administrator | Gyms, applications, tenant plans/contracts, platform revenue, audit and diagnostics | Account management, editorial oversight, platform configuration, support oversight, privacy-conscious product analytics | Verified platform authority; all sensitive operations audited |
| Content manager | No distinct role or editorial workspace | Versioned exercise/workout/plan/challenge editing, media metadata and publication workflow | Editorial permissions only; no financial or unrestricted account access |
| Support agent | No distinct role or ticket workspace | Assigned ticket inbox, replies, status transitions and minimal account/subscription diagnostics | Ticket/support scope; no credentials, raw payment details or arbitrary fitness-history access |

Current role definitions are in `packages/core/src/rbac.ts`; only member, platform-admin, gym-owner and gym-staff are currently declared. Content manager, support agent and trainer are **new work**, not existing features hidden behind a missing menu.

## Domain-level gap assessment

“Partial” means useful implementation exists but the full specification is not yet satisfied. It does not mean every listed sub-requirement has passed acceptance testing.

| Specification | Current evidence | Initial assessment / remaining work |
| --- | --- | --- |
| §§5–8: roles, navigation, auth | `rbac.ts`, `firebase/auth-context.tsx`, `/login`, `/api/auth/home`, tenant/admin shells | Partial. Preserve existing auth/session/deletion; add scoped personas, Apple sign-in where supported, auditable consent and native account parity. |
| §9, §35: onboarding/profile | `src/components/onboarding/`, `UserProfile` in core types, profile screen | Partial. Full goal/experience/equipment/location/duration/frequency/target-muscle/time-zone preferences are not represented as one validated personalization model. |
| §10: fitness assessment | Existing training/progress utilities are not an assessment workflow | New assessment input/result/history, optional skip, non-medical baseline and reassessment policy. |
| §11, §58: goals/calculations | Core goal metrics, `fitness.ts`, goals screen, training volume/progression helpers | Partial. Primary/secondary fitness intent, target-date/strength goals, decreasing-target and baseline handling, plan-review triggers need explicit coverage. |
| §12: exercise library | Core exercise catalogs, extended catalog, exercise picker/detail/library | Partial. Preserve current discovery/media/instructions; add governed metadata, stable published revisions, favorites and constraint-aware alternatives. |
| §13, §19, §34: workout library/custom workouts/favorites | Scheduled exercise routines and session editing; no general workout/plan favorites entities in `FitnessState` | Partial. Add first-class reusable templates, duplicate/edit/archive, discovery and per-account favorites without abusing gym documents. |
| §§14–15, §18, §§48–49: generator/plans/adaptation | `suggestions.ts`, `program.ts`, `training.ts`, local/optional AI coach | Partial. Coaching text and suggested routines are not full constraint-based generation. Add explicit exclusion/equipment/difficulty/recovery rules, plan versions and user-approved adaptations. |
| §§16–17, §57: runner/set logging/summary | `session-runner-modal.tsx`, training helpers, set kinds/RPE, history records | Partial. Audit every player requirement, durable resume, timestamps, replacement/skip semantics, idempotent completion and exact summary derivation before claiming compliance. |
| §§20–23: history/body/progress | Dashboard progress/body screens, `BodyLog`, core volume/PR/readiness calculations | Partial. Expand filters/measurements and model historical snapshots; ensure edits/deletions update derived totals without losing units. |
| §24: calendar | Recurring schedule and planning UI | Partial. Explicit plan instances, missed/rescheduled status and rest-day semantics need a unified model across web/mobile. |
| §25, §44: notifications | No notification domain/dispatch API in current route inventory | New preferences, time zones, quiet hours, opt-in push/in-app inbox, segmented operator workflow and idempotent delivery jobs. |
| §§26–29: streaks/challenges/achievements/motivation | Rest-aware streak/achievement calculations and encouragement already exist in core/dashboard | Partial. Challenges/participation are new; validate durable unlock dates and challenge rules. Keep messaging non-shaming. |
| §§30–32: health/wearables/voice | Expo app exists; its store currently uses local AsyncStorage | Native/provider work. Add permission-gated adapters, provenance/deduplication, supported-device UI and real-device verification. Voice guidance requires actual supported runtime integration. |
| §33: global search | Surface-specific search exists | Partial. Unified normalized search over accessible published exercises/workouts/plans/challenges still needed. |
| §§36–38, §75: subscriptions/payments/gating | `pro.ts`, billing adapters, gym purchases and platform payment records | Partial/provider-dependent. Verified personal subscription lifecycle, app-store products, restore, refunds/expiry and server entitlements must not be replaced with local flags. |
| §39: account/product administration | Current admin console manages tenants and tenant contracts | Partial. Tenant totals are not DAU, member-account administration, trial conversion or consumer subscription churn. Add privacy-conscious metrics and scoped user operations. |
| §§40–43, §67: editorial CMS | Built-in catalog and tenant class/plan editing | New versioned editorial lifecycle for exercises, workout templates, training plans and challenges. Tenant membership pricing tiers are not training plans. |
| §45: support | No support-ticket API/workspace in current route inventory | New account/tenant-linked tickets, replies, state machine, redacted diagnostics and least-privilege support workspace. |
| §§46–47, §94: product analytics | `telemetry.tsx` reports optional crashes/web vitals; admin shows tenant snapshots | Partial. Neither is a retention/conversion event pipeline. Define minimal events, consent/retention, aggregation, denominators and historical report windows. |
| §§50–52, §70: safety/offline/sync | Safety-aware coach prompts, local persistence, write queue and PWA foundations | Partial. Validate durable active sessions, idempotent completion, conflict handling and cached published content across web/native. |
| §§53–54: entities/business rules | Current typed core state and tenant entities | Partial. Additive migrations required; retain legacy accounts and enforce business rules server-side where data crosses trust boundaries. |
| §§60–62, §90: accessibility/localization | Accessible component primitives, adaptive colors, English copy and unit conversion | Partial. Locale dictionaries, French/Arabic translations, RTL, pluralization, localized content revisions and native accessibility verification remain. |
| §§63–66, §§87–89, §91: errors/security/privacy/audit/export | Existing guards/rules, admin audit, export/deletion, diagnostic cards | Partial. Extend controls to new entities/personas, support redaction, consent, retention/anonymization and full-domain export. Never infer permission from a rendered button. |
| §68: media | Images/exercise media and storefront HTTPS URL fields | Partial. Managed uploads, ownership/licensing, validation, captions, variants/CDN and storage quotas/rules remain. |
| §69, §§71–74, §92–93: performance/testing/acceptance | Unit, rules and browser suites exist | Existing tests cover existing behavior only. Extend traceability and require cross-persona, negative authorization, offline and native/provider tests. |
| §§84–86: runtime product configuration/flags/permissions | Tenant-plan config and capability matrix | Partial. Add validated, audited product policy and rollout targeting. Do not confuse deployment environment switches with an operator-managed rollout system. |
| §§76–83, §§95–98: scope/phases/architecture/flows | Existing app is a reusable foundation | Follow explicit feature acceptance; do not represent the optional recommended stack or URL examples as mandatory rewrites. Track P0/P1/P2 separately. |

## Delivery order

Each milestone must include real persistence, corresponding consumer/operator UI, loading/error/empty states, authorized APIs/rules, and tests. This is sequencing, not scope removal.

### 1. Persona and data foundations — implemented slice, validation in progress

- [x] Formalize trainer, content-manager and support-agent capabilities and role resolution.
- [x] Add dedicated guarded homes while preserving existing explicit redirect intents.
- [x] Define global vs tenant editorial scope and trainer assignments.
- [x] Add versioned personalization preferences with backward-compatible parsing and account sync.
- [ ] Add server/rules negative tests: support cannot bill/publish, editors cannot access private user records, trainers cannot cross tenants/assignments, members cannot mint entitlements.
- [x] Define public guest previews separately from on-device mode.

### 2. Complete the member training loop

- [ ] Persist complete onboarding preferences and optional assessment.
- [ ] Build deterministic beginner plan generation with explicit constraints and explanations.
- [ ] Add first-class reusable workouts/favorites and plan lifecycle/calendar instances.
- [ ] Close player/set logging/resume/completion gaps; retain historical revision snapshots.
- [ ] Extend history, measurements and progress with canonical units and correct goal math.
- [ ] Expose permitted plan assignment and shared-progress review to trainers/owners, not unrestricted personal data.
- [ ] Bring the Expo surfaces through the same shared-domain acceptance tests; web completion is not native completion.

### 3. Content and platform operations

- [ ] Versioned exercise, workout, plan and challenge CMS with draft/review/published/archived lifecycle.
- [ ] Published content feeds discovery and generators; archived revisions remain usable in history.
- [ ] Admin user operations and editorial oversight; content-manager workspace without money access.
- [ ] Media management with validated uploads and storage rules.
- [ ] Audited runtime configuration and entitlements/feature-flag definitions.

### 4. Engagement and support across personas

- [ ] Challenges/participation and durable achievement unlocks.
- [ ] Notification preferences, in-app inbox and scheduled delivery respecting consent/time zones/quiet hours.
- [x] User-facing support submission, operator inbox, replies and safe status transitions.
- [ ] Owner/staff workflows and scoped communication; support sees only the data necessary to resolve tickets.
- [ ] Privacy-conscious product analytics rather than invented history or all-time labels on limited snapshots.

### 5. Commercial and native integrations

- [ ] Verified subscription ledger and webhook/receipt idempotency.
- [ ] App Store/Play Billing purchase/restore and expiry/refund/grace/retry behavior.
- [ ] HealthKit/Health Connect adapters, user-visible sync status and revocation.
- [ ] Supported voice guidance and wearable flows with platform capability detection.
- [ ] English/French/Arabic translations and RTL across member/operator/native surfaces.

### 6. Release validation and expansion

- [ ] Register → personalize → generate → execute → complete → progress on web and target native devices.
- [ ] Offline execution, resume, reconnection and duplicate-completion checks.
- [ ] Cross-tenant and cross-persona permission tests, privacy export/deletion and retained history.
- [ ] Provider-backed purchases/restore/expiry/refunds and notification delivery verified in appropriate sandboxes.
- [ ] Accessibility, mobile performance, localized consent/legal copy and published content review.
- [ ] Scope P2 community/marketplace/live coaching/computer-vision work explicitly; do not disguise links or toggles as these systems.

## Integration prerequisites, not hidden assumptions

Implementation can proceed on domain logic and sandbox adapters without secrets in chat. Production activation additionally needs configured store products/provider accounts, notification credentials, consent/privacy decisions, licensed media, reviewed translations and supported-device testing. Unsupported or unconfigured integrations must show an honest unavailable state and must not mint fake purchases, delivery receipts, health data or completed workouts.

## Current milestone status

- [x] Locate and read the committed requirements document.
- [x] Reconcile it with the existing code and identify all personas, including newly required roles.
- [x] Record domain gaps and dependency-ordered delivery milestones.
- [ ] Implement milestone 1 and validate authorization/data migrations.

Runtime work now exists: see [implemented persona workflows](persona-workflows.md) for shipped routes, data boundaries, verification and remaining release gates. The complete FRS is **not** implemented; unchecked milestones are still outstanding.
