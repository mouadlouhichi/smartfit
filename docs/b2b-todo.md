# SmartFit B2B — implementation status

Living tracker for the pivot designed in [`b2b-pivot-plan.md`](./b2b-pivot-plan.md).
Update the checkboxes as work lands. **Verified** means a command in this repo
executed the code path, not that it compiles.

Legend: ✅ done & verified · 🟡 done, not verifiable here · ⬜ not started

---

## Phase 0 — Prerequisites ✅

- [x] Install dependencies (`corepack pnpm install`; `pnpm` is not on PATH, use `corepack pnpm …`)
- [x] Record the green baseline on `main` — `typecheck` 0, `lint` 0 errors, 120 root tests, 171 core tests
- [x] Note: `node_modules` does **not** persist between sandbox turns — reinstall each session

## Phase 1 — Roles & tenancy primitives ✅

- [x] `packages/core/src/rbac.ts` — 4 roles, `PERMISSION_MATRIX`, `can()`
- [x] `packages/core/src/tenant.ts` — slugs, host resolution, plan limits, roster helpers
- [x] Exported from `packages/core/src/index.ts`
- [x] `packages/core/tests/rbac.test.ts` — **29 tests, passing**
- [x] `packages/core/tests/tenant.test.ts` — **38 tests, passing**
- [x] Subpath exports `@smartfit/core/tenant` and `/rbac` (keeps the 54 KB exercise
      catalog out of the edge middleware bundle)
- [x] Bug found by these tests: `tenantPath` left interior double slashes, which is a
      *different Next.js route*, not a cosmetic wart. Fixed.

## Phase 2 — Data layer & security rules 🟡

- [x] `firestore.rules` — `gyms/**` tree; `users/{uid}` unchanged apart from `gymShares`
- [x] `firestore.indexes.json` — composite indexes (14 total; +`checkins uid+at`)
- [x] `src/lib/firebase/tenant-repo.ts` — tenant CRUD, roster, slots, bookings, invoices, audit
- [x] `src/app/api/admin/claims/route.ts` — grant/revoke the `sfRole` claim
- [x] `tests/rules/firestore-rules.test.ts` — tenant-isolation tests **written**
      (22 at Phase 2, +1 check-ins test at Phase 7: staff-recorded, member-read
      own-only, append-only, payload-validated)
- [x] Rules **parse** cleanly under an ANTLR Firestore grammar (syntax only)
- [ ] ⛔ **The rules tests have never executed.** No Java in the sandbox and
      `storage.googleapis.com` (emulator jar) is unreachable. Runs in CI via `pnpm test:rules`.
- [ ] Deploy rules + indexes (`firebase deploy --only firestore:rules,firestore:indexes`)

## Phase 3 — Subdomains ✅ (preview wildcard still open)

- [x] `src/middleware.ts` — host → `/g/{slug}` rewrite, pure string work, edge-safe
- [x] Reserved-word and base-host guards
- [x] `NEXT_PUBLIC_APEX_DOMAIN` / `NEXT_PUBLIC_BASE_HOST` documented in `.env.example` + README
- [x] **Verified live** against a dev server: `acme.localhost` → `x-tenant-slug: acme`;
      apex, `www.`, and `admin.` all correctly serve the apex app
- [ ] ⛔ Whether the e2b preview proxy answers wildcard subdomains is **unverified**
      (sandbox id not discoverable from inside). Non-blocking: `/g/{slug}` works regardless.
- [ ] `vercel.json` wildcard domain + DNS for production

## Phase 4 — Public tenant site ✅

- [x] `/g/[slug]` storefront — hero with the gym's accent colour, facts row,
      description, day-grouped timetable with live seat counts, published pricing
- [x] **Server-rendered.** The layout is a server component that resolves the
      tenant with the Admin SDK, so the content is in the initial HTML. This
      started as a client-only `useEffect` load and rendered an empty skeleton to
      crawlers — for a page a gym puts in its Instagram bio that is an SEO
      failure, not a cosmetic one, so it was rewritten.
- [x] `src/lib/tenant-server.ts` — cloud via Admin SDK, demo fixture otherwise;
      a *configured but failing* SDK is not silently downgraded to demo data
- [x] Not-found (invalid slug) and not-live (pending/suspended/closed) states
- [x] **Verified in the running dev server**: `/g/zone-fight` SSR contains
      "Zone Fight", "Timetable", "Boxing Fundamentals", "390 MAD";
      `/g/admin` and `/g/BAD_SLUG` both render "That gym does not exist"
