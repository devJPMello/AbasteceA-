import {
  FUEL_LABEL,
  FUEL_OPTIONS,
  computeBands,
  formatDistance,
  formatPrice,
  type FuelType,
  type SortBy,
} from '@bomba-certa/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { Chip } from '../../src/components/ui';
import { useNearby } from '../../src/hooks/queries';
import { useLocation } from '../../src/hooks/useLocation';
import { bandColor, colors } from '../../src/theme';

const RADII = [1000, 3000, 5000, 10000];

/** Map region that fits a circle of `radius` metres around the point. */
function regionFor(lat: number, lng: number, radius: number) {
  const latDelta = ((radius * 2) / 111_320) * 1.3;
  const lngDelta = latDelta / Math.cos((lat * Math.PI) / 180);
  return { latitude: lat, longitude: lng, latitudeDelta: latDelta, longitudeDelta: lngDelta };
}

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const { position, status, locate } = useLocation();
  const [fuelType, setFuelType] = useState<FuelType>('GASOLINE_COMMON');
  const [radiusMeters, setRadiusMeters] = useState(3000);
  const [sortBy, setSortBy] = useState<SortBy>('price');

  const { data, isLoading, isError, refetch } = useNearby({
    ...position,
    radiusMeters,
    fuelType,
    sortBy,
  });
  const stations = useMemo(() => data?.items ?? [], [data]);
  const bands = useMemo(
    () => computeBands(stations.map((s) => s.price?.priceMilli ?? null)),
    [stations],
  );

  useEffect(() => {
    mapRef.current?.animateToRegion(regionFor(position.lat, position.lng, radiusMeters), 400);
  }, [position.lat, position.lng, radiusMeters]);

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FUEL_OPTIONS.map((f) => (
            <Chip
              key={f}
              label={FUEL_LABEL[f]}
              selected={f === fuelType}
              onPress={() => setFuelType(f)}
            />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          {RADII.map((r) => (
            <Chip
              key={r}
              label={`${r / 1000} km`}
              selected={r === radiusMeters}
              onPress={() => setRadiusMeters(r)}
            />
          ))}
          <Chip
            label="Menor preço"
            selected={sortBy === 'price'}
            onPress={() => setSortBy('price')}
          />
          <Chip
            label="Mais perto"
            selected={sortBy === 'distance'}
            onPress={() => setSortBy('distance')}
          />
        </ScrollView>
        {status !== 'granted' && (
          <Pressable onPress={locate}>
            <Text style={styles.hint}>
              {status === 'loading'
                ? 'Obtendo sua localização…'
                : 'Localização negada: mostrando o centro de Palmas. Toque para tentar de novo.'}
            </Text>
          </Pressable>
        )}
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={regionFor(position.lat, position.lng, radiusMeters)}
        showsUserLocation={status === 'granted'}
      >
        <Circle
          center={{ latitude: position.lat, longitude: position.lng }}
          radius={radiusMeters}
          strokeColor={colors.brand}
          fillColor="rgba(15,118,110,0.06)"
        />
        {stations.map((s, i) => (
          <Marker
            key={`${s.id}-${s.price?.priceMilli ?? 'x'}-${bands[i]}`}
            coordinate={{ latitude: s.lat, longitude: s.lng }}
            onPress={() => router.push(`/station/${s.id}`)}
            tracksViewChanges={false}
          >
            <View
              style={[
                styles.marker,
                {
                  backgroundColor: bandColor[bands[i] ?? 'none'],
                  opacity: s.price?.stale ? 0.65 : 1,
                },
              ]}
            >
              <Text style={styles.markerText}>
                {s.price ? (s.price.priceMilli / 1000).toFixed(2).replace('.', ',') : '—'}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>

      <FlatList
        style={styles.list}
        data={stations}
        keyExtractor={(s) => s.id}
        refreshing={isLoading}
        onRefresh={() => refetch()}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {isError
              ? 'Não foi possível carregar os postos.'
              : isLoading
                ? 'Carregando…'
                : 'Nenhum posto neste raio.'}
          </Text>
        }
        renderItem={({ item, index }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/station/${item.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.sub}>
                {formatDistance(item.distanceMeters)}
                {item.price?.stale ? ' · desatualizado' : ''}
              </Text>
            </View>
            <Text style={[styles.price, { color: bandColor[bands[index] ?? 'none'] }]}>
              {item.price ? formatPrice(item.price.priceMilli) : '—'}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  filters: {
    padding: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  hint: { marginTop: 8, fontSize: 12, color: colors.muted },
  map: { flex: 1.1 },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  name: { fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  price: { fontSize: 18, fontWeight: '700' },
  empty: { textAlign: 'center', padding: 20, color: colors.muted },
  marker: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
