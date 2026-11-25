import { loginSchema, registerSchema } from '@bomba-certa/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/atoms/Button';
import { Card } from '../components/atoms/Card';
import { Input } from '../components/atoms/Input';
import { FormField } from '../components/molecules/FormField';
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
      toast.success(isRegister ? 'Conta criada. Bem-vindo!' : `Olá, ${res.user.name}!`);
      navigate('/');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 401
            ? 'E-mail ou senha incorretos.'
            : err.status === 409
              ? 'Este e-mail já está cadastrado.'
              : err.message
          : 'Sem conexão com o servidor.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm p-4 pt-10">
      <Card className="p-6">
        <h1 className="mb-5 text-2xl font-bold tracking-tight">
          {isRegister ? 'Criar conta' : 'Entrar'}
        </h1>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {isRegister && (
            <FormField label="Nome">
              <Input name="name" autoComplete="name" />
            </FormField>
          )}
          <FormField label="E-mail">
            <Input name="email" type="email" autoComplete="email" />
          </FormField>
          <FormField
            label="Senha"
            hint={isRegister ? 'Mínimo de 8 caracteres.' : undefined}
            error={error}
          >
            <Input
              name="password"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
          </FormField>
          <Button type="submit" loading={busy} className="w-full">
            {isRegister ? 'Cadastrar' : 'Entrar'}
          </Button>
        </form>
        <p className="mt-5 text-sm text-muted-foreground">
          {isRegister ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
          <Link
            to={isRegister ? '/login' : '/register'}
            className="font-medium text-primary underline"
          >
            {isRegister ? 'Entrar' : 'Cadastrar'}
          </Link>
        </p>
      </Card>
    </div>
  );
}
