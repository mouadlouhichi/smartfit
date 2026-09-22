# Scripts

## `seed-firestore.mjs` — populate demo data into Cloud Firestore

The production app never ships demo data; this script is the supported way to
fill a demo/staging account with a realistic ~6-week training history (matching
`scripts/seed.sql`).

### Credentials
Create a service-account key: **Firebase console → Project settings → Service
accounts → Generate new private key**. Provide it via env (never commit real
keys, never prefix with `NEXT_PUBLIC_`):

```bash
export FIREBASE_PROJECT_ID="your-project-id"
export FIREBASE_CLIENT_EMAIL="firebase-adminsdk-...@your-project-id.iam.gserviceaccount.com"
export FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Alternatively, with `gcloud` / Application Default Credentials configured, just
set `FIREBASE_PROJECT_ID` and the script uses `applicationDefault()`.

**All scripts in this directory automatically load the repo's `.env`** (values
already in your shell always win), so the `export` lines above can simply live
in `.env` instead. They also accept the app-side `FIREBASE_ADMIN_PROJECT_ID` /
`FIREBASE_ADMIN_CLIENT_EMAIL` / `FIREBASE_ADMIN_PRIVATE_KEY` names, or one
`FIREBASE_ADMIN_SERVICE_ACCOUNT` JSON blob, if that is how your `.env` is
configured for the deployed app.

### Run
```bash
# writes to users/demo-user
pnpm seed

# or a specific account / email
SEED_UID=some-firebase-auth-uid SEED_EMAIL=demo@example.com pnpm seed
```

Set `SEED_UID` to an existing signed-in user's UID to make the data appear in
that account; otherwise create a Firebase Auth user with the matching uid/email.

`scripts/seed.sql` contains the same demo data as a relational schema
for SQL/analytics use.

## `seed-b2b.mjs` — stand up the B2B demo tenant

The production app ships with **no tenants** — a gym exists only once the
platform approves an application. This script provisions a realistic one so
the owner console, the staff console and the member experience all render with
data:

```bash
pnpm seed:b2b
```

Uses the same service-account env as above (`FIREBASE_PROJECT_ID`,
`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`), plus:

| Env | Default | Purpose |
| --- | --- | --- |
| `B2B_PASSWORD` | `SmartFit!234` | Password for every seeded account |
| `B2B_GYM_SLUG` | `zone-fight` | Tenant slug / subdomain |
| `B2B_ADMIN_EMAIL` | `admin@smartfit.app` | Platform-admin address (gets the `sfRole` claim) |
| `B2B_FORCE` | _unset_ | `1` also resets passwords on existing accounts |

Creates a platform admin, an owner (`owner@{slug}.smartfit.app`), staff,
trainers and members, plus classes, a weekly timetable with bookings and a
waitlist, door check-ins, membership plans and paid invoices — including one
class later **today** so the staff "Today" view is populated whatever day it
runs. Idempotent: every write targets a deterministic document id, so re-run
it freely (it also refreshes the "later today" slot). Sign in as any seeded
account, then open `/g/{slug}` and switch the demo role, or `/g/{slug}/console`.

## `grant-admin.mjs` — promote one account to platform admin

`/admin` is gated by the `sfRole: 'platform-admin'` custom claim on the signed-in
user's ID token. Seeding the whole demo org just to let yourself in is overkill —
grant the claim on your **existing** account instead:

```bash
FIREBASE_PROJECT_ID=... FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY=... \
  node scripts/grant-admin.mjs you@example.com

