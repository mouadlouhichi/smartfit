# SmartFit — Production-Readiness Audit

**Date:** 2026-09-08 · **Commit:** `4384ce1` (branch `arena/01a07db2-smartfit`)
**Scope:** web app (`src/`), mobile app (`apps/mobile/`), shared domain (`packages/core/`),
Firebase infra, CI/CD, and marketing-claim parity.
**Predecessor:** `docs/mvp-audit.md` (2026-09-07) — this audit re-verifies every finding there
against the current tree and then assesses what remains before real users.

---

## 0. Verdict

**The web app is functionally MVP-complete and unusually well hardened for its size.**
Every P0 from the previous audit is genuinely fixed — not patched over — and the fixes are
tested (85 unit tests, all passing). The remaining distance to "production ready" is no
longer about features; it is about **operations and last-mile correctness**:

1. **Two real functional bugs** remain in the Progress screen and the cloud backup-import path.
2. **The Firebase backend has never been deployable from the repo** — there is no
   `firebase.json`, so the documented `firebase deploy --only firestore:rules,firestore:indexes`
   cannot run. If rules/indexes were only ever applied by hand (or never), production data
   access is undefined.
3. **Zero observability and zero abuse protection** — no error reporting, no App Check, no
   budget alarms. A production incident today would be invisible until users complain.
