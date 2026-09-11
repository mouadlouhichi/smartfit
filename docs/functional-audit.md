# SmartFit — Deep Functional Audit & Competitive Comparison (historical)

> **Superseded on 11 September 2026.** Use [`mvp-audit-2026-09-11.md`](./mvp-audit-2026-09-11.md)
> for current launch status; Pro and mobile scope decisions have changed since this snapshot.
>
> Audited 2026-09-08 against `main` (commit `9815dbf`), then upgraded on
> `arena/01a082ec-smartfit`. This document is the **before → after** picture:
> what the app had, what the category leaders ship, what the reference
> fitness-app design guide prescribes, and exactly what was built to close the
> gap — with the honest free-vs-Pro gates that now back the paywall.

---

## 1. How the audit was done

- Read every screen, modal, store slice and the shared `@smartfit/core` engine.
- Benchmarked against the five reference trackers (Hevy, Strong, Fitbod,
  Jefit, Boostcamp) and the coaching tier (Alpha Progression, RP Hypertrophy),
  plus the design patterns called out in the reference guide: closing rings,
  calendar heatmaps, glanceable mid-workout metrics, thumb-zone controls and
  paywall placement.
- Ran the project's own checks: `tsc`, `eslint`, `pnpm test:all` (148 tests),
  `next build` — all green.

---

## 2. What SmartFit already did well (keep)

| Area | Evidence |
| --- | --- |
| **Domain core** | Pure, unit-tested `@smartfit/core`: sessions, schedule, goals, body logs, categories, plans, units. |
| **Sync + offline** | Firestore write-queue, per-account offline cache, local-first mode, JSON import/export, paging. |
| **Exercise catalog** | 103 curated + 1,323 runtime movements with animated demo frames and how-to steps. |
| **AI coach** | Deterministic on-device engine with an optional AI provider and a free daily cap. |
| **Safety** | Defensive `parseState` that never white-screens; validated Firestore rules. |
| **PWA** | Manifest, service worker, offline page, install prompt. |

These are genuinely strong. The gaps were on the *product* surface, not the plumbing.

---

## 3. The gaps — before this change

1. **No real "start exercise" flow.** The runner was a small modal that only
   counted time and ticked a set counter — no reps, no weight, no demo image,
   no rest logic. Every serious tracker leads with per-set logging.
2. **No progressive overload.** Nothing pre-filled your last numbers. This is
   the single most-cited differentiator across Hevy/Strong/Fitbod/Jefit/Boostcamp.
3. **No personal records / 1RM.** No e1RM, no PR celebration — the emotional
   hook that turns logging into a habit.
4. **No volume / muscle analytics.** No tonnage, no per-muscle breakdown.
5. **Weak retention visuals.** No closing rings, no consistency heatmap — the
   two visualisations the category converged on.
6. **No achievements / gamification.** 67% of health apps ship at least one
   gamification element; SmartFit had none.
7. **A paywall that didn't look (or act) premium.** `PRO_FEATURES` promised
   "Pro badge" and "first access to new gym programs" that were **not
   enforced**, and only two gates (coach replies, quarter/year ranges) were
   real. The paywall was a plain list, not a premium surface.
8. **Thin imagery.** 7 category JPEGs + 1 hero; no premium art anywhere.

---

## 4. Competitive comparison (before → after)

| Capability | Hevy / Strong | Fitbod / Jefit | SmartFit before | **SmartFit after** |
| --- | --- | --- | --- | --- |
| Per-set reps × weight logging | ✅ | ✅ | ❌ count-only | ✅ guided runner |
| Last-session pre-fill (progressive overload) | ✅ | ✅ | ❌ | ✅ `lastPerformance` |
| Personal records / e1RM | ✅ | ✅ | ❌ | ✅ Epley e1RM + live PR flash |
| Rest timer w/ presets + feedback | ✅ | ✅ | 60s only | ✅ presets, +15s, skip, haptic + chime |
| Volume / tonnage & per-muscle | ✅ (Pro) | ✅ | ❌ | ✅ free |
| Activity rings | (Apple) | — | ❌ | ✅ `activityRings` |
| Consistency heatmap | (GitHub-style) | — | ❌ | ✅ `consistencyHeatmap` |
| Achievements / badges | ⚠️ some | ⚠️ | ❌ | ✅ 9-badge wall |
| Workout templates / routines | ✅ | ✅ | ⚠️ slots only | ✅ schedule = routine (free cap 3) |
| Premium paywall w/ real gates | ✅ | ✅ | ⚠️ 2 gates | ✅ 6 enforced gates + trial |
| Offline / PWA | ✅ | ✅ | ✅ | ✅ |
| Cloud sync | ✅ | ✅ | ✅ | ✅ |