# revoke again:
node scripts/grant-admin.mjs --remove you@example.com
```

Same service-account env as above. Claims are additive (unrelated custom claims
are preserved). The account must already exist in Firebase Auth. After granting,
**sign out and back in** — claims are minted into the ID token at sign-in, so the
token already in the browser still says member.

## `promote-custom-gym.mjs` — turn a personal custom gym into a real tenant

A member's "custom gyms" live in `users/{uid}/customGyms` — private data with
owner-only rules. When that person wants to run a *real* gym on SmartFit, this
script promotes one of them into a B2B tenant: it provisions `gyms/{slug}`
(trial status, chosen platform plan), writes the owner membership row the
security rules read, and converts every class into a real template — classes
with a weekday + time also get their next occurrence scheduled as a slot.

Nothing is moved: the original customGym document stays exactly where it was.

```bash
FIREBASE_PROJECT_ID=... FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY="..." \
B2B_PROMOTE_UID=<uid> B2B_PROMOTE_GYM=<customGym doc id> \
node scripts/promote-custom-gym.mjs
```

| Env | Default | Purpose |
| --- | --- | --- |
| `B2B_PROMOTE_UID` | — | The member whose custom gym is being promoted |
| `B2B_PROMOTE_GYM` | — | The `customGyms` document id |
| `B2B_GYM_SLUG` | slugged gym name | Tenant slug / subdomain; errors if taken |
| `B2B_PLAN` | `starter` | Platform plan for the new tenant |
| `B2B_PROMOTE_FORCE` | _unset_ | `1` allows merging into an existing tenant doc |

Idempotent for classes and slots (document ids derive from the custom class
ids), so a re-run updates in place. `pnpm seed:b2b` remains the way to stand
up a full demo tenant with accounts and bookings.

## `audit-team-access.ts` — read-only authorization preflight

Run before deploying the membership-based Team rules. This command **never writes,
repairs, grants roles, transfers ownership, creates accounts or sends invitations**.
Use a read-only service account where possible. Environment credentials use the same
`.env` / `FIREBASE_ADMIN_*` conventions above; ADC is explicit with `--adc`.

```bash
pnpm audit:team --project your-project-id
pnpm audit:team --project your-project-id --gym zone-fight
# Use an access-controlled location outside the repo; IDs in reports are sensitive.
node --import tsx scripts/audit-team-access.ts --project your-project-id --json > /secure/location/team-audit.json
pnpm audit:team --project your-project-id --adc
```

The selected project must match configured credential/public project IDs. There is
no implicit default, `--apply`, automatic fallback to a demo, or automatic repair.
For local emulators, `FIRESTORE_EMULATOR_HOST` must be a loopback host with a port and
the explicit project must start with `demo-`. Never set emulator variables in production.

Checks include:

- Each live gym's authoritative owner row exists, has role `owner`, and is active/unexpired.
- Extra owner-role rows and missing/mismatched `uid` mirrors (which break persona redirects).
- Invalid role/status/expiry values and inactive privileged memberships.
- Pending/inactive gyms' missing owner is a warning; missing active-gym ownership blocks release.
- Inactive staff/trainer grants are warnings because freezing/revocation can be intentional.

Reads are paginated, using field projections for collection scans. Defaults cap the
scan at **100 gyms and 2,000 members per gym**; `--max-gyms` (up to 1,000) and
`--max-members` (up to 10,000) deliberately raise the read/cost budget. Limits, missing
selected gyms and read failures **never produce a clean audit**. Reports include
identifiers/finding codes, not email addresses, member notes, tokens or credentials.
The finding cap is 10,000; reaching it also marks the result incomplete.

Exit codes: **0** complete with no error findings (warnings may remain), **1** findings
block release, **2** invalid configuration or incomplete scan. An empty project can
validly contain no gyms; check the reported project and counts. This is a point-in-time
preflight, not a transactionally consistent snapshot or a production-readiness certificate.
Run it in a controlled maintenance window and re-run after reviewed repairs. Recover
ownership using a trusted, separately reviewed Admin operation and preserve an audit;
never infer a replacement owner from an email or silently reactivate a frozen account.

## Authorization integration suite

```bash
# Requires Java 21. Both commands use a pinned official firebase-tools version.
pnpm test:rules
pnpm test:integration
```

The integration suite connects real Firebase client/Admin SDKs to the official Auth
and Firestore emulators. It exercises the actual route handlers (without an HTTP server)
and security rules with emulator-issued ID tokens, including same-token grants/revocation,
committed membership snapshots, concurrent role transactions, deletion/assignment locks
and revoked platform claims. It has no Auth/Admin mocks. The tests refuse non-loopback
emulator hosts or an unexpected project before initializing services. Test projects
start with `demo-` and are separate from production and the rules-unit-test project.
CI runs both suites as blocking steps. This does not replace a deployed two-browser
smoke test, IAM/index validation, provider tests or real-device testing.
