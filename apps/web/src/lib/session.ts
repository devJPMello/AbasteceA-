import { useSyncExternalStore } from 'react';

export interface Session {
  user: { id: string; email: string; name: string };
  accessToken: string;
  refreshToken: string;
}

const KEY = 'bomba-certa.session';
const listeners = new Set<() => void>();

function read(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

let current: Session | null = read();

/**
 * Tokens live in localStorage: simple and survives reloads, but readable by any script on the
 * page (XSS). A production hardening would keep the refresh token in an httpOnly cookie.
 */
export const session = {
  get: () => current,
  set(next: Session) {
    current = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: keep the in-memory session */
    }
    listeners.forEach((l) => l());
  },
  clear() {
    current = null;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useSession(): Session | null {
  return useSyncExternalStore(session.subscribe, session.get);
}
