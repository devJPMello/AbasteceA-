import { loginSchema, registerSchema } from '@bomba-certa/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../lib/api';
import { session } from '../lib/session';
import type { AuthResponse } from '../lib/types';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isRegister = mode === 'register';

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const parsed = (isRegister ? registerSchema : loginSchema).safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
      return;
    }
    setBusy(true);
    try {
      const res = await api<AuthResponse>(isRegister ? '/auth/register' : '/auth/login', {
        method: 'POST',
        body: parsed.data,
      });
      session.set({ user: res.user, accessToken: res.accessToken, refreshToken: res.refreshToken });
      navigate('/');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 401
            ? 'E-mail ou senha incorretos.'
            : err.status === 409
              ? 'Este e-mail já está cadastrado.'
              : err.message
          : 'Erro inesperado.',
      );
    } finally {
      setBusy(false);
    }
  }

  const input = 'mt-1 w-full rounded border border-slate-300 px-3 py-2';

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-2xl font-bold">{isRegister ? 'Criar conta' : 'Entrar'}</h1>
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        {isRegister && (
          <label className="block text-sm font-medium">
            Nome
            <input name="name" autoComplete="name" className={input} />
          </label>
        )}
        <label className="block text-sm font-medium">
          E-mail
          <input name="email" type="email" autoComplete="email" className={input} />
        </label>
        <label className="block text-sm font-medium">
          Senha
          <input
            name="password"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            className={input}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          disabled={busy}
          className="w-full rounded bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {busy ? 'Aguarde…' : isRegister ? 'Cadastrar' : 'Entrar'}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        {isRegister ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
        <Link to={isRegister ? '/login' : '/register'} className="font-medium text-brand underline">
          {isRegister ? 'Entrar' : 'Cadastrar'}
        </Link>
      </p>
    </div>
  );
}
