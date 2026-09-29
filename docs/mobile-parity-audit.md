# Mobile ↔ web parity audit — 2026-09-30

Scope: what the **web app** (`src/`) has that the **mobile app**
(`apps/mobile/`) does not, plus the manual steps only a human with account
access can perform.

Everything below was verified against this checkout, not recalled. Counts are
line counts and file lists from the working tree.

---

## 1. Where the two apps stand

| | web | mobile |
| --- | --- | --- |
| Routes / screens | 32 pages + 20 API routes | 11 route files |
| Onboarding | `/onboarding` | `/onboarding` — **parity** (5-step wizard) |
| Auth | `/login` (signin · signup · reset · Google) | `/login` + `/profile` sign-out — **parity** |
| Data storage | Firestore + `write-queue.ts` (offline-first sync) | AsyncStorage only, **no sync layer** |
| Health | n/a | Health Connect (Android) wired; HealthKit (iOS) **not implemented** |
| Runner | GPS + MapLibre vector basemap (`run-map.tsx`) | GPS tracking, **no map at all** |
| Coach | `/dashboard/coach` + `/api/coach` proxy | `/coach` (client-side) |
| B2B / gyms | `/g/[slug]`, `/studio`, `/gyms`, `/admin/*` | **none** |
| i18n | shared `@smartfit/core` | shared `@smartfit/core` — **parity** |

Both apps share 37 domain modules / ~17.6k lines through `@smartfit/core`
(33 import sites in mobile). So closing most gaps below is **UI work, not
re-deriving domain logic** — the rules already exist and are already tested.

---

## 2. Missing screens

| Web screen | Source of truth | Mobile status | What it takes |
| --- | --- | --- | --- |
| **Library** | `training-library.tsx` (205 lines) | Missing | Browse/filter the shared exercise catalogue and start a session. The catalogue (`extended-catalog.ts`, `exercise-instructions.ts`) is already in mobile — only the browse screen is absent. |
| **Personalize** | `personalization.tsx` (278 lines) | Missing | Preferred days, equipment, session length. `DEFAULT_TRAINING_PREFERENCES`, `generateStarterWeek`, `parseTrainingPreferences` are all in core, and onboarding already writes `planId`. Highest value per line of work. |
| **Body** | `body-screen.tsx` (596 lines) | Partial — `BodyMeasurementModal` only | Web has trend charts (recharts) over measurements. Mobile logs measurements but never plots them. Mobile has `LineChart`/`BarChart` components already. |
| **Fuel** | `fuel-screen.tsx` (527 lines) | Partial — `MealEntryModal` only | Web has targets, macro breakdown, day navigation and meal-scan. Mobile logs meals; `nutrition.ts` (core) is present. |
| **Coaching** | `coaching-workspace.tsx` (505 lines) | Missing | Depends on the B2B graph (§3); member-side view needs a gym assignment. |
| **Gym / studio / admin** | `/g/[slug]`, `/studio`, `/gyms`, `/admin/*` | Missing | Whole B2B surface. Out of scope for a consumer mobile release; revisit only if the B2B pivot ships to phones. |
| **Legal / support** | `/privacy`, `/terms`, `/support` | Missing | Web links these from the login footer; the mobile login footer shows the privacy line but links nowhere. Cheap: open `https://<host>/privacy` via `expo-web-browser`. |

Mobile does have, and keeps: **Home**, **Plan**, **Progress**, **Goals**,
**Profile** plus hidden **Coach** and **Run** — 3,971 lines across 11 route
files, with 25 supporting components.

---

## 3. Missing capabilities (bigger than a screen)

Ordered by how much they block a real release.

### 3.1 No data sync layer — the biggest gap
The web persists through `src/lib/firebase/repo.ts` + `write-queue.ts` (queued,
offline-tolerant writes to Firestore, keyed by `uid`). Mobile persists to
AsyncStorage only. **Consequence: signing in on mobile creates an account but
nothing follows it.** A user who trains on the phone and opens the web sees an
empty dashboard, and vice versa.

Minimum viable next step: a mobile `repo`/queue pair that mirrors the web's
contract, driven off the `user.uid` the auth context already exposes, with the
existing `@smartfit/core` state shape as the payload. Firestore rules already
exist and are tested (`pnpm test:rules`), so no backend change is needed —
mobile just has to join the same data model.