- [x] `generateMetadata` per tenant — title/description/OG from the gym's own
      branding, one `cache()`d Admin-SDK load shared by layout + page +
      metadata. Verified: `<title>Zone Fight · SmartFit</title>` and the
      gym's tagline as `og:description` in the served HTML
- [x] Class detail page — `/g/[slug]/class/[classId]`: template facts,
      upcoming occurrences with live seat counts, book/cancel actions, its own
      metadata. Unknown class id → 404 (verified). Links from every timetable
      row
- [x] **Two demo tenants** (pivot DoD: "two gyms reachable via `/g/{slug}`") —
      the demo layer is a per-slug fixture registry, not one gym aliased under
      every URL. `zone-fight` (the original, unchanged) and `iron-house` —
      Iron House Strength, a Starter-plan gym nine days into its trial,
      mirrored in `admin-demo.ts` (Nadia Cherkaoui, Rabat, 3 classes, no
      invoices yet). Personas bind per gym: the switcher says "Nadia — gym
      owner" on Iron House, "Youssef — gym owner" on Zone Fight — a role at
      one gym says nothing about another. Unknown slugs render the not-live
      state (gym null), the same answer a missing Firestore doc gives.
      Verified in the prod build: `/g/iron-house` SSRs "Iron House Strength"
      and "Powerlifting Basics" with zero Zone Fight leakage; `/gyms` lists
      both; `/g/does-not-exist` says "not open yet"; `/g/zone-fight`
      unchanged.

## Phase 5 — Gym owner console ✅ (writes wired; cloud path unexercised)

- [x] `/g/[slug]/console` — capability-filtered nav, role badge, demo-role switcher
- [x] Overview — active members, MRR, collected (30d), occupancy, at-risk,
      expiring, frozen, and a win-back worklist
- [x] Timetable — class templates + scheduled occurrences with fill
- [x] Members — roster with status, check-ins, last-seen, days-to-expiry, notes,
      at-risk flag
- [x] Revenue — MRR, collected, invoiced, per-invoice list
- [x] Plans · Staff · Settings (read-only)
- [x] `src/lib/tenant-metrics.ts` — extracted pure, **9 unit tests passing**
- [x] **Writes wired** through a single `run()` path in the provider:
      freeze/reactivate a member, check a member in, add a class, schedule an
      occurrence, take a payment (issues a paid invoice), add a plan, edit
      branding. Each returns `false` on failure so no success toast can lie.
- [x] After a cloud write the provider **refetches** rather than patching
      locally, so the screen shows what the server accepted — the rules may
      reject a write the client thought was fine.
- [x] `ToastProvider` mounted in the tenant shell (the rest of the app mounts it
      inside `DashboardShell`, so tenant routes would have thrown on `useToast()`)
- [ ] ⛔ Writes only exercised in **demo mode**. No Firebase project here, so the
      cloud path (`saveMembership`, `checkIn`, `saveClass`, `issueInvoice`,
      `savePlan`, `saveGymProfile`) has never run against real Firestore.
- [x] Booking mutations from the member side — wired through the same `run()`
      path (Phase 7): `bookSeat` (the capacity transaction), `cancelBooking`
      (releases the seat), plus staff `markAttendance` and `promoteFromWaitlist`

## Phase 6 — Staff console 🟡

- [x] Same tree, capability-filtered nav — a denied section is **absent**, not
      disabled, so a receptionist never learns that a Revenue tab exists
- [x] Staff land on **Today**, not the owner dashboard, because the default tab
      follows whatever the capability filter leaves first
- [x] Today view — classes with booked/capacity and the seat list
- [x] Fast member search → check in (writes `checkins` + `lastVisitAt` + a
      `checkins/{visitId}` record, as one batch in cloud mode)
- [x] Mark attended / no-show on a booking — `markAttendance` wired into every
      booked row on Today (`class:attend:mark` gated); waitlist rows get a
      **Promote** action (`waitlist:promote`) that takes the next seat in a
      transaction. Demo fixture always schedules one class later today with
      booked + waitlisted rows so the view is populated on any run date
- [ ] Verify the filter against a real staff account (demo switcher only so far)

## Phase 7 — Member gym experience 🟡 (demo-verified; cloud path unexercised)

Everything ships on the **gym's site** (`/g/{slug}`), not in `/dashboard` —
the B2C app is untouched (see the guard below).

