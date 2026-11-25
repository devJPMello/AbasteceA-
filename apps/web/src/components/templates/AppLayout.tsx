import { Fuel } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { session, useSession } from '../../lib/session';
import { Button, buttonVariants } from '../atoms/Button';
import { AppToaster } from '../molecules/AppToaster';
import { ErrorBoundary } from '../molecules/ErrorBoundary';
import { ThemeToggle } from '../molecules/ThemeToggle';

export function AppLayout() {
  const current = useSession();
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
          <ThemeToggle />
          {current ? (
            <>
              <span className="hidden px-2 text-sm text-muted-foreground sm:inline">
                {current.user.name}
              </span>
              <Button variant="secondary" size="sm" onClick={() => session.clear()}>
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
      <main id="conteudo" className="min-h-0 flex-1">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <AppToaster />
    </div>
  );
}
