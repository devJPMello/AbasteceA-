import {
  FUEL_LABEL,
  FUEL_OPTIONS,
  createPriceReportSchema,
  formatPrice,
  formatRelative,
  parsePriceInput,
  type FuelType,
} from '@bomba-certa/shared';
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, ErrorText } from '../../src/components/ui';
import { useReportPrice, useStation } from '../../src/hooks/queries';
import { ApiError } from '../../src/lib/api';
import { useSession } from '../../src/lib/session';
import { colors } from '../../src/theme';

export default function StationScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const station = useStation(id);
  const report = useReportPrice(id);
  const [fuelType, setFuelType] = useState<FuelType>('GASOLINE_COMMON');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (station.isLoading)
    return <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />;
  if (station.isError || !station.data) {
    return (
      <ErrorText>
        {station.error instanceof ApiError && station.error.status === 404
          ? 'Posto não encontrado.'
          : 'Erro ao carregar o posto.'}
      </ErrorText>
    );
  }
  const s = station.data;

  async function submit() {
    setError(null);
    setNotice(null);
    const priceMilli = parsePriceInput(price);
    // Same Zod schema as the API: the phone and the server cannot disagree on what is valid.
    const parsed = createPriceReportSchema.safeParse({ stationId: id, fuelType, priceMilli });
    if (priceMilli === null || !parsed.success) {
      setError('Informe um preço válido entre R$ 1,000 e R$ 20,000 (ex.: 6,29).');
      return;
    }
    try {
      const result = await report.mutateAsync({ fuelType, priceMilli });
      setPrice('');
      setNotice(
        result.status === 'PENDING'
          ? 'Reporte enviado. O valor está fora da faixa usual e aguarda confirmação de outros usuários.'
          : 'Obrigado! Preço atualizado.',
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o reporte.');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{s.name}</Text>
      <Text style={styles.sub}>
        {s.brand} · {s.address}
      </Text>

      <Text style={styles.section}>Preços atuais</Text>
      {FUEL_OPTIONS.map((fuel) => {
        const p = s.prices.find((x) => x.fuelType === fuel);
        return (
          <Card key={fuel} style={styles.priceRow}>
            <Text style={styles.fuel}>{FUEL_LABEL[fuel]}</Text>
            {p ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.price}>{formatPrice(p.priceMilli)}</Text>
                <Text style={styles.meta}>
                  {p.source === 'ANP' ? 'ANP' : 'Usuário'} ·{' '}
                  {p.reportedAt ? formatRelative(p.reportedAt) : ''}
                  {p.stale ? ' · desatualizado' : ''}
                </Text>
              </View>
            ) : (
              <Text style={styles.meta}>Sem preço</Text>
            )}
          </Card>
        );
      })}

      <Text style={styles.section}>Reportar preço</Text>
      {session ? (
        <Card>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 10 }}
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
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="6,299"
            keyboardType="decimal-pad"
            style={styles.input}
            accessibilityLabel="Preço em reais"
          />
          {error && <ErrorText>{error}</ErrorText>}
          {notice && <Text style={styles.notice}>{notice}</Text>}
          <View style={{ marginTop: 10 }}>
            <Button
              title={report.isPending ? 'Enviando…' : 'Reportar preço'}
              onPress={submit}
              disabled={report.isPending}
            />
          </View>
        </Card>
      ) : (
        <Text style={styles.meta}>
          <Link href="/account" style={{ color: colors.brand, fontWeight: '600' }}>
            Entre na sua conta
          </Link>{' '}
          para reportar um preço.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  sub: { color: colors.muted, marginBottom: 8 },
  section: { fontSize: 16, fontWeight: '600', marginTop: 12, color: colors.text },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fuel: { color: colors.text },
  price: { fontSize: 18, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    backgroundColor: '#fff',
  },
  notice: { color: colors.success, fontSize: 13, marginTop: 6 },
});