4. **No end-to-end test coverage** — the CI would not catch a broken dashboard.
5. **The mobile app is a local-only prototype** — no auth, no sync, no onboarding. It must be
   explicitly descoped from launch (it currently isn't, in README/marketing structure).

**Readiness by area**

| Area | State | Production-ready? |
| --- | --- | --- |
| Domain logic (`@smartfit/core`) | 57 tests, pure, shared, validated state parser | ✅ Yes |
| Web build / typecheck / lint / format | All clean; 18 static routes; 102 kB shared JS | ✅ Yes |
| Data lifecycle (create/edit/delete everything) | Sessions, goals, schedule, body, categories all complete | ✅ Yes |
| Cloud sync correctness | Owner-bound snapshots, durable write queue, retry, sync banner | ✅ Yes (2 bugs below) |
| Offline (PWA) | Real SW + manifest + icons + offline page; Firestore persistent cache | ✅ Yes |
| Auth (email/Google/reset/delete account) | Implemented, friendly errors, enumeration-safe reset | ⚠️ No email verification; password re-auth dead-end |
| Onboarding + guards | Enforced on every dashboard route via `AuthGate` | ✅ Yes |
| Privacy / terms / SEO / social cards | Real pages, absolute OG URLs, robots + sitemap | ✅ Yes |
| Error handling | `error.tsx`, `global-error.tsx`, `loading.tsx`, validated hydration | ✅ Yes |
| Firebase deployment story | **No `firebase.json`; rules/indexes not deployable from repo** | ❌ No |
| Abuse protection / cost control | **No App Check, no rules-side validation, no billing alarms** | ❌ No |
| Observability | **No error reporting, no uptime, no web vitals** | ❌ No |
| E2E / component tests | **None** (unit tests only; mobile has zero tests) | ❌ No |
| Mobile app | Local-only companion; data siloed; can't see cloud data | ❌ No (descope or invest) |

---

## 1. What was verified by execution (not just reading)

Against a clean install (pnpm 9.15.9, Node 22):

```
pnpm typecheck                        ✅ clean
pnpm lint (eslint)                    ✅ clean
pnpm format:check (prettier)          ✅ clean
pnpm test (web lib)                   ✅ 28/28
pnpm --filter @smartfit/core test     ✅ 57/57
pnpm --filter @smartfit/mobile typecheck ✅ clean
pnpm build                            ✅ 18 routes, all static
```

Live smoke test of the production server (`next start`):

- All routes 200: `/`, `/login`, `/onboarding`, `/dashboard{,/plan,/goals,/progress,/body,/profile,/coach}`,
  `/privacy`, `/terms`, `/offline`; unknown path → custom 404.
- PWA chain intact: `/manifest.webmanifest`, `/sw.js`, `/favicon.ico`, `/icon.svg`, `/og.png`,
  `/apple-touch-icon.png`, `/icons/{icon-192,icon-512,maskable-512}.png` — all 200; every file
  the SW precaches exists; manifest shortcut `/dashboard?log=1` is handled by the overview screen.
- `robots.txt` disallows the app routes and points at an absolute sitemap; OG/canonical URLs are
  absolute via `metadataBase`.
- Security headers present: `X-Content-Type-Options`, `X-Frame-Options` (prod),
  `Referrer-Policy`, `Permissions-Policy`.

## 2. Previous audit findings — all P0s and nearly all P1s verified fixed

| `mvp-audit.md` finding | Status now (verified in code/tests) |
| --- | --- |
| 2.1 Cross-account leak on sign-out | ✅ Fixed — snapshots carry their `owner`; per-account cache keys (`smartfit.cache.{uid}`); `signOutAndForget` clears both keys. Covered by `tests/hydration.test.ts`. |
| 2.2 Fire-and-forget cloud writes | ✅ Fixed — durable `WriteQueue` (ordered, collapsing, exponential backoff, online-flush, permission errors fail fast), `SyncBanner` + retry affordance, per-account offline mirror. Covered by `tests/write-queue.test.ts`. |
| 2.3 Side effects inside `setState` updater | ✅ Fixed — remote writes enqueued via `queueMicrotask` outside the updater; StrictMode-safe. |
| 2.4 No local→cloud migration | ✅ Fixed — `MigrationPrompt` offers import/discard on first sign-in to an empty account; import validates via `parseState`; discard actually erases. |
| 2.5 No edit/delete on web | ✅ Fixed — `SessionDetailModal` (view → edit → delete), edit+delete in Goal/Schedule/Workout/Body/Category modals. |
| 2.6 Captured data never displayed | ✅ Fixed — exercises/sets/notes rendered in session detail; `weightUnit`/`distanceUnit` settable in Profile + Onboarding and honoured everywhere (canonical-storage model in `units.ts`); `weeklyRestDays` powers the streak; `weekStartsOn` is a real preference. |
| 2.7 No `public/` dir | ✅ Fixed — full icon set, manifest with shortcuts, OG image, `robots.ts`, `sitemap.ts`, `metadataBase`. |
| 2.8 Onboarding only enforced on `/dashboard` | ✅ Fixed — `AuthGate` in `dashboard/layout.tsx` guards auth **and** onboarding on every route, with skeleton instead of flash. |
| 3.1 Two week definitions | ✅ Fixed — single `weekStartOf(state)` used by fitness, goals and coach. |
| 3.2 Fabricated coach rings | ✅ Fixed — chips carry real calorie-share percentages. |
| 3.3 Dead mic buttons | ✅ Removed. |
| 3.4 Duplicated coach engines | ✅ Fixed — one `answerCoach` in core, unit-tested (`coach.test.ts`). |
| 3.5 Hardcoded dashboard targets | ✅ Fixed **on Overview** (`targetsForDays`: goals win, plan-derived fallback, honest hint when generic). ❌ **Still broken on Progress** — see 4.1. |
| 3.6 Plan never connects to log | ✅ Fixed — `todaysAgenda` + "On today's plan" with one-tap prefill ("Log it"), `scheduleId` linkage, done state. |
| 3.7 Streak semantics | ✅ Fixed — rest-day-aware `currentStreak` (uses `weeklyRestDays`) + `weeklyStreak` used by the coach. |
| 3.8 Unbounded Firestore reads | ⚠️ Partially — initial load bounded (400 sessions, 200 body logs) with the declared composite index; `loadMoreSessions` exists but **no UI calls it** — see 4.2. |
| 3.9 No cloud offline support | ✅ Fixed — `persistentLocalCache` + multi-tab manager, IndexedDB write replay, per-account localStorage fallback when the load fails. |
| 3.10 No account deletion | ✅ Fixed — data wipe → `deleteUser`, Google re-auth via popup, enumeration-safe messages. Password-user gap — see 4.5. |
| 3.11 No error boundaries / unvalidated hydration | ✅ Fixed — `error.tsx`, `global-error.tsx`, `loading.tsx`; every hydration path goes through the defensive `parseState` normaliser (hand-rolled, not zod — fine, and tested). |
| 3.12 Mobile not shippable | ⚠️ Partially — brand colours/icon fixed, date chips added, storage validated; still **no auth/cloud/onboarding** — see 4.7. |
| P2 items (dead seed flag, seed in bundle, stale README, no ESLint/Prettier/hooks, footer links, deleted-category sessions, weight-blind calories, a11y labels) | ✅ All fixed — seed moved to `@smartfit/core/seed` subpath (out of app bundles), README accurate, ESLint+Prettier+pre-commit hook+CI lint job, real `/privacy` `/terms` linked from footer, `UNKNOWN_CATEGORY` fallback + usage check before category delete, MET formula personalised by latest body weight, labels/aria associated. |
| §5 marketing claims | ✅ Mostly honest now — PWA claim is backed by code; coach is described as "on-device coach, answers from your own data"; pricing is a single free tier ($0/forever); privacy page accurately describes both modes. Remaining nits — see 6. |

---

## 3. New issues introduced or uncovered by this audit

Nothing found in the new sync/hydration/migration machinery: the owner-bound snapshot design is
sound and the queue semantics (collapse-by-key, fail-fast on `permission-denied`, resume-from-head)
are correct and tested. The issues below are the leftovers.

## 4. P1 — fix before launch

### 4.1 Progress screen: hardcoded targets and unit-blind distance (functional bug)

`src/components/dashboard/screens/progress-screen.tsx:68-71` invents targets
(`goalMin` 60/300/1200, `goalCal` 500/2500/10000) and the distance ring at `:113-122` divides by
hardcoded 5/25/100 km — exactly the pattern that was fixed on Overview with `targetsForDays()`.
Worse, `formatDistance(rangeAgg.distance ?? 0)` at `:121` and `:150` omits the unit argument, so
**miles users see kilometre numbers labelled as their distance** on both the ring and the stat
card. Overview passes `state.profile.distanceUnit` correctly; Progress never reads it.

**Fix:** derive all three rings from `targetsForDays(state, days)` (it already returns
`minutes`/`calories`/`distanceKm` scaled to the window) and pass `state.profile.distanceUnit`
to both `formatDistance` calls (converting `rangeAgg.distance` with `fromKm` for display).

### 4.2 Session history pagination is dead code (silent truncation at 400)

`loadMoreSessions()` (`src/lib/firebase/repo.ts:105`) is exported, indexed and tested in shape —
and **called by nothing**. Cloud users who pass `INITIAL_SESSION_LIMIT = 400` sessions (~16 months
at 6×/week, less for double-days):

- can't see or edit older workouts (the Plan log and Recent activity just stop),
- get **wrong aggregates** — `totalWorkouts`, "all-time" category mix, and long streaks are
  computed from the truncated in-memory window,
- export a JSON backup that silently omits the unloaded tail.

Local mode is unaffected (everything lives in memory), which makes this a slow-burn cloud-only bug.

**Fix (smallest credible):** a "Load earlier workouts" button in the Plan log that pages via
`loadMoreSessions` with the oldest loaded `(date, createdAt)` cursor and appends; disable export
label honestly ("last 400 sessions") until fully paged, or page-to-complete before export.

### 4.3 Cloud "Import backup" merges instead of replacing (data-integrity bug)

Profile → Import backup promises: *"Replace everything … your current data will be overwritten."*
In cloud mode `replaceState()` → `importState()` only performs `batch.set` for the records **in the
file**; remote documents absent from the backup are never deleted. After the next reload the
"deleted" records reappear — the exact opposite of what the confirm dialog said. (In local mode it
is a true replace, so this only bites cloud users restoring an older backup.)

**Fix:** in cloud mode run `wipeUserData(owner)` → `importState(...)` (both already exist and are
batch-safe), inside the same confirm flow; keep the local mirror write afterwards.

### 4.4 The Firebase backend cannot be deployed from the repo (launch blocker)

There is **no `firebase.json`**. `firestore.rules` and `firestore.indexes.json` sit at the root,
and `docs/firebase.md` instructs `firebase deploy --only firestore:rules,firestore:indexes` —
which fails without a `firebase.json` naming those files. Consequences if this was never done by
hand in the console:

- **rules not deployed** → the project either denies everything (Production mode default: no user
  can read/write — cloud mode is broken) or, if the project was left in test mode, **the entire
  database is world-readable/writable until the test-mode expiry**.
- **composite index not deployed** → the bounded session query (`orderBy date desc, createdAt
  desc`) throws `failed-precondition` on first load for every cloud user. The app degrades to the
  local cache (good), but cloud sync never works.

**Fix:** add `firebase.json`:

```json
{
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" }
}
```

then `firebase deploy --only firestore` and verify a smoke sign-in against the real project. Add a
CI check that rules compile (`firebase emulators:exec` or `firestore.rules` unit tests with
`@firebase/rules-unit-testing` — currently no rules tests exist at all).

### 4.5 No abuse/cost protection in front of Firebase

The API key is public by design and rules confine writes to `users/{uid}`, but nothing stops a
script from: mass-creating accounts (Auth quota/billing), or writing unlimited 1 MB documents
under one authenticated uid (Firestore storage/ops billing). Standard hardening, none present:

- **Firebase App Check** (reCAPTCHA Enterprise for web) — not referenced anywhere in the codebase.
- **Rules-side payload validation** — rules check only ownership; no field/size/type constraints
  (`request.resource.data.keys().hasAny(...)`, size caps, `date` format check).
- **Billing alarms / quota caps** in GCP — an ops task, not code, but must exist before launch.
- **Auth quota + blocking functions** (optional) if spam signups appear.

Also minor: **no email verification** (`sendEmailVerification` is never called — unverified
accounts are fully functional), and **password users hit a dead-end on account deletion** when
Firebase demands recent login (`deleteAccount` only re-authenticates Google via popup; email users
get a message telling them to sign in again, with no in-flow way to do it).

### 4.6 Zero observability

The app is fully static/client-side; the privacy policy (rightly) rules out ad trackers, but
today there is **nothing**: no error reporting (the boundaries only `console.error`), no crash
visibility, no uptime check, no web-vitals, no funnel insight (signups, onboarding completion,
retention). You cannot answer "is production broken?" or "did anyone finish onboarding this week?"

**Fix (privacy-compatible):** self-hosted Sentry/GlitchTip or Vercel's error monitoring +
Analytics (cookie-less) + a synthetic uptime ping. Update the privacy page if anything is added —
it currently promises "no analytics SDKs", so choose tools that keep that promise or amend it.

### 4.7 No end-to-end or component tests

85 unit tests cover the domain and the risky lib decisions (hydration, write queue, auth errors) —
genuinely good. But **no test renders a single component**: CI would stay green if the dashboard
white-screened, a modal stopped submitting, or the AuthGate redirect looped. No Playwright/Cypress
anywhere; mobile `test` script is an `echo`; CI has no rules tests (4.4), no `pnpm audit`, no
Lighthouse budget.

**Fix (minimum bar):** one Playwright spec in CI — landing → sign up (Auth emulator) → onboarding →
log workout → appears on dashboard + plan log → edit → delete → export JSON. Plus a local-mode spec
(no Firebase env) so both persistence paths are covered.

### 4.8 Mobile app is not part of a shippable product

Current state (verified): AsyncStorage-only store — **no auth, no Firestore, no onboarding**;
it cannot see or produce any data the web app holds. Feature-wise it can log/delete sessions
(7-day date chips), toggle schedule entries (can't add/edit/delete), add/delete goals, log body
measurements; it has no categories management, no export/import, no account deletion, no coach,
no tests. `eas.json` exists but there is no EAS project id/credentials — no build has ever been
submitted. Store compliance (Play Data safety forms, iOS privacy labels, account-deletion
requirement the moment auth ships) is untouched.

**Decision required:** (a) **descope** — mark it explicitly as an internal prototype in README and
remove any implication of mobile sync from marketing ("syncs across devices" is currently true for
web↔web only, and the profile screen says exactly that — good), or (b) invest ~2–3 weeks to port
the web auth/repo/queue stack (all of it is platform-agnostic except the Firebase web SDK, which
works in RN) before any store submission. Shipping it as-is would strand users' data on one device.

---

## 5. P2 — polish / acceptable debt for v1

- **Cross-tab divergence (cloud):** two open tabs each hold an in-memory snapshot; there are no
  `onSnapshot` listeners, so a write in tab A appears in tab B only after reload. The multi-tab
  IndexedDB manager prevents *lost writes*, and per-document upserts keep conflicts small
  (last-write-wins per record), but the mirror can serve stale data within a session.
- **localStorage quota is swallowed:** `writeLocal` catches quota errors silently — a very heavy
  local-mode user (multi-MB JSON) would keep working in memory while persistence quietly stops.
  A one-time warning toast would close the loop.
- **Native `confirm()` dialogs** for destructive actions (7 call sites) — functional, but
  inconsistent with the design system and unstylable.
- **No PWA install prompt UI** — `beforeinstallprompt` is never surfaced; installation is
  discoverable only via the browser menu.
- **"See all" on Recent activity → `/dashboard/progress`** but the full log lives at
  `/dashboard/plan`; small navigation mismatch.
- **Local-mode `/login`** renders the sign-in form and only fails with the (well-written)
  "no Firebase configuration" message on submit; a "continue on this device" shortcut would be
  friendlier for previews.
- **Marketing nit:** landing/OG copy says "on-device data — no wearable required" while cloud mode
  syncs to Firestore; the privacy page explains both modes correctly, but the hero sentence is
  mode-blind.
- **Password-reset & verification emails use Firebase default templates** — sender domain and
  branding should be customised before launch (console task).
- **No i18n / single locale** — fine for an EN launch; `weekStartsOn` already covers the main
  locale-sensitive behaviour.
- **Ops runbook missing:** Firestore region choice (EU vs US for latency/GDPR), scheduled
  Firestore exports (backup/DR — the only current "backup" is the user-initiated JSON export),
  env-var checklist per Vercel environment (`NEXT_PUBLIC_SITE_URL` included), and a documented
  rollback path.

---

## 6. Marketing-claim parity (re-check)

| Claim | Reality |
| --- | --- |
| "Installable PWA, works offline" (pricing) | ✅ True — manifest + SW + offline page + persistent Firestore cache; verified 200s on every precached asset. |
| "On-device coach, answers from your own data" | ✅ True and now honestly worded — deterministic rule engine in core, no network. |
| "$0 / forever" single free tier | ✅ True — no payment code exists anywhere; no dark patterns. |
| "Syncs across devices" (profile screen) | ✅ Correctly scoped in-copy to the cloud account; web↔web only. Mobile remains out — see 4.8. |
| "No trackers, no analytics" (privacy) | ✅ True today — and it constrains the observability fix (4.6): pick privacy-safe tooling or amend the policy. |
| README | ✅ Accurate — cloud/local modes, no demo seed, PWA, coach route, seed script all described correctly. |

---

## 7. Launch checklist (ordered)

**Code (≈2–3 days)**
1. Progress screen: real targets via `targetsForDays` + honour `distanceUnit` (4.1).
2. Cloud import = wipe + write, matching the confirm copy (4.3).
3. Wire `loadMoreSessions` into the Plan log; label export honestly until fully paged (4.2).
4. Add `firebase.json`; deploy rules + indexes; smoke-test a real sign-in (4.4).
5. Password-user re-auth path for account deletion; optionally send email verification (4.5).

**Infra & ops (≈1 day, mostly console)**
6. Firebase App Check (reCAPTCHA Enterprise) + enforcement on Auth/Firestore (4.5).
7. GCP billing alarms + Firestore budget notification; pick the Firestore region deliberately (5).
8. Error monitoring + uptime ping that respects the privacy promise (4.6).
9. Set production env vars in Vercel (all `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_SITE_URL`);
   add the prod domain to Firebase Auth authorised domains; customise email templates (5).
10. Scheduled Firestore export to Cloud Storage (backup/DR) (5).

**Quality gate (≈2–3 days)**
11. Playwright smoke spec (local mode + Auth-emulator cloud mode) in CI (4.7).
12. Firestore rules unit tests (`@firebase/rules-unit-testing`) in CI (4.4).
13. `pnpm audit --audit-level=high` in CI; Node/pnpm versions pinned (already `.nvmrc` ✓).

**Product decision**
14. Mobile: descope publicly or fund parity work (4.8). Until then it should not appear in any
    user-facing "get the app" surface.

Everything else in §5 is safe to schedule after launch.

---

## 8. Remediation log — branch `arena/01a07db2-smartfit` (2026-09-08)

Everything codeable from §7 was implemented on this branch:

| Checklist item | Implementation |
| --- | --- |
| 1 · Progress screen targets & units | Rings now derive from `targetsForDays(state, days)`; both `formatDistance` calls honour `profile.distanceUnit`; a caption explains empty burn/distance rings until a goal exists. Covered by the E2E journey (`0 mi` assertion after switching units). |
| 2 · Cloud import = true replace | `replaceState` now runs `wipeUserData` → `importState` in cloud mode. |
| 3 · History pagination | `loadMoreSessions`/new `loadMoreBodyLogs` wired into Plan ("Load earlier workouts") and Body ("Load earlier measurements"); `collectFullState()` pages to the beginning before Export JSON, so backups are complete. New composite index for `bodyLogs` (`date desc, createdAt desc`) added to `firestore.indexes.json`. |
| 4 · `firebase.json` | Added (rules + indexes + emulator ports) — `firebase deploy --only firestore:rules,firestore:indexes` now works from the repo; `docs/firebase.md` updated with verification steps. |
| 5 · Deletion & verification | Password users get an inline re-authentication step (`reauthenticate` runs **before** the data wipe, so a wrong password can't strand an empty account); sign-up sends `sendEmailVerification`; Profile shows an "Email not verified" notice with resend. |
| 6 · App Check | Client initialises `ReCaptchaV3Provider` when `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` is set (graceful without it); enforcement ordering documented in `docs/ops-runbook.md` §1. |
| 6b · Rules validation | `firestore.rules` now validates payloads per collection (types, date format, bounds, string caps, field-count caps); form inputs enforce matching `maxLength`s. `tests/rules/firestore-rules.test.ts` runs against the emulator (`pnpm test:rules`, advisory CI job `firestore-rules`). |
| 7 · Billing/ops | `docs/ops-runbook.md`: budgets & quota caps, Firestore region choice, scheduled exports (backup/DR), authorised domains, email templates, env-var matrix, incident table, rollback path, dependency-audit triage. |
| 8 · Observability | `src/lib/report.ts` + `<Telemetry/>`: crash reports from both error boundaries, `window.onerror`/`unhandledrejection`, and web vitals — POSTed **only** to an optional self-hosted `NEXT_PUBLIC_ERROR_ENDPOINT`; silent by default, pathname-only (no query strings), unit-tested (`tests/report.test.ts`), and disclosed in the privacy policy ("Crash reports (optional)"). |
| 9 · Env vars | `.env.example` documents the App Check key and error endpoint. |
| 11 · E2E | Playwright suite (`e2e/smoke.spec.ts`) against the production build in local mode: full journey (onboarding → log → detail → edit → delete → schedule → goals → body → units → coach → export → erase), deep-link onboarding guard, reload persistence, legal/404 pages, PWA asset chain. CI job `e2e` with trace artifacts on failure. |
| 12 · Rules tests in CI | `firestore-rules` job (Java 17 + emulator), `continue-on-error` until observed green. |
| 13 · `pnpm audit` | Non-blocking CI step + triage policy in the runbook (current findings are build-time transitive deps of the Expo toolchain). |
| 14 · Mobile decision | Descoped explicitly: README banner, runbook §6; no user-facing surface references it. |

**P2 items also done:** cross-tab convergence (storage-event adoption with
ping-pong guard), localStorage-quota warning banner, design-system confirm
dialogs replacing all seven native `confirm()` calls, PWA install prompt
(`beforeinstallprompt`, dismissible), "See all" → `/dashboard/plan`, local-mode
`/login` now offers "Continue on this device", landing/OG copy de-absolutised
("local-first" instead of "on-device only" claims), body-log deletion confirm.

**Not implemented here (console/account tasks, intentionally):** App Check
registration + enforcement, billing alarms, scheduled exports, email template
branding, uptime ping, collector stand-up — all step-by-step in
`docs/ops-runbook.md`.
