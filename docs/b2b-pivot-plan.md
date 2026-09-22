# SmartFit B2B pivot — personas, permissions & implementation plan

**Status:** proposal, awaiting sign-off. Nothing in this document is implemented yet.
**Scope:** move SmartFit from B2C-only to **B2B2C** — gyms are customers (tenants),
their members are end users. Four roles, dedicated subdomain per gym.

---

## 1. Current state (verified against the repo)

Every claim below was checked in the working tree, not assumed.

| Fact | Evidence |
| --- | --- |
| No role/permission concept exists anywhere | `grep -rn "role\|admin\|owner"` over `packages/core/src/types.ts` and `src/lib/env.ts` returns **zero** matches |
| Auth is identity-only — no claims, no roles | `src/lib/firebase/auth-context.tsx` exposes `signUp` / `signIn` / `signInWithGoogle` / `signOut` only; no `getIdTokenResult`, no custom claims |
| A "gym" is **not** a tenant — it is a document inside one user's tree | `packages/core/src/gym.ts` defines `CustomGym`; `src/lib/firebase/repo.ts` lists `customGyms` as a sub-collection of `users/{uid}`; `firestore.rules` → `match /users/{userId} { match /customGyms/{docId} { allow … if isOwner(userId) } }` |
| Rules are owner-only, deny-by-default | `firestore.rules` ends with `match /{document=**} { allow read, write: if false; }` |
| No subdomain handling of any kind | `find . -name middleware.ts` → **no results**; `vercel.json` has only `installCommand`/`buildCommand`, no `rewrites`; `next.config.mjs` has `headers()` only |
| Existing gym UI is a personal toy, not a business console | `src/components/dashboard/gym/gym-management.tsx` (917 lines) is rendered inside `src/components/dashboard/screens/plan-screen.tsx:198`; it lets *one member* invent a gym and its classes |
| Server route pattern to copy already exists | `src/app/api/account/delete/route.ts` — Admin SDK, bearer-token verification, same-origin check, transaction-claimed job, `runtime = 'nodejs'` |
| B2B billing hooks partially exist | `src/lib/billing/` has a provider interface (`stripe-links`, `cmi`, `sandbox`); CMI is the Moroccan gateway. It prices **individual Pro**, not gym contracts |
| Local-mode fallback must keep working | `src/lib/firebase/config.ts` → `isFirebaseConfigured` gates cloud mode; `src/lib/store-context.tsx` runs fully offline otherwise |
| Test conventions | `pnpm test` = `node --import tsx --test tests/*.test.ts`; `packages/core/tests/*`; rules tests need the emulator via `pnpm test:rules`; Playwright in `e2e/` |
| Dependencies were absent, now installed | `ls -d node_modules` → absent at audit time; installed via `corepack` in Phase 0 (see §9). `pnpm` is **not** on PATH here — use `corepack pnpm …` |

**The core problem:** multi-tenancy is impossible while a gym lives under `users/{uid}`.
The whole pivot is a consequence of moving the gym to a top-level collection and
introducing a role layer on top of it.

---

## 2. Decisions locked with you

1. **Roles:** `member` + `platform-admin` + `gym-owner` + `gym-staff`, with an
   explicit per-capability permission matrix (§4).
2. **Tenancy: hybrid.** Gym business data (profile, branding, timetable, classes,
   staff, memberships, bookings, revenue) lives top-level under `gyms/{gymId}`.
   A member's private training data **stays** in `users/{uid}` and is tagged with
   `gymId`. Owners see roster + aggregates, **never** raw member workout logs.
3. **Subdomains:** host-based resolution (`acme.smartfit.app`) **plus** a
   `/g/{slug}` path fallback, so every tenant is clickable in the e2b preview.

---

## 3. Target architecture

