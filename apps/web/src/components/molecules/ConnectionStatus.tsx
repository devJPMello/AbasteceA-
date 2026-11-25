import { WifiOff } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

/**
 * Offline banner: tells the user that what they see may be older than the real prices. Also
 * confirms when the connection returns (React Query refetches on reconnect by itself).
 */
export function ConnectionStatus() {
  const online = useOnlineStatus();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
    } else if (wasOffline.current) {
      wasOffline.current = false;
      toast.success('De volta online. Atualizando os preços…');
    }
  }, [online]);

  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-warning/15 px-3 py-1.5 text-center text-xs font-medium text-warning"
    >
      <WifiOff aria-hidden className="h-4 w-4 shrink-0" />
      Você está offline. Mostrando os últimos dados salvos: os preços podem estar desatualizados.
    </div>
  );
}
