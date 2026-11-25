import { session } from './session';

/**
 * Emulator: Android reaches the host machine at 10.0.2.2. On a real phone set
 * EXPO_PUBLIC_API_URL to your computer's LAN address (e.g. http://192.168.0.10:3000).
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface Options {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

function buildUrl(path: string, query?: Options['query']) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) params.set(k, String(v));
  const qs = params.toString();
  return `${API_URL}${path}${qs ? `?${qs}` : ''}`;
}

function send(path: string, opts: Options, token?: string) {
  return fetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
}

// Refresh tokens are single-use, so concurrent 401s must share one refresh call.
let refreshing: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  const current = session.get();
  if (!current) return Promise.resolve(null);
  refreshing ??= (async () => {
    try {
      const res = await send('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: current.refreshToken },
      });
      if (!res.ok) return null;
      const tokens = (await res.json()) as { accessToken: string; refreshToken: string };
      await session.set({ ...current, ...tokens });
      return tokens.accessToken;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  let res = await send(path, opts, session.get()?.accessToken);

  if (res.status === 401 && session.get()) {
    const token = await refreshAccessToken();
    if (token) res = await send(path, opts, token);
    else await session.clear();
  }

  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as { message?: string } | null;
  if (!res.ok) throw new ApiError(res.status, data?.message ?? 'Erro inesperado');
  return data as T;
}