```
        acme.smartfit.app          smartfit.app/admin          smartfit.app/dashboard
   (preview: /g/acme/…)                  │                              │
                 │                       │                              │
        ┌────────▼─────────┐             │                              │
        │  src/middleware  │  host → /g/{slug} rewrite (pure string)     │
        └────────┬─────────┘             │                              │
                 │                       │                              │
   ┌─────────────▼──────────┐   ┌────────▼─────────┐   ┌────────────────▼───────┐
   │  /g/[slug]  public site│   │ /admin  platform │   │ /dashboard  member app │
   │  /g/[slug]/console     │   │ (custom claim)   │   │  (unchanged B2C)       │
   │  owner + staff console │   └────────┬─────────┘   └────────────┬───────────┘
   └─────────────┬──────────┘            │                          │
                 │      capability check (rbac.can)                 │
                 │                       │                          │
   ┌─────────────▼───────────────────────▼──────────────────────────▼───────────┐
   │                          Cloud Firestore                                   │
   │  gyms/{gymId}/**        (tenant: public + private + ops + money)            │
   │  users/{uid}/**         (member private data, owner-only — UNCHANGED)       │
   │  platform/**            (admin rollups, audit)                              │
   └────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Authorization model — two layers

Firestore rules are **the only server-side enforcement** in this app (the browser
writes straight to Firestore), so roles must be enforced there, not just in the UI.

- **Platform role → Firebase custom claim.** `auth.setCustomUserClaims(uid, { sfRole: 'platform-admin' })`
  via an Admin SDK route. Read in rules as `request.auth.token.sfRole`.
  *Caveat handled explicitly:* claims are baked into the ID token and can lag up
  to ~1 hour. Every admin route therefore calls `getIdToken(true)` on the client
  after a role change, and the admin gate re-checks server-side before acting.
- **Per-gym role → membership document**, *not* a claim. `gyms/{gymId}/members/{uid}`
  holds `{ role: 'owner' | 'staff' | 'member', status, since }`. Rules resolve it
  with `get(...)`. This is deliberate: a claim cannot express "owner of gym A and
  staff at gym B", and adding/removing staff would otherwise wait on token refresh.
- **UI layer** mirrors the same matrix through a pure `can(role, capability)` in
  `@smartfit/core`, so buttons are hidden by the *same* table the rules enforce.
  The rules remain the real boundary; the UI is convenience.

### 3.2 Why member data is not shared upward

The hybrid choice buys member trust: `users/{uid}/**` rules stay exactly as they
are today (owner-only). The gym owner's roster is built from documents the **gym**
owns (`gyms/{gymId}/members/{uid}` — join date, plan, status, check-in counters)
plus an **explicit opt-in** share doc the member writes themselves
(`users/{uid}/gymShares/{gymId}` containing aggregates only — sessions this month,
streak, attendance %). No body weight, no medical data, no meal logs. Revoke = delete
the share doc. This is what makes "the gym sees my progress" a feature instead of
a privacy incident.

---

## 4. Roles & permission matrix

Capabilities are a flat string union in `@smartfit/core`; the matrix is
`Record<Capability, readonly Role[]>`. `●` granted, `○` denied.

### 4.1 Tenant & platform

| Capability | platform-admin | gym-owner | gym-staff | member |
| --- | :-: | :-: | :-: | :-: |
| `gym:create` (provision tenant) | ● | ○ | ○ | ○ |
| `gym:read:any` (cross-tenant) | ● | ○ | ○ | ○ |
| `gym:read:own` | ● | ● | ● | ○ |
| `gym:update:own` | ● | ● | ○ | ○ |
| `gym:suspend` / `gym:restore` | ● | ○ | ○ | ○ |
| `gym:delete` | ● | ● (with confirm) | ○ | ○ |
| `subdomain:claim` | ● | ● | ○ | ○ |
| `platform:config` (flags, reserved words) | ● | ○ | ○ | ○ |
| `impersonate` (view-as-gym) | ● | ○ | ○ | ○ |
| `audit:read:platform` | ● | ○ | ○ | ○ |
| `audit:read:own` | ● | ● | ○ | ○ |
| `application:review` | ● | ○ | ○ | ○ |

### 4.2 Branding & public site

| Capability | platform-admin | gym-owner | gym-staff | member |
| --- | :-: | :-: | :-: | :-: |
| `branding:edit` (logo, colors, photos, copy) | ● | ● | ○ | ○ |
| `hours:edit` (opening hours, holidays, blackouts) | ● | ● | ● | ○ |
| `pricing:publish` (public pricing page) | ● | ● | ○ | ○ |
| `public:read` | ● | ● | ● | ● (incl. signed-out) |

### 4.3 Scheduling, bookings, check-in

| Capability | platform-admin | gym-owner | gym-staff | member |
| --- | :-: | :-: | :-: | :-: |
| `class:create` / `class:update` | ● | ● | ● | ○ |
| `class:delete` | ● | ● | ○ | ○ |
| `timetable:publish` | ● | ● | ○ | ○ |
| `class:attend:mark` (attendance/no-show) | ● | ● | ● | ○ |
| `booking:create:self` | ● | ● | ● | ● |
| `booking:create:any` (book for a member) | ● | ● | ● | ○ |
| `booking:cancel:self` | ● | ● | ● | ● |
| `booking:cancel:any` | ● | ● | ● | ○ |
| `booking:read:gym` (all bookings of the gym) | ● | ● | ● | ○ |
| `booking:read:self` | ● | ● | ● | ● |
| `waitlist:promote` | ● | ● | ● | ○ |
| `checkin:door` (scan/mark arrived) | ● | ● | ● | ○ |

### 4.4 Members & staff

| Capability | platform-admin | gym-owner | gym-staff | member |
| --- | :-: | :-: | :-: | :-: |
| `member:roster:read` | ● | ● | ● | ○ |
| `member:invite` | ● | ● | ● | ○ |
| `member:status:change` (freeze/activate) | ● | ● | ● | ○ |
| `member:notes:write` (internal CRM notes) | ● | ● | ● | ○ |
| `member:remove` | ● | ● | ○ | ○ |
| `member:self:read` | ● | ● | ● | ● |
| `member:data:share` (opt-in aggregates) | ○ | ○ | ○ | ● |
| `staff:invite` / `staff:remove` | ● | ● | ○ | ○ |
| `staff:role:change` | ● | ● | ○ | ○ |
| `shift:manage` (trainer rota) | ● | ● | ● | ○ |

### 4.5 Money

| Capability | platform-admin | gym-owner | gym-staff | member |
| --- | :-: | :-: | :-: | :-: |
| `plan:manage` (membership tiers, pricing) | ● | ● | ○ | ○ |
| `payment:take` (sell/extend at desk) | ● | ● | ● | ○ |
| `invoice:issue` | ● | ● | ● | ○ |
| `invoice:refund` | ● | ● | ○ | ○ |
| `revenue:read` | ● | ● | ○ | ○ |
| `revenue:read:self` (my commission/sales) | ● | ● | ● | ○ |
| `membership:purchase:self` | ● | ● | ● | ● |

### 4.6 Marketing, facility, reporting

| Capability | platform-admin | gym-owner | gym-staff | member |
| --- | :-: | :-: | :-: | :-: |
| `broadcast:send` (announcements/push) | ● | ● | ● | ○ |
| `promo:manage` (codes, referrals) | ● | ● | ○ | ○ |
| `equipment:manage` (inventory, maintenance) | ● | ● | ● | ○ |
| `reports:gym` (occupancy, retention, revenue) | ● | ● | ○ | ○ |
| `reports:staff:self` (my classes only) | ● | ● | ● | ○ |
| `reports:platform` (MRR, churn, all tenants) | ● | ○ | ○ | ○ |

---

## 5. Deep persona analysis

### 5.1 Platform admin — *operates SmartFit itself*

**Who:** you (and later a small ops team). Sells SmartFit to gyms, keeps them live.
**Success looks like:** a gym signs up, gets a working subdomain in minutes, starts
billing members, and you can see the money and the risk without asking anyone.

**Pains this must kill**
- No way to know which gyms are paying, which are stalled, which are about to churn.
- No kill switch: a non-paying or abusive gym must be cut off *without* losing data.
- No answer to "what is happening in tenant X?" when an owner emails support.
- No record of who changed what — unacceptable once real businesses depend on it.

**Features, by priority**

*Must*
1. **KPI overview** — tenants by status, active members, MRR, new/churned this
   month, sessions logged/day, activation funnel (applied → provisioned → first
   class published → first paying member).
2. **Gym registry** — searchable table: name, slug, status, plan, owner, members,
   MRR, last activity. Filters by status/plan/region.
3. **Gym detail** — profile, owner contact, plan & limits vs. usage, subdomain,
   payment state, notes, timeline. Actions: suspend / restore / extend trial /
   change plan / assign owner.
4. **Application queue** — self-serve "list your gym" form → review, approve
   (provisions tenant + subdomain + owner claim) or reject with reason.
5. **Plans & limits config** — tiers with hard limits: members, locations, staff
   seats, classes/week, custom branding, API access, white-label domain.
6. **Revenue & billing** — invoices per gym, failed payments, dunning/retry,
   manual credit, and **offline payment recording** (bank transfer / CMI are the
   norm locally — an owner paying by transfer must be markable as paid by hand).
7. **Audit log** — append-only, admin-readable: actor, action, tenant, before/after,
   timestamp. Written by every admin route.
8. **View-as-gym (impersonation)** — read-only session into a tenant for support,
   with a persistent banner and an audit entry. Never write-capable.

*Should*
9. Per-tenant **feature flags** (roll out bookings to one gym first).
10. **Announcements** to gym owners; release notes.
11. **Data requests** — export or delete a tenant for compliance, reusing the
    existing deletion-job pattern from `src/app/api/account/delete/route.ts`.

*Could*
12. Health panel: sync errors, per-tenant error rates, quota.
13. Self-serve owner onboarding email flows.

**Routes:** `/admin`, `/admin/gyms`, `/admin/gyms/[gymId]`, `/admin/applications`,
`/admin/plans`, `/admin/revenue`, `/admin/audit`, `/admin/settings`.
Apex-only — never served on a tenant subdomain.

---

### 5.2 Gym owner — *the paying customer*

**Who:** owner/manager of a gym (e.g. Zone Fight in Casablanca). Runs a business:
revenue, retention, occupancy, staff. Not a fitness-data person.
**Success looks like:** "I opened my subdomain, published this week's timetable,
saw 14 bookings, collected 6 memberships, and spotted 9 members who haven't come
in three weeks."

**Pains this must kill**
- Paper/Excel roster, no idea who is about to lapse.
- Class capacity managed by memory; no-shows invisible.
- Revenue tracked in a notebook; no MRR, no churn number.
- Staff can't check people in without the owner present.
- Marketing is guesswork — no list of at-risk members to win back.

**Features, by priority**

*Must*
1. **Owner dashboard** — today's occupancy vs. capacity, check-ins, new members,
   MRR, expiring memberships, at-risk count, unhandled bookings.
2. **Branding & public site** — logo, colors, photos, description, address, hours,
   contact, socials. Live instantly on the subdomain. This is their storefront,
   so it must look good on day one.
3. **Member roster (CRM)** — status (trial/active/frozen/expired), join date, plan,
   expiry, visit count, **last visit**, at-risk flag (no visit in 14/21 days),
   internal notes, freeze/activate, export CSV.
4. **Timetable & classes** — class templates, recurring weekly slots, capacity,
   studio/room, instructor, publish/unpublish, one-off exceptions and holiday
   blackouts. Reuses the existing taxonomy so nothing is re-invented:
   `ClassFocus` lives in `packages/core/src/program.ts`, `Intensity` in
   `packages/core/src/types.ts`, and `packages/core/src/gym.ts` already maps
   class names → exercises via `aiDetermineExercises()`.
5. **Bookings & check-in** — per-class booking list, waitlist with auto-promote,
   no-show policy, front-desk check-in (search → mark attended), guest pass.
6. **Membership plans & pricing** — tiers (monthly/quarterly/annual, drop-in,
   student), join fee, publish to the public pricing page.
7. **Revenue** — MRR, new vs. churned, ARPU, revenue vs. target, payment history,
   refund with reason.
8. **Staff** — invite staff with the `gym-staff` role, set who can do what,
   trainer profiles, rota/shifts, hours worked.
9. **Settings** — subdomain, timezone, currency (MAD default), tax, waiver text,
   data export, close gym.

*Should*
10. **Retention campaigns** — win-back list (at-risk), birthday nudge, broadcast
    announcement, promo codes, referral tracking.
11. **Facility** — equipment inventory, maintenance log, hourly occupancy heat.
12. **Reports** — class popularity, peak hours, trainer utilisation, retention
    cohorts, revenue trend.
13. **Trainer commission** — per-class or per-member payout view.

*Could*
14. Review/testimonial wall on the public site.
15. Multi-location (a tenant with several sites).
16. Custom domain (`gym.acme.ma`) — the subdomain code is built so this is additive.

**Routes:** `/g/[slug]/console` (dashboard), `/timetable`, `/members`, `/bookings`,
`/checkin`, `/revenue`, `/plans`, `/staff`, `/marketing`, `/facility`, `/reports`,
`/settings`.

---

### 5.3 Gym staff — *front desk and trainers*

**Who:** receptionist and coaches. Execute the day; they do not run the business.
**Success looks like:** a member walks in, staff find them in three keystrokes,
mark the check-in, book them into the 18:00 class, done. And staff cannot
accidentally delete a member or change prices.

**Pains this must kill**
- Owner-dependency for every check-in.
- No single "what's happening today" view.
- Trainers can't see who is coming to their class.

**Features, by priority**

*Must*
1. **Today view** — all classes today with booked/capacity, plus "my classes"
   highlighted.
2. **Fast check-in** — member search (name/phone), mark attended / no-show / late,
   sell or extend a membership, take payment, guest pass.
3. **Class running** — start/close class, take attendance, adjust capacity,
   substitute instructor.
4. **Member lookup** — status, plan, expiry, booking history, notes. **Privacy-
   scoped:** no body measurements, no meals, no medical notes.
5. **Booking desk** — add a member to a class, promote from waitlist, cancel,
   reschedule.
6. **My numbers** — attendance and occupancy for *my* classes, sales I made.

*Should*
7. Message class participants; announce cancellation.
8. Request shift swap / leave (owner approves).
9. Equipment issue reporting.

*Explicitly denied* (must be visibly absent, not just disabled): pricing, plan
management, member deletion, branding, refunds, revenue totals, staff management,
platform data, gym deletion.

**Routes:** same `/g/[slug]/console/**` tree, capability-filtered. Staff land on
Today instead of the owner dashboard, and the nav renders only what
`can(role, …)` allows.

---

### 5.4 Member — *the existing B2C user, now gym-linked*

**Who:** today's SmartFit user. **Nothing they already have may regress.**
**Success looks like:** same tracker they know, plus "book the 19:00 HIIT at my
gym" and "my membership expires in 6 days".

**Features, by priority**

*Must*
1. **Unchanged app** — Overview, Run, Plan, Goals, Progress, Body, Fuel, Coach
   exactly as today. The B2B work must not touch these screens' behaviour.
2. **My gym** — find/join a gym by subdomain or directory; membership card with
   status + expiry; renewal.
3. **Book classes** — timetable, book/cancel/waitlist, my bookings, reminders.
4. **Check-in history** — visits, streak at the gym.
5. **Opt-in progress sharing** — explicit toggle, shows exactly which aggregates
   are shared, revocable in one tap.

*Should*
6. Gym announcements feed.
7. Trainer profiles.
8. Invite friends / referral credit.
9. Freeze membership.
10. Waiver signing.

---

## 6. Data model (Cloud Firestore)

```
gyms/{gymId}                          public profile + status + subdomain
  ├─ name, slug, subdomain, status, planId, ownerUid, createdAt
  ├─ branding{logo,colors,photos,description}, contact{}, hours{}, location{}
  │
  ├─ members/{uid}                    ← the tenant's roster (gym-owned)
  │    role: 'owner'|'staff'|'member' · status · joinedAt · planId
  │    expiresAt · checkins · lastVisitAt · notes · frozen
  │
  ├─ staff/{uid}                      role, permissions snapshot, hiredAt, active
  ├─ classes/{classId}                template: name, focus, intensity, minutes,
  │                                   capacity, instructorUid, studio
  ├─ slots/{slotId}                   occurrence: classId, startsAt, endsAt,
  │                                   capacity, booked, cancelled, exceptions
  ├─ bookings/{bookingId}             slotId, uid, status(booked|attended|
  │                                   no_show|cancelled|waitlist), createdAt
  ├─ plans/{planId}                   membership tier: price, currency, period,
  │                                   joinFee, published, limits
  ├─ invoices/{invoiceId}             memberUid, planId, amount, currency,
  │                                   status, method, paidAt, issuedBy
  ├─ broadcasts/{id}                  audience, subject, body, sentAt, authorUid
  ├─ equipment/{id}                   name, status, notes, nextService
  ├─ shifts/{id}                      staffUid, startsAt, endsAt, role
  ├─ settings/{settings}              PRIVATE — timezone, currency, tax, waiver,
  │                                   flags  (owner/staff read only)
  └─ audit/{auditId}                  actorUid, action, target, at, meta

users/{uid}                           ← UNCHANGED, still owner-only
  ├─ profile{ … gymId? }              gymId already exists in the type
  ├─ sessions/ schedule/ goals/ bodyLogs/ meals/ categories/ customGyms/
  └─ gymShares/{gymId}                ← NEW, opt-in aggregates written BY THE MEMBER
       { sessionsThisMonth, streak, attendancePct, sharedAt }

platform/meta/platform                counters: tenants, members, mrr
platform/applications/{appId}         gym signup requests
platform/audit/{id}                   cross-tenant admin actions
```

**Migration of the existing `customGyms`.** The current
`users/{uid}/customGyms/{docId}` stays where it is (it is personal data and the
rules for it are correct). A one-off script offers to "promote" one of them into a
real tenant for anyone who wants to open a gym; nothing is silently moved.

---

## 7. Security rules design

New `match /gyms/{gymId}` blocks added to `firestore.rules`, keeping the existing
`users/{userId}` tree byte-identical.

```
function isPlatformAdmin() {
  return request.auth != null && request.auth.token.sfRole == 'platform-admin';
}
function gymMemberDoc(gymId) {
  return get(/databases/$(database)/documents/gyms/$(gymId)/members/$(request.auth.uid)).data;
}
function gymRole(gymId) {
  return request.auth != null && request.auth.uid == resource.data.ownerUid
      ? 'owner' : gymMemberDoc(gymId).role;   // owner is authoritative
}
```

Rules per collection:
- `gyms/{gymId}` — read: any signed-in user (public storefront) **but** private
  fields live in `settings/`, never here. Write: owner. Suspend/status: platform-admin.
- `members/{uid}` — read: self, gym staff/owner, platform-admin. Write: staff/owner.
  Delete: owner only. A member can write their own doc *once* to self-join with
  `role: 'member'`.
- `classes`, `slots`, `bookings`, `plans`, `invoices` — role-gated per §4, with
  the same field/type/bound validation style already used for `sessions`
  (string caps, numeric ranges, field-count caps) so a scripted client cannot use
  a tenant as junk storage.
- `settings`, `audit` — owner/staff read, owner write; audit is **append-only**
  (no update, no delete by client).
- `platform/**` — client denied entirely; Admin SDK only.

**Known costs, stated up front:** every `get()` inside a rule is a billed read and
rules allow only a small number of them per evaluation, so the membership lookup
must stay exactly one `get()` — never a query. `bookings` list queries need new
composite indexes (`firestore.indexes.json` currently has only three, all
`collectionGroup` on `sessions`/`bodyLogs`/`meals`).

---

## 8. Subdomain architecture

**Middleware does no I/O.** `src/middleware.ts` is pure string work (it runs on the
edge, where the Admin SDK cannot):

1. Read `host`. If it ends with `NEXT_PUBLIC_APEX_DOMAIN` (e.g. `smartfit.app`) and
   the remaining prefix is not a reserved word → `slug = prefix`.
2. Rewrite `/*` → `/g/{slug}/*`. Skip `/api/*`, `/_next/*`, static files.
3. Reserved words: `www`, `app`, `admin`, `api`, `docs`, `manage`, `console`, `g`,
   plus anything in `platform/config.reservedSubdomains`.
4. Guard against rewrite loops and against a slug colliding with a real route.

**Slug → gymId resolution happens in the page/route**, server-side with the Admin
SDK (Node runtime), so no public directory of tenant IDs is exposed and the lookup
is cacheable.

**Path fallback** `/g/[slug]/...` is the canonical route tree, so the preview works
with zero DNS: `https://{port}-{sandboxId}.e2b.app/g/acme` renders the same tree
middleware would have rewritten to.

**Unverified, will test empirically:** whether the e2b preview proxy answers
wildcard subdomains of `{port}-{sandboxId}.e2b.app`. I will `curl` a wildcard host
against the running dev server and report the actual result rather than assume it
either way. If it works, `NEXT_PUBLIC_APEX_DOMAIN` is set so real subdomains are
demoable here; if not, the `/g/{slug}` fallback carries the demo.

**Production (Vercel):** wildcard DNS `*.smartfit.app` + wildcard cert, and
`vercel.json` gains the domain. Nothing in the app changes — that is the point of
routing both modes into the same tree.

---

## 9. Implementation phases

Each phase ends green (`pnpm typecheck`, `pnpm lint`, `pnpm test`) before the next.

**Phase 0 — prerequisites. ✅ DONE.** Dependencies were absent
(`ls -d node_modules` → nothing) and `pnpm` was not on PATH; `corepack` was
available, so `corepack prepare pnpm@9.15.9 --activate` (matching
`packageManager` in `package.json`) then `corepack pnpm install` succeeded in 21s.
Node here is v22.22.3, matching `.nvmrc`.

**Verified green baseline on `main`** (the reference point every later phase is
measured against — anything that turns red after Phase 1 is a regression we caused):

| Command | Result |
| --- | --- |
| `pnpm typecheck` (`tsc --noEmit`) | exit 0, no output |
| `pnpm lint` (`eslint .`) | exit 0 — **0 errors**, 1 pre-existing warning: `<img>` at `src/components/dashboard/screens/profile-screen.tsx:775` |
| `pnpm test` (`node --import tsx --test tests/*.test.ts`) | **120 pass / 0 fail** |
| `pnpm --filter @smartfit/core test` | **171 pass / 0 fail** |
| **Total** | **291 tests green** |

Not run (needs the Firestore emulator, and CI owns it): `pnpm test:rules`.
Not run: `pnpm build` and `pnpm test:e2e` (Playwright browsers not installed here) —
both to be attempted at Phase 3 and Phase 9.

Note for later phases: invoke the runner as `corepack pnpm …` in this environment,
or activate pnpm on PATH first.

**Phase 1 — roles & tenancy primitives (`@smartfit/core`, no UI).**
- `packages/core/src/rbac.ts` — `Role`, `Capability`, `PERMISSION_MATRIX`, `can()`.
- `packages/core/src/tenant.ts` — tenant types, `slugify`, reserved words,
  `resolveTenantHost(host, apex)`, status/plan enums, limit checks.
- `packages/core/tests/rbac.test.ts`, `tenant.test.ts` — pure, run under `pnpm test`.
  The matrix is tested exhaustively: every capability × every role.
- Export both from `packages/core/src/index.ts`.

**Phase 2 — data layer & rules.**
- `src/lib/firebase/tenant-repo.ts` — gym CRUD, roster, classes, slots, bookings.
- `firestore.rules` — new `gyms/**` blocks; `users/**` untouched.
- `firestore.indexes.json` — new composite indexes.
- Extend `tests/rules/firestore-rules.test.ts` with tenant-isolation cases:
  staff of gym A cannot read gym B; a member cannot read another member; a member
  cannot read `platform/**`; audit docs cannot be updated or deleted.
- `/api/admin/claims` route (Admin SDK) to set `sfRole`, following the
  `account/delete` route's conventions.

**Phase 3 — subdomains.** `src/middleware.ts`, `/g/[slug]` public site,
`vercel.json` domain entry, `.env.example` additions (`NEXT_PUBLIC_APEX_DOMAIN`).
Empirically verify wildcard behaviour; Playwright test for the `/g/{slug}` fallback
and for reserved-word handling.

**Phase 4 — platform admin portal.** `/admin` gated on the `sfRole` claim, admin
layout + nav, registry/detail/applications/plans/revenue/audit screens, the admin
API routes, audit writing on every mutation.

**Phase 5 — gym owner console.** `/g/[slug]/console/**` — dashboard, branding,
roster, timetable, bookings, plans, revenue, staff, settings.

**Phase 6 — staff console.** Same tree, capability-filtered nav, Today + check-in
first. Denials are rendered as absent, not disabled.

**Phase 7 — member gym experience.** Join a gym, membership card, book/cancel/
waitlist, check-in history, opt-in share toggle. `/dashboard/**` untouched.

**Phase 8 — B2B billing.** Extend `src/lib/billing/` with a gym-contract provider
path alongside the existing Pro provider; CMI + offline-payment recording.

**Phase 9 — seed, docs, migration.** Extend `scripts/seed-firestore.mjs` with a
demo tenant (owner + staff + members + timetable + bookings) so both portals render
with data; update `README.md`, `docs/firebase.md`, `.env.example`; add the
`customGyms` promotion script.

---

## 10. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Custom-claim lag (~1 h) grants/revokes admin late | `getIdToken(true)` after role change; admin routes re-verify server-side before acting |
| Per-gym role in a claim would break multi-gym users | Role comes from a membership doc `get()` in rules — one read, no query |
| Owner reading member data becomes a privacy incident | `users/**` rules untouched; sharing is member-initiated, aggregate-only, revocable |
| Rules `get()` costs and per-evaluation limits | Exactly one membership `get()` per rule; no lookups inside list rules |
| Missing composite indexes silently break lists (this has bitten this repo before — see `isMissingIndexError` in `repo.ts`) | Declare indexes in Phase 2; keep the existing unordered-fallback pattern |
| Local mode (no Firebase) breaks | Tenant features degrade to a clear "cloud mode required" state, exactly like auth does today |
| B2C regression | `/dashboard/**` and the mobile app are not modified; e2e smoke tests must stay green |
| Subdomain rewrite loop | Middleware skips `/api`, `/_next`, static, and reserved words; loop guard tested |

---

## 11. Open questions (non-blocking, defaults chosen)

1. **Currency/locale** — default MAD + French/English labels given the market?
   *Default: MAD, English UI now, i18n-ready strings.*
2. **Member↔gym cardinality** — one gym per member, or many? *Default: many
   (a `gymId` on the profile is the "primary"; memberships allow more).*
3. **Check-in mechanism** — front-desk search first, QR later? *Default: yes.*
4. **Do gym owners need the member tracker too**, or console only?
   *Default: both — an owner is also a member.*
5. **Mobile app** — staff check-in on Expo, or web-only for staff?
   *Default: web-only in this pivot; mobile unchanged.*

---

## 12. Definition of done for the pivot

- Four roles enforced in **rules**, not just UI, with emulator tests proving
  cross-tenant and cross-member isolation.
- Two gyms provisioned with distinct subdomains, both reachable via
  `/{g}/{slug}` in the preview (and via host if the wildcard test passes).
- Admin can approve an application, provision a tenant, suspend it, and see it in
  the audit log.
- Owner can publish a timetable, see bookings, take a payment, and see MRR.
- Staff can check a member in and cannot see revenue or delete a member.
- Member's existing dashboard behaves identically to `main`.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm test:rules` all pass,
  with the executed code paths named in the PR description.