### 3.2 iOS HealthKit is unimplemented (Health Connect works)
- Android: `health-connect.ts` is wired into the store (availability probe,
  permission request, 14-day sync, Play-Store install path) and surfaced in
  **Profile → Health Connect**.
- iOS: `health-kit.ts` (137 lines) is a **complete shim that nothing imports**
  — `grep -rn "health-kit" apps/mobile/src` returns no call sites. There is no
  HealthKit native module in `apps/mobile/package.json` (only
  `react-native-health-connect`), yet `app.config.js` already declares
  `NSHealthShareUsageDescription` / `NSHealthUpdateUsageDescription`.

So on iPhone the permission copy ships while the capability does not. This is
the mandatory-integration item that is genuinely unfinished: it needs a native
HealthKit package (e.g. `@kingstinct/react-native-healthkit`), an Expo config
plugin with the HealthKit entitlement, and wiring the existing shim into
`store.tsx` behind the same `syncHealthConnect`-style API.

### 3.3 The runner has no map
`apps/mobile/src/app/(tabs)/run.tsx` (828 lines) records GPS with
`expo-location`, filters implausible jumps and handles pause/resume, but draws
**no map** — there is no map dependency in `apps/mobile/package.json`. The web
runner renders a MapLibre vector basemap (`src/components/dashboard/run/run-map.tsx`,
`src/lib/map-tiles.ts`). Bringing a vector basemap to mobile is a real feature,
not a tweak: it needs a tile source plus attribution and API-key handling, and
offline tile caching if runs happen without signal.

### 3.4 No account export / deletion
Web exposes `/api/account/export` and `/api/account/delete` (Admin SDK,
server-only). Mobile's only destructive action is "Erase everything" (local
device data). A cloud-mode mobile account cannot be exported or deleted from
the phone. Both are privacy commitments, not niceties.

### 3.5 No push notifications
No `expo-notifications` dependency and no registration code. Plan reminders,
streak nudges and coaching assignments all exist as web concepts with no phone
delivery.

### 3.6 No Pro purchase path
`ProCard` states subscriptions are managed on the web "for now" — deliberate,
but worth stating in the audit rather than rediscovering later. Needs
`expo-in-app-purchases`/RevenueCat + server-side receipt validation before the
App Store will accept a paid tier.

### 3.7 Offline/degraded-state UX is thinner
Web has a dedicated `/offline` route and `load-errors.ts`; mobile has
`StoreStatusGate` (storage failures only). Once §3.1 lands, mobile needs the
equivalent of the web's load-error surfaces, or a sync failure will look like
data loss.

---

## 4. What is genuinely at parity (do not rebuild)

- **Onboarding** — 5-step wizard, writes through `completeOnboarding`, shares
  the same `onboarding.*` i18n keys (all 35 verified present).
- **Auth** — signin / signup / reset, Google, local-mode fallback card, error
  messages from the shared `@smartfit/core` auth-error layer, sign-out in
  Profile. Same copy and order as the web login.
- **Local-first privacy** — AsyncStorage default, biometric lock
  (`expo-local-authentication`), no telemetry; cloud mode is opt-in via four
  env vars and the app runs fully with none of them.
- **Strength logging** — `LogWorkoutModal`, `ExercisePickerModal`,
  `ExerciseDemo`, `EventDetailModal` + shared catalogue, including GIF demo
  assets.
- **Health Connect (Android)** — availability, permissions, 14-day sync.
- **i18n** — same translator and catalogues as web.
- **Gating order** — `StoreProvider → AuthProvider → AuthGate → OnboardingGate
  → Stack`, composed so a signed-out visitor is never dragged through profile
  setup, and a local-mode install never sees an auth wall.

---

## 5. Manual steps only you can do

Nothing in this section can be done from CI or from this repo — every item
requires console or store-account access. Steps 1–4 are required for the login
that now ships to actually work against your live project; the rest are
optional or release-gated.

### 5.1 Required for cloud mode (login) — Firebase console

1. **Get the web app's client config.** Firebase console → your project →
   Project settings → General → *Your apps* → the web app → SDK setup and
   configuration. Copy `apiKey`, `authDomain`, `projectId`, `appId`
   (and `storageBucket`, `messagingSenderId` if you want them).
   These are the same four values your web `.env` uses — **use the same
   project**, so one account works on both apps.

