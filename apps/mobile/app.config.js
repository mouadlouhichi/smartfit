/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: 'SmartFit',
  slug: 'smartfit',
  version: '1.0.0',
  scheme: 'smartfit',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,

  // Brand: volt lime on near-black, matching the web app and the shared mark.
  icon: './assets/icon.png',
  primaryColor: '#9CFF00',

  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0E0E0E',
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
      backgroundColor: '#E05E36',
    },
  },

  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },

  plugins: ['expo-router'],
};

module.exports = config;
