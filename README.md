<div align="center">

# 🏋️ SmartFit

**A private, mobile-first fitness tracker that knows the difference between
training _hard_ and training _smart_.**

[![CI](https://img.shields.io/badge/CI-web%20build%20%7C%20core%20tests%20%7C%20mobile%20typecheck-2ea44f)](.github/workflows/ci.yml)
[![Turbo](https://img.shields.io/badge/Turborepo-monorepo-EF4444?logo=turborepo&logoColor=white)](https://turbo.build)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs)](https://nextjs.org)
[![Expo](https://img.shields.io/badge/Expo-SDK%2052-000020?logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.76-61DAFB?logo=react&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![NativeWind](https://img.shields.io/badge/NativeWind-4-38BDF8)](https://www.nativewind.dev)

</div>

---

SmartFit is the fitness counterpart of the [SmartJib / flousy-app](https://github.com/mouadlouhichi/flousy-app)
budget tracker. It mirrors the **same monorepo architecture, design language and
quality bar** — a Turborepo with a Next.js web app, an Expo mobile app and a
shared domain package — but applies them to **training** instead of money.

> **Conceptual parallel.** SmartJib keeps *what money is for* (envelope) strictly
> separate from *where it sits* (place). SmartFit keeps *what a session is*
> (activity category) separate from *the work done* (logged sessions), *the plan*
> (recurring schedule), *the target* (goals that survive week rollover) and *the
> result* (body-metric trends).

## ✨ Features

### Training

- **Log workouts** — strength, cardio, HIIT, mobility, sport & active rest, with
  duration, intensity, estimated calories, distance and exercises on both apps.
- **Illustrated exercise library** — a curated catalog of 100+ common movements
  (muscles, equipment, aliases, browse groups) in `@smartfit/core`, with
  two-frame demonstration images streamed from the open
  [free-exercise-db](https://github.com/yuhonas/free-exercise-db) dataset
  (Unlicense) and crossfaded into a GIF-style loop. The **Plan tab** has a
  browsable library — grouped by body section (Chest, Back, Legs…), with
  search and hover-animated demos. Logging suggests matches as you type;
  free-typed names and old logs are matched to the catalog so history gets
  illustrations too. A "how to do it" sheet with step-by-step instructions
  (lazily fetched from the same dataset, session-cached) is one tap away
  from the library, the picker and any logged exercise.
- **Animated GIF demos** — most of the catalog (92/103 exercises) is mapped to
  ExerciseDB-style animated demonstrations (illustrated figure, target muscle
  highlighted in red) mirrored on jsDelivr via
  [ExerciseGymGifsDB](https://github.com/JahelCuadrado/ExerciseGymGifsDB):
  light 128px animated WebP thumbs in grids, pickers and session rows, and the
  full-size GIF in the "how to do it" sheet. Exercises without a curated GIF
  (or if the CDN is unreachable) fall back to the two-frame photo loop above.
  Note: those GIFs are ExerciseDB artwork — fine for personal use, but
  commercial redistribution requires an exercisedb.com license.
- **Training plans** — four proven splits: **Push/Pull/Legs**, **Upper/Lower**,
  **Full Body 3×**, and **Cardio & Conditioning**. Pick one and the weekly split
  lights up on both apps.
- **Recurring schedule** — drop sessions into the week (day/time/duration),
  toggle them active, or delete them.
- **Goals** — weekly & monthly targets for workouts, active minutes, calories or
  distance, with live progress bars that reset each period.
- **Streaks & momentum** — a consecutive-day training streak.
- **Progress analytics** — 8-week volume charts (Recharts on web, SVG on mobile),
  activity-mix distribution and intensity spread.
- **Body trends** — log weight and measurements over time; the trend line shows
  real change.

### Platform

- **Local-first, cloud-optional** — with no Firebase config the web app runs in
  **local mode** (`localStorage`, no account). Add a Firebase config and it
  switches to **cloud mode**: email/password + Google sign-in, per-user data in
  Cloud Firestore, an offline IndexedDB cache and a retrying write queue. Mobile
  is local-only (AsyncStorage).
- **Your data is yours** — JSON export *and* import, erase-everything, and full
  account deletion. On first sign-in, existing on-device data can be migrated
  into the new account.
- **Starts empty** — no demo data is ever seeded into the app. Use
  `pnpm seed` (`scripts/seed-firestore.mjs`) if you want a populated demo
  account.
- **Guided 5-step onboarding** — name → units/rest days → strategy → first goal →
  review.
- **Installable PWA** — web manifest, maskable icons and a service worker that
  keeps the app shell working offline.
- **On-device coach** — a deterministic rule engine (in `@smartfit/core`) that
  answers questions from your real data. No LLM, no network call.
- **Light / dark** theming on web; token-driven design system shared conceptually
  across platforms.
- **Marketing site** included (landing, features, how-it-works, plans, FAQ),
  plus `/privacy` and `/terms`.

## 🧱 Tech stack

| Layer            | Web (root `src/`)                        | Mobile (`apps/mobile`)                    |
| ---------------- | ---------------------------------------- | ----------------------------------------- |
| Framework        | Next.js 15 (App Router, RSC)             | Expo SDK 52 + Expo Router                 |
| UI runtime       | React 19                                 | React Native 0.76 / React 18              |
| Styling          | Tailwind CSS v4 + CSS variables          | NativeWind 4 (Tailwind)                   |
| Components       | Radix primitives (shadcn-style)          | Custom NativeWind components              |
| Charts           | Recharts                                 | react-native-svg                          |
| Icons            | lucide-react                             | lucide-react-native                       |
| Persistence      | localStorage · Cloud Firestore (optional) | AsyncStorage                             |
| Auth             | Firebase Auth (optional)                 | —                                         |
| Shared logic     | **`@smartfit/core`** (TypeScript, no React) | same via Metro workspace resolution    |

The monorepo is orchestrated with **Turborepo** and **pnpm workspaces**.

## 🚀 Quick start

```bash
pnpm install

# Web — http://localhost:3000 (the Next.js app lives at the repo root)
pnpm dev

# Mobile (Expo dev server — scan the QR with Expo Go / a dev client)
pnpm mobile         # expo start
pnpm mobile:android # expo run:android
pnpm mobile:ios     # expo run:ios
```

Both apps start **empty** and open the guided **onboarding**. No backend is
required — cloud mode activates only when a full Firebase config is present (see
[`docs/firebase.md`](docs/firebase.md)).

## 🧰 Scripts

The web app runs from the repo root; mobile and the shared package are workspace packages:

```bash
pnpm dev            # start the Next.js web app (root)
pnpm build          # production build of the web app
pnpm typecheck      # tsc --noEmit for the web app
pnpm lint           # ESLint (next/core-web-vitals) across the monorepo
pnpm format         # Prettier --write  (pnpm format:check in CI)
pnpm test           # core domain tests
pnpm seed           # populate a Firestore demo account (needs admin creds)

pnpm --filter @smartfit/core test          # core domain tests
pnpm --filter @smartfit/mobile typecheck   # mobile types
```

## ⚙️ Environment variables

SmartFit is **local-first — every variable is optional** and has a default. Copy
the relevant `.env.example` to `.env.local` (web) / `.env` (mobile) to override.

| Variable | App | Default | Effect |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_DEFAULT_PLAN` / `EXPO_PUBLIC_DEFAULT_PLAN` | web / mobile | `full-body` | Default strategy for new accounts (`ppl` · `upper-lower` · `full-body` · `cardio-focus`) |
| `NEXT_PUBLIC_APP_NAME` / `EXPO_PUBLIC_APP_NAME` | web / mobile | `SmartFit` | Display name (web metadata / document title) |
| `NEXT_PUBLIC_SITE_URL` | web | Vercel URL, else `http://localhost:3000` | Absolute origin for canonical URLs, Open Graph tags, `robots.txt` and the sitemap |
| `NEXT_PUBLIC_FIREBASE_*` | web | _unset_ | A **complete** set (API key, auth domain, project id, app id) switches the app into cloud mode; anything missing keeps it local |

Env access is centralised and validated in `src/lib/env.ts` (web) and
`apps/mobile/src/lib/env.ts` (invalid plan values fall back to the default). See
`.env.example` and `apps/mobile/.env.example`.

## 🗂 Project structure

```
smartfit/
├─ src/                             # Next.js 15 web + marketing app (repo root = web root)
│  ├─ app/                          # App Router routes
│  │  ├─ page.tsx                   #   marketing landing
│  │  ├─ onboarding/ · login/       #   entry flows
│  │  └─ dashboard/                 #   overview · plan · goals · progress · body · profile
│  ├─ components/
│  │  ├─ ui/                        #   shadcn-style primitives (button, card, dialog…)
│  │  ├─ dashboard/                 #   shell, screens, modals, nav
│  │  └─ landing/                   #   marketing sections
│  ├─ lib/                          #   store, Firebase (auth/repo/write-queue), env
│  └─ app/{privacy,terms,offline}/  #   legal + offline fallback pages
├─ apps/
│  └─ mobile/                       # Expo Router + NativeWind app
│     ├─ app.config.js · eas.json
│     ├─ babel.config.js · metro.config.js · tailwind.config.js
│     ├─ assets/                    # icon, adaptive-icon, splash, favicon
│     └─ src/
│        ├─ app/                    # expo-router tabs: index/plan/progress/goals/profile
│        ├─ components/             # UI kit, BarChart, CategoryIcon, modals
│        └─ lib/                    # store (AsyncStorage) + cn
├─ packages/
│  └─ core/                         # @smartfit/core — framework-agnostic domain
│     ├─ src/
│     │  ├─ types.ts                #   domain model
│     │  ├─ constants.ts            #   categories, intensities, plans, metadata
│     │  ├─ fitness.ts              #   pure logic: stats, streaks, goals, targets
│     │  ├─ state.ts                #   dependency-free validation / parsing
│     │  ├─ units.ts                #   kg/lb · km/mi · cm/in conversion
│     │  ├─ coach.ts                #   the deterministic coach engine
│     │  ├─ format.ts               #   display formatters
│     │  ├─ seed.ts                 #   demo generator (subpath: @smartfit/core/seed)
│     │  ├─ utils.ts                #   uid / clamp / round
│     │  └─ index.ts                #   barrel export (deliberately omits seed.ts)
│     └─ tests/                     # 57 domain unit tests (node:test)
├─ public/                          # icons, manifest.webmanifest, og.png, sw.js
├─ scripts/                         # seed-firestore.mjs · seed.sql
├─ firestore.rules · firestore.indexes.json
├─ next.config.mjs · tsconfig.json · postcss.config.mjs
├─ eslint.config.mjs · .prettierrc.json
├─ turbo.json
├─ pnpm-workspace.yaml              # workspaces, hoisted linker, React-types override
├─ vercel.json                      # framework=nextjs · pnpm install · next build
└─ .github/workflows/ci.yml         # lint/format · web build · core tests · mobile typecheck
```

### Why a shared core?

Every rule that must not drift between platforms lives in `@smartfit/core`, which
contains **no React and no platform APIs** — it runs in the browser, in Node
(CI/tests) and on native (Metro) unchanged:

- calorie estimation (MET-based, personalised by body mass), aggregation & bucketing
- streaks, goal progress (with the 100% clamp / done flag) and activity targets
- unit conversion, and the validating state parser used by both apps
- the coach engine, the training-plan split logic and activity categories
- the demo seed and the TypeScript domain model

The web app transpiles it via `transpilePackages`; the mobile app resolves it
through Metro's workspace config (`metro.config.js`).

## 🔄 Domain mapping (SmartJib → SmartFit)

| SmartJib (finance)             | SmartFit (fitness)                                |
| ------------------------------ | ------------------------------------------------- |
| Budget envelope / category     | Activity type (Strength, Cardio, HIIT…)           |
| Money place                    | — (every session is logged directly)              |
| Variable expenses              | Workout sessions                                  |
| Fixed recurring bills          | Recurring weekly training schedule                |
| Savings goals                  | Weekly / monthly training goals                   |
| Budgeting strategies           | PPL / Upper-Lower / Full-Body / Cardio plans      |
| Trends (money over time)       | Progress (8-week training volume)                 |
| Net worth                      | Body-metric trends                                |
| Multi-currency                 | Weight / distance units (kg·lb, km·mi, cm·in)     |

## 🔐 Privacy

**Local mode** (no Firebase config): nothing ever leaves the device. Web state
lives under a single `localStorage` key (`smartfit.state.v1`); mobile state under
the same key in AsyncStorage.

**Cloud mode** (Firebase configured): your data lives under `users/{uid}` in
Cloud Firestore and is readable only by you — `firestore.rules` denies every
request that isn't your own authenticated account. A per-account offline mirror
is kept on the device (`smartfit.cache.<uid>`) and is **cleared on sign-out**, so
one account's history can never surface under another.

Either way there are no analytics SDKs and no third-party trackers. Use
**Profile → Export JSON** for a backup, **Import backup** to restore, **Erase
everything** to wipe your data, or **Delete account** to remove data and
credentials permanently. See [`/privacy`](src/app/privacy/page.tsx).

## 🧪 Testing

Domain logic is pure and lives in `@smartfit/core`, covered by **57 tests** in
`packages/core/tests/` (Node's built-in test runner, no framework):

| Suite | Covers |
| --- | --- |
| `fitness.test.ts` | calorie estimation (incl. body mass), aggregation, weekly bucketing, goal progress, plan lookup |
| `streaks.test.ts` | daily/weekly streaks and the rest-day allowance |
| `state.test.ts`   | the validating parser: migrations, bad input, round-tripping |
| `units.test.ts`   | kg·lb, km·mi, cm·in conversion at the display boundary |
| `coach.test.ts`   | coach intents and the numbers behind every answer |
| `targets.test.ts` | activity targets derived from goals, falling back to the plan |

```bash
pnpm test   # or: pnpm --filter @smartfit/core test
```

## 📦 Mobile builds (EAS)

The Expo app ships with an `eas.json` (development / preview / production
profiles). Native builds run through [EAS Build](https://expo.dev/eas):

```bash
pnpm --filter @smartfit/mobile exec eas build --profile preview --platform android
```

`nativewind` is pinned to `~4.1.23` (4.2.x pulls reanimated-4 worklets that break
the SDK-52 / reanimated-3 babel pipeline), mirroring the reference app's setup.

## 🚢 Deployment (Vercel)

The Next.js **web app lives at the repo root** (so Vercel's framework detection
finds `next` and the App Router with zero Root Directory configuration), while
the mobile app and shared package live in `apps/` and `packages/`. The root
**`vercel.json`** pins pnpm and the standard Next build:

```json
{
  "framework": "nextjs",
  "installCommand": "pnpm install",
  "buildCommand": "next build"
}
```

Notes for the monorepo:

- `pnpm-workspace.yaml` sets **`nodeLinker: hoisted`** so `next` resolves from a
  flat root `node_modules` (required for Vercel detection and the Expo/Metro
  toolchain). pnpm 12 reads this from the workspace YAML, not `.npmrc`.
- The root `tsconfig.json` scopes the web typecheck to `src/` and excludes
  `apps/` and `packages/`, so React-Native sources aren't type-checked by Next.
- Native builds are not part of the Vercel build — they go through EAS.

## 🛣 Roadmap

- Exercise library with per-set weight/reps history and progressive-overload hints.
- Full mobile parity: auth, cloud sync and onboarding on Expo (web ships first).
- Push reminders for scheduled sessions (Expo Notifications).
- Component and end-to-end tests above the domain layer.
