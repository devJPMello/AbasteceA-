import { Download } from 'lucide-react';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { Button } from '../atoms/Button';

/** "Install app" button, shown only when the browser says the PWA can be installed. */
export function InstallButton() {
  const { canInstall, install } = useInstallPrompt();
  if (!canInstall) return null;
  return (
    <Button variant="soft" size="sm" aria-label="Instalar o app" onClick={() => void install()}>
      <Download aria-hidden className="h-4 w-4" />
      <span className="hidden sm:inline">Instalar</span>
    </Button>
  );
}
