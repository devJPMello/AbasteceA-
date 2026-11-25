import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

export interface Session {
  user: { id: string; email: string; name: string };
  accessToken: string;
  refreshToken: string;
}

const KEY = 'bomba-certa.session';
const listeners = new Set<() => void>();

let current: Session | null = null;
let ready = false;
const emit = () => listeners.forEach((l) => l());

/**
 * Tokens are kept in the OS keystore (Keychain / Android Keystore) through expo-secure-store,
 * unlike the web app's localStorage: other apps and plain file access cannot read them.
 * Reading is async, so the app shows a splash until `loadSession()` has finished.
 */
export async function loadSession() {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    current = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    current = null;
  }
  ready = true;
  emit();
}

export const session = {
  get: () => current,
  async set(next: Session) {
    current = next;
    emit();
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
  },
  async clear() {
    current = null;
    emit();
    await SecureStore.deleteItemAsync(KEY);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export const useSession = () => useSyncExternalStore(session.subscribe, session.get);
export const useSessionReady = () => useSyncExternalStore(session.subscribe, () => ready);
