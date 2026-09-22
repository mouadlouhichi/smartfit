# SmartFit — Operations Runbook

Everything that must happen **outside the codebase** before and after launch.
Code-side items live in the audit's launch checklist (`docs/production-audit.md` §7).

---

## 1. Pre-launch checklist (one-time)

### Firebase console

| # | Task | Where | Why |
| --- | --- | --- | --- |
| 1 | Create/select the production project | console.firebase.google.com | — |
| 2 | **Choose the Firestore region deliberately** (e.g. `eur3`/`europe-west` for EU-facing traffic, `nam5` for US) | Firestore → Create database | Region is **immutable** after creation; drives latency and GDPR data-residency answers |
| 3 | Enable **Email/Password** and **Google** sign-in | Authentication → Sign-in method | Required for cloud mode |
| 4 | Add every serving domain to **Authorized domains** (prod domain, `*.vercel.app` preview suffix if previews should sign in) | Authentication → Settings | Sign-in fails with `auth/unauthorized-domain` otherwise — the app surfaces this message, but fix the cause |
| 5 | Restrict the web **API key** to those HTTP referrers | Google Cloud → Credentials | Limits key abuse from other origins |
| 6 | Register the web app for **App Check** with reCAPTCHA v3, copy the site key into `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` | Project settings → App Check | The client initialises App Check automatically when the key is present |
| 7 | **Enable App Check enforcement** for Firestore and Authentication — *after* step 6 is deployed and traffic shows attested requests | App Check → APIs | Blocks scripted abuse of the public API key. Enforcing before clients ship the key locks out real users |
| 8 | Customise the **email templates** (password reset, and the verification mail the app now sends at sign-up): sender name, logo, domain | Authentication → Templates | Default `noreply@smartfit-….firebaseapp.com` mails look like phishing |
| 9 | (Optional) Configure a **custom SMTP sender** | Authentication → Templates → SMTP | Deliverability + branded from-address |

### Deploy backend config from the repo

```bash
firebase login
firebase use <project-id>
firebase deploy --only firestore:rules,firestore:indexes
```

`firebase.json` (repo root) points the CLI at `firestore.rules` and
`firestore.indexes.json`. Verify afterwards:

- A fresh sign-up can create a profile document (rules not stuck in deny-all
  Production-mode defaults).
- The sessions query works — the composite index (`date desc, createdAt desc`)
  is required by the bounded history load; without it every cold start fails
  with `failed-precondition` and falls back to the local cache.
- Rules tests: `pnpm test:rules` (needs Java 21+ locally; CI runs it in the
  `firestore-rules` job).
- The account deletion endpoint (`POST /api/account/delete`) uses the Admin
  SDK and the server-only `accountDeletionJobs/{uid}` collection. The client
  sends a freshly reauthenticated Firebase ID token; the endpoint recursively
  removes `users/{uid}` and its subcollections, records progress, then deletes
  the Auth user. A failed request is retryable and does not fall back to a
  client-side wipe.

### Google Cloud billing & abuse guard-rails

| # | Task | Where |
| --- | --- | --- |
| 10 | Attach a billing account and confirm Firestore is in **production mode** (not test mode — test mode expires into world-open access) | GCP → Firestore |
| 11 | Create **budget alerts** (e.g. warn at $10/$50/$200, action at $500) | GCP → Billing → Budgets & alerts |
| 12 | Set **quota caps** if desired (Firestore reads/writes per minute) — a hard cap converts an attack into a partial outage instead of a bill | GCP → APIs & Services → Quotas |
| 13 | Enable **daily automated Firestore exports** to Cloud Storage (gcloud scheduler job or console) — the only server-side backup; user JSON export is client-side only | see §3 |

### Vercel

