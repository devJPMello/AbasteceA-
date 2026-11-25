import type { ExpoConfig } from 'expo/config';

/**
 * Dynamic config so secrets and per-developer values come from the environment, not git:
 *  - GOOGLE_MAPS_API_KEY: Android map tiles (Maps SDK for Android key).
 *  - EAS_PROJECT_ID: needed to obtain Expo push tokens (create the project with `eas init`).
 */
const config: ExpoConfig = {
  name: 'Bomba Certa',
  slug: 'bomba-certa',
  version: '0.1.0',
  scheme: 'bombacerta',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    // Change before publishing: this identifies the app in the stores.
    bundleIdentifier: 'dev.bombacerta.app',
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'Mostra os postos mais baratos perto de você.',
    },
  },
  android: {
    package: 'dev.bombacerta.app',
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
    config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY } },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-location',
      { locationWhenInUsePermission: 'Mostra os postos mais baratos perto de você.' },
    ],
    ['expo-notifications', { color: '#0f766e', defaultChannel: 'alerts' }],
  ],
  extra: { eas: { projectId: process.env.EAS_PROJECT_ID } },
  experiments: { typedRoutes: true },
};

export default config;
