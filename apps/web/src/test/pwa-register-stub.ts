import { vi } from 'vitest';

/**
 * Test double for `virtual:pwa-register/react`. Tests flip `pwaState` to simulate "a new version
 * is waiting" or "ready for offline", and inspect `updateServiceWorker` / the setters.
 */
export const pwaState = {
  needRefresh: false,
  offlineReady: false,
  setNeedRefresh: vi.fn(),
  setOfflineReady: vi.fn(),
  updateServiceWorker: vi.fn(async () => {}),
  registrationCallback: undefined as ((url: string, reg?: unknown) => void) | undefined,
};

export function resetPwaState() {
  pwaState.needRefresh = false;
  pwaState.offlineReady = false;
  pwaState.setNeedRefresh.mockClear();
  pwaState.setOfflineReady.mockClear();
  pwaState.updateServiceWorker.mockClear();
  pwaState.registrationCallback = undefined;
}

export function useRegisterSW(options?: { onRegisteredSW?: (url: string, reg?: unknown) => void }) {
  pwaState.registrationCallback = options?.onRegisteredSW;
  return {
    needRefresh: [pwaState.needRefresh, pwaState.setNeedRefresh] as const,
    offlineReady: [pwaState.offlineReady, pwaState.setOfflineReady] as const,
    updateServiceWorker: pwaState.updateServiceWorker,
  };
}
