# SmartFit — Functional & UX Audit with Strava + Competitor Benchmark

**Goal of this audit:** make the user *see the benefit* of paying for Pro mode — and map exactly what to build, fix, and say to get there.

| | |
|---|---|
| **Date** | 2026-09-09 |
| **Branch / commit** | `arena/01a08777-smartfit` @ `885c8f5` (== `main`) |
| **Method** | Static code audit of every screen, modal, store slice, `@smartfit/core` engine, billing adapter, landing site, and mobile app — plus market research on Strava, Hevy, Strong, Fitbod, JEFIT |
| **Prior art** | Builds on `docs/mvp-audit.md`, `docs/production-audit.md`, `docs/functional-audit.md` — this report does **not** re-litigate fixed P0s (data leak, write queue, PWA); it focuses on **product surface, UX, competitive position, and Pro conversion** |

> Note: `pnpm`/`node_modules` are not installed in this sandbox, so tests/builds were not re-run here. Prior branch verification recorded 148 passing tests and a clean `next build` (`docs/functional-audit.md` §6).

## 0. Implementation log (2026-09-09, same branch)

Shipped from this report's action plan (§12):

| # | Action | Status |
|---|---|---|
| 1 | Marketing rewrite → Free-vs-Pro (pricing, FAQ, free-list, CTA) | ✅ done |
| 2 | Un-gated records display, earned badges, CSV; on-device Q&A unlimited | ✅ done (CSV free, records/badges free; coach was already correct — see correction) |
| 3 | Mobile Pro enforcement | ⚠️ partial: Pro status + upsell card in mobile profile; native checkout (RevenueCat) still open |
| 4 | Next-session progression v1 (rules-based, Pro) | ✅ done — `progressionTarget` pre-fills + explains targets in the runner |
| 5 | Readiness/load v1 (Pro) + free blurred tease | ✅ done — `readiness` + `loadSeries`, `ReadinessCard` on overview |
| 6 | Shareable workout cards (free watermarked, Pro clean) | ✅ done — `renderWorkoutPng` + summary button |
| 7 | Paywall placement (onboarding trial, post-PR, trial-ending) | ❌ open — needs modal-stack + notification work (tracked, not started) |
| 8 | Real billing: webhook + portal + rules re-audit; trial 7→14d | ⚠️ partial: provider architecture + Stripe portal link + 14-day trial done; webhook provisioning still open (see `docs/billing.md`) |
| 9 | Lifetime tier $99 | ✅ done (plan, paywall card, parser, rules) |
| 10 | Runner flexibility + FAB + reminders | ❌ open (this round fixed units/labels + search instead) |
| 11–12 | Projections/RPE/wearables/GPS/coach-2.0 | ❌ open — future roadmap |

Also fixed in this round: **cardio measure bug** (runtime + curated cardio entries and free-typed runs now log distance, not load), **exercise search UX** (typo tolerance, slang synonyms, cross-field queries, recents, match highlighting, result counts, clear button, distance badges), and **CMI readiness** (provider interface + dormant CMI module + `docs/billing.md` finance guide — no CMI integration, by decision).

**Correction to §3 P1-1:** re-reading `coach-panel.tsx` showed the free cap already applies to the AI-provider path only (`if (aiAvailable && aiOn && !capped)` → AI; otherwise on-device answers flow uncapped, and the composer is never disabled). The report's claim that "the cap blocks the composer regardless" was wrong — the implementation was already the recommended design. `PRO_GATES` copy now says "6 AI replies / day" to make that explicit.

---

## 1. Executive summary

**SmartFit is a genuinely good free tracker with a paywall nobody will pay through.** The training core loop (log → run → streaks → rings → PRs) now matches the Hevy/Strong tier, the engineering (offline-first, pure domain core, honest gate enforcement) is best-in-class — but the Pro tier fails the one test that matters:

> **Free records what you did. Paid must tell you what it means and what to do next.**

Every successful competitor follows this rule. Strava's free tier logs; the subscription delivers Fitness/Freshness, Relative Effort, route intelligence, and leaderboards. Fitbod charges ~$96/yr for one thing: *tell me what to do today*. SmartFit Pro currently does the opposite — it mostly **shows more of what you already did** (longer ranges, more rows of records, more badges) while the "what next" engine (the coach) is a rule-based keyword matcher whose "unlimited" tier has questionable value.

**The 5 highest-leverage findings:**

| # | Finding | Severity | Conversion impact |
|---|---------|----------|-------------------|
| 1 | **The marketing site actively denies Pro exists** — "no premium tier, nothing to upsell, no subscription — ever" in 3+ sections — while the app contains a $6.99/mo paywall | 🔴 P0 — trust & legal risk | Users who upgrade feel deceived; SEO/landing can't sell Pro |
| 2 | **Pro gates are punitive caps, not aspirational unlocks.** Top-3 records, 3 badges, CSV export = "pay to remove annoyance." Nothing in Pro makes you *train better* | 🔴 P0 — value prop | Core reason conversion will stall |
| 3 | **Mobile bypasses every gate.** The mobile app contains zero Pro/paywall/coach code — any capped user can get everything free on mobile, and mobile users never see an upsell | 🔴 P0 — revenue leak | Paywall is web-only theater |
| 4 | **No billing backend.** Stripe Payment Links with no webhook provisioning, no receipt validation, entitlement = a client-writable Firestore field. No restore path for real purchases, no dunning, no refunds story | 🟠 P1 | Can't take real money safely |
| 5 | **Paywall has no placement strategy.** No onboarding trial offer, no post-PR upsell, no win-back, no feature-tease. The paywall only appears when you collide with a cap | 🟠 P1 | 80% of conversion surface missing |

**Bottom line:** Fix #1 immediately (it's a copy change). Rebuild the Pro value prop around *training intelligence* (#2 + roadmap in §9). Close the mobile hole (#3) before spending a dollar on acquisition. Then #4 and #5 unlock real revenue.

---

## 2. Functional audit — what works ✅

Credit where due — the foundation is strong. Verified in code:

