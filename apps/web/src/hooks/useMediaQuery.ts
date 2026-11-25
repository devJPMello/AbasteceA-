import { useSyncExternalStore } from 'react';

/** Subscribes to a CSS media query. Returns `false` where matchMedia does not exist (tests/SSR). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof matchMedia !== 'function') return () => {};
      const mql = matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => typeof matchMedia === 'function' && matchMedia(query).matches,
    () => false,
  );
}

/** Tailwind's `md` breakpoint: sidebar layout on desktop, bottom sheet on phones. */
export const useIsDesktop = () => useMediaQuery('(min-width: 768px)');
