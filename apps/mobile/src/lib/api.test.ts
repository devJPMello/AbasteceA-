import { api, ApiError } from './api';
import { session } from './session';

// In-memory stand-in for the OS keystore.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

const user = { id: 'u1', email: 'a@b.co', name: 'Ana' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(async () => {
  await session.set({ user, accessToken: 'old-access', refreshToken: 'old-refresh' });
});

afterEach(() => jest.restoreAllMocks());

describe('api client', () => {
  it('sends the bearer token and returns the parsed body', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ok: true }));
    await expect(api('/users/me')).resolves.toEqual({ ok: true });
    expect((fetchSpy.mock.calls[0]![1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer old-access',
    });
  });

  it('turns error responses into ApiError with the server message', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json({ message: 'Try again in 5 min.' }, 429));
    await expect(api('/prices/reports', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 429,
      message: 'Try again in 5 min.',
    });
    await expect(api('/x')).rejects.toBeInstanceOf(ApiError);
  });

  it('refreshes once on 401, stores the new tokens and retries the request', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({}, 401)) // original request
      .mockResolvedValueOnce(json({ accessToken: 'new-access', refreshToken: 'new-refresh' })) // refresh
      .mockResolvedValueOnce(json({ id: 'u1' })); // retry
    await expect(api('/users/me')).resolves.toEqual({ id: 'u1' });

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(String(fetchSpy.mock.calls[1]![0])).toContain('/auth/refresh');
    expect((fetchSpy.mock.calls[2]![1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer new-access',
    });
    expect(session.get()).toMatchObject({ accessToken: 'new-access', refreshToken: 'new-refresh' });
  });

  it('shares a single refresh between concurrent 401s (refresh tokens are single-use)', async () => {
    let refreshCalls = 0;
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        refreshCalls++;
        await new Promise((r) => setTimeout(r, 20));
        return json({ accessToken: 'new-access', refreshToken: 'new-refresh' });
      }
      const auth = (init as RequestInit).headers as Record<string, string>;
      return auth.Authorization === 'Bearer new-access' ? json({ ok: true }) : json({}, 401);
    });

    await expect(Promise.all([api('/a'), api('/b'), api('/c')])).resolves.toHaveLength(3);
    expect(refreshCalls).toBe(1);
  });

  it('logs the user out when the refresh fails', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ message: 'Refresh token reuse detected' }, 401));
    await expect(api('/users/me')).rejects.toMatchObject({ status: 401 });
    expect(session.get()).toBeNull();
  });
});
