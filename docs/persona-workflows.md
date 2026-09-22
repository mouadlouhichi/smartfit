# Persona workflows — implemented expansion slice

Date: 21 September 2026. Source: `muscle_monster_complete_functional_requirements.md`.

This is working application code, not signoff on the full 98-section FRS. Keep the domain backlog in `feature-expansion-plan.md` as the scope of remaining work.

## Available workflows

| Persona | Entry | Implemented behavior |
| --- | --- | --- |
| Guest | `/library` | Published-only discovery, search, difficulty/equipment/type filters, instructions, safety notes and optional HTTPS demonstration links. Cloud errors are visible, not replaced by fixtures. |
| Free / premium member | `/dashboard/library`, `/dashboard/personalize`, `/support` | Published routines launch the existing player with copied exercises. Versioned private preferences sync through the existing profile store; a constrained starter-week preview can replace scheduled sessions after confirmation. Support tickets, replies, close/reopen and export are available to both tiers. No new premium entitlement is invented. |
| Gym owner | `/g/{slug}/coaching` | Manage member/staff/trainer roles, assign active trainers to active members, read assignments and remove/reassign them. Reassignment resets consent, routine and conversation. No owner-transfer flow. |
| Gym staff | `/g/{slug}/coaching` | Read assignments and feedback in their own gym without prescribing routines or changing trainer roles. Existing desk/roster/billing workflows remain in the console. |
| Trainer | `/g/{slug}/coaching` | Dedicated login home; only their assigned members, consent-gated routine prescription and shared feedback. No complete roster, revenue, private fitness history or body measurements. |
| Content manager | `/studio` | Dedicated login home; exercise/routine authoring, draft/review/publish/archive, immutable cloud revision snapshots and optimistic version checks. Published content feeds the library. |
| Support agent | `/support` | Dedicated login home; ticket inbox, search/status filters, replies and controlled status transitions. No publishing, gym finance or private fitness-data access. |
| Platform admin | `/admin/access`, studio/support links | Assign/remove specialist platform roles for existing Firebase accounts, fresh server-side role verification, self-demotion protection and audited changes. Existing `/admin` home remains unchanged. |

Existing explicit login `next`/`gym` intents retain precedence. Global workspaces are exempt from tenant-subdomain rewriting. No static or personal custom-gym registry was reintroduced.

## Data and security

- Global content: `platform/content/entries/{id}` and its `revisions/{version}`. Browsers cannot read/write this tree directly. Public API returns published entries and strips the editor identity; editorial requests require content-manager/admin access.
- Support: `platform/support/entries/{id}`. Requester identity comes from verified Auth, never the body. A non-support caller sees only their own tickets. New tickets are throttled per account to one per 30 seconds; messages and conversations are bounded.
- Coaching: `gyms/{slug}/coaching/{memberUid}`. Every request resolves the current gym and active membership. Mutations recheck gym/member authorization in the transaction. A trainer query is assignment-scoped; the member must accept before routines or feedback are written. Staff are read-only.
- Preferences: `users/{uid}.profile.trainingPreferences`, schema version 1. Shared-core parser, profile persistence and Firestore validation agree. Existing profiles need no backfill; malformed preference objects are dropped by the parser.
- New API mutation transactions check account-deletion locks before writing. Profile JSON export includes supplementary support/coaching records; importing a fitness backup does not recreate those operational records. Account deletion removes the requester's tickets and their member/trainer assignments, in addition to private user data.
- Operational audit logs, published editorial revisions and existing gym membership/financial records are not erased by this personal-data deletion flow. Replies authored by support staff in another requester's ticket remain with that ticket. The privacy page describes these boundaries; deployment-specific retention/legal review is still required.
- Fresh platform claims and revoked-token checks gate the new APIs and shared admin guard. Existing direct Firestore tokens may retain old platform claims until expiry; changing a role does not imply immediate invalidation of all issued tokens at the rules layer.
- Fixed a pre-existing disclosure: public tenant server payloads no longer serialize roster, invoices or bookings. Authorized clients load private collections separately.
- Fixed a pre-existing privilege escalation: staff can create/update ordinary members, but cannot promote themselves, create privileged memberships or edit owner/trainer role records through Firestore.

## Deliberate limits — do not mark these complete

- The generator is a small, deterministic **starter** catalog: at most three non-consecutive sessions, equipment/movement/exclusion filters, beginner volume, a professional-clearance stop and explanations. It is not a clinically reviewed, balanced long-term program or full adaptive plan engine.
- CMS plan entries currently contain routines, not multi-week plan lifecycle/calendar instances. Challenge drafts may be authored but **cannot be published** until participation rules exist. No challenge participation, premium content gating, media uploads, revision rollback or review-assignment workflow is claimed.
- Lists are capped and disclose their limits: 100 content entries/tickets/assignments and 500 compact roster entries. Full account export does not use the list caps. Cursor pagination and high-volume operations remain pending.
- Demo mutations use session-only browser storage and are clearly labelled. They do not contact support, grant real roles or publish cloud content. Personal fitness data continues to use the existing local/cloud store.
- This release slice does not add Expo screens, payment verification, push delivery, HealthKit/Health Connect, wearables, translations/RTL or production analytics. Native type compatibility is not native functional parity.
- The full FRS also still requires assessment/onboarding expansion, reusable workout favorites, full plan adaptation, challenge/achievement lifecycle, offline conflict/completion validation, media administration and broader admin operations.

## Deploy and validate

1. Deploy the app and **both** `firestore.rules` and `firestore.indexes.json`; wait for indexes to finish building. Indexes include published/status and requester ticket lists, coaching account export/deletion queries, and member-role home lookup.
2. Use an existing platform admin at `/admin/access` to grant `content-manager` or `support-agent`. Have the recipient sign out and back in. Gym trainers are membership roles, not global custom claims. The staging seed script now creates content/support specialists and gives its trainer a true trainer membership; it was not run against a live project in this pass.
3. Author real, reviewed content in `/studio`. An empty production library is expected until content is published. Do not copy demo fixtures into production as if reviewed/paid media.
4. Verify cloud publishing, stale-version conflicts, support ownership, cross-gym/foreign-trainer denials, consent changes, export and deletion in a staging Firebase project.
5. Run the existing CI Firestore emulator job before deploying rules. This sandbox lacks Java; package-network failures prevented installing it, so **the new rules tests were added but not executed locally**.

## Verification recorded in this implementation pass

- Root unit tests: **171 passed**.
- Shared-core tests: **253 passed**, including 14 new content/support/coaching/personalization tests.
- Server-handler tests: **8 passed**, using mocked Auth and Admin persistence; these exercise actual HTTP handlers, not a live Firebase service.
- New browser suite: **6 passed** — publishing/archive, support conversation lifecycle, consent-gated coaching, preference persistence/scheduling, narrow-screen layout and API refusals.
- Existing landing/admin browser regression coverage: all 10 tests passed across the suite and an isolated retry; one existing lifecycle confirmation test timed out in the combined development-server run, then passed unchanged on retry.
- Web/core/mobile typechecks passed. Production build passed. Formatting passed. Lint has zero errors and one pre-existing profile `<img>` warning.
- Browser execution used an ephemeral Chromium installation outside the repository; no sandbox browser dependency was added to the product.
- Live Firebase/provider writes, security-rule emulator execution and device/native runtime validation remain unverified.
