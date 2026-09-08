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

### Rules tests

The rules are a security boundary and have unit tests that run against the
Firestore emulator (requires Java 17+):

```
pnpm test:rules
```

CI runs them in the (currently advisory-only) `firestore-rules` job. Verify
after deploying: sign up, complete onboarding, log a workout, reload — the
profile document, category seeds and session write must all succeed.

## 4. Data model
```
users/{uid}                          -> { profile, createdAt, updatedAt }
users/{uid}/categories/{id}          -> activity categories
users/{uid}/sessions/{id}            -> logged workout sessions
users/{uid}/schedule/{id}            -> recurring scheduled workouts
users/{uid}/goals/{id}               -> goals
users/{uid}/bodyLogs/{id}            -> body measurements
```

## 5. Demo data (optional, never shipped to end users)
The app never seeds demo data. For demos/analytics use one of:

- **Firestore:** `pnpm seed` — see `scripts/README.md`. Requires a service
  account (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)
  and writes a realistic ~6-week history to a `demo-user` (or `SEED_UID`).
- **SQL:** `scripts/seed.sql` — relational schema + the same demo data for Postgres/SQLite
  exploration and analytics (includes a `v_weekly_volume` view).

## 6. App Check (recommended before launch)
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

## 7. Email verification
Sign-up sends a verification email automatically. The profile screen shows an
"Email not verified" notice with a resend action while the address is
unconfirmed. Customise the sender, subject and body under
Authentication → Templates so the mail does not look like phishing.

## Local-only mode
Leave the `NEXT_PUBLIC_FIREBASE_*` vars unset and the app runs entirely in the
browser with no backend — great for quick previews.
