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
```

With these set, `/dashboard` is gated behind sign-in (visitors are redirected to
`/login`, which offers email/password and Google). New accounts start empty and
land on guided onboarding — **there is no demo data in production**.

## 3. Deploy security rules
From the repo root (with the [Firebase CLI](https://firebase.google.com/docs/cli)
installed and logged in):

```
firebase deploy --only firestore:rules,firestore:indexes
```

`firestore.rules` ensures each user can only read/write their own
`users/{uid}/...` tree. `firestore.indexes.json` adds the date ordering index.

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

## Local-only mode
Leave the `NEXT_PUBLIC_FIREBASE_*` vars unset and the app runs entirely in the
browser with no backend — great for quick previews.