SmartFit now matches the tracker tier on the core loop and exceeds it on
privacy (on-device coach, local-first) — while the Pro tier is priced in the
category's $3–16/mo band.

---

## 5. What was built

### 5.1 Guided workout runner ("start exercise")
`modals/session-runner-modal.tsx` — now a **full-screen, always-dark** live
session (the reference guide's "screen for someone mid-workout"):

- Running clock + start/pause always visible; everything else below the fold.
- Per-exercise stepper with animated demo tiles.
- Per-set **reps × weight** inputs, **pre-filled from your last session**
  (`lastPerformance`) — progressive overload for free.
- Live **e1RM** under each set; completing a set detects a **new PR** (flash +
  toast + haptic) and starts the **suggested rest** for the intensity.
- **Rest timer**: countdown bar, presets, +15s, skip, WebAudio chime + vibration.
- **Finish summary**: sets, volume (tonnage), heaviest, PR list, then Save.

### 5.2 Training engine (`@smartfit/core/training.ts`)
Pure, unit-tested (21 new tests): `estimatedOneRepMax` (Epley),
`lastPerformance`, `personalRecords`, `isPersonalRecord`, `sessionVolume` /
`muscleVolume`, `suggestedRestSeconds` + `REST_PRESETS`, `computeAchievements`,
`currentStreakDays`, `activityRings`, `consistencyHeatmap`,
`summariseLiveSession`.

### 5.3 Progress analytics
`progress-screen.tsx` adds: consistency heatmap, **Personal records & 1RM**
board (free = top 3, Pro = all), **achievements wall** (free = 3, Pro = all),
and **volume-by-muscle** bars.

### 5.4 Overview
Closing **activity rings** (Move/Exercise/Sessions from the athlete's own
goals) plus a cinematic **"Start today's workout"** card that opens the runner
with today's slot and its routine.

### 5.5 Premium Pro paywall
`pro-modal.tsx` — dark ember hero, plan cards with a gold "Best value / Save
40%" ribbon, an **honest Free-vs-Pro table** derived from `PRO_GATES`, and a
no-card **7-day trial**. Every advertised gate is real.

### 5.6 Honest Pro gates (`pro.ts`)
| Gate | Free | Pro | Enforced in |
| --- | --- | --- | --- |
| AI coach | 6/day | Unlimited | `coach-panel.tsx` |
| Analytics ranges | week/month | + quarter/year | `progress-screen.tsx` |
| Records & 1RM | top 3 | all | `progress-screen.tsx` |
| Achievements | 3 | all | `progress-screen.tsx` |
| Workout templates | 3 | unlimited | `ScheduleModal.tsx` |
| Export | JSON | + CSV | `profile-screen.tsx` |

Plus the **Pro badge** on the profile hero (`pro-badge.tsx`).

### 5.7 Routine templates
`ScheduledWorkout.exercises` (optional, backwards-compatible) turns a schedule
slot into a reusable routine the runner loads. Free tier caps templates at 3;
a 4th routes to the paywall. Firestore rules + parser updated.

### 5.8 Imagery
Refreshed all six category arts and added `start-workout.jpg`,
`session-bg.jpg`, `coach-hero.jpg` in one cohesive ember/dark editorial style.

---

## 6. Verification

- `npx tsc --noEmit` — clean.
- `npx eslint` (changed files) — clean.
- `pnpm test:all` — **148 pass / 0 fail** (core 108 incl. 21 new training
  tests; root 40).
- `next build` — 18/18 routes static, compiled successfully.
- Fixed a real bug found during the audit: nested `undefined` set fields
  (bodyweight sets) would have failed Firestore writes — `repo.ts` now
  deep-sanitizes (`sanitize`), also applied to `replaceCollection` & `importState`.

## 7. Known limits & next steps (not shipped)

- **Wearable sync** (HealthKit / Health Connect) — web can't reach it; the
  domain is ready for it.
- **Live Activities / lock-screen timer** — needs native.
- **Social / leaderboards** — deliberately out of scope for a privacy-first app.
- Real Stripe receipts: wire webhooks to set `monthly`/`yearly`; the sandbox
  and trial paths are already distinct from paid stamps.
