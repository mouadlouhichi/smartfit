<div align="center">

# 🏋️ SmartFit

**A private, mobile-first fitness tracker that knows the difference between
training _hard_ and training _smart_.**

[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Tests](https://img.shields.io/badge/tests-7%20passing-2ea44f)](#-testing)

</div>

---

SmartFit is the fitness counterpart of the [SmartJib](https://github.com/mouadlouhichi/flousy-app)
budget tracker. It adopts the **same architecture, design language and quality bar** —
Next.js App Router, React 19, Tailwind v4, shadcn-style UI, a calm tokenised theme,
localStorage demo mode, and a guided onboarding — but applies them to **training**
instead of money.

> **Conceptual parallel.** SmartJib keeps *what money is for* (envelope) strictly
> separate from *where it sits* (place). SmartFit keeps *what a session is*
> (activity category) separate from *the work done* (logged sessions), *the plan*
> (recurring schedule) and *the target* (goals that survive week rollover).

## ✨ Features

- **Log workouts** — strength, cardio, HIIT, mobility, sport & active rest, with
  duration, intensity, estimated calories, distance and exercises.
- **Training plans** — four proven splits: Push/Pull/Legs, Upper/Lower, Full
  Body 3×, and Cardio & Conditioning. Pick one and the weekly split lights up.
- **Recurring schedule** — drop sessions into the week with a day/time/duration;
  toggle them active or delete them.
- **Goals** — weekly & monthly targets for workouts, active minutes, calories or
  distance, with live progress bars that reset each period.
- **Streaks & momentum** — a consecutive-day training streak on the header.
- **Progress analytics** — 8-week volume area/bar charts, activity-mix donut,
  intensity spread.
- **Body trends** — log weight and measurements over time; the trend line shows
  real change.
- **Private by design** — everything lives in `localStorage`. No account, no
  wearable, no server, no trackers. One-tap JSON export / erase.
- **Guided 5-step onboarding**, **light/dark/system** theme, mobile-first
  responsive shell (sidebar on desktop, bottom nav on mobile), and a marketing
  landing page.

## 🧱 Tech stack

- **Next.js 15** (App Router, React Server Components, static export-friendly)
- **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4** with a CSS-variable design token system
- **Radix UI** primitives (dialog, tabs, switch, progress, …) wrapped as
  shadcn-style components in `src/components/ui/`
- **Recharts** for analytics, **lucide-react** icons, **next-themes** for theming
- **localStorage** persistence + realistic demo seed data (zero backend needed)

## 🚀 Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

The app ships with **demo data preloaded** so charts/streaks render immediately.
Erase it from **Profile → Erase everything**, or run through the guided
**onboarding** to start fresh.

```bash
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm test           # node:test unit tests
```

## 🗂 Project structure

```
src/
├─ app/                      # Next.js App Router
│  ├─ page.tsx               # Marketing landing page
│  ├─ onboarding/            # 5-step guided setup
│  ├─ login/                 # Local-first entry / demo
│  ├─ dashboard/
│  │  ├─ layout.tsx          # Auth/onboarding gate
│  │  ├─ page.tsx            # Overview
│  │  ├─ plan/               # Training plan + workout log
│  │  ├─ goals/              # Goal tracking
│  │  ├─ progress/           # Charts & analytics
│  │  ├─ body/               # Body measurements & trends
│  │  └─ profile/            # Settings & data management
│  └─ globals.css            # Design tokens ("Motion" theme)
├─ components/
│  ├─ ui/                    # shadcn-style primitives
│  ├─ dashboard/
│  │  ├─ dashboard-shell.tsx # Sidebar + bottom-nav + header + modals
│  │  ├─ screens/            # One screen per dashboard route
│  │  ├─ modals/             # Workout / Schedule / Goal / Body / Category
│  │  └─ modal-context.tsx   # Global quick-add modal state
│  └─ landing/               # Landing navigation & footer
└─ lib/
   ├─ types.ts               # Domain model
   ├─ constants.ts           # Categories, intensities, plans, metadata
   ├─ fitness.ts             # Pure domain logic (stats, streaks, goals…)
   ├─ store-context.tsx      # React store + localStorage persistence
   ├─ seed.ts                # Demo data generator
   └─ format.ts              # Display formatters
tests/                       # node:test unit tests for domain logic
```

## 🔄 Domain mapping (SmartJib → SmartFit)

| SmartJib (finance)            | SmartFit (fitness)                 |
| ----------------------------- | ---------------------------------- |
| Budget envelope / category    | Activity type (Strength, Cardio…)  |
| Money place (bank/home/wallet)| — (every session is logged direct) |
| Variable expenses             | Workout sessions                   |
| Fixed monthly bills           | Recurring weekly schedule          |
| Savings goals                 | Weekly / monthly training goals    |
| 50/30/20 & other strategies   | PPL / Upper-Lower / Full-Body plans|
| Trends (6-month money)        | Progress (8-week training volume)  |
| Net worth                     | Body-metric trends                 |
| Multi-currency                | Weight/distance units (kg/lb, km)  |

## 🔐 Privacy

SmartFit never sends data anywhere. State is persisted under one
`localStorage` key (`smartfit.state.v1`). Use **Profile → Export JSON** for a
backup, or **Erase everything** to wipe the device copy.

## 🧪 Testing

Domain logic lives in pure functions (`src/lib/fitness.ts`) and is covered by
`tests/fitness.test.ts` — calorie estimation, aggregation, weekly bucketing,
goal progress (including the 100% clamp / done flag), streaks and plan lookup.

## 🛣 Roadmap

- Expo / React Native mobile app (mirroring SmartJib's `apps/mobile`).
- Exercise library with set/rep/weight history and progressive-overload hints.
- Optional cloud sync (Firebase) alongside the local-first default.
- PWA install manifest + offline service worker.
