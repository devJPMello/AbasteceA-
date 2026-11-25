import '@fontsource-variable/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ApiError } from './lib/api';
import { ThemeProvider } from './lib/theme';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Offline, still TRY the request: the service worker may answer from its cache. With the
      // default ('online'), React Query would pause and show a skeleton forever.
      networkMode: 'offlineFirst',
      // Retrying a 4xx never helps; only retry network/5xx errors once.
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
    },
    // Writes must fail fast when offline ("sem conexão") instead of hanging until reconnect.
    mutations: { networkMode: 'always' },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
