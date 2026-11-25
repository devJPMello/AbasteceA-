import { useCallback, useEffect, useState } from 'react';

export const PALMAS_CENTER = { lat: -10.1844, lng: -48.3336 };

export type GeoStatus = 'loading' | 'granted' | 'denied' | 'unavailable';

/** Browser geolocation with a fallback to Palmas' centre so the map is never empty. */
export function useGeolocation() {
  const [position, setPosition] = useState(PALMAS_CENTER);
  const [status, setStatus] = useState<GeoStatus>('loading');

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable');
      return;
    }
    setStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
        setStatus('granted');
      },
      () => setStatus('denied'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(locate, [locate]);

  return { position, status, locate };
}
