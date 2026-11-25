import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: '@storybook/react-vite',
  core: { disableTelemetry: true },
  viteFinal: async (viteConfig) => ({
    ...viteConfig,
    // Reuse vite.config.ts (Tailwind, the @bomba-certa/shared alias) but not the PWA plugin: a
    // service worker and `virtual:pwa-*` modules make no sense inside Storybook.
    plugins: (viteConfig.plugins ?? [])
      .flat(Infinity as 1)
      .filter(
        (p) =>
          !(
            p &&
            typeof p === 'object' &&
            'name' in p &&
            String(p.name).startsWith('vite-plugin-pwa')
          ),
      ),
  }),
};

export default config;
