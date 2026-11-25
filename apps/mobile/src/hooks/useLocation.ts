import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

export const PALMAS_CENTER = { lat: -10.1844, lng: -48.3336 };
export type LocationStatus = 'loading' | 'granted' | 'denied';

/** Foreground location with a fallback to Palmas' centre so the map is never empty. */
export function useLocation() {
  const [position, setPosition] = useState(PALMAS_CENTER);
  const [status, setStatus] = useState<LocationStatus>('loading');

  const locate = useCallback(async () => {
    setStatus('loading');
    try {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== 'granted') return setStatus('denied');
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
      setStatus('granted');
    } catch {
      setStatus('denied');
    }
  }, []);

  useEffect(() => {
    void locate();
  }, [locate]);

  return { position, status, locate };
}
