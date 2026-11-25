import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { vi } from 'vitest';
import { session } from '../lib/session';

/** Renders with the same providers as the app (query cache, router, toasts). */
export function renderApp(
  ui: ReactElement,
  route = '/',
  { toaster = true }: { toaster?: boolean } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        {ui}
        {toaster && <Toaster />}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export function logIn(name = 'Ana') {
  session.set({
    user: { id: 'u1', email: 'ana@example.com', name },
    accessToken: 'access',
    refreshToken: 'refresh',
  });
}

export const json = (body: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status });

export interface RecordedCall {
  method: string;
  path: string;
  body: unknown;
}

/**
 * Fakes the API. `handler` receives the method and path (without the /api prefix) and returns a
 * Response; every call is recorded so tests can assert what the UI sent.
 */
export function mockApi(handler: (method: string, path: string) => Response) {
  const calls: RecordedCall[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://localhost');
    const method = init?.method ?? 'GET';
    const path = url.pathname.replace(/^\/api/, '');
    calls.push({
      method,
      path,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    });
    return handler(method, path);
  });
  return calls;
}
