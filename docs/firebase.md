# Firebase setup (Auth + Cloud Firestore)

SmartFit is **local-first by default**. When a full Firebase web config is
present it switches to **cloud mode**: Firebase Authentication for identity and
Cloud Firestore for data, synced across devices. With no config it runs entirely
on-device (localStorage) — useful for previews and offline development.

## 1. Create the project
1. In the [Firebase console](https://console.firebase.google.com/) create a project.
2. **Build → Authentication → Sign-in method** and enable:
   - **Email/Password**
   - **Google**
3. **Build → Firestore Database → Create database** (Production mode).
4. **Project settings → General → Your apps → Web app** and copy the config values.

## 2. Configure environment variables
Set these in `.env.local` (dev) and in Vercel → Project → Settings →
Environment Variables (production). Only `NEXT_PUBLIC_*` values reach the
browser.

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
# optional:
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
# abuse protection (optional but recommended before launch — see §6):
NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=...
```

With these set, `/dashboard` is gated behind sign-in (visitors are redirected to
`/login`, which offers email/password and Google). New accounts start empty and
land on guided onboarding — **there is no demo data in production**.

## 3. Deploy security rules & indexes
`firebase.json` at the repo root points the CLI at the rules and index files,
so from the repo root (with the [Firebase CLI](https://firebase.google.com/docs/cli)
installed and logged in):

```
firebase use <your-project-id>
firebase deploy --only firestore:rules,firestore:indexes
```

`firestore.rules` ensures each user can only read/write their own
`users/{uid}/...` tree **and validates every write**: required fields, types,
sane bounds (dates are `yyyy-mm-dd`, durations/calories are non-negative
numbers, strings are length-capped, field counts are capped). A scripted
client cannot use an account as free junk storage, and a buggy client fails at
the rules layer instead of poisoning the data it later reads back. The web
forms enforce the same caps client-side (`maxLength`), so honest users never
hit a rules rejection.

`firestore.indexes.json` declares the composite indexes the bounded history
queries need (`sessions` and `bodyLogs`, both `date desc, createdAt desc`).
**Without them the cloud load fails with `failed-precondition`** and the app
silently falls back to the local cache — deploy them before the first user.

### Deploy the rules **with** the app, not after it

A release that starts reading a new collection needs its rules live at the same
time. Firestore denies anything no rule matches, so a client running ahead of
the deployed rules gets `permission-denied` on that read.

Three things keep that from becoming an outage, and all three are deliberate:

1. **Rules and indexes are part of the release.** Run
   `firebase deploy --only firestore:rules,firestore:indexes` in the same
   maintenance window as the app deploy, before traffic reaches the new build.
2. **A refused collection costs that collection, not the account.** Every
   read in the hydration path goes through `readOrFallback`
   (`src/lib/firebase/load-errors.ts`): `permission-denied` on a secondary
   collection degrades it to empty and reports it, so the athlete still gets
   their data. A network failure is *not* degraded — it still throws, so the
   cached copy is used rather than an empty account being shown (and later
   written back).
3. **The failure names its cause.** A blocked collection shows a banner saying
   which one; a total failure says whether to deploy rules, deploy indexes,
   sign in again, or check the network — instead of blaming the connection for
   every problem.

`tests/load-errors.test.ts` pins both the boundary (only `permission-denied`
degrades) and the copy, and asserts structurally that no raw read sneaks back
into `loadUserState`.

### Rules tests

The rules are a security boundary and have unit tests that run against the
Firestore emulator (requires Java 21+):

```
pnpm test:rules
```

CI runs them in the blocking `firestore-rules` job. Verify after deploying:
sign up, complete onboarding, log a workout, reload — the profile document,
category seeds, generated starter schedule (when selected), and session write
must all succeed.

## 4. Data model
```
users/{uid}                          -> { profile, createdAt, updatedAt }
users/{uid}/categories/{id}          -> activity categories
users/{uid}/sessions/{id}            -> logged workout sessions
users/{uid}/schedule/{id}            -> recurring scheduled workouts
users/{uid}/goals/{id}               -> goals
users/{uid}/bodyLogs/{id}            -> body measurements
users/{uid}/gymShares/{gymId}        -> opt-in aggregates the member shares with one gym
accountDeletionJobs/{uid}             -> server-only deletion progress (client denied)

gyms/{slug}                          -> tenant: public profile, status, branding, plan
gyms/{slug}/members/{uid}            -> roster row + the per-gym role the rules get()
gyms/{slug}/classes/{classId}        -> class template (focus, minutes, capacity, studio)
gyms/{slug}/slots/{slotId}           -> scheduled occurrence (startsAt, capacity, booked)
gyms/{slug}/bookings/{bookingId}     -> one seat: uid, status (booked|attended|no_show|cancelled|waitlist)
gyms/{slug}/checkins/{visitId}       -> append-only door-visit record (uid, at, by)
gyms/{slug}/plans/{planId}           -> membership tiers (price, period, published)
gyms/{slug}/invoices/{invoiceId}     -> payments (memberUid, amountMinor, status, method)
gyms/{slug}/settings/{settingsId}    -> private tenant settings (owner/staff read)
gyms/{slug}/audit/{entryId}          -> append-only action log
platform/**                          -> admin rollups; client-denied entirely
```

### The B2B split in one paragraph
A member's private training data never leaves `users/{uid}` — the rules there
are unchanged and owner-only. A gym owns its roster (`gyms/{slug}/members`) and
everything it needs to run (timetable, bookings, check-ins, plans, invoices),
and the *only* thing a member shares upward is a document they write
themselves: `users/{uid}/gymShares/{gymId}` with three aggregates (sessions
this month, streak, attendance %). Deleting that document is the whole
revocation. Per-gym roles (owner/staff/member) live on the membership row —
the rules resolve them with a single `get()`, never a claim, so multi-gym
users and staff changes take effect immediately. Design and rules:
`docs/b2b-pivot-plan.md`; implementation status: `docs/b2b-todo.md`.


## 5. Server-side account deletion

Cloud account deletion is handled by `POST /api/account/delete`, not by a
client-side loop. After the client reauthenticates and sends a fresh ID token,
the Admin SDK records a retryable job, recursively deletes `users/{uid}` and
all nested collections, then deletes the Firebase Auth user. Configure either
these Vercel server-only variables:

```
FIREBASE_ADMIN_PROJECT_ID=...
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY=...     # preserve escaped newlines
```

or one `FIREBASE_ADMIN_SERVICE_ACCOUNT` JSON secret. Google-hosted runtimes may
use Application Default Credentials. Never expose any of these as
`NEXT_PUBLIC_*`. A failed request can be retried; the job record prevents a
crashed request from leaving an account permanently stuck.

## 6. Demo data (optional, never shipped to end users)
The app never seeds demo data. For demos/analytics use one of:

- **Firestore:** `pnpm seed` — see `scripts/README.md`. Requires a service
  account (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)
  and writes a realistic ~6-week history to a `demo-user` (or `SEED_UID`).
- **SQL:** `scripts/seed.sql` — relational schema + the same demo data for Postgres/SQLite
  exploration and analytics (includes a `v_weekly_volume` view).

## 7. App Check (recommended before launch)
The Firebase config keys are necessarily public, so rules are the real access
control. **App Check** adds attestation on top: it proves requests come from
the genuine app on an authorised domain, which is what stops scripts from
farming Auth signups and Firestore operations with the public key.

1. Firebase console → **App Check → Apps** → register the web app with
   **reCAPTCHA v3** and copy the site key.
2. Set `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` and redeploy. The client
   initialises App Check automatically when the key is present and degrades
   gracefully when it is absent.
3. Once the deployed build is sending attested traffic, enable **enforcement**
   for Firestore and Authentication under App Check → APIs.

Enforce only after step 2 is live — enforcing first would lock out real users.
Full ordering is in `docs/ops-runbook.md` §1.

## 8. Email verification
Sign-up sends a verification email automatically. The profile screen shows an
"Email not verified" notice with a resend action while the address is
unconfirmed. Customise the sender, subject and body under
Authentication → Templates so the mail does not look like phishing.

## Local-only mode
Leave the `NEXT_PUBLIC_FIREBASE_*` vars unset and the app runs entirely in the
browser with no backend — great for quick previews.
