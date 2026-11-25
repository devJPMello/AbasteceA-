import { loginSchema, registerSchema } from '@bomba-certa/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, ErrorText } from '../../src/components/ui';
import { ApiError, api } from '../../src/lib/api';
import { PUSH_MESSAGE, registerForPush, unregisterPush } from '../../src/lib/push';
import { session, useSession } from '../../src/lib/session';
import { colors } from '../../src/theme';

interface AuthResponse {
  user: { id: string; email: string; name: string };
  accessToken: string;
  refreshToken: string;
}

export default function AccountScreen() {
  const current = useSession();
  const qc = useQueryClient();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pushInfo, setPushInfo] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const isRegister = mode === 'register';
    const parsed = (isRegister ? registerSchema : loginSchema).safeParse({ name, email, password });
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
      await session.set(res);
      setPassword('');
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

  async function logout() {
    await unregisterPush(); // while the token is still valid
    await session.clear();
    qc.clear();
  }

  async function enablePush() {
    const result = await registerForPush();
    setPushInfo(result.ok ? 'Notificações ativadas neste aparelho.' : PUSH_MESSAGE[result.reason]);
  }

  if (current) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text style={styles.title}>{current.user.name}</Text>
          <Text style={styles.meta}>{current.user.email}</Text>
        </Card>
        <Card>
          <Text style={styles.bold}>Notificações push</Text>
          <Text style={styles.meta}>Receba um aviso quando um alerta de preço for atingido.</Text>
          <View style={{ marginTop: 10 }}>
            <Button title="Ativar neste aparelho" variant="ghost" onPress={enablePush} />
          </View>
          {pushInfo && <Text style={[styles.meta, { marginTop: 8 }]}>{pushInfo}</Text>}
        </Card>
        <Button title="Sair" variant="danger" onPress={logout} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{mode === 'register' ? 'Criar conta' : 'Entrar'}</Text>
      {mode === 'register' && (
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Nome"
          style={styles.input}
          autoComplete="name"
        />
      )}
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="E-mail"
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Senha"
        style={styles.input}
        secureTextEntry
        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <Button
        title={busy ? 'Aguarde…' : mode === 'register' ? 'Cadastrar' : 'Entrar'}
        onPress={submit}
        disabled={busy}
      />
      <Button
        title={mode === 'register' ? 'Já tenho conta' : 'Criar uma conta'}
        variant="ghost"
        onPress={() => setMode(mode === 'register' ? 'login' : 'register')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  bold: { fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
});
