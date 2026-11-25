import {
  FUEL_LABEL,
  FUEL_OPTIONS,
  createAlertSchema,
  formatPrice,
  formatRelative,
  parsePriceInput,
  type FuelType,
} from '@bomba-certa/shared';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, ErrorText } from '../../src/components/ui';
import {
  useAlerts,
  useCreateAlert,
  useDeleteAlert,
  useNotifications,
} from '../../src/hooks/queries';
import { useLocation } from '../../src/hooks/useLocation';
import { ApiError } from '../../src/lib/api';
import { useSession } from '../../src/lib/session';
import { colors } from '../../src/theme';

const RADII = [1000, 3000, 5000, 10000];

export default function AlertsScreen() {
  const session = useSession();
  const { position, status } = useLocation();
  const alerts = useAlerts();
  const notifications = useNotifications();
  const create = useCreateAlert();
  const remove = useDeleteAlert();
  const [fuelType, setFuelType] = useState<FuelType>('GASOLINE_COMMON');
  const [radiusMeters, setRadiusMeters] = useState(3000);
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.meta}>
          <Link href="/account" style={{ color: colors.brand, fontWeight: '600' }}>
            Entre na sua conta
          </Link>{' '}
          para criar alertas de preço.
        </Text>
      </View>
    );
  }

  async function submit() {
    setError(null);
    const targetPriceMilli = parsePriceInput(target);
    const parsed = createAlertSchema.safeParse({
      fuelType,
      targetPriceMilli,
      radiusMeters,
      lat: position.lat,
      lng: position.lng,
    });
    if (targetPriceMilli === null || !parsed.success) {
      setError('Informe um preço-alvo válido (ex.: 5,99).');
      return;
    }
    try {
      await create.mutateAsync(parsed.data);
      setTarget('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar o alerta.');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.section}>Novo alerta</Text>
      <Card>
        <Text style={styles.meta}>
          Avisa quando um posto a até {radiusMeters / 1000} km{' '}
          {status === 'granted' ? 'de você' : 'do centro de Palmas'} chegar ao preço-alvo ou menos.
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginVertical: 10 }}
        >
          {FUEL_OPTIONS.map((f) => (
            <Chip
              key={f}
              label={FUEL_LABEL[f]}
              selected={f === fuelType}
              onPress={() => setFuelType(f)}
            />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {RADII.map((r) => (
            <Chip
              key={r}
              label={`${r / 1000} km`}
              selected={r === radiusMeters}
              onPress={() => setRadiusMeters(r)}
            />
          ))}
        </ScrollView>
        <TextInput
          value={target}
          onChangeText={setTarget}
          placeholder="Preço-alvo, ex.: 5,99"
          keyboardType="decimal-pad"
          style={styles.input}
          accessibilityLabel="Preço-alvo em reais"
        />
        {error && <ErrorText>{error}</ErrorText>}
        <View style={{ marginTop: 10 }}>
          <Button
            title={create.isPending ? 'Criando…' : 'Criar alerta'}
            onPress={submit}
            disabled={create.isPending}
          />
        </View>
      </Card>

      <Text style={styles.section}>Meus alertas</Text>
      {alerts.data?.length === 0 && <Text style={styles.meta}>Nenhum alerta ainda.</Text>}
      {alerts.data?.map((a) => (
        <Card key={a.id} style={styles.alertRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bold}>
              {FUEL_LABEL[a.fuelType]} ≤ {formatPrice(a.targetPriceMilli)}
            </Text>
            <Text style={styles.meta}>
              raio {a.radiusMeters / 1000} km · {a.lastNotifiedAt ? 'já avisou' : 'aguardando'}
            </Text>
          </View>
          <Button title="Excluir" variant="danger" onPress={() => remove.mutate(a.id)} />
        </Card>
      ))}

      <Text style={styles.section}>
        Notificações{notifications.data?.unread ? ` (${notifications.data.unread} novas)` : ''}
      </Text>
      {notifications.data?.items.length === 0 && (
        <Text style={styles.meta}>Nada por aqui ainda.</Text>
      )}
      {notifications.data?.items.map((n) => (
        <Card key={n.id} style={{ opacity: n.readAt ? 0.7 : 1 }}>
          <Text style={styles.bold}>{n.title}</Text>
          <Text style={styles.body}>{n.body}</Text>
          <Text style={styles.meta}>{formatRelative(n.createdAt)}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  section: { fontSize: 16, fontWeight: '600', marginTop: 12, color: colors.text },
  meta: { fontSize: 12, color: colors.muted },
  bold: { fontWeight: '600', color: colors.text },
  body: { color: colors.text, marginVertical: 4 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
