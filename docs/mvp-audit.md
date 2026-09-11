# SmartFit — Functional MVP Audit (historical)

> **Superseded on 11 September 2026.** Use [`mvp-audit-2026-09-11.md`](./mvp-audit-2026-09-11.md)
> for the current re-verification and launch decision.

**Date:** 2026-09-07 · **Commit:** `0eaf739` (branch `arena/01a079b7-smartfit`)
**Scope:** web app (`src/`), mobile app (`apps/mobile/`), shared domain (`packages/core/`),
infra (Firebase, CI, deployment), and marketing-claim vs. implementation parity.

---

## 0. Verdict

SmartFit is a **very polished shell around a mostly-complete local tracker**. The
design system, landing site, navigation and the read-side of the product are
genuinely finished. What's missing for MVP is concentrated in three places:

1. **Data lifecycle** — you can create almost everything but edit/delete almost nothing, and
   the data you *do* enter (exercises, notes, units) is never shown back to you.
2. **Cloud mode correctness** — Firebase was bolted on after the local-first design and the
   two persistence paths conflict. There is at least one **cross-account data leak** and
   silent write-failures.
3. **Ship-ability** — no `public/` directory at all: no favicon, no manifest, no OG image,
   no robots/sitemap; several marketing claims (PWA/offline, sync) aren't backed by code.

**Readiness by area**

| Area | State | MVP-ready? |
| --- | --- | --- |
| Domain logic (`@smartfit/core`) | 7 unit tests, all pass, pure & shared | ✅ Yes |
| Web build / typecheck | `pnpm build` + `tsc --noEmit` clean, 13 routes static | ✅ Yes |
| Landing / marketing site | 14 sections, anchors all resolve | ✅ Yes (copy needs fixes) |
| Log a workout / goals / body / schedule (create) | Works | ✅ Yes |
| Edit & delete records | Mostly **missing on web** | ❌ No |
| Onboarding | Works, but only enforced on `/dashboard` | ⚠️ Partial |
| Auth (email/Google/reset) | Implemented and well-handled | ✅ Yes |
| Cloud sync (Firestore) | Works on the happy path; **leaks + silent failures** | ❌ No |
| AI Coach | Rule-based keyword matcher + **fabricated progress rings** | ⚠️ Partial |
| Mobile app | Read-mostly companion; no auth/sync/onboarding | ❌ No (as a v1 store app) |
| PWA / offline | **Does not exist** but is advertised | ❌ No |
| SEO / social / icons | **No `public/` dir**, relative canonical, no OG image | ❌ No |
| Error handling / observability | No `error.tsx`, no boundary, no logging | ❌ No |
| Linting / formatting | **No ESLint or Prettier at all** (`lint` = `tsc`) | ⚠️ Partial |

---

## 1. What was verified working

Run against a clean install (`pnpm install`, pnpm 9.15.9, Node 22):

```
pnpm typecheck                     ✅ clean
pnpm build                         ✅ 13 routes, all static, ~102 kB shared JS
pnpm --filter @smartfit/core test  ✅ 7/7 pass
pnpm --filter @smartfit/mobile typecheck ✅ clean
```

All routes return 200: `/`, `/login`, `/onboarding`, `/dashboard{,/plan,/goals,/progress,/body,/profile,/coach}`;
unknown paths correctly 404 into the custom `not-found.tsx`.

Working end-to-end (local mode):

- Guided 5-step onboarding → profile + first weekly goal written to state.
- Log a workout (date, type, title, minutes, intensity, distance for cardio, exercises, notes),
  with live calorie estimation.
- Create/toggle/delete a recurring scheduled session; switch training strategy (4 splits).
- Create/delete goals with weekly/monthly reset and clamped progress.
- Log/delete body measurements with a Recharts trend line and delta-since-first.
- Progress screen: 8-week volume bars, activity mix, intensity spread.
- Add/delete custom activity types; export state as JSON; erase everything.
- Light/dark theme; responsive shell (desktop rail + mobile expanding nav).

---

## 2. P0 — MVP blockers

### 2.1 Cross-account data leak on sign-out `src/lib/store-context.tsx:181`

```ts
useEffect(() => {
  if (!ready || cloud) return;
  persistLocal(state);          // ← writes whatever is in memory
}, [state, ready, cloud]);
```

On sign-out, `user` becomes `null` → `cloud` flips to `false` **in the same render pass in
which `state` still holds the previous user's Firestore data**, and `ready` is still `true`.
The effect therefore writes User A's cloud data into `localStorage`. The subsequent
`hydrate()` for the signed-out visitor reads that key back — so a signed-out visitor (or the
next person on that browser) sees the previous account's training history.

