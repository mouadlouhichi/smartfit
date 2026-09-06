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
  duration, intensity, estimated calories, distance and (web) exercises.
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

- **Local-first & private** — the web app uses `localStorage`; the mobile app
  uses AsyncStorage. No account, no wearable, no backend, no trackers. One-tap
  JSON export (web) and demo/erase on both.
- **Demo mode** — a realistic 6-week training history is seeded on first run so
  charts and streaks render immediately.
- **Guided 5-step onboarding** — name → units/rest days → strategy → first goal →
  review.
- **Light / dark** theming on web; token-driven design system shared conceptually
  across platforms.
- **Marketing site** included (landing, features, how-it-works, plans, FAQ).

## 🧱 Tech stack

| Layer            | Web (`apps/web`)                         | Mobile (`apps/mobile`)                    |
| ---------------- | ---------------------------------------- | ----------------------------------------- |
| Framework        | Next.js 15 (App Router, RSC)             | Expo SDK 52 + Expo Router                 |
| UI runtime       | React 19                                 | React Native 0.76 / React 18              |
| Styling          | Tailwind CSS v4 + CSS variables          | NativeWind 4 (Tailwind)                   |
| Components       | Radix primitives (shadcn-style)          | Custom NativeWind components              |
| Charts           | Recharts                                 | react-native-svg                          |
| Icons            | lucide-react                             | lucide-react-native                       |
| Persistence      | localStorage                             | AsyncStorage                              |
| Shared logic     | **`@smartfit/core`** (TypeScript, no React) | same via Metro workspace resolution    |

The monorepo is orchestrated with **Turborepo** and **pnpm workspaces**.

## 🚀 Quick start

```bash
pnpm install

# Web — http://localhost:3000
pnpm web            # or: pnpm --filter @smartfit/web dev

# Mobile (Expo dev server — scan the QR with Expo Go / a dev client)
pnpm mobile         # expo start
pnpm mobile:android # expo run:android
pnpm mobile:ios     # expo run:ios
```

The apps ship with **demo data preloaded**. Erase it from **Profile → Erase
everything**, or run the guided **onboarding** to start fresh.

## 🧰 Scripts

Run from the repo root (Turbo fans these out across the workspace):

```bash
pnpm dev         # start all dev servers
pnpm build       # production build of every app
pnpm typecheck   # tsc --noEmit in core + web + mobile
pnpm test        # core domain tests
pnpm lint        # lint checks
```

Filter to a single package, e.g. `pnpm --filter @smartfit/web build`.

## ⚙️ Environment variables

SmartFit is **local-first — every variable is optional** and has a default. Copy
the relevant `.env.example` to `.env.local` (web) / `.env` (mobile) to override.

| Variable | App | Default | Effect |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SEED_DEMO` / `EXPO_PUBLIC_SEED_DEMO` | web / mobile | `true` | Seed a demo training history on first run; `false` sends fresh installs to onboarding |
| `NEXT_PUBLIC_DEFAULT_PLAN` / `EXPO_PUBLIC_DEFAULT_PLAN` | web / mobile | `full-body` | Default strategy for new accounts (`ppl` · `upper-lower` · `full-body` · `cardio-focus`) |
| `NEXT_PUBLIC_APP_NAME` / `EXPO_PUBLIC_APP_NAME` | web / mobile | `SmartFit` | Display name (web metadata / document title) |

Env access is centralised and validated in `apps/web/src/lib/env.ts` and
`apps/mobile/src/lib/env.ts` (invalid plan values fall back to the default). See
`.env.example`, `apps/web/.env.example` and `apps/mobile/.env.example`.

## 🗂 Project structure

```
smartfit/
├─ apps/
│  ├─ web/                          # Next.js 15 web + marketing app
│  │  ├─ src/
│  │  │  ├─ app/                    # App Router routes
│  │  │  │  ├─ page.tsx             #   marketing landing
│  │  │  │  ├─ onboarding/ login/   #   entry flows
│  │  │  │  └─ dashboard/            #   overview · plan · goals · progress · body · profile
│  │  │  ├─ components/
│  │  │  │  ├─ ui/                  #   shadcn-style primitives (button, card, dialog…)
│  │  │  │  ├─ dashboard/           #   shell, screens, modals, nav
│  │  │  │  └─ landing/             #   marketing sections
│  │  │  └─ lib/                    #   web store (localStorage) + cn helper
│  │  └─ tests/                     # (domain tests live in core)
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
│     │  ├─ fitness.ts              #   pure logic: stats, streaks, goals, series
│     │  ├─ format.ts               #   display formatters
│     │  ├─ seed.ts                 #   demo data generator
│     │  ├─ utils.ts                #   uid / clamp / round
│     │  └─ index.ts                #   barrel export
│     └─ tests/fitness.test.ts      # domain unit tests
├─ turbo.json
├─ pnpm-workspace.yaml              # workspaces + single-React-types override
└─ .github/workflows/ci.yml         # web build · core tests · mobile typecheck
```

### Why a shared core?

Every rule that must not drift between platforms lives in `@smartfit/core`, which
contains **no React and no platform APIs** — it runs in the browser, in Node
(CI/tests) and on native (Metro) unchanged:

- calorie estimation, weekly/monthly aggregation & bucketing
- streaks, goal progress (with the 100% clamp / done flag)
- the training-plan split logic and activity categories
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
| Multi-currency                 | Weight/distance units (kg/lb, km)                 |

## 🔐 Privacy

SmartFit never sends data anywhere. Web state is persisted under a single
`localStorage` key (`smartfit.state.v1`); mobile state under the same key in
AsyncStorage. Use **Profile → Export JSON** (web) for a backup, or **Erase
everything** to wipe the on-device copy.

## 🧪 Testing

Domain logic is pure and lives in `@smartfit/core`; it's covered by
`packages/core/tests/fitness.test.ts` (Node's built-in test runner):

- calorie estimation & aggregation
- weekly bucketing / series ordering
- goal progress (clamp + done flag)
- streaks and plan lookup

Run everything with `pnpm test` (or `pnpm --filter @smartfit/core test`).

## 📦 Mobile builds (EAS)

The Expo app ships with an `eas.json` (development / preview / production
profiles). Native builds run through [EAS Build](https://expo.dev/eas):

```bash
pnpm --filter @smartfit/mobile exec eas build --profile preview --platform android
```

`nativewind` is pinned to `~4.1.23` (4.2.x pulls reanimated-4 worklets that break
the SDK-52 / reanimated-3 babel pipeline), mirroring the reference app's setup.

## 🚢 Deployment (Vercel)

The Next.js app lives in `apps/web`, so the root **`vercel.json`** tells Vercel to
build only that workspace and where the output is:

```json
{
  "installCommand": "pnpm install",
  "buildCommand": "pnpm --filter @smartfit/web build",
  "outputDirectory": "apps/web/.next",
  "framework": "nextjs"
}
```

No special project settings are needed beyond pointing the project at the repo —
the mobile package intentionally has no web `build` task (native builds go through
EAS), so it isn't built on Vercel.

## 🛣 Roadmap

- Exercise library with per-set weight/reps history and progressive-overload hints.
- Optional cloud sync (Firebase) alongside the local-first default.
- PWA install manifest + offline service worker for the web app.
- Push reminders for scheduled sessions (Expo Notifications).
