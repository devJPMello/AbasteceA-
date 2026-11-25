import { Link, Outlet } from 'react-router-dom';
import { session, useSession } from '../lib/session';

export function Layout() {
  const current = useSession();
  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between bg-brand px-4 py-2 text-white">
        <Link to="/" className="text-lg font-bold tracking-tight">
          ⛽ Bomba Certa
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {current ? (
            <>
              <span className="hidden sm:inline">Olá, {current.user.name}</span>
              <button
                onClick={() => session.clear()}
                className="rounded bg-white/15 px-3 py-1 hover:bg-white/25"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="rounded px-3 py-1 hover:bg-white/15">
                Entrar
              </Link>
              <Link to="/register" className="rounded bg-white px-3 py-1 text-brand">
                Cadastrar
              </Link>
            </>
          )}
        </nav>
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