**Fix:** set `ready = false` *before* the auth transition (both branches of `hydrate`), and
clear the `smartfit.state.v1` key on sign-out.

### 2.2 Cloud writes are fire-and-forget — silent data loss `src/lib/store-context.tsx:152-172`

`upsertItem`, `deleteItem` and `saveProfile` are all called as `void promise` with **no
`.catch` anywhere**. A permissions error, an expired token or a dropped connection produces
an unhandled rejection; the UI shows the record as saved and the user loses it on next
load. `isFirestoreError()` is defined in `repo.ts:31` and never called.

**Fix:** wrap writes in a queue with retry, surface a "not saved" toast, and mirror the last
known good state to `localStorage` as a cache in cloud mode too.

### 2.3 Side effects inside a `setState` updater `src/lib/store-context.tsx:277-291`

`updateProfile` / `completeOnboarding` call `persistProfile(profile)` *inside* the `mutate`
updater. `reactStrictMode: true` (`next.config.mjs:11`) double-invokes updaters in dev, so
every profile change issues **two Firestore writes**. It also captures a stale `state` for
the local branch (`persistLocal(state)` at line 160 writes the pre-update object).

### 2.4 No local → cloud migration on first sign-in `src/lib/store-context.tsx:118-142`

A visitor uses the app locally (the login page even offers "continue on this device"),
then signs up. `hydrate()` sees no remote doc, creates a **fresh empty** profile, and the
local history is silently orphaned. For a product whose landing page says "start free, no
account", this is the single most likely first-run data-loss path.

**Fix:** on first cloud hydration with a non-empty local state, prompt to import and batch-upload.

### 2.5 No way to edit or delete a logged workout on web

