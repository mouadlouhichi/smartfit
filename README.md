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
- **Suggested program** — pick your gym in Profile (**Zone Fight** ships with
  its full class timetable) and a suggested week appears right in the
  settings: set a target weight and the mix of classes (HIIT/cardio/combat vs
  strength vs recovery) adapts to how far away you are, then import the whole
  week into your schedule with one click — from Profile or the Plan tab.
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
  answers questions from your real data. No LLM, no network call. Optionally
  plug in any OpenAI-compatible AI endpoint (`NEXT_PUBLIC_AI_*`): the coach
  then shows an "AI answers" switch (off by default, per browser), labels
  AI-written replies, and falls back to the on-device engine on any failure.
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
pnpm test           # web lib tests (hydration, write queue, auth errors, diagnostics)
pnpm test:e2e       # Playwright smoke suite against the production build (needs pnpm build first)
pnpm test:rules     # Firestore rules tests against the emulator (needs Java 17+)
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
| `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` | web | _unset_ | reCAPTCHA v3 site key from Firebase App Check; when set, the client attests every request (enable enforcement in the console only after deploying it) |
| `NEXT_PUBLIC_ERROR_ENDPOINT` | web | _unset_ | Optional **self-hosted**, cookie-free collector for crash reports and web vitals. Unset = nothing is ever sent (see `docs/ops-runbook.md`) |
| `NEXT_PUBLIC_AI_ENDPOINT` | web | _unset_ | Optional OpenAI-compatible chat-completions URL for the coach (Gemini's OpenAI layer, Groq, OpenRouter, Pollinations…). Unset = no AI switch anywhere, everything stays on-device |
| `NEXT_PUBLIC_AI_API_KEY` | web | _unset_ | Provider key, sent as `Authorization: Bearer` (free tiers exist for Gemini/Groq) |
| `NEXT_PUBLIC_AI_MODEL` | web | _unset_ | Model id, e.g. `gemini-2.0-flash`; omit to let the provider choose |

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
│     └─ tests/                     # 70 domain unit tests (node:test)
├─ e2e/                             # Playwright smoke suite (local-mode product journey)
├─ tests/                           # web lib unit tests + tests/rules (Firestore rules, emulator)
├─ docs/                            # design-system.md · firebase.md · ops-runbook.md · audits
├─ public/                          # icons, manifest.webmanifest, og.png, sw.js
├─ scripts/                         # seed-firestore.mjs · seed.sql
├─ firebase.json                    # Firestore rules/indexes deploy config + emulator ports
├─ firestore.rules · firestore.indexes.json
├─ playwright.config.ts
├─ next.config.mjs · tsconfig.json · postcss.config.mjs
├─ eslint.config.mjs · .prettierrc.json
├─ turbo.json
├─ pnpm-workspace.yaml              # workspaces, hoisted linker, React-types override
├─ vercel.json                      # framework=nextjs · pnpm install · next build
└─ .github/workflows/ci.yml         # lint/format/audit · build · unit · e2e · rules · mobile
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

Either way there are no analytics SDKs and no third-party trackers, and the
optional crash-report endpoint (`NEXT_PUBLIC_ERROR_ENDPOINT`) is off unless a
deployment explicitly self-hosts one. The optional AI coach (`NEXT_PUBLIC_AI_*`)
is off twice over — unconfigured deployments hide it entirely, and even then
each athlete must flip an explicit switch before a question plus a compact
training summary ever reaches the provider. Use
**Profile → Export JSON** for a backup, **Import backup** to restore, **Erase
everything** to wipe your data, or **Delete account** to remove data and
credentials permanently. See [`/privacy`](src/app/privacy/page.tsx).

## 🧪 Testing

Four layers, all running in CI (Node's built-in test runner + Playwright — no
heavy frameworks):

**Domain (`packages/core/tests/`, 70 tests)** — pure logic:

| Suite | Covers |
| --- | --- |
| `fitness.test.ts` | calorie estimation (incl. body mass), aggregation, weekly bucketing, goal progress, plan lookup |
| `streaks.test.ts` | daily/weekly streaks and the rest-day allowance |
| `state.test.ts`   | the validating parser: migrations, bad input, round-tripping |
| `units.test.ts`   | kg·lb, km·mi, cm·in conversion at the display boundary |
| `coach.test.ts`   | coach intents and the numbers behind every answer |
| `targets.test.ts` | activity targets derived from goals, falling back to the plan |
| `program.test.ts` | the Zone Fight timetable, the target-driven weekly mix and suggested-program import |

**Web lib (`tests/`, 40 tests)** — the decisions that used to be untestable
inside React: `hydration.test.ts` (what every identity/mode combination sees),
`write-queue.test.ts` (ordering, retries, collapsing, failure surfacing),
`auth-errors.test.ts` (friendly, enumeration-safe messages),
`report.test.ts` (diagnostics stay silent by default and never leak query strings),
`ai-coach.test.ts` (opt-in AI client: URL normalisation, context minimisation,
graceful failure back to the on-device engine).

**E2E (`e2e/`, Playwright)** — the real production build in local mode:
onboarding → log → detail → edit → delete → schedule → goals → body → units →
coach → export → erase, plus deep-link guards, reload persistence, legal/404
pages and the PWA asset chain.

```bash
pnpm build && pnpm test:e2e
```

**Security rules (`tests/rules/`)** — ownership and payload validation against
the Firestore emulator (advisory CI job until observed green, then blocking):

```bash
pnpm test:rules   # requires Java 17+
```

## 📦 Mobile builds (EAS)

> **Status: internal prototype — deliberately descoped from launch.** The Expo
> app has no auth, no cloud sync and no onboarding; its data stays in
> AsyncStorage and cannot see web-account data. Don't surface it to users until
> the parity work in `docs/production-audit.md` §4.8 is done.

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
- Real-time cross-device sync (Firestore `onSnapshot` listeners) — cross-tab
  convergence already ships via the storage-event bridge.
- Launch ops: see `docs/ops-runbook.md` (App Check enforcement, billing alarms,
  scheduled Firestore exports, collector for diagnostics).
