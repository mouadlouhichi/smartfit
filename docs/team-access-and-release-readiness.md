# Team access and release readiness

**Updated: 22 September 2026. Scope: membership authorization, team management and targeted web hardening.**

## Implemented

- Gym console → **Team** (`/g/{slug}/console?tab=staff`): find an existing member, review capabilities, choose member/trainer/staff, enter a reason, and explicitly confirm. Inactive promotions are blocked. Owner and self-role changes are protected. Demo changes are visibly session-only, with no email invitations or durable cloud audit.
- `POST /api/tenant/team`: same-origin authenticated requests; fresh platform claims; transactional reads of the gym, actor, target, assignments and account-deletion locks. Only the current active owner or a platform administrator may act. Suspended/closed gyms cannot change team access. The target must already belong to this gym. `expectedRole` rejects stale edits (409). Promotions require an active, unexpired membership. Assigned people must have their coaching assignments removed/reassigned first.
- Role update and immutable `staff:role:change` audit entry commit together. The audit records actor, target, timestamp, old/new roles and reason. Direct client role writes and forged role-audit events are denied by rules. The older coaching role action delegates to this same server service; its UI links to the Team manager.
- **No gym-role custom claim or forced ID-token refresh.** Firestore rules read the current membership on each authorized operation. Shared UI/API resolution requires active/trial membership, a future expiry when present, and a live gym. Owner membership must agree with `gym.ownerUid`; ownership metadata alone is insufficient. Platform administration still intentionally uses `sfRole`.
- Console listens to committed server gym/membership snapshots, clears private collections on access changes, and invalidates in-flight reads and previous-account mutations. Cached or pending client writes cannot grant console access. Expiry schedules a recheck even without a document update. API-backed coaching also invalidates its workspace on live access changes, including dashboard embeds.
- Login home selection checks the actual gym status, authoritative membership document ID and current shared role policy. New joins and role updates maintain the `uid` query mirror.
- Owner profile edits cannot change the platform contract, provisioning fields or ownership. Direct deletion/disabling of the authoritative owner row is denied; team members must be demoted before a client can remove the membership.
- Service worker v11 evicts old cached HTML. Navigations use the network or a generic offline page; APIs and React server-component requests are not cached. Only successful public static assets without `private`/`no-store` are cached. The geolocation header now permits same-origin location use for run tracking (browser permission is still required).
- Production configuration guard requires matching Firebase client/admin projects and complete credentials (or explicit Google ADC). Deliberate credential-free builds use `SMARTFIT_DEPLOYMENT=demo`; CI explicitly opts in. The guard checks presence/consistency, **not** whether credentials or providers actually work.

“Immediate” means subsequent authorized operations use the changed document and connected sessions react to its snapshot. It does not retract data already downloaded, guarantee network delivery latency, or make a disconnected device a trusted operator. Account/Firestore local storage has a separate offline-data policy; service-worker cleanup does not erase those stores.

## Continuation: automated release preflight and stronger test gates

- Added `pnpm audit:team --project PROJECT [--gym SLUG] [--json] [--adc]`: a read-only,
  bounded/paginated preflight for owner rows, UID mirrors, malformed role/status/expiry
  values and inactive grants. Errors block release; limits/read failures mark the report
  incomplete. No automatic repairs or privilege grants. See `scripts/README.md` for exit
  codes, cost limits and safe report handling. The live-project audit has **not** been run.
- Added a real-SDK Auth + Firestore emulator integration suite for the team handlers:
  unchanged-token access, committed snapshots, concurrent role edits with one audit,
  frozen/expired membership, deletion/assignment locks and revoked platform claims.
  CI runs it as a blocking step after the rules suite. It is **written and type-checked,
  not locally executed** because official emulator prerequisites remain unreachable.
- Pinned both emulator commands to `firebase-tools@15.30.2`; test projects now use
  `demo-` IDs. Integration setup refuses non-loopback hosts before initializing Admin.
- Production configuration rejects emulator routing variables, including the Auth
  emulator setting that would otherwise permit unsigned emulator tokens.
- Feature API JSON parsing now enforces the 40,000-byte cap **while streaming**, cancels
  oversize bodies even with a false Content-Length, and rejects malformed UTF-8/JSON.
  This avoids buffering arbitrary payload sizes before validation.