**Core training loop (web)**
- Log workouts (strength/cardio/HIIT/mobility/sport/rest) with duration, intensity, calories, distance, exercises, notes — `WorkoutModal.tsx`
- **Guided session runner** (full-screen, dark): per-set reps × weight, last-session pre-fill (`lastPerformance`), live Epley e1RM, PR detection flash, rest timer with presets/+15s/skip, chime + haptic, finish summary with tonnage — `session-runner-modal.tsx` (1,080 lines, the best-built surface in the app)
- Recurring schedule that doubles as routine templates (`ScheduledWorkout.exercises`, backwards-compatible)
- 4 training splits (PPL, Upper/Lower, Full Body 3×, Cardio) + gym-aware suggested program (Zone Fight timetable)
- Goals (weekly/monthly × workouts/minutes/calories/distance) with live progress + reset logic
- Streaks (day + week), activity rings from the user's *own* goals, consistency heatmap, 9-badge achievement wall, volume-by-muscle bars, 8-week charts
- Exercise catalog: 103 curated + 1,323 runtime movements with animated GIF demos, faceted browse (section → muscle → equipment → search), how-to sheets — genuinely better than Strong's library UX
- Body trends (weight + measurements), JSON export/import, erase-everything, account deletion

**Platform**
- Local-first with optional Firebase cloud mode (offline IndexedDB cache, retrying write queue, per-account cache — the old P0s are fixed)
- PWA (manifest, service worker, offline page, install prompt, `/dashboard?log=1` shortcut)
- Light/dark theming, design tokens, Radix primitives, responsive shell (desktop rail + mobile nav)
- 11 core test suites + web lib tests; Firestore rules tests; Playwright smoke suite

**This already beats:** Strong's free tier (4-routine cap, no supersets on free), Fitbod's free tier (effectively a 3-workout trial), and JEFIT's ad-supported free tier on sheer usable-free value.

---

## 3. Functional audit — gaps & defects ❌

### 🔴 P0-1. Landing site contradicts the paywall (trust-breaking)

Three separate marketing components promise there is **no** paid tier, while `pro-modal.tsx` + `pro.ts` sell one at $6.99/mo / $49.99/yr:

| File | Claim |
|---|---|
| `src/components/landing/pricing-section.tsx` | Two cards: "Free" and **"Also free"** — "There is no premium tier — every advanced feature is included." Footer: "No card, no trial, no subscription — **ever**." |
| `src/components/landing/faq-section.tsx:7-8` | "Is SmartFit free?" → "Yes — every feature is free… There is no premium tier, no trial that runs out, and no card required… **nothing to upsell**." |
| `src/components/landing/free-list-section.tsx` | "Start free. Stay free." … "there is **no premium tier and nothing to upsell**." |

**Why this is the #1 fix:** a user who reads the site then hits a paywall feels tricked — the single worst emotion for conversion. It also makes every Pro marketing effort (SEO, ads, App Store copy) impossible, and "no subscription — ever" next to a subscription checkout is a plausible false-advertising complaint.
**Fix:** rewrite as Free-vs-Pro (§11 has the copy). ~1 day.

### 🔴 P0-2. Mobile bypasses all Pro gates (revenue leak)

`apps/mobile/src` contains **zero** references to `hasProAccess`, coach, trial, checkout, or subscription (verified by grep). It also lacks the runner, coach panel, rings, heatmap, achievements, and records board. Consequences:

1. A free user capped at "top 3 records" on web gets… well, mobile has no records board at all — but the deeper problem: **any gate you add on web is unenforced on mobile**, since entitlement lives in shared state shape and mobile never checks it.
2. Mobile users (the majority of fitness-app usage — gym = phone) **never see a single upsell**. Your highest-intent surface has zero monetization.
3. When you add mobile gates later, existing mobile users will experience it as *taking features away*.

**Fix:** enforce `hasProAccess` in the mobile store before adding any new gate; add a native paywall sheet (RevenueCat is the standard answer — see §11). Until then, treat web Pro as a beta.

### 🔴 P0-3. Pro gates are caps, not superpowers (value-prop failure)

Current gates (`PRO_GATES` in `packages/core/src/pro.ts`):

