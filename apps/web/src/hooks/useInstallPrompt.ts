import { useCallback, useEffect, useState } from 'react';

/** Chromium's install event: not in the DOM typings because it is not a web standard. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone() {
  return (
    (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Lets the app offer its own "Install" button. Browsers fire `beforeinstallprompt` when the PWA
 * is installable; we keep the event and replay it on demand. Safari/iOS never fires it (users add
 * the app through the Share sheet), so `canInstall` simply stays false there.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // stop the browser's own mini-infobar; we show our button instead
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return null;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null); // the event can only be used once
    return outcome;
  }, [deferred]);

  return { canInstall: deferred !== null && !installed, installed, install };
}