| # | Task |
| --- | --- |
| 14 | Import the repo; framework auto-detected (Next.js), `pnpm` install/build per `vercel.json` |
| 15 | Set **Production** env vars: `NEXT_PUBLIC_SITE_URL` (custom domain), all `NEXT_PUBLIC_FIREBASE_*`, optional `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`, optional `NEXT_PUBLIC_ERROR_ENDPOINT`. `NEXT_PUBLIC_*` values are **inlined at build time** — adding one requires a redeploy |
| 16 | Set the server-only Admin env vars for the deletion endpoint: `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, and `FIREBASE_ADMIN_PRIVATE_KEY` (or one `FIREBASE_ADMIN_SERVICE_ACCOUNT` JSON secret). Never prefix these with `NEXT_PUBLIC_`; never commit them |
| 17 | Preview deployments: either leave Firebase vars unset (they run in local mode — good for design review) or point them at a **separate staging Firebase project**. Never share production Firestore with previews |
| 18 | Add the production domain to Firebase Auth authorised domains (step 4) and to the API-key referrers (step 5) |
| 19 | Enable Vercel's HTTPS/HSTS defaults; on a custom domain verify the certificate issued before launch |

### Diagnostics (privacy-compatible)

The app ships an **off-by-default** diagnostics channel (`src/lib/report.ts`):
crash reports from the error boundaries, unhandled window errors/rejections,
and web vitals — POSTed as plain JSON to `NEXT_PUBLIC_ERROR_ENDPOINT` **only
when that variable is set**. No cookies, no third-party SDK, no identifiers,
pathname only (no query strings).

| # | Task |
| --- | --- |
| 20 | Stand up a self-hosted collector (GlitchTip, Sentry self-hosted, or a 20-line log function) |
| 21 | Set `NEXT_PUBLIC_ERROR_ENDPOINT` and redeploy |
| 22 | Add an **uptime ping** (e.g. UptimeRobot/BetterStack free tier) on `/` and `/dashboard` |
| 23 | Keep the privacy page's "Crash reports (optional)" section in sync with what the collector actually stores |

If you instead adopt a hosted analytics/error SDK, the privacy policy **must**
be amended first — it currently promises no analytics SDKs and no third-party
processors beyond Google/Firebase in account mode.

---

## 2. Launch-day verification

1. Sign up with a fresh email → verification email arrives (check spam; sender
   configured in step 8).
2. Complete onboarding → log a workout → reload on a second device (same
   account) → the workout is there.
3. Kill the network (devtools offline) → app still renders from cache → log a
   session → reconnect → sync banner clears and the session appears on device 2.
4. Delete account from Profile → confirm → Firestore tree is gone
   (`users/{uid}` no longer readable with the admin SDK) and the Auth user no
   longer exists.
5. Install the PWA (Chrome menu → Install) → relaunch from the icon → works
   offline, including the `/offline` fallback for uncached routes.
6. Share the URL in a chat app → OG card renders with the image.

## 3. Backups & DR

- **Automated exports (recommended):**
  ```bash
  gcloud firestore export gs://<project>-backups/$(date +%F) \
    --project=<project-id>
  ```
  Schedule daily via Cloud Scheduler (Pub/Sub → Cloud Function) or a cron
  GitHub Action with workload identity. Retain ≥ 30 days; test a restore into
  a scratch project quarterly.
- **User-initiated:** Profile → Export JSON (complete: it pages through the
  full history before downloading).
- **Restore:** `gcloud firestore import` into an empty database, or re-import
  per-user via the admin SDK.

## 4. Incident basics

| Symptom | First checks |
| --- | --- |
| "Changes aren't syncing" banner for many users | Firestore status; App Check enforcement flipped before clients had the key (step 7 ordering); rules deploy broke writes (rollback: `firebase deploy --only firestore:rules` with the previous revision from git) |
| Sign-in suddenly fails on a domain | Authorised domains list; API-key referrer restrictions; `auth/unauthorized-domain` message in the app tells users exactly this |
| Cold start empty in cloud mode | Historically a missing composite index (`failed-precondition` in console) — redeploy indexes. Reads now fall back to an unordered fetch + client-side sort (with a console warning), so sign-in works regardless; the indexes just make it cheaper |
| Blank page after deploy | Check the collector endpoint for `route`/`global` crash reports; Vercel build logs; rollback the deployment (Vercel keeps prior builds one click away) |

Rollback path: Vercel → Deployments → Promote previous. Firestore rules/
indexes roll back by redeploying the previous git revision. The deletion job
is intentionally server-owned; if its route is rolled back, pause account
self-deletion rather than restoring the old client-side wipe.

## 5. Dependencies & security triage

`pnpm audit` currently reports findings **only in build-time transitive
dependencies of the mobile Expo toolchain** (`tar`, `xmldom`, `postcss`,
`image-size` via `@expo/cli` and the RN chain). They do not ship to users and
do not execute against untrusted input in CI (the toolchain only unpacks
first-party packages). The CI `lint` job runs the audit **non-blocking**.

Triage plan:
- Revisit on the **Expo SDK upgrade** (SDK 53+ refreshes the whole chain).
- If the mobile app stays descoped, consider removing `apps/mobile` from the
  install graph (or the repo) — that erases most of the audit output.
- Flip the CI audit step to blocking once `--audit-level=high` is clean.

## 6. Mobile app status

`apps/mobile` is an **internal prototype**, deliberately descoped from launch:
no auth, no cloud sync, no onboarding — it cannot see web-account data. Do not
list it in any user-facing surface until the parity work in
`docs/production-audit.md` §4.8 is funded and done. Play Store submission would
additionally require: EAS project setup (`eas build` credentials), a Data
safety form, a privacy policy URL, and — once auth ships — an in-app account
deletion path.


## Team access release — 22 September 2026

See [the current release checklist](./team-access-and-release-readiness.md) before deploying
membership-based role changes. In particular, reconcile authoritative owner memberships,
run the Java 21 Firestore emulator suite, and ship the new rules and web application together.
Do not assume a successful demo build proves cloud authorization or provider readiness.

Production builds now fail when Firebase client/admin configuration is incomplete or targets
different projects. `SMARTFIT_DEPLOYMENT=demo` is the explicit opt-out for intentional previews
and local production-build tests, **not** a repair for a real deployment's missing credentials.
Google-hosted ADC requires `SMARTFIT_ADMIN_ADC=true` and a matching project ID. CI's credential-free
browser jobs explicitly select demo mode. This guard checks configuration, not live connectivity.


### Automated team-access preflight

Before the coordinated rules/API release, run `pnpm audit:team --project PROJECT` with
read-only credentials; see `scripts/README.md` for options and report handling. A truncated
or failed scan exits 2; blocking findings exit 1. Only an exit-0 **complete** report with
reviewed warnings clears this preflight, not the whole production launch. No live audit
has been performed by the local implementation tests. Run both `pnpm test:rules` and
`pnpm test:integration` with Java 21; CI now runs both as blocking steps.