- [x] **Find a gym** — `/gyms` public directory (server-rendered, live tenants
      only, `force-dynamic` so a newly approved gym appears without a deploy);
      linked from every storefront footer and from `/login`
- [x] **Join** — one tap on the storefront for a signed-in non-member
      (`joinGym()` self-enrols as `role: 'member', status: 'trial', checkins: 0`,
      exactly the shape the rules accept). The pricing "Join" buttons send
      signed-out visitors to `/login?gym={slug}`, and the login gateway now
      returns them **to the gym** instead of the dashboard
- [x] **Membership card** — status badge, plan, expiry countdown
      (`daysUntilExpiry`), member since, check-ins all-time + this month,
      last visit — all from the gym-owned roster row
- [x] **Book / cancel / waitlist** — actions on every timetable row *and* the
      class detail page: Book (seats left), Join waitlist (full), Cancel
      (releases the seat), all capability-gated (`booking:create:self` /
      `booking:cancel:self`). "My classes" lists upcoming + history with
      attendance statuses. Capacity is the `bookSeat` transaction in cloud
      mode; in demo the same decision runs on local state
- [x] **Check-in history** — new append-only `gyms/{slug}/checkins/{visitId}`
      collection (rules + composite index + 5 rules tests written). `checkIn()`
      now writes counter + visit record as one batch; the member sees their own
      visits, nothing else
- [x] **Opt-in progress sharing** — toggle showing *exactly* what is shared:
      sessions this month, rest-day-aware streak, class attendance %. Computed
      by `src/lib/gym-share.ts` (pure, **6 unit tests**), written to the
      member's own `users/{uid}/gymShares/{slug}`, revocable in one tap
      (delete = revoke). The member's tracker data never crosses the boundary
- [x] **Demo personas** — the storefront switcher binds each demo role to a
      fixture person (owner/staff/member), adds a **prospect** persona (signed
      in, not a member) so the join flow is walkable without Firebase
- [x] **`/dashboard/**` + Expo untouched** — no file under `src/app/dashboard`,
      `src/components/dashboard` or `apps/mobile` was modified (verified with
      `git diff --stat` against the pivot base); the only non-tenant web
      changes are the login gateway's `?gym=` return path and a directory link
