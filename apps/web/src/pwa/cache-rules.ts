/**
 * What the service worker is allowed to cache. Single source of truth: vite.config.ts feeds
 * these patterns to Workbox, and cache-rules.test.ts pins down what matches and what must NOT.
 *
 * Plain RegExp literals only (no closures): Workbox serialises them into the generated sw.js.
 */

/** OpenStreetMap raster tiles (a/b/c subdomains). */
export const TILE_PATTERN = /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.+/;

/**
 * PUBLIC station reads: nearby search, station detail and price history. Matches the dev proxy
 * (`/api/stations/...`) and a production API host (`https://api.example.com/stations/...`).
 *
 * Deliberately excludes everything personal or mutable: `/stations/:id/pending-reports` (answer
 * depends on who is logged in), `/alerts`, `/notifications`, `/auth/*`, `/users/*`, `/prices/*`,
 * `/devices/*`. Caching those could show one user's data to another on a shared device.
 */
export const STATION_API_PATTERN =
  /^https?:\/\/[^/]+(?:\/api)?\/stations\/(?:nearby|[0-9a-f-]{36}(?:\/price-history)?)(?:\?.*)?$/i;

export const CACHE_NAMES = { tiles: 'osm-tiles', stationsApi: 'stations-api' } as const;
