import { useQueryClient } from '@tanstack/react-query';
import { Fuel } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { session, useSession } from '../../lib/session';
import { Button, buttonVariants } from '../atoms/Button';
import { AppToaster } from '../molecules/AppToaster';
import { ConnectionStatus } from '../molecules/ConnectionStatus';
import { ErrorBoundary } from '../molecules/ErrorBoundary';
import { InstallButton } from '../molecules/InstallButton';
import { ThemeToggle } from '../molecules/ThemeToggle';
import { NotificationBell } from '../organisms/NotificationBell';
import { PwaPrompts } from '../organisms/PwaPrompts';

export function AppLayout() {
  const current = useSession();
  const queryClient = useQueryClient();

  function logout() {
    session.clear();
    // Personal data (alerts, notifications, "is this report mine?") must not outlive the session.
    queryClient.clear();
  }

  return (
    <div className="flex h-full flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[2000] focus:rounded-lg focus:bg-card focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Fuel aria-hidden className="h-5 w-5 text-primary" />
          Bomba Certa
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-1">
          <InstallButton />
          <ThemeToggle />
          {current ? (
            <>
              <NotificationBell />
              <span className="hidden px-2 text-sm text-muted-foreground sm:inline">
                {current.user.name}
              </span>
              <Button variant="secondary" size="sm" onClick={logout}>
                Sair
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                Entrar
              </Link>
              <Link to="/register" className={buttonVariants({ size: 'sm' })}>
                Cadastrar
              </Link>
            </>
          )}
        </nav>
      </header>
      <ConnectionStatus />
      <main id="conteudo" className="min-h-0 flex-1">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <AppToaster />
      <PwaPrompts />
    </div>
  );
}