- [x] **E2E spec written** (`e2e/tenant.spec.ts`): directory → storefront →
      join → book → cancel → share toggle → staff check-in/attendance/promote,
      plus staff/RBAC tab-absence assertions. ⛔ Cannot run in this sandbox
      (`cdn.playwright.dev` unreachable — browsers won't download); runs in CI
      via `pnpm test:e2e`
- [ ] ⛔ Cloud path unexercised — `joinGym`, `bookSeat`, `cancelBooking`,
      `markAttendance`, `promoteFromWaitlist`, `shareWithGym`, `loadCheckins`
      have never run against real Firestore. No Firebase project here; every
      one of them is covered by rules that *should* accept the exact payload
      sent (shapes pinned in `tests/rules/firestore-rules.test.ts`), which is
      the strongest statement available without a project
- [ ] Reminders for booked classes (should-have; needs notifications infra)

## Phase 8 — Platform admin 🟡 (demo-verified; cloud writes unexercised)

- [x] `/admin` gate on the `sfRole` claim — client check for UX, every route
      re-verifies from the decoded token server-side. Claim staleness
      (~1 h) handled visibly: the refusal card offers *Recheck my access*
      (`getIdToken(true)`), it never just says no. A **signed-out** visitor
      gets a sign-in card (`/login?next=/admin`, validated same-app path)
      — not the role-refusal message, which read as a verdict on an account
      the app had never inspected. `scripts/grant-admin.mjs` promotes one
      existing account (`--remove` revokes) without seeding the demo org
- [x] KPI overview — live gyms, platform MRR (active + past-due only; trials
      are not revenue), members/staff/classes totals, collected 30d, new this
      month, tenants-by-status, MRR by plan, pending-applications worklist.
      `computeAdminOverview` is pure, **10 unit tests** (`tests/admin-model.test.ts`)
- [x] Gym registry — searchable (name/slug/city), status-filtered, rollups
      (members, classes, member revenue) assembled server-side by the Admin SDK
- [x] Gym detail — profile, plan vs usage, lifecycle actions (suspend /
      restore / close — reversible kill switch, field updates only), change
      platform plan, assign owner (writes the membership row the rules read),
      subscription payment history
- [x] Application queue → approve provisions the tenant (`status: 'trial'`,
      Starter plan, owner membership row when the email matches an account,
      slug uniqueness enforced — a taken explicit slug fails loudly, a
      generated one disambiguates); reject records a reason. Public intake is
      the rate-limited `/api/apply` + the "List your gym" form on `/gyms`
- [x] Plans & limits config — price/limits per tier, merged over
      `platform/config`, every field bounded server-side
      (`validatePlanPatch`, tested)
- [x] Revenue — platform MRR, collected 30d, per-gym rollup, and
      **offline payment recording** (cash / transfer / CMI — the local norm),
      defaulting to the gym's plan price
- [x] Audit log — every admin route appends actor/action/target/meta to
      `platform/audit/entries` (same stream the claims route writes); shown
      newest-first. Append-only by construction (Admin SDK only)
- [x] View-as-gym impersonation — `/g/{slug}/console?viewAs=1` renders every
      console screen **read-only by construction**: the tenant provider's
      single write path refuses all mutations while the banner is up.
      Persistent, named banner; entering the session is audited
- [x] Demo fixtures (`admin-demo.ts`) — four gyms, a pending application, a
      rejected one, payments, audit entries — so the whole console is
      explorable in preview; `seed:b2b` now seeds the same shape into a real
      project (1 pending application, 3 platform payments, audit entries)
- [x] **Verified in the dev server**: all 7 `/admin` routes + detail render
      with demo content (KPIs, registry rows, queue, tiers, payments, audit);
      **and against the production build**: every route 200,
      `POST /api/admin/gym` (the kill switch) refuses an unauthenticated call
      with 401, `/api/apply` validates live (bad email → 400 with both
      errors; reserved slug `admin` → the applicant-facing message)
- [x] e2e (`e2e/tenant.spec.ts`, +4 tests): KPI band + registry filter,
      suspend → audit entry, approve → provisioned tenant in registry,
      plans edit. ⛔ runs in CI only (Playwright CDN unreachable here)
- [ ] ⛔ Cloud writes unexercised — no Firebase project in the sandbox, so
      provisioning, suspend/restore, plan changes, payment recording and the
      apply intake have never run against real Firestore. Their Firestore
      side-effects are Admin-SDK only (which bypasses rules by design), so
      the emulator suite would not cover them either; they need a staging
      project
- [ ] Per-tenant feature flags (`platform/config.flags`)
- [ ] Announcements to gym owners; data-export/delete for compliance

## Phase 9 — B2B billing 🟡 (demo-verified; cloud writes unexercised)

Both money flows are **offline-first** (transfer/cash are the local norm), the
shared arithmetic is pure and tested (`src/lib/billing/gym-contract.ts`,
**8 tests**), and one invariant holds everywhere: *a browser can never mint a
paid invoice* — the rules make `invoices` operator-only and the online half is
a server route. Full model: `docs/billing.md` §4.

- [x] **Gym-contract billing path** alongside the Pro provider — recorded
      payments (Phase 8) now also **auto-activate**: a payment converts
      `trial` → `active` and clears `past_due`, but never overrides a suspend
      (`gymStatusAfterPayment`, pinned by test). Dunning-lite contract state
      (`current → due at 28d → overdue at 35d`, anchored to the last payment,
      never the signup) is **derived, never stored**, so the badge cannot
      disagree with the books: shown in the admin registry (overdue badge) and
      on the gym page (state + last payment date)
- [x] **Member purchase at the desk** — the console's sale now completes the
      membership: `settlePlanPurchase()` writes the paid invoice **and**
      applies plan/status/expiry in one batch (`extendedExpiry` runs from the
      later of now and the current expiry, so renewing early never steals paid
      days — pinned by test). Draft requests from the site appear in a
      "To collect" queue with one-click collect
- [x] **Member purchase online** — a published plan on `/g/{slug}` gets
      "Choose this plan" for signed-in members →
      `POST /api/billing/gym/purchase`: verifies the membership, copies the
      amount **server-side** from the published plan, idempotent per open
      request, records a **draft** invoice (a request, never a receipt). The
      plan card then shows "Waiting for the desk" until collected. Online CMI
      checkout remains the documented dormant contract (billing.md §3/§4)
- [x] **Verified in the dev server (demo)**: member persona picks a plan →
      draft appears; owner persona sees it in "To collect" → collecting marks
      it paid and moves the membership (plan, status, expiry) in the same
      render; walk-in sale applies the plan too
- [ ] ⛔ Cloud writes unexercised (`/api/billing/gym/purchase`,
      `settlePlanPurchase`, payment auto-activation) — no Firebase project
      here; all three are Admin-SDK/client-batch writes against paths whose
      rules-accepted shapes are pinned in `tests/rules/firestore-rules.test.ts`

## Phase 10 — Seed, docs, migration 🟡

- [x] `scripts/seed-b2b.mjs` — admin, owner, staff, members + populated tenant (`pnpm seed:b2b`);
      now also seeds door check-ins and one class later **today** (idempotent,
      deterministic ids, booking counters accumulated correctly across plan rows)
- [ ] ⛔ Seed has only had `node --check`; running it needs a real Firebase project
- [x] `scripts/README.md` entry for `seed:b2b`
- [x] `docs/firebase.md` — the `gyms/**` model (+ the member-share boundary in prose)
- [x] README pivot section — "Gyms (B2B)" under Features + `seed:b2b` in Scripts
- [x] `customGyms` → tenant promotion script — `scripts/promote-custom-gym.mjs`
      (`pnpm`-less `node scripts/…`): provisions `gyms/{slug}` (trial, chosen
      plan), writes the owner membership row the rules read, converts every
      class into a template and classes with weekday+time into scheduled
      slots. **Nothing is moved** — the personal `customGyms` document stays
      untouched (pivot plan §6). Documented in `scripts/README.md`;
      ⛔ `node --check` only (needs a real project to run)

---

## Post-DoD — the member app's gym surfaces became tenants

The member tracker still had two legacy gym concepts the pivot never touched:
a **static in-repo gym registry** (`GYM_PROGRAMS`, a hardcoded fake Zone Fight)
behind onboarding's "Your gym — optional" picker and the Plan tab's suggested
week, and the personal **"custom gyms" builder** (917-line GymManagement on
the Plan tab, profile cards counting them). A gym in the member app and a gym
on the platform were two different things — the architecture is now applied
everywhere:

- [x] `packages/core`: the static program (`ZONE_FIGHT`, `GYM_PROGRAMS`,
      `getGymProgram`) is gone; `suggestProgram(state, program)` takes the
      gym as an argument and `findGymProgram(list, gymId)` resolves the
      selection against the live list. The engine is tenant-agnostic (core
      tests run on a synthetic fixture).
- [x] `src/lib/tenant-server.ts` `loadGymPrograms()` — every live tenant
      folded into the engine's `GymProgram` shape (classes + a 14-day slot
      window → deduped weekly pattern; opening hours → summary line). Demo
      mode maps the fixtures; `GET /api/gym-programs` exposes it (same public
      data as the storefront).
