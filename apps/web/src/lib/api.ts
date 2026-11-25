import { session } from './session';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
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
  return `${BASE}${path}${qs ? `?${qs}` : ''}`;
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

// Single-flight: concurrent 401s share one refresh call (refresh tokens are single-use).
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
      session.set({ ...current, ...tokens });
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
    else session.clear();
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? 'Erro inesperado', data?.details);
  }
  return data as T;
}
