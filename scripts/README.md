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