- [x] Onboarding is a server route now (`force-dynamic`): the picker lists
      the real gyms and links the `/gyms` directory.
- [x] Plan tab: `GymPicker` replaces GymManagement — pick a tenant, the
      suggested week imports from its real timetable, "Open page" links to
      `/g/{slug}`. Profile cards follow ("Your gym — pick a gym, build your
      week"; the custom-gyms badge is gone).
- [x] **The personal custom-gyms builder is retired from the UI.** Data
      model, `users/{uid}/**` rules and existing account data are untouched
      (private by design); `promote-custom-gym.mjs` keeps working.
- [x] +3 e2e (19 total in `tenant.spec.ts`): picker lists real tenants,
      `/api/gym-programs` shape, plan-screen pick → link through.
- [x] **Admin can set up a gym directly** — "Set up a gym" in the registry:
      name (address derived or explicit, uniqueness-checked with the same
      rules as application approval), city, owner email (resolved to the
      membership row when the account exists, otherwise a note to assign
      later), platform plan (validated against the effective tiers),
      accent colour. Provisions `status: 'trial'` + audit `gym:create`;
      `assign-owner` now accepts an email as well as a uid. +1 e2e (20).

## Verification log

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm typecheck` | exit 0 | run after every phase so far |
| `pnpm lint` | exit 0 | 0 errors; 1 **pre-existing** `<img>` warning at `profile-screen.tsx:775` |
| `pnpm test` | **153/153** | +10 `tests/admin-model.test.ts` (overview), +8 `tests/gym-contract.test.ts` (contract states, expiry extension); the env-docs guard caught 4 undocumented `B2B_PROMOTE_*` script vars — fixed in `.env.example` |
| `pnpm --filter @smartfit/core test` | **238/238** | was 171 before the pivot; +67 |
| `pnpm test:rules` | ⛔ **cannot run here** | needs Java + emulator jar from GCS; checkin rules tests **written** (+1 test, 7 asserts) |
| tenant routes (dev server) | ✅ all 200, clean log | `/`, `/g/{slug}`, `/g/{slug}/class/{classId}`, `/g/{slug}/console`, `/gyms` (incl. the apply form), `/dashboard`, `/login`; reserved + malformed slugs render the not-found state; unknown class id → 404 |
| admin routes (dev server) | ✅ all 7 + gym detail | `/admin`, `/admin/gyms`, `/admin/gyms/{slug}`, `/admin/applications`, `/admin/plans`, `/admin/revenue`, `/admin/audit` render with demo content (KPI band, registry, queue, tiers, payments, audit) |
| admin API guards (prod build) | ✅ | `GET /api/admin/data` → 401 without a token; `POST /api/admin/gym` (kill switch) → 401; `POST /api/apply` validates live: junk email → 400 with combined errors, reserved slug `admin` → applicant-facing message |
| billing guards + SSR (prod build) | ✅ | `POST /api/billing/gym/purchase` → 401 without a token (a browser cannot mint even a draft); storefront SSRs "Choose this plan" for the member persona; admin registry SSRs the derived "overdue" contract badge |
| second tenant (prod build) | ✅ | `/g/iron-house` SSRs its own name/branding/timetable (0 "Zone Fight" hits); `/gyms` lists both gyms; `/g/does-not-exist` renders the not-live state, not an aliased gym |
| tenant SSR content (curl) | ✅ | storefront HTML contains the member section (membership card, My classes, Visits, Progress sharing), per-tenant `<title>`/`og:` metadata, class-detail occurrences with seat counts, directory entries |
| `pnpm start` (production) | ✅ all 200 | 16 routes swept from the built output — dashboard, storefront, class detail, console, `/gyms`, all 7 admin pages, `/login`, purchase API. Gotcha found: building while `next dev` is running corrupts `.next` (prod then 500s half the routes) — **stop the dev server before `pnpm build`** |
| `pnpm build` | ✅ **exit 0** | `/g/*`, `/gyms`, `/admin/**` + all admin/apply API routes correctly dynamic; middleware 32.9 kB |
| `pnpm test:e2e` | ⛔ **cannot run here** | `e2e/tenant.spec.ts` **written** (20 tests: tenant journey, admin console, membership purchase, second tenant at `/g/iron-house` + directory listing + unknown-slug not-found); `cdn.playwright.dev` unreachable — CI runs it |

## Known environment constraints

- `pnpm` is not on PATH → use `corepack pnpm …`, or `corepack enable` once per session.
- `node_modules` is not persisted between turns → reinstall (~20 s).
- Network egress is limited to `registry.npmjs.org` and `github.com`. Debian apt repos,
  `api.adoptium.net`, `storage.googleapis.com` and `cdn.playwright.dev` are all
  unreachable, which is what blocks the Firestore emulator and Playwright browsers.
- No Firebase project is configured, so the app runs in **local mode** — cloud-only
  paths cannot be exercised end-to-end here.
- **ToastProvider is root-mounted** (`AppProviders`), as of Phase 8. It used to be
  mounted per subtree (DashboardShell, then tenant shell, then admin), and every new
  route tree 500'd on its first `useToast()` until someone remembered — that bug
  happened three separate times. The stack is viewport-fixed, so one root mount is
  position-identical; do not reintroduce per-shell mounts.


## 22 September continuation — team access release safety

- [x] Read-only `audit:team` owner/membership preflight, explicit project and bounded pagination.
- [x] Typed real-SDK Auth/Firestore integration suite added to blocking CI, with pinned CLI and demo-only projects.
- [x] Production emulator-variable rejection and bounded streaming feature-API JSON parsing.
- [ ] Run official rules and integration suites: Java/GCS downloads remain blocked in this sandbox.
- [ ] Audit actual staging/production owners and run deployed two-browser role grant/revoke smoke tests.
- [ ] Complete provider, operations and native release gates listed in `team-access-and-release-readiness.md`.

The earlier environment/verification entries above are historical. Browser tooling was
available in prior UI passes (20 targeted tests passed); this continuation verifies the
new audit/config/request-body logic and prepares emulator coverage, not a live deployment.