| Gate | Free | Pro | Verdict |
|---|---|---|---|
| AI coach | 6 replies/day | Unlimited | ⚠️ Strongest idea, weakest execution (see P0-4) |
| Analytics ranges | week/month | + quarter/year | ⚠️ Invisible value — user must be 3+ months in to care; by then they've decided |
| Records & 1RM | top 3 | all | ❌ Punitive — hiding the user's *own* achievements feels like ransom, not reward |
| Achievements | 3 badges | all | ❌ Same — "pay to see your trophies" breeds resentment (Strava/Hevy never gate your own history display) |
| Templates | 3 routines | unlimited | ✅ Legit (matches Strong's 3–4 cap playbook) — but weakest of the standard caps |
| Export CSV | JSON only | + CSV | ❌ Near-zero willingness-to-pay; Hevy gives CSV free; reads as hostage-taking of own data |

Compare the competitor playbook: **free = log everything forever; paid = intelligence, planning, and status.** Nobody gates *your own past* — they gate *your future* (what to do, how you're adapting) and *your standing* (leaderboards, fitness score). SmartFit currently gates the past. §9 rebuilds this.

### 🟠 P1-1. The coach can't carry the paywall (yet)

The "unlimited AI coach" gate assumes the coach is worth paying for. Today:

- The on-device engine is a **deterministic keyword matcher** with 4 quick replies (`coach.ts`). It answers "how am I doing this week" well — but it's the same answer every time, with no memory, no plan generation, no progression advice.
- The "AI answers" switch requires the *operator* to configure `NEXT_PUBLIC_AI_*` — per the README, unset = no switch at all. So for most deployments, "Pro = unlimited AI coach" means **unlimited rule-based replies**. That's not a $50/yr feature.
- The free cap (6/day) counts *all* replies including on-device ones (`coach-panel.tsx:81` — `capped` blocks the composer regardless of AI toggle). Capping deterministic local replies costs you nothing and annoys the user — the marginal cost is zero, so the cap reads as artificial.

**Fix direction:** make the coach *actually intelligent* on the Pro side — adaptive next-workout generation from history + recovery, plateau detection, deload calls, goal-race countdowns (§9.1). Gate the intelligence, not the reply count. Keep on-device Q&A unlimited for everyone (it's free to serve and builds the data moat that makes Pro advice good).

### 🟠 P1-2. Billing is a demo, not a business

`src/lib/billing.ts` = Stripe Payment Links *or* clearly-labeled sandbox. Honest, but:

- **No webhook provisioning.** The README/docs admit receipts must "flip `profile.pro`" — but no webhook endpoint exists in `src/app/api` (there is no `api/` route at all). After real payment, nothing activates Pro. This is the last mile of real money and it's missing.
- **Entitlement is client-writable.** `updateProfile({ pro: {...} })` from the client; sandbox path writes the same stamp shape as paid. Any check of "trial vs paid" is by convention. Firestore rules must be verified to reject client `pro` writes (rules file exists — re-audit when webhooks land).
- **No restore/verify flow for real purchases.** "Restore" today presumably re-reads Firestore; with Payment Links + no customer portal linkage, a user who pays on a new device has no recovery path except manual support.
- **No trial-to-paid bridge.** The 7-day trial is cardless and local; it expires silently with no "trial ending" nudge, no win-back, no downgrade explanation. Strava runs a **30-day** trial [1](https://therunninggenie.com/blog/strava-free-vs-premium-worth-it) — 7 days barely covers one training week + a rest week; users can't feel the value.
- Price page in-app only: no web checkout fallback copy, no "manage subscription" deep link to Stripe Customer Portal.

**Fix:** minimal viable real billing = Stripe Payment Links + a small webhook (Next.js route + Firebase Admin) that stamps `pro` server-side + Customer Portal link + trial-ending emails/nudges. Or RevenueCat once mobile matters (it handles App Store + Play + web entitlements in one place).

### 🟡 P2. Missing category-table-stakes features (functional, not just Pro)

Walked against Hevy/Strong/Fitbod/Strava checklists — SmartFit lacks:

| Missing | Who has it | Impact |
|---|---|---|
| **RPE/RIR per set** | Hevy, Strong (Pro) | Serious lifters' #1 logging dimension; needed for any fatigue/adaptive feature |
| **Supersets / drop sets / circuits** | Hevy (polished), Strong | Runner logs straight sets only |
| **Plate calculator** | Strong (Pro) | Small build, high gym-floor love |
| **Exercise swap / alternatives** ("cable row is taken") | Fitbod, JEFIT | Core gym-floor need; you have the 1,400-exercise graph to power it |
| **Custom exercises** | Hevy (free, capped), Strong (Pro) | Users with bands/chains/home gear hit a wall; custom *activity types* exist but not exercises |
| **Training load / fitness-freshness** (CTL/ATL/TSS-style) | Strava (sub), Runalyze | The "am I overtraining?" answer — a natural Pro anchor |
| **Muscle recovery status** | Fitbod | Powers adaptive suggestions; differentiator |
| **Wearable sync** (Apple Health, Health Connect, Garmin) | Strava (thousands of devices), all majors | Web can't do it; mobile must. Biggest structural gap long-term |
| **GPX import / route tracking** | Strava (core) | You have `geo.ts` + `RouteMap` + `route-art.ts` (share canvas!) but **no GPS recording surface** — the share/export art exists with no recorder feeding it |
| **Progress photos / measurements gallery** | JEFIT, Fitbod | Body-screen is numbers-only |
| **Reminders / notifications** | All majors | No scheduled-session nudge = streaks die silently |
| **Challenges / social / sharing** | Strava (the moat), Hevy feed | Deliberately out of scope for privacy — but *private* challenges (vs. past self) and shareable workout cards cost no privacy |
| **Program builder / progression schemes** (5/3/1, GZCL, linear) | Boostcamp, Strong (paid packs) | Templates are static lists; no %1RM or auto-progression |
| **Warm-up sets / deload logic** | Alpha Progression, RP | |
| **Rest-day / recovery content** | Nike TC, Apple F+ | You model rest days (`weeklyRestDays`) but never use them in UI |

### 🟡 P2-2. Data-model observations (good bones, small holes)

- `ScheduledWorkout.exercises` as template vehicle is elegant and backwards-compatible. But templates have no **versioning** (edit template later ≠ update past logs — correct — but also no "update all future" semantics; fine for now).
- Sets support `reps/weight/distanceM` — no `rpe`, `rir`, `setType` (warmup/drop/failure), `restAfter`. Adding these later = migration; better to add optional fields now while the user base is small.
- No `deletedAt` soft-delete or conflict fields — fine for single-user, but the write queue + multi-device will eventually need last-writer-wins metadata.
- `GeoPoint[]` routes: `simplifyRoute` caps at 500 pts — good. No `activityId → route` linkage surfaced in session detail yet.

---

## 4. UX audit — heuristic evaluation

Scored against Nielsen + fitness-app-specific heuristics (glanceability mid-workout, thumb zone, one-hand gym use, habit loops). Method: code-read of every screen/modal + interaction flow tracing.

### 4.1 Onboarding (5 steps: name → units/rest → strategy → goal → review)

| Heuristic | Finding |
|---|---|
| ✅ Progressive commitment | 5 short steps, skippable-feeling, ends with a real artifact (first goal) |
| ❌ **No value moment** | Onboarding ends → empty dashboard. Category best practice (Fitbod, Strava): first session *planned for you* before you leave onboarding. SmartFit asks for target weight + gym (great data!) then… shows an empty week. The suggested program exists but lives in Profile/Plan — it should be **step 6: "Your first week is ready → Start workout 1"** |
| ❌ **No Pro/trial placement** | Zero mention of Pro during onboarding — the highest-attention 90 seconds in the product. Reference-guide playbook: soft paywall after first value moment ("Your 7-day Pro trial starts with your first workout"). Currently trial is only discoverable inside Settings → Pro |
| ⚠️ Rest days collected, never used | `weeklyRestDays` is gathered at onboarding and then invisible — a broken promise in the first run |
| ⚠️ Units good (kg/lb, km/mi), but target-weight-only goal presets bias toward weight loss; strength users ("bench 100kg") get no first-goal template |

**UX score: 6/10** — smooth but ends in an empty room instead of a first workout.

### 4.2 Core loop: log / run a workout

| Heuristic | Finding |
|---|---|
| ✅ Runner is genuinely gym-usable | Full-screen dark, big clock, pause always visible, per-set pre-fill, demo tiles, haptic+chime rest timer — this is the reference-guide "screen for someone mid-workout" done right |
| ✅ "Start today's workout" card on overview | One-tap from open → runner with today's slot preloaded |
| ⚠️ Pre-logging friction | `WorkoutModal` (manual log) asks date/type/title/minutes/intensity/distance/exercises/notes in one sheet — 7+ fields before Save. Hevy/Strong default everything and let you log a session in ~3 taps. SmartFit should: default date=today, intensity from last same-type session, and collapse exercises/notes behind "add details" |
| ❌ **No mid-workout flexibility** | Runner can't swap an exercise, add an unplanned exercise, or mark "skipped — equipment busy." Real gym sessions deviate; apps that punish deviation get abandoned mid-set. This is the runner's biggest UX hole |
| ❌ No set-type affordance | No warm-up/failure/drop marking → warm-up sets pollute e1RM/volume math and PR detection can fire on a warm-up set |
| ⚠️ Rest timer is per-completed-set only | No manual "start rest now" without completing a set; no per-exercise default rest memory |
| ⚠️ Finish summary has no share/celebrate action | PR moment → Save → …nothing. Strava's entire growth engine is the post-activity share. You built `route-art.ts` share canvas — wire a **shareable workout card** (PRs, volume, streak) into the finish screen |

**UX score: 7.5/10** — best surface in the app, one flexibility upgrade from excellent.

### 4.3 Feedback, retention & habit loops

| Heuristic | Finding |
|---|---|
| ✅ Rings + heatmap + streaks + badges | All four retention visuals present — matches category |
| ⚠️ Streak fragility | `currentStreak` (consecutive days) with no rest-day awareness and no "streak freeze"/recovery mechanic. One rest day (which your own plan prescribes!) kills the streak the app celebrates. Either count "training days vs planned days" (adherence %) or forgive planned rest days |
| ❌ **No notifications/reminders** | The #1 habit-loop tool in every competitor is absent. A "Leg day at 18:00?" push is worth more than any badge |
| ❌ No weekly review moment | Strava's week-in-review, Hevy's streak nudge — SmartFit has the data (`weeklySeries`, `aggregate`) but no "Your week: 4/5 sessions, +2.5t volume" digest surface or share card |
| ⚠️ Goal UX is create-and-forget | Goals have progress bars but no mid-period pacing ("2 workouts left, 3 days left"), no at-risk warning, no celebration state beyond the bar hitting 100% |
| ⚠️ Coach is passive | Coach answers questions; it never *starts* a conversation. No "you're 1 session from your goal," no plateau flag, no deload suggestion. Proactive > reactive for perceived intelligence |

**UX score: 6/10** — visuals present, loops open (no triggers, no payoffs).

### 4.4 Navigation & information architecture

| Heuristic | Finding |
|---|---|
| ✅ 7 sections match mental model | Overview / Plan / Progress / Body / Goals / Coach / Profile — standard, learnable |
| ⚠️ Plan tab is overloaded | Schedule + strategy switch + suggested program + exercise library + history log in one 555-line screen. The library deserves its own tab (it's a destination, not a setting); history deserves its own (it's the logbook lifters live in) |
| ⚠️ Progress tab is overloaded in the other direction | Ranges + volume + heatmap + records + achievements + muscle bars in one scroll (701 lines). Records and achievements are destinations — consider sub-tabs: Overview | Records | Achievements |
| ✅ Deep-linkable dashboard routes | Each tab is a real route — good for PWA shortcuts and future notifications |
| ❌ No global "＋" action | Logging requires navigating to Overview quick-actions or Plan. Category standard: persistent FAB → Log / Start runner. On mobile (gym = one hand, barbell in other), this is the difference between logging and not |

### 4.5 Empty states, errors, offline

| Heuristic | Finding |
|---|---|
| ✅ Starts empty, honestly | No fake demo data; `EmptyState` component exists |
| ⚠️ Empty states describe, don't convert | "Your training grid fills in as you log sessions" — passive. Better: "Log your first workout →" with the action inline. Every empty state should contain its own CTA |
| ✅ Error boundaries + offline page + sync banner | `error.tsx`, `global-error.tsx`, `/offline`, `sync-banner.tsx` — the production audit's work holds up |
| ⚠️ Silent-conflict UX unknown | Write queue retries, but multi-device last-writer-wins has no "which version?" surface. Acceptable pre-scale; log it |

### 4.6 Accessibility & inclusive design

- ✅ Semantic structure, `aria-label`s on icon buttons, real `<button>`s, focus-visible styles via Radix
- ⚠️ Runner inputs (`reps`/`weight` as text inputs) need `inputMode="decimal"` verification + large touch targets with sweaty hands in mind (min 48px — audit the set rows)
- ⚠️ Color-only signals: heatmap intensity, ring closure, PR flash all rely on color; add shape/label redundancy (ring % labels exist — good; heatmap tooltips need checking)
- ⚠️ Motion: crossfading GIF loops + canvas landing art — verify `prefers-reduced-motion` handling
- ❌ No voice control / screen-reader pass documented for the runner — the surface where users literally can't look at the screen

### 4.7 Visual & brand consistency

- ✅ Cohesive ember/dark editorial art direction across category tiles, `start-workout.jpg`, `session-bg.jpg`, `coach-hero.jpg`, `pro-hero.jpg`
- ✅ Token-driven theming, light/dark on web
- ⚠️ Pro surfaces use premium dark-ember; free surfaces are neutral — good separation, but the **paywall is the only place Pro *looks* premium**. Pro subscribers need persistent premium *feel* (badge is there; ambient touches — Pro ring finish, gold PR flashes — sell retention, not just conversion)

**Overall UX score: 6.5/10** — a well-built B+ product whose gaps are all in *loops* (triggers, payoffs, flexibility), not *screens*. Nothing here needs a redesign; everything needs a second pass on behavior.

---

## 5. Competitor benchmark

### 5.1 Strava — the deep comparison (the user asked for this one specifically)

**Positioning:** Strava is not a gym tracker — it's the *social network for endurance athletes* (run/ride/swim/hike), 100M+ athletes, GPS-first. SmartFit is gym-first, private-first. They overlap in: activity logging, goals, streaks/challenges, progress analytics, subscription monetization — and Strava is the monetization benchmark because it converts free → paid better than anyone in fitness.

**Pricing (verified Sept 2026):** **$11.99/mo or $79.99/yr** (50% student discount, 30-day trial) [2](https://www.garagegymreviews.com/strava-fitness-app-review). Annual rose $59.99 → $79.99 — and still converts, which tells you everything about value perception.

**Free vs Subscriber (current split)** [3](https://www.bikeradar.com/advice/fitness-and-training/strava-your-complete-guide) [4](https://therunninggenie.com/blog/strava-free-vs-premium-worth-it):

| Free (record + belong) | Subscriber-only (understand + improve + compete) |
|---|---|
| GPS activity recording | Route Builder (heatmap-based, surface type, offline routes) |
| Social feed, kudos, clubs | Training Dashboard: Fitness Score, freshness, Relative Effort, training load |
| Basic stats (dist/pace/time/elev) | Full segment leaderboards + age/weight filters |
| Beacon safety (now free!) | Custom goals + race analysis |
| Challenges (join) | Create challenges, full segment history (free = top 10 only) |
| | GAP, power curves, HR/power analysis |

**The Strava conversion formula — steal these mechanics:**

1. **Free = the verb, paid = the adverb.** Free tells you *what* (10k in 52:00). Paid tells you *so what* (Fitness 62→68, "you're overreaching") and *what next* (routes matched to your fitness). SmartFit's Pro must make the same split: free = log everything; Pro = readiness, adaptation, next-session plan.
2. **Gate standing, not history.** Strava gates *leaderboards and full segment history depth* — your rank among others — never your own activities. SmartFit gates your own badges. Flip it: your history is sacred; gate *comparative and predictive* views (percentile-vs-past-self, projected 1RM date, "strongest cycle yet").
3. **The social graph is the acquisition engine; data depth is the retention engine.** SmartFit rejects social for privacy (a defensible niche!) — so it must over-invest in the retention side: the weekly review, the fitness score, the "year in training." Private users still crave *meaning*.
4. **Beacon lesson:** Strava moved safety to free [2](https://www.garagegymreviews.com/strava-fitness-app-review) because safety features earn trust and trust earns subscriptions. SmartFit's analog: **CSV/JSON export and full history must be free** — data-hostage features destroy exactly the privacy-trust brand you're building. (Yes: this means un-gating CSV. See §9.)
5. **30-day trial, annual default.** 30 days covers a full training block; 7 days covers an excuse. And Strava prices annual at ~55% off monthly-equivalent — SmartFit's 40% is fine, but the trial length should match a training cycle.

**Where SmartFit can beat Strava (don't compete head-on):** gym intelligence (Strava's strength features are shallow), privacy (no feed pressure, no segment anxiety — a real and growing complaint), coaching (Strava tells you load; nobody tells gym users *what to lift today* — that gap is SmartFit's to own).

### 5.2 Hevy / Strong / Fitbod / JEFIT — the gym-tier playbook

Prices verified July–Sept 2026 [5](https://www.sensai.fit/blog/hevy-vs-strong-2026) [6](https://aitoolsbakery.com/blog/hevy-vs-strong-app/):

| | Hevy | Strong | Fitbod | JEFIT |
|---|---|---|---|---|
| Monthly | $2.99 | $4.99 | $15.99 | ~$12.99 |
| Yearly | **$23.99** | **$29.99** | **$95.99** | ~$70 |
| Lifetime | **$74.99** | **$99.99** | — | — |
| Free tier | Unlimited logging, 4 routines, 7 custom ex., 3-mo advanced graphs | Unlimited logging, 3 routines | 3 workouts then paywall (trial-like) | Full but ad-supported |
| Pro unlocks | Hevy Trainer (auto weight progression), advanced graphs, no… (no ads anyway) | Plate calc, supersets, Watch app, custom ex., CSV | The whole product (adaptive programming) | No ads, advanced analytics, more programs |
| Rating | 4.9 ★ | 4.8–4.9 ★ | 4.8 ★ | — |

**Lessons for SmartFit's $6.99/mo / $49.99/yr positioning:**

1. **You're priced between Strong ($30/yr) and Fitbod ($96/yr).** That slot says "smarter than a logbook, cheaper than a coach." Your feature set must deliver exactly that sentence — today it reads as "logbook with caps," which loses to Strong's $30/yr and Hevy's $24/yr on price alone.
2. **Lifetime is now table stakes in gym apps.** Both Hevy ($75) and Strong ($100) sell lifetime/forever tiers [5](https://www.sensai.fit/blog/hevy-vs-strong-2026). A $99–$129 SmartFit Lifetime would (a) capture the privacy-conscious buyer who hates subscriptions, (b) generate upfront cash, (c) anchor the yearly as "sensible." Add it.
3. **Hevy's free tier is the honesty benchmark:** unlimited logging forever, caps only on routines/custom-exercises/graph-window. SmartFit's free tier is already this generous — say so, loudly, on the rewritten pricing page.
4. **Fitbod proves the ceiling:** $96/yr for *adaptive programming alone*. One killer "tell me what to do" feature is worth more than six caps. This is your Pro north star.
5. **Strong gates the Watch app; Hevy gates graph history-window** (3 months) — note the pattern again: gate *depth of insight* (full history graphs) and *convenience superpowers* (plate calc), never *your own data display*.

---

## 6. SmartFit vs. the field — feature matrix (Sept 2026)

| Capability | Strava $80/yr | Hevy $24/yr | Strong $30/yr | Fitbod $96/yr | **SmartFit now** |
|---|---|---|---|---|---|
| Strength set logging (reps×kg) | ⚠️ basic | ✅ | ✅ | ✅ | ✅ |
| Last-session pre-fill / overload | — | ✅ | ✅ | ✅ (auto) | ✅ |
| e1RM + PR detection | segments, not lifts | ✅ basic | ✅ | ❌ | ✅ (live flash!) |
| RPE/RIR logging | — | ✅ | ✅ Pro | ✅ | ❌ |
| Supersets / drop sets | — | ✅ polished | ✅ | ✅ | ❌ |
| Plate calculator | — | — | ✅ Pro | — | ❌ |
| Rest timer | — | ✅ | ✅ | ✅ | ✅ (presets, chime, haptic) |
| Exercise library + demos | — | 400+ | 200+ | 1,600+ | ✅ 103+1,323 w/ GIFs — **best in class** |
| Custom exercises | — | ✅ (7 free) | ✅ Pro | limited | ❌ |
| Routine templates | — | ✅ | ✅ (3 free) | ✅ auto | ✅ (3 free) |
| Adaptive next-workout | ❌ (load only) | ⚠️ (weights) | ❌ | ✅ (core) | ❌ |
| Training load / readiness | ✅ (Fitness/Freshness) | ❌ | ❌ | ✅ (recovery) | ❌ |
| GPS route tracking | ✅ (core) | ❌ | ❌ | ❌ (sync) | ❌ (art exists, no recorder) |
| Wearable sync | ✅ thousands | ⌚ log-only | ⌚ log-only | ✅ sync | ❌ |
| Social / leaderboards | ✅ (the moat) | feed | ❌ | ❌ | ❌ (by design) |
| Shareable workout cards | ✅ | ✅ | ✅ | ✅ | ❌ (canvas util exists, unwired) |
| Rings / heatmap / badges | ⚠️ (relative) | ⚠️ streaks | ❌ | ⚠️ streaks | ✅ all three |
| Coach / guidance | ❌ | ❌ | ❌ | ✅ programs | ⚠️ rule-based Q&A |
| Body metrics + photos | weight only | ⚠️ | ⚠️ | ✅ | ⚠️ numbers only |
| Reminders / notifications | ✅ | ✅ | ✅ | ✅ | ❌ |
| Data export | ✅ | CSV free | CSV Pro | sub-only | JSON free / CSV Pro |
| Offline-first + privacy | ❌ cloud | ❌ cloud | ❌ cloud | ❌ cloud | ✅ **the differentiator** |
| Web + mobile parity | ✅ | ✅ web+apps | iOS-first | apps | ⚠️ web leads, mobile lags |
| Lifetime purchase | ❌ | ✅ $75 | ✅ $100 | ❌ | ❌ |

**Reading:** SmartFit's free core loop is competitive; its library + privacy + offline story is differentiated; its gaps cluster in exactly the two areas that justify subscriptions industry-wide — **intelligence** (adaptive, readiness, RPE) and **connection** (wearables, sharing). The roadmap writes itself.

---

## 7. Pro value-prop diagnosis: why nobody will pay (yet)

Put yourself in a lifter's shoes at the paywall. They see:

- "Unlimited coach replies" — *replies from what? The thing that answered my 4 canned questions?*
- "Quarter & year analytics" — *I'm 3 weeks in. Come back in a year?*
- "Every lift's records" — *you're hiding MY PRs from ME?*
- "All badges" — *you're hiding MY trophies?*
- "Unlimited routines" — *I run PPL. That's 3. Convenient.*
- "CSV export" — *my own data, held for ransom?*

Three gates feel like **ransom**, two feel like **someday**, one feels like **meh**. Willingness-to-pay research across fitness apps is consistent: users pay for **outcomes** (get stronger, don't get injured, stay consistent), **status** (proof, rank, streaks that matter), and **convenience** (less thinking). Current Pro sells none of the three — it sells *absence of caps*.

**The reframe (memorize this for every Pro decision):**

> **Free: "Log everything, forever, privately."**
> **Pro: "Know what it means. Know what to do next. Prove how far you've come."**

Every Pro feature must answer at least one of: *What does my training mean? What should I do today? How do I show my progress?* Anything that doesn't is a free feature.

---

## 8. Recommended Pro roadmap — features that sell Pro

Ordered by conversion-impact × effort. Each item: **the user-visible benefit** (the sentence that sells it), gate design, and effort.

### 🔥 Tier 1 — Pro saviors (build these before any other Pro work)

**1. Next-Session Planner ("Your workout, written for you")** — *the Fitbod killer*
- Benefit: *"Open the app. Today's exact session — exercises, sets, reps, weights — generated from your history, your recovery, and your goal. Just press Start."*
- How: rules engine v1 (no LLM needed): last-performance + progression rule (e.g. +2.5kg or +1 rep on top set when all sets hit target RPE≤8), muscle-recency balancing from session history, deload every 4th week. V2 adds the optional LLM for variety/explanations.
- Gate: free = this week's template static; **Pro = adaptive weights + auto-progression + "why this session" rationale**. Free users *see* the Pro plan blurred/teased ("Pro would add 2.5kg here — here's why").
- Effort: M (engine exists in pieces: `lastPerformance`, `muscleVolume`, `suggestProgram`). Highest ROI in this report.

**2. Readiness & training load ("Train hard on green days, survive red ones")** — *the Strava Fitness/Freshness answer*
- Benefit: *"A daily 0–100 readiness score: sleep-ish proxy from training recency + volume trend + streak load. Red day? The planner auto-swaps intensity."*
- How: v1 = purely training-derived (acute:chronic volume ratio, days-since-hard-session, streak pressure, planned rest days finally used!). V2 = manual check-in (sleep 1–5, soreness 1–5 — 10 seconds, massive data value) → real readiness algorithm.
- Gate: **Pro-only score + 90-day load chart**; free sees "light/moderate/heavy week" label only. The free label creates the question Pro answers.
- Effort: M. Pairs perfectly with #1 (readiness drives the planner).

**3. Shareable proof ("Gym receipts")** — *the viral loop you already half-built*
- Benefit: *"One-tap cinematic cards: new PR, week-in-review, 100th workout, year-in-training. Post anywhere — with a SmartFit watermark that recruits your friends."*
- How: wire `route-art.ts` canvas patterns → workout/PR/review card renderer → Web Share API + download PNG. Include the GPS route art when routes exist.
- Gate: **free = 1 card style, SmartFit watermark; Pro = all styles, no watermark, video-ish animated export**. Growth (free sharing) + conversion (premium styles) in one feature.
- Effort: S–M. Doubles as the missing post-workout celebration (§4.2).

**4. Paywall & marketing rewrite** — *the 1-day 10×*
- Rewrite pricing/FAQ/free-list per §11, add Free-vs-Pro to landing, add onboarding trial offer, add trial-ending + post-PR upsell triggers (§10). No new tech — pure conversion surface.
- Effort: S.

### 🟡 Tier 2 — Pro depth (next quarter)

5. **Strength standards & projections** ("You're 6 weeks from a 100kg bench") — e1RM trend → projected-date math per lift; percentile-vs-past-self ("strongest cycle yet"). Gate: projections + full per-lift history charts Pro; current e1RM free. Effort: S–M.
6. **Plate calculator + warm-up generator** — auto warm-up ramp (bar → 40/60/80%) injected into the runner; plate breakdown per side. Small build, daily gym-floor touchpoint with Pro. Consider: warm-ups free (they fix the polluted-e1RM bug too — mark `setType: 'warmup'`), plate calc Pro à la Strong. Effort: S.
7. **RPE/RIR logging + fatigue view** — per-set RPE input in runner → estimated fatigue/recovery per muscle group (the Fitbod "recovery status" answer, training-derived). Gate: logging free (data moat!), fatigue/recovery dashboard Pro. Effort: M.
8. **Full history & year-in-training** — keep quarter/year ranges Pro (fine), but add the emotional artifact: auto-generated annual review (sessions, tonnage, PRs, streak bests, before/after body) + share card. Retention + win-back gold. Effort: M.
9. **Goal race / target-date planning** ("Bench 100kg by Dec 1") — reverse-plan required weekly progression from current e1RM trend; pacing alerts ("2.5kg behind pace"). Gate: full Pro; free keeps simple metric goals. Effort: M.
10. **Advanced body composition** — measurements gallery + progress-photo timeline (private, on-device) + weight-trend predictions. Gate: photos + predictions Pro; basic logs free. Effort: M.

### 🟢 Tier 3 — Strategic moat (later, mostly mobile-dependent)

11. **Wearable sync** (Apple Health / Health Connect via mobile; REST/RPE auto-import, HR-based calorie truth) — the price of competing with Strava long-term. Free: import; Pro: HR-powered readiness + calorie reconciliation. Effort: L.
12. **GPS run/ride tracking + route art** — finish what `geo.ts` started: record → map → pace splits → share. Direct Strava overlap; keep scope tight (run/ride/walk only). Gate: tracking free (acquisition!), splits/GAP-style grade analysis Pro. Effort: L.
13. **Private challenges vs. past self** ("Beat last October") — monthly rematch cards, no social graph needed. Gate: Pro (it's a retention feature for committed users). Effort: M.
14. **Coach 2.0 (memory + proactivity)** — weekly briefings, plateau flags, deload calls, goal countdowns, natural-language plan tweaks ("swap Friday to Saturday"). Requires either a real LLM provider deal or a much deeper rules engine. Gate: briefings + proactive nudges Pro; Q&A unlimited free. Effort: L.
15. **Program marketplace / proven programs** (5/3/1, GZCL, C25K-style) — licensed or community programs as importable templates. Revenue share potential. Effort: L.

### Gates to REMOVE or rework (selling ransom hurts the brand)

| Current gate | Action | Rationale |
|---|---|---|
| Records top-3 | **Un-gate display; gate depth** — all PRs visible free; per-lift history charts + projections Pro | Your-own-history ransom; Strava/Hevy never do this |
| Achievements 3-of-9 | **Un-gate earned badges; gate future ones** — earned = always visible; locked-badge previews + exclusive Pro challenges | Hiding earned trophies is uniquely enraging |
| CSV export | **Make free** | The privacy brand cannot hold data hostage; Hevy gives it free; Beacon lesson (§5.1.4) |
| Coach 6/day (all replies) | **Unlimited on-device Q&A free; gate intelligence** (briefings, planner, AI-provider replies when configured) | Zero-marginal-cost cap reads as artificial |
| Quarter/year ranges | **Keep**, but add the free tease (blurred preview + "3 more months to unlock Year view — or go Pro") | Fine gate, needs a shop window |
| 3 routine templates | **Keep** (matches Strong) | Fine gate |

**Resulting Pro pitch after rework:** *"Adaptive planning, readiness score, strength projections, full history + year-in-review, premium share styles, plate calc, fatigue view, goal countdowns — $49.99/yr."* That's a Strong-beating, Fitbod-adjacent proposition at half Fitbod's price. It finally answers *"what do I get?"* with outcomes, not absences.

---

## 9. UX enhancement backlog (all tiers — free UX that *leads to* Pro)

Prioritized by impact; each tagged **[Free UX]** or **[Pro surface]**.

### Quick wins (days each)

1. **[Free UX] Global ＋ FAB** (mobile-first, web too): Log workout / Start runner / Log body — persistent, thumb-zone. The single biggest logging-friction reducer.
2. **[Free UX] Runner: add/swap/skip exercise mid-session** — "equipment busy" flow with alternatives from your 1,400-exercise graph (same-muscle swap suggestions). Kills the #1 abandonment reason.
3. **[Free UX] Runner: warm-up set marking** — `setType` field + toggle; excludes warm-ups from e1RM/PR/volume. Fixes data pollution AND enables the warm-up generator later.
4.. **[Free UX] Streak forgiveness for planned rest days** — adherence % ("5/5 planned days") alongside/instead of raw consecutive-day streak. Uses the `weeklyRestDays` you already collect.
5. **[Free UX] Every empty state gets its CTA** — "Log your first workout →", "Plan your week →". Inline actions, not descriptions.
6. **[Pro surface] Blurred Pro previews (shop windows)** — readiness score blurred, quarter chart blurred, next-session adaptive weights shown-but-locked with one-tap trial start. Users can't want what they can't see.
7.. **[Pro surface] Post-PR upsell** — after a PR flash: "See every record + your projected 100kg date → Try Pro free." Highest-emotion moment in the app, currently monetized at $0.
8. **[Pro surface] Trial-ending nudge (day 5 of 7)** — "Trial ends in 2 days — here's what you'd lose" + keep-Pro CTA. Silent expiry = silent churn.
9. **[Free UX] Manual-logging defaults** — date=today, intensity=last-same-type, collapse exercises/notes behind "details." 3-tap logging.
10. **[Free UX] Mid-period goal pacing** — "2 workouts left · 3 days left" + at-risk state. Turns bars into behavior.

### Bigger bets (weeks)

11. **[Free UX] Onboarding step 6: first week ready** — end onboarding with the suggested program imported + "Start workout 1" CTA + soft trial offer. Converts signup → first session → trial in one flow.
12. **[Free UX] Weekly review card** — auto "Your week: 4/5, +2.5t, 🔥12-day streak" surface + share action. The retention artifact every competitor has.
13. **[Free UX] Proactive coach nudges** — goal-at-risk, plateau (same top set 3 weeks), streak-at-risk, deload-due. Even rule-based, proactivity 10×s perceived intelligence.
14. **[Free UX] Reminders** (PWA push on web, local notifications on mobile) — session-time nudges + streak-saver evening nudge. The habit loop's missing trigger.
15. **[Free UX] Split the Plan tab** — Library and History become first-class tabs; Plan keeps schedule + strategy. Information architecture for a growing app.
16. **[Free UX] Progress photos + measurements gallery** — body-screen glow-up (photos Pro per §8-T2).
17. **[Pro surface] Persistent premium feel** — Pro ring finish, gold PR flash, profile badge (exists) + exclusive app icon/theme. Retention is re-conversion.
18. **[A11y] Runner hardening** — 48px targets, `inputMode=decimal`, reduced-motion path, screen-reader pass, color+label redundancy on heatmap/rings.

---

## 10. Pricing, packaging & paywall strategy

**Price verdict: $6.99/mo / $49.99/yr is defensible — after the value rebuild. Today it's overpriced for what's gated.**

| Anchor | Yearly | SmartFit position |
|---|---|---|
| Hevy Pro | $23.99 [5](https://www.sensai.fit/blog/hevy-vs-strong-2026) | You're 2× — must be visibly smarter |
| Strong PRO | $29.99 [5](https://www.sensai.fit/blog/hevy-vs-strong-2026) | You're 1.7× — planner + readiness justify it |
| SmartFit Pro | **$49.99** | The "smarter than logbook" slot ✅ |
| Strava | $79.99 [2](https://www.garagegymreviews.com/strava-fitness-app-review) | You're 0.6× — credible for gym-only |
| Fitbod | $95.99 [5](https://www.sensai.fit/blog/hevy-vs-strong-2026) | You're 0.5× — the "Fitbod intelligence, half price, private" pitch |

**Recommendations:**

1. **Keep $6.99/$49.99, add Lifetime $99–$129.** Hevy ($75) and Strong ($100) prove the lifetime buyer exists [5](https://www.sensai.fit/blog/hevy-vs-strong-2026); privacy-conscious users disproportionately hate subscriptions. Lifetime = cash now + price anchor that makes yearly look sensible.
2. **Extend trial 7 → 14 days minimum (30 = Strava-standard).** 7 days can't cover a training block + a rest week. Cardless trial is a fine differentiator — keep it, but add the day-5/12 nudge + end-of-trial summary.
3. **Paywall placement map** (each trigger independently worth testing):
   - Onboarding end (soft, skippable): "Start your free Pro trial with your first week"
   - Post-PR celebration → records/projections upsell
   - Blurred readiness/load/projection previews (tap → paywall)
   - 4th routine template (exists — keep)
   - Trial-ending nudge + expired-trial "what you lost" win-back (30/60/90 days)
   - Annual-review teaser ("Your 2026 in training is ready 🔒")
4. **Rewrite the marketing site** (fixes P0-1). Suggested copy direction:
   - Hero sub: *"Free forever to log everything. Pro tells you what to do next."*
   - Pricing: two cards — **Free $0**: "Log unlimited workouts, plans, goals, streaks, full history, JSON+CSV export. Private, offline-first, no card." / **Pro $4.17/mo billed yearly**: "Adaptive next-session planner, readiness score, strength projections, year-in-training, premium share styles, unlimited routines." CTA: "Start 14-day free trial."
   - FAQ: replace "no premium tier" with "What does Pro add?" + "Is my data still private on Pro? (Yes — same local-first architecture; Pro is intelligence, not surveillance.)"
5. **Billing hardening order:** webhook provisioning → Customer Portal link → Firestore-rules re-audit (server-only `pro` writes) → RevenueCat when mobile paywall ships → dunning/win-back emails.
6. **Student/promo lever (later):** Strava's 50%-off student tier [2](https://www.garagegymreviews.com/strava-fitness-app-review) converts price-sensitive lifters; park until billing is real.

---

## 11. Metrics — how to know it's working

| Metric | Instrument | Target (directional) |
|---|---|---|
| Signup → first logged session (24h) | onboarding funnel | ≥60% (fix = step-6 first week) |
| D7 / D30 retention | cohort | D30 ≥25% (category median ~20–30%) |
| Paywall view → trial start | per-trigger funnel | ≥8–12% blended |
| Trial → paid | billing | ≥25–35% (cardless trials convert lower; 30-day helps) |
| Free → paid (overall) | revenue | 3–7% (fitness-app band) |
| Feature adoption: runner/set-fill/PR rate | runner events | PR flash rate, % sessions via runner |
| NPS / store rating | surveys | ≥4.7 ★ to match Hevy/Strong shelf position |
| Support tickets re "where is my PR/badge" | support tags | → 0 after un-gating (validates §8 rework) |

Suggested event taxonomy additions: `paywall_viewed{trigger}`, `trial_started{trigger}`, `trial_expired`, `pro_activated{plan}`, `pro_cancelled{reason}`, `pr_celebrated`, `plan_generated{source}`, `card_shared{channel}`, `week_review_viewed`.

---

## 12. Prioritized action plan (the one-page version)

| Order | Action | Why | Effort |
|---|---|---|---|
| 1 | Rewrite pricing/FAQ/free-list → Free-vs-Pro | P0 trust fix; unblocks all marketing | S |
| 2 | Un-gate records display, earned badges, CSV; unlimited on-device Q&A | Stop selling ransom; earn trust to sell intelligence | S |
| 3 | Enforce `hasProAccess` on mobile + ship mobile paywall sheet | Close the revenue leak before it matters | M |
| 4 | Ship Next-Session Planner v1 (rules-based, Pro) | The one feature worth $50/yr | M |
| 5 | Ship readiness/load v1 (Pro) + free blurred tease | The Strava-answer; pairs with #4 | M |
| 6 | Wire shareable workout cards (free style + Pro styles) | Viral loop + post-workout payoff | S–M |
| 7 | Paywall placement: onboarding trial, post-PR, trial-ending nudge | 80% of conversion surface | S |
| 8 | Real billing: webhook + portal + rules re-audit; trial 7→14/30d | Take real money safely | M |
| 9 | Add Lifetime tier $99–$129 | Capture subscription-haters, anchor yearly | S |
| 10 | Runner flexibility (swap/add/skip, warm-up sets) + FAB + reminders | Core-loop excellence → retention → conversion pool | M |
| 11 | Projections, plate calc, RPE/fatigue, goal countdowns | Pro depth that justifies renewal | M/L |
| 12 | Wearables, GPS, coach 2.0, programs marketplace | Strategic moat | L |

**The pitch this roadmap earns:** *"SmartFit Free logs everything, forever, privately. SmartFit Pro — $4.17/mo — writes your next session, tells you when you're ready, and proves how far you've come. Half the price of Fitbod, none of the feed anxiety of Strava, and your data never leaves your pocket."*

---

## Appendix A — Audit traceability (files read)

- Product: `src/components/dashboard/screens/*.tsx` (6), `src/components/dashboard/*.tsx` (12), `src/components/dashboard/modals/*.tsx` (8), `src/app/*/page.tsx` (11), `src/components/landing/*.tsx` (14)
- Domain: `packages/core/src/*.ts` (`pro.ts`, `coach.ts`, `training.ts`, `fitness.ts`, `geo.ts`, `program.ts`, `state.ts`, `types.ts`, …)
- Billing/state: `src/lib/billing.ts`, `src/lib/store-context.tsx` (via prior audits + gates grep), `src/lib/route-art.ts`
- Mobile: `apps/mobile/src/app/*.tsx` (5), `components/*.tsx` (8), `lib/*` — confirmed: no coach/Pro/runner code
- Prior audits: `docs/{mvp,production,functional}-audit.md` (findings incorporated, not duplicated)

## Appendix B — Sources

- Strava pricing $11.99/mo · $79.99/yr, student −50%, 30-day trial, Beacon now free [2](https://www.garagegymreviews.com/strava-fitness-app-review)
- Strava free-vs-subscriber feature split [3](https://www.bikeradar.com/advice/fitness-and-training/strava-your-complete-guide) · premium value = Route Builder + Training Dashboard [4](https://therunninggenie.com/blog/strava-free-vs-premium-worth-it)
- Hevy/Strong 2026 verified prices, free-tier caps, lifetime tiers [5](https://www.sensai.fit/blog/hevy-vs-strong-2026) [6](https://aitoolsbakery.com/blog/hevy-vs-strong-app/)
- Hevy $23.99/yr · Strong $29.99/yr · Fitbod $95.99/yr comparison [1](https://www.sensai.fit/blog/hevy-vs-strong-vs-fitbod)
- Relative Effort/TRIMP, GAP, Fitness & Freshness as subscriber analytics ([runbikecalc guide](https://runbikecalc.com/blog/strava-training-analysis-complete-guide-2026))
