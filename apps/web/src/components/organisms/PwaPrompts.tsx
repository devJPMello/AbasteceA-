import { useEffect } from 'react';
import { toast } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_TOAST_ID = 'pwa-update';
const HOUR = 60 * 60 * 1000;

// Module-level so a remount (StrictMode) never leaves two timers running.
let updateTimer: ReturnType<typeof setInterval> | undefined;

/**
 * Service worker lifecycle, shown as toasts. Renders nothing itself.
 *  - New version ready: a persistent toast offers "Atualizar" (the user picks the moment).
 *  - First install finished: one-time "ready for offline use" message.
 *  - Long-lived tabs re-check for a new version every hour.
 */
export function PwaPrompts() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      clearInterval(updateTimer);
      if (registration) updateTimer = setInterval(() => void registration.update(), HOUR);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast('Nova versão disponível', {
      id: UPDATE_TOAST_ID,
      description: 'Atualize para usar as últimas melhorias.',
      duration: Infinity,
      action: { label: 'Atualizar', onClick: () => void updateServiceWorker(true) },
      cancel: { label: 'Depois', onClick: () => setNeedRefresh(false) },
    });
  }, [needRefresh, updateServiceWorker, setNeedRefresh]);

  useEffect(() => {
    if (!offlineReady) return;
    toast.success('Pronto para usar offline', {
      description: 'Os últimos preços e o mapa visto ficam salvos neste aparelho.',
    });
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady]);

  return null;
}
