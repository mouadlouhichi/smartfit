/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: 'SmartFit',
  owner: 'mouadlouhichi',
  slug: 'smartfit',
  version: '1.0.0',
  scheme: 'smartfit',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,

  // Ties every `eas build` from CI and local dev to the same Expo project, so
  // builds show up on the expo.dev dashboard instead of spinning up a new
  // anonymous project each run.
  extra: {
    eas: {
      projectId: '10f1e489-ed90-4376-be3f-d4dc127d85c3',
    },
  },

  icon: './assets/icon.png',
  primaryColor: '#8AD200',

  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0E0E0E',
  },

  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.smartfit.app',
    infoPlist: {
      NSMicrophoneUsageDescription:
        'Allow SmartFit to record audio notes about your workouts (optional).',
      NSFaceIDUsageDescription:
        'Lock SmartFit with Face ID to keep your training, recovery and body data private.',
      NSHealthShareUsageDescription:
        'SmartFit reads your workouts, heart rate and sleep to compute your daily recovery score.',
      NSHealthUpdateUsageDescription: 'SmartFit can write workouts you log back to Apple Health.',
    },
  },

  android: {
    package: 'com.smartfit.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#8AD200',
    },
    permissions: [
      'android.permission.health.READ_STEPS',
      'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
      'android.permission.health.READ_TOTAL_CALORIES_BURNED',
      'android.permission.health.READ_HEART_RATE',
      'android.permission.health.READ_RESTING_HEART_RATE',
      'android.permission.health.READ_HEART_RATE_VARIABILITY',
      'android.permission.health.READ_RESPIRATORY_RATE',
      'android.permission.health.READ_OXYGEN_SATURATION',
      'android.permission.health.READ_SLEEP',
      'android.permission.health.READ_EXERCISE',
      'android.permission.health.READ_EXERCISE_ROUTES',
      'android.permission.USE_BIOMETRIC',
      'android.permission.USE_FINGERPRINT',
      'android.permission.VIBRATE',
    ],
  },

  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },

  plugins: [
    'expo-router',
    'expo-dev-client',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'SmartFit uses location only while a GPS run is active and the app is in the foreground.',
      },
    ],
    [
      'react-native-health-connect',
      {
        healthConnectPermissionReason:
          'SmartFit syncs steps, heart rate, sleep and workouts from Health Connect to compute your daily recovery score.',
      },
    ],
    'expo-haptics',
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'Allow SmartFit to use Face ID to lock your training data.',
      },
    ],
  ],
};

module.exports = config;