2. **Register the Android app.** Project settings → *Add app* → Android.
   - Package name: `com.smartfit.app` (must match `app.config.js` exactly).
   - Add the **SHA-1** of the keystore the release actually ships with —
     EAS-managed credentials have their own fingerprint, so get it from
     `eas credentials` (Android → the build profile you ship → *Keystore*
     → SHA-1 fingerprint), not from a local debug keystore. Google sign-in
     fails with `DEVELOPER_ERROR` if this is missing or wrong.
   - Download **`google-services.json`**. Either drop it at
     `apps/mobile/google-services.json` or paste its values into
     `EXPO_PUBLIC_FIREBASE_*`. It is a client file, not a secret.
     If you commit it, note that it is project-identifying but not a
     credential — Firebase treats it as public.

3. **Register the iOS app.** *Add app* → iOS, bundle id `com.smartfit.app`,
   and download `GoogleService-Info.plist` to `apps/mobile/`.

4. **Enable Google sign-in and create the OAuth clients.** Authentication →
   Sign-in method → Google → *Web SDK configuration* gives you the **web**
   client id. Then in Google Cloud console → APIs & Services → Credentials,
   create an **iOS** client (bundle id `com.smartfit.app`) and an **Android**
   client (package `com.smartfit.app` + the same SHA-1 as step 2). Put all
   three in the env:
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `…_IOS_CLIENT_ID`, `…_ANDROID_CLIENT_ID`.
   The web id is also the fallback, so email/password works without any of
   them — only Google needs these.

5. **Authorised domains / redirect.** The app redirects on the custom scheme
   `smartfit`, which is already set in `app.config.js` and matches the code
   (`makeRedirectUri({ scheme: 'smartfit' })`). Nothing to configure in
   Firebase for the native flow, but keep the scheme in the config — changing
   one without the other breaks the Google round-trip.

6. **If the web login currently works, steps 1–4 are the whole list**: the
   same project serves both apps, and Firestore rules are already deployed.

### 5.2 Required for a device build — EAS / stores

7. **Wait for the Android quota reset (Thu 01 Oct 2026)** and re-run the
   workflow; iOS already queues fine today via `ios.simulator: true`
   (`builds/5556def3-ccc2-4297-933b-b7ea81161b14`).
8. **Apple Developer Program ($99/yr)** — required for a device/TestFlight
   build. The simulator build needs no account, but it cannot be installed on
   a physical iPhone.
9. **Google Play Console ($25 one-off)** — required to publish the Android
   build to testers or users.
10. **Version bump before each store release** — `version` / `versionCode` in
    `apps/mobile/app.config.js` (currently `1.0.0` / `1`).

### 5.3 Optional / later

11. **`google-services.json` commit decision** (step 2) — no functional
    impact either way.
12. **App Check for mobile**, if you want parity with the web's reCAPTCHA
    hardening. Needs a Play Integrity / DeviceCheck setup.
13. **Push notifications** (§3.5) — needs an FCM sender id and, on iOS, an APNs
    key uploaded to EAS.
14. **HealthKit on iOS** (§3.2) — the Human Interface Guidelines require the
    HealthKit entitlement on the App ID plus a reviewed privacy policy; both
    are Apple-account actions.

---

## 6. Suggested order

1. **Sync layer** (§3.1) — without it, login is a dead end; everything else is
   cosmetic next to this.
2. **iOS HealthKit** (§3.2) — the only *mandatory* item that is unfinished.
3. **Personalize + Library screens** (§2) — core logic already written, so
   these are the cheapest real features.
4. **Map for the runner** (§3.3).
5. **Account export/delete** (§3.4), push (§3.5), Pro (§3.6), B2B (§2).

---

### Provenance

- Route lists: `find src/app -name page.tsx` / `find apps/mobile/src/app -name '*.tsx'`.
- Feature sizes: `wc -l` on the files cited above.
- HealthKit gap: `grep -rn "health-kit" apps/mobile/src` → no call sites;
  `grep -n health apps/mobile/package.json` → Health Connect only.
- Map gap: no map package in `apps/mobile/package.json`; web has
  `run-map.tsx` + `map-tiles.ts`.
- Sync gap: no `firestore` occurrence in `apps/mobile/src` outside comments;
  web has `repo.ts`, `tenant-repo.ts`, `write-queue.ts`.
