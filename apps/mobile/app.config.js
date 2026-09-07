/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: 'SmartFit',
  slug: 'smartfit',
  version: '1.0.0',
  scheme: 'smartfit',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,

  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#F7FAF7',
  },

  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.smartfit.app',
  },

  android: {
    package: 'com.smartfit.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#15803D',
    },
  },

  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },

  plugins: ['expo-router'],
};

module.exports = config;
