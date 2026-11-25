import '@fontsource-variable/inter';
import type { Preview } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AppToaster } from '../src/components/molecules/AppToaster';
import { ThemeProvider, useTheme, type Theme } from '../src/lib/theme';
import '../src/index.css';

/** Keeps the app's ThemeProvider in step with Storybook's toolbar. */
function ThemeBridge({ theme }: { theme: Theme }) {
  const { setTheme } = useTheme();
  useEffect(() => setTheme(theme), [theme, setTheme]);
  return null;
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Color theme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    (Story, context) => {
      const [client] = useState(
        () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      );
      return (
        <ThemeProvider>
          <ThemeBridge theme={context.globals.theme === 'dark' ? 'dark' : 'light'} />
          <QueryClientProvider client={client}>
            <MemoryRouter>
              <Story />
              <AppToaster />
            </MemoryRouter>
          </QueryClientProvider>
        </ThemeProvider>
      );
    },
  ],
  parameters: {
    layout: 'padded',
    backgrounds: { disable: true }, // the app's tokens paint the page background
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: {
      // Violations fail the story in the a11y panel. Individual stories can opt out with a reason.
      test: 'error',
    },
  },
};

export default preview;
