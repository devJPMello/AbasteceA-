/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { CACHE_NAMES, STATION_API_PATTERN, TILE_PATTERN } from './src/pwa/cache-rules';

const shared = fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url));
const pwaRegisterStub = fileURLToPath(new URL('./src/test/pwa-register-stub.ts', import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt": a new version waits until the user accepts (see PwaPrompts), instead of
      // swapping the app under their hands in the middle of reporting a price.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'Bomba Certa',
        short_name: 'Bomba Certa',
        description: 'Mapa colaborativo de preços de combustível em Palmas-TO',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#0f766e',
        background_color: '#f8fafc',
        categories: ['navigation', 'utilities'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [{ name: 'Alertas', url: '/alerts', description: 'Seus alertas de preço' }],
      },
      workbox: {
        // woff2 only: every browser that runs a service worker supports it.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        // Offline navigation to any SPA route serves the cached shell, never the API or docs.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/docs/],
        runtimeCaching: [
          {
            // Tiles rarely change: serve from cache first. Bounded, to stay a polite OSM client.
            urlPattern: TILE_PATTERN,
            handler: 'CacheFirst',
            options: {
              cacheName: CACHE_NAMES.tiles,
              expiration: { maxEntries: 400, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Prices change: try the network first, but fall back to the last answer when offline
            // or when the API is slow (e.g. a free-tier instance waking up).
            urlPattern: STATION_API_PATTERN,
            handler: 'NetworkFirst',
            options: {
              cacheName: CACHE_NAMES.stationsApi,
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 60, maxAgeSeconds: 3 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      // The service worker is only generated for production builds: caching in dev is a trap.
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    // Consume the shared Zod schemas straight from source: no build step in dev/tests.
    alias: { '@bomba-certa/shared': shared },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: false,
    // The virtual module only exists inside the Vite plugin; tests use a controllable stub.
    alias: { 'virtual:pwa-register/react': pwaRegisterStub },
  },
});
