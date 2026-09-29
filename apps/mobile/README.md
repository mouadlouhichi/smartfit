# SmartFit Mobile — Health Connect & EAS Build

## Health Connect (Android)

SmartFit syncs with **Google Health Connect** so your recovery score is powered
by real wearable data (Pixel Watch, Samsung Watch, Oura, Garmin, Fitbit,
Whoop, Withings, Polar — any app that writes to Health Connect).

### Data synced
| Metric | Record type |
| --- | --- |
| Steps | `Steps` |
| Active calories | `ActiveCaloriesBurned` |
| Resting heart rate | `RestingHeartRate` |
| HRV (rMSSD) | `HeartRateVariabilityRmssd` |
| Respiratory rate | `RespiratoryRate` |
| Blood oxygen | `OxygenSaturation` |
| Sleep sessions + stages (deep/REM/light/awake) | `SleepSession` |
| Exercises | `ExerciseSession` |

Synced rows merge into the existing SmartFit store keyed by `source:externalId`,
so re-syncs are idempotent and manual logs are preserved (the merge prefers
values you entered over blank synced fields for a given day).

### How to set up

1. Install the **Health Connect** app from Google Play if not present. It ships
   pre-installed on Android 14+; on Android 13 it's a one-tap install from Play.
2. Open **SmartFit → Profile → Health Connect** and tap **Grant permissions**.
3. Enable the apps you want SmartFit to read from inside the Health Connect UI.
4. Tap **Sync now**. SmartFit pulls the last 14 days; the recovery card on the
   home screen updates immediately.

## iOS (Apple Health)

Apple Health is not wired yet. The sync layer is designed the same way
(`health-connect.ts` is Android-only; a sibling `health-kit.ts` using
`react-native-health` will slot in when P2 is scheduled. The `NSHealth*UsageDescription`
keys are already declared in `app.config.js` so adding the native module does not
change the permission surface again.

## EAS Build / automatic cloud builds

SmartFit uses Expo Application Services (EAS) to produce signed Android and iOS
binaries without running Android Studio / Xcode locally.

### One-time setup

1. Install EAS CLI: `npm i -g eas-cli`
2. Log in: `eas login`
3. From `apps/mobile`, run once to configure your project:
   ```bash
   cd apps/mobile
   eas build:configure
   ```
4. Add an Expo Personal Access Token as a GitHub secret named `EXPO_TOKEN`
   (create one at https://expo.dev/settings/access-tokens).
5. For production builds add the Android signing secrets:
   `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (all optional — without them
   you can still build internal/preview APKs).

### Build profiles (`apps/mobile/eas.json`)

| Profile   | When to use                                | Output                |
| --------- | ------------------------------------------ | --------------------- |
| `development` | Local dev-client builds (with dev menu) | Debug dev-client APK  |
| `preview` | Shareable internal preview (PR builds)     | Signed APK            |
| `production` | Play Store release                       | AAB, auto-increment   |

### Triggers (`.github/workflows/mobile-build.yml`)

| Event | Build |
| --- | --- |
| PR opened / updated | Android preview APK |
| Push to `main` or `releases/*` | Production Android build (internal track) |
| Tag `v*.*.*` | Production Android **+** iOS build, auto-submit to stores |
| Manual dispatch (`workflow_dispatch`) | Pick profile + platform |

### Manual builds

```bash
# Development client (install via QR on a device running Expo Go/dev-client)
pnpm build:dev

# Shareable preview APK
pnpm build:preview

# Production release
pnpm build:prod

# Over-the-air update to channel (JS only)
pnpm update
```

Build artifacts land at the Expo dashboard and are linked from the CI run.