`updateSession` and `deleteSession` exist in the store (`store-context.tsx:206,214`) and are
**never used by any component**. The workout log rows in `plan-screen.tsx:170-192` render a
badge and nothing else. Same for `updateGoal` (`:242`, unused → goals can't be edited) and
schedule entries (only the active toggle + delete; no edit).

Mistyping "450 minutes" instead of "45" is currently permanent. Ironically the *mobile* app
can delete sessions (`apps/mobile/src/app/index.tsx:157`) and the web app cannot.

### 2.6 Logged data that is never displayed anywhere

| Captured in | Field | Rendered anywhere? |
| --- | --- | --- |
| `WorkoutModal:163` | `exercises[]` (name + set count) | ❌ never |
| `WorkoutModal:196` | `notes` | ❌ never |
| Onboarding + Profile | `profile.weightUnit` (kg/lb) | ❌ never — body weight is hardcoded `kg` (`constants.ts:96`) |
| Type model | `profile.distanceUnit` (km/mi) | ❌ never settable, `formatDistance` hardcodes `km` (`format.ts:17`) |
| Onboarding + Profile | `profile.weeklyRestDays` | ❌ never used in any calculation |

There is **no session detail view at all** — the app asks for exercises and notes and then
throws the UI away. Either surface them (a session drawer) or remove the inputs before ship.

### 2.7 No `public/` directory — the app has no icons, manifest or social card

Verified live: `/favicon.ico`, `/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml` all **404**.
`canonical` and `og:url` render as the literal string `"/"` (no `metadataBase`), and there is
no `og:image`. Any share of the site produces a blank card, and browsers show a default icon.

This also makes the pricing page's **"Installable PWA, works offline"**
(`pricing-section.tsx:34`) a false claim — there is no manifest and no service worker.

### 2.8 Onboarding is only enforced on `/dashboard`

`src/app/dashboard/page.tsx` redirects incomplete profiles to `/onboarding`, but
`/dashboard/plan|goals|progress|body|profile|coach` do not. Any deep link, bookmark or the
footer's "Open dashboard" link drops a brand-new user into an empty screen with no setup.
Move the check into `dashboard/layout.tsx` (or `AuthGate`).

---

## 3. P1 — Should fix before calling it v1

### 3.1 Two different definitions of "this week"

`startOfWeek()` in core uses **Sunday** (`fitness.ts:26`) — used by `thisWeek()`,
`weeklySeries()` and `goalProgress()`. The coach uses **Monday**
(`coach/page.tsx:269`, `coach-panel.tsx:32`). So the coach's sentence
"you burned X across N sessions this week" mixes a Sunday-based total with a Monday-based
category breakdown. Pick one (and make it a user preference or at least a single constant).

### 3.2 The AI Coach shows fabricated numbers

`coach/page.tsx:111` → `<ProgressRing pct={60 + ((i * 13) % 35)} />` and
`coach-panel.tsx:182` → `<MiniRing pct={55 + i * 20} />`. Those rings are pure decoration
rendered next to *real* calorie figures, which reads as data. Either bind them to a real
ratio (category kcal ÷ weekly kcal) or delete them.

### 3.3 Dead UI: the microphone buttons

`coach/page.tsx:159` and `coach-panel.tsx:223` render Mic buttons with **no handler**.
Clicking does nothing. Remove them or wire Web Speech API.

### 3.4 Duplicated, divergent coach engines

`coach/page.tsx:198-265` and `coach-panel.tsx:29-100` are two separate rule engines with
different quick-reply chips ("How am I doing this week?" vs "Log water"), different
fallbacks, and different week boundaries. `coach-panel` even advertises hydration logging
that doesn't exist. Extract one `answer(question, state)` into `@smartfit/core` and test it.

### 3.5 Hardcoded targets presented as goals

Overview (`overview-screen.tsx:61-64`) and Progress (`progress-screen.tsx:62-65`) invent
targets — 300 min/week, 2500 kcal/week, 25 km/week, 5 workouts — regardless of the goals the
user actually created. A user with a "3 workouts/week" goal still sees rings scaled to 5.
Derive these from `state.goals`, or label them as generic benchmarks.

### 3.6 The plan never connects to the log

`ScheduledWorkout.active` is only ever read for display and one coach sentence. There is:
no "mark today's scheduled session as done" action, no pre-filled log from a schedule entry,
no missed-session indication, no reminders. The weekly split and the workout log are two
unrelated features sharing a page. This is the biggest *product* gap — it's what makes the
plan feel real.

### 3.7 Streak semantics fight the product

`currentStreak()` counts **consecutive calendar days** with a session. Every plan in the app
prescribes 3–6 days/week, so the streak resets constantly and the header will read "1 day"
for most users. Consider a "weeks hitting target" streak, or count planned rest days as
preserving the streak (`weeklyRestDays` is already collected and unused).

### 3.8 Firestore reads are unbounded

`loadUserState()` (`repo.ts:41-72`) does a full `getDocs` of every sub-collection on every
app open, sorts client-side, and never paginates. `firestore.indexes.json` defines a
`sessions` date index that no query uses. After a year of training that's ~250 doc reads per
cold start, per device. Add `orderBy('date','desc').limit(n)` + incremental paging for the log.

### 3.9 Cloud mode has no offline support

`getFirestore(app)` (`config.ts:96`) is used without `persistentLocalCache`, and cloud mode
never mirrors to `localStorage`. Sign in, lose connectivity, and the app is empty — while
the marketing site sells "works offline".

### 3.10 Account deletion is missing

Profile offers "Erase everything" (deletes Firestore docs) but there is no way to delete the
**auth account**. With email/Google sign-in shipped, an account-deletion path is table stakes
(and a legal requirement in several jurisdictions).

### 3.11 No error boundaries or loading states

No `app/error.tsx`, `app/global-error.tsx`, or any `loading.tsx`. A single throw in a client
screen (e.g. a corrupt `localStorage` payload that parses but has the wrong shape — `JSON.parse`
result is cast with `as FitnessState` at `store-context.tsx:107`, unvalidated) white-screens
the whole app. `zod` is already a dependency and is not used anywhere — validate on hydrate.

### 3.12 Mobile app is not a shippable v1

`apps/mobile` is a read-mostly companion:

- No onboarding, no auth, no cloud sync → **it cannot see the data the web app stores in Firestore**.
- Can't create a scheduled session, manage activity types, edit anything, or export.
- Workouts are always logged with **today's** date (no date picker, `LogWorkoutModal.tsx:25`).
- `app.config.js` never sets the app `icon` (only splash/adaptive/favicon), and its colours are
  leftover template green (`#15803D`, `#F7FAF7`) vs. the brand clay `#D6532F`.
- `package.json` `test` script is `echo "…covered by core tests"` — CI's mobile job only typechecks.

Decision needed: **ship web-only for MVP** and label mobile as an internal preview, or invest
~2–3 weeks to bring it to parity.

---

## 4. P2 — Polish / debt

- **`NEXT_PUBLIC_SEED_DEMO` / `EXPO_PUBLIC_SEED_DEMO` are dead.** `env.seedDemo` is defined
  (`src/lib/env.ts:26`, `apps/mobile/src/lib/env.ts:21`) and **read by nothing**. The README
  still documents demo data being "preloaded on first run" — it isn't.
- **`buildSeedState()` ships in the client bundle** — `packages/core/src/index.ts` re-exports
  `./seed`, so ~150 lines of unreachable demo data are bundled into every page.
- **`completeOnboarding()` is dead code** — onboarding calls `updateProfile` twice inside a
  `setTimeout(…, 0)` instead (`onboarding/page.tsx:41`).
- **README is stale.** It states "no account, no backend, no trackers", lists Firebase cloud
  sync under 🛣 Roadmap, and describes demo data as shipping by default. All three are now
  wrong. It also omits `/dashboard/coach` from the project structure.
- **No ESLint, no Prettier, no pre-commit hook.** `"lint": "tsc --noEmit"` is a typecheck
  wearing a lint costume, and `next.config.mjs` sets `eslint.ignoreDuringBuilds: true` for a
  config that doesn't exist. React-hooks rules are being disabled by comment in three files
  with no linter to enforce them.
- **No tests above the domain layer.** Zero component, integration or e2e tests; the store,
  the auth gate, the repo and every screen are untested. CI has three jobs and none of them
  would catch a broken dashboard.
- **Footer links go nowhere useful** (`footer-section.tsx`): "Help center", "Contact" and
  "Sign in" all point at `/dashboard`; "Privacy policy" is an anchor to a marketing section.
  There are no `/privacy` or `/terms` pages — needed before app-store or ad traffic.
- **`seed.sql` at the repo root** is a Postgres schema for a product that uses Firestore.
  It's documented as reference-only, but it's a confusing artifact in the root of an MVP.
- **`categoryBreakdown` filters by `state.categories`**, so sessions whose category was later
  deleted vanish from the activity mix (their minutes are silently dropped) —
  `deleteCategory` doesn't reassign or block deletion of an in-use type.
- **`estimateCalories` ignores body weight** despite the doc comment claiming a body-weight
  factor and despite `bodyLogs` holding weight — every 45-min moderate session is exactly
  310 kcal for a 55 kg and a 105 kg user.
- **Accessibility spot-checks**: `Select` elements in `plan-screen.tsx:65` and the workout
  filter have `<label>` text not associated via `htmlFor`/`id`; the decorative `Trash2` at
  `apps/mobile/src/app/profile.tsx:117` is rendered at `size={1}` in white (leftover).

---

## 5. Marketing claims vs. implementation

| Claim (where) | Reality |
| --- | --- |
| "Installable PWA, works offline" (`pricing-section.tsx:34`) | No manifest, no service worker, no offline cache. **False.** |
| "AI Coach insights from your data" (pricing, hero, nav "Insights") | Keyword `if/else` matcher with fabricated progress rings. Defensible if reworded ("smart summaries"), misleading as "AI". |
| "no backend, no account" (README, onboarding copy at `onboarding/page.tsx:76`) | Firebase Auth + Firestore ship in the app; onboarding still tells cloud users their data never leaves the device. **Contradictory.** |
| "syncs across devices" (`profile-screen.tsx:158`) | True for web↔web only; the mobile app has no cloud path at all. |
| "Hydration logging is on the roadmap" (`coach-panel.tsx:88`) | Coach volunteers a feature that doesn't exist and isn't planned in the README. |
| "Demo data preloaded" (README Quick start) | Seeding is disabled and the flag is unwired. **False.** |

---

## 6. Recommended MVP cut-line

A pragmatic path to "we can put this in front of real users":

**Sprint 1 — correctness (P0, ~3–5 days)**
1. Fix the sign-out leak + clear local key on sign-out (2.1).
2. Add write error handling + a persistent local cache in cloud mode (2.2, 3.9).
3. Move profile persistence out of the `setState` updater (2.3).
4. First-sign-in local→cloud import prompt (2.4).
5. Validate hydrated state with `zod` + add `app/error.tsx` (3.11).
6. Enforce onboarding in `dashboard/layout.tsx` (2.8).

**Sprint 2 — complete the loop (P0/P1, ~4–6 days)**
7. Session detail view + edit + delete; goal edit; schedule edit (2.5, 2.6).
8. "Log from schedule" / mark scheduled session done (3.6).
9. Honour `weightUnit`, add `distanceUnit` to settings, or drop both fields (2.6).
10. Unify the week boundary and extract one coach engine into core, with tests (3.1, 3.4).
11. Remove the fake rings and the dead mic buttons (3.2, 3.3).
12. Derive dashboard targets from real goals (3.5).

**Sprint 3 — ship-ability (~2–3 days)**
13. Create `public/`: favicon set, `manifest.webmanifest`, OG image, `robots.txt`, `sitemap.ts`,
    `metadataBase` (2.7).
14. Service worker + install prompt, *or* delete the PWA/offline claims (2.7, §5).
15. `/privacy` + `/terms` pages; fix footer links; account deletion (3.10, P2).
16. ESLint + Prettier + a `lint` CI job; one Playwright smoke test covering
    onboarding → log workout → see it on the dashboard.
17. Rewrite the README to match reality (cloud mode, no demo seed, coach route).

**Explicitly out of MVP:** mobile parity (ship web-first), exercise library with
per-set history, push reminders, wearable import.