## Verification executed here

- Shared core: **265 tests passed**.
- Web libraries: **198 tests passed**, including deployment configuration and service-worker behavior.
- Mocked Admin/Auth HTTP handlers: **14 tests passed**, including atomic role/audit writes, stale edits, active-owner requirements, assignment protection and deletion locks. These are not real Firestore transaction tests.
- Browser (previous UI pass; not re-run in this tooling/API continuation): **20 tests passed** across team access (3), console workflows (8), persona feature workspaces (6), and branding (3), using demo data.
- Web/core/mobile TypeScript checks and explicit-demo production build passed. Lint has no errors and one pre-existing profile image warning. Formatting and diff checks passed.
- Added Firestore rules cases for same-session grants/revocation, expiry/freeze, spoofed claims, owner consistency/protection, protected gym fields, privileged write denial and audit forgery.
- **Rules emulator NOT run in this sandbox:** Java is absent; a fresh GitHub release attempt also failed at the release-asset download, and the official GCS emulator download remains unreachable. The installed pinned CLI was invoked and refused to start without Java. The CI Java 21 rules job remains a mandatory release gate. No live Firebase deployment, multi-user cloud browser test, payment provider verification or native device test was performed.

## Required release gates — not yet certified

1. **Owner migration/preflight.** Run the new read-only `pnpm audit:team --project PROJECT` command with reviewed credentials and require a complete report with no error findings. For every live gym, confirm `gyms/{slug}/members/{ownerUid}` exists with role `owner`, active/trial status, no expired expiry, and the correct `uid` mirror. Flag duplicate owner-role rows, mismatched UIDs and already-expired privileged grants. Use a trusted Admin SDK operator for recovery; do not weaken rules or restore a token-claim shortcut. There is no general ownership-transfer UI in this release.
2. **Emulator/CI.** Run `pnpm test:rules` and `pnpm test:integration` with Java 21 and require the full CI suite to pass. Confirm role tests against the final rules, including real transaction conflict/deletion behavior. The new browser tests exercise workflow behavior, not Firebase delivery.
3. **Coordinated deployment.** Deploy the reviewed web/API changes and `firestore:rules,firestore:indexes` to staging first. Deploy rules before opening the new team workflow to operators. The old direct role writer will be denied by the new rules; do not roll back to permissive role rules. Back up before rollout and retain a known-good compatible deployment.
4. **Two-session cloud smoke test.** Owner and target in separate browsers: grant staff, verify roster access without token refresh, demote and verify access disappears. Repeat for frozen/expired/deleted memberships, gym suspension, trainer scope, foreign gym, same-account tabs, sign-out/account switch during a slow read, and reconnect after offline operation. Inspect the committed audit entries. Confirm no protected roster flashes from stale responses.
5. **Firebase/environment.** Verify public/admin project alignment, credential availability, Auth authorized domains, email verification/reset, account export/deletion, seeded gym discovery, required indexes, App Check rollout and real security-rule deployment. Missing Admin services must still produce the existing friendly onboarding/public-list failure behavior—not a signup 500.
6. **Commercial/provider readiness.** Billing remains subject to the existing sandbox/live limitations. Do not launch paid promises until server-verified entitlement provisioning, signed webhooks, replay/idempotency, cancellation/refunds and reconciliation are verified for the chosen provider. AI/provider connectivity, large-logo Storage, external media policy and outbound email/invitation delivery are separate integrations; this team workflow sends no invitations.
7. **Operations/privacy.** Verify monitoring, budget/rate-limit protections, secret rotation, backup restore and deletion/export retention policies; test shared-device/offline cache behavior and service-worker upgrade. Exercise large rosters and pagination/load limits before onboarding large tenants; current console roster reads are not paginated. Audit the remaining legacy direct-client booking/payment boundaries for the chosen commercial launch scope.
8. **Full-app scope.** Native release validation and the remaining FRS work in `feature-expansion-plan.md` / `persona-workflows.md` are not completed by this authorization pass. Run the full browser suite and real-device/accessibility checks before release.

**Verdict:** team authorization and targeted production safeguards have been implemented and locally tested where feasible. This is **not a certification that the entire app is production-ready**. Cloud authorization, deployment and provider/operations gates above must be completed before a real launch.
