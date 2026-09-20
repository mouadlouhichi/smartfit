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
- [x] `firestore.indexes.json` — 10 new composite indexes (13 total)
- [x] `src/lib/firebase/tenant-repo.ts` — tenant CRUD, roster, slots, bookings, invoices, audit
- [x] `src/app/api/admin/claims/route.ts` — grant/revoke the `sfRole` claim
- [x] `tests/rules/firestore-rules.test.ts` — 22 tenant-isolation tests **written**
- [x] Rules **parse** cleanly under an ANTLR Firestore grammar (syntax only)
- [ ] ⛔ **The 22 rules tests have never executed.** No Java in the sandbox and
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
- [ ] `generateMetadata` per tenant (title/OG from the gym's own branding)
- [ ] Class detail page

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
- [ ] Booking mutations from the member side (the `bookSeat` transaction)

## Phase 6 — Staff console 🟡

- [x] Same tree, capability-filtered nav — a denied section is **absent**, not
      disabled, so a receptionist never learns that a Revenue tab exists
- [x] Staff land on **Today**, not the owner dashboard, because the default tab
      follows whatever the capability filter leaves first
- [x] Today view — classes with booked/capacity and the seat list
- [x] Fast member search → check in (writes `checkins` + `lastVisitAt`)
- [ ] Mark attended / no-show on a booking (`markAttendance` exists, not wired)
- [ ] Verify the filter against a real staff account (demo switcher only so far)

## Phase 7 — Member gym experience ⬜

- [ ] Find/join a gym; membership card with status + expiry
- [ ] Book / cancel / waitlist; my bookings
- [ ] Check-in history
- [ ] Opt-in progress-sharing toggle showing exactly what is shared
- [ ] `/dashboard/**` and the Expo app must stay **unchanged**

## Phase 8 — Platform admin ⬜

- [ ] `/admin` gate on the `sfRole` claim
- [ ] KPI overview · gym registry · gym detail (suspend / restore / change plan)
- [ ] Application queue → provision tenant + subdomain + owner claim
- [ ] Plans & limits config
- [ ] Revenue, incl. offline/transfer payment recording (CMI is the local gateway)
- [ ] Audit log · view-as-gym impersonation (read-only, always audited)

## Phase 9 — B2B billing ⬜

- [ ] Gym-contract billing path alongside the existing Pro provider
- [ ] Member membership purchase at the desk and online

## Phase 10 — Seed, docs, migration ⬜

- [x] `scripts/seed-b2b.mjs` — admin, owner, staff, members + populated tenant (`pnpm seed:b2b`)
- [ ] ⛔ Seed has only had `node --check`; running it needs a real Firebase project
- [ ] `scripts/README.md` entry for `seed:b2b`
- [ ] `docs/firebase.md` — the `gyms/**` model
- [ ] `customGyms` → tenant promotion script
- [ ] README pivot section

---

## Verification log

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm typecheck` | exit 0 | run after every phase so far |
| `pnpm lint` | exit 0 | 0 errors; 1 **pre-existing** `<img>` warning at `profile-screen.tsx:775` |
| `pnpm test` | **129/129** | includes the env-docs guard, which caught 6 undocumented vars |
| `pnpm --filter @smartfit/core test` | **238/238** | was 171 before the pivot; +67 |
| `pnpm test:rules` | ⛔ **cannot run here** | needs Java + emulator jar from GCS |
| tenant routes (dev server) | ✅ all 200, clean log | `/`, `/g/{slug}`, `/g/{slug}/console`, `/dashboard`, `/login`; reserved + malformed slugs render the not-found state |
| `pnpm build` | not yet run | |
| `pnpm test:e2e` | not yet run | Playwright browsers not installed |

## Known environment constraints

- `pnpm` is not on PATH → use `corepack pnpm …`, or `corepack enable` once per session.
- `node_modules` is not persisted between turns → reinstall (~20 s).
- Network egress is limited to `registry.npmjs.org` and `github.com`. Debian apt repos,
  `api.adoptium.net` and `storage.googleapis.com` are all unreachable, which is what
  blocks the Firestore emulator.
- No Firebase project is configured, so the app runs in **local mode** — cloud-only
  paths cannot be exercised end-to-end here.
