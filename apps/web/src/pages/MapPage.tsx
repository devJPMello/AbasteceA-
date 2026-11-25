import type { FuelType, SortBy } from '@bomba-certa/shared';
import { useMemo, useState } from 'react';
import { StationList } from '../components/StationList';
import { StationMap } from '../components/StationMap';
import { useNearby } from '../hooks/queries';
import { useGeolocation } from '../hooks/useGeolocation';
import { FUEL_LABEL, FUEL_OPTIONS } from '../lib/format';
import { computeBands } from '../lib/priceBand';

const RADII = [1000, 3000, 5000, 10000, 20000];

const GEO_MESSAGE = {
  loading: 'Obtendo sua localização…',
  granted: 'Usando sua localização.',
  denied: 'Localização negada: mostrando o centro de Palmas.',
  unavailable: 'Localização indisponível: mostrando o centro de Palmas.',
} as const;

export function MapPage() {
  const { position, status, locate } = useGeolocation();
  const [fuelType, setFuelType] = useState<FuelType>('GASOLINE_COMMON');
  const [radiusMeters, setRadiusMeters] = useState(5000);
  const [sortBy, setSortBy] = useState<SortBy>('price');
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useNearby({
    ...position,
    radiusMeters,
    fuelType,
    sortBy,
    page: 1,
  });

  const stations = useMemo(() => data?.items ?? [], [data]);
  const bands = useMemo(
    () => computeBands(stations.map((s) => s.price?.priceMilli ?? null)),
    [stations],
  );

  const select = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm';

  return (
    <div className="grid h-full grid-rows-[45%_55%] lg:grid-cols-[380px_1fr] lg:grid-rows-1">
      <aside className="order-2 flex min-h-0 flex-col border-r border-slate-200 bg-white lg:order-1">
        <div className="space-y-2 border-b border-slate-200 p-3">
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs font-medium">
              Combustível
              <select
                className={`${select} mt-1 w-full`}
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value as FuelType)}
              >
                {FUEL_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {FUEL_LABEL[f]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium">
              Raio
              <select
                className={`${select} mt-1 w-full`}
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(Number(e.target.value))}
              >
                {RADII.map((r) => (
                  <option key={r} value={r}>
                    {r / 1000} km
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium">
              Ordenar
              <select
                className={`${select} mt-1 w-full`}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
              >
                <option value="price">Menor preço</option>
                <option value="distance">Mais perto</option>
              </select>
            </label>
          </div>
          <p className="flex items-center justify-between text-xs text-slate-500">
            <span>{GEO_MESSAGE[status]}</span>
            <button onClick={locate} className="font-medium text-brand underline">
              Atualizar
            </button>
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading && <p className="p-4 text-sm text-slate-600">Carregando postos…</p>}
          {isError && (
            <p role="alert" className="p-4 text-sm text-red-700">
              Não foi possível carregar os postos.{' '}
              <button className="underline" onClick={() => refetch()}>
                Tentar de novo
              </button>
            </p>
          )}
          {data && (
            <StationList
              stations={stations}
              bands={bands}
              activeId={activeId}
              onSelect={setActiveId}
            />
          )}
        </div>
      </aside>
      <section className="order-1 min-h-0 lg:order-2">
        <StationMap
          stations={stations}
          bands={bands}
          center={position}
          radiusMeters={radiusMeters}
          activeId={activeId}
          onSelect={setActiveId}
        />
      </section>
    </div>
  );
}
