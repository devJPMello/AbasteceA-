import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

/**
 * Generates the PNG icons (192/512, maskable, apple-touch, favicon.ico) from public/icon.svg.
 * Run `pnpm --filter @bomba-certa/web generate-pwa-assets` after changing the SVG, and commit the
 * results: the normal build does not need `sharp`.
 */
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/icon.svg'],
});
