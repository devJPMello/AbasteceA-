import { computeBands, formatPrice, type FuelType, type SortBy } from '@bomba-certa/shared';
import { LocateFixed } from 'lucide-react';
import { useMemo, useState } from 'react';
import { IconButton } from '../components/atoms/Button';
import { AsyncStateView } from '../components/molecules/AsyncStateView';
import { BottomSheet, type SheetState } from '../components/molecules/BottomSheet';
import { FuelChips } from '../components/molecules/FuelChips';
import { MapFilters } from '../components/organisms/MapFilters';
import { MapLegend } from '../components/organisms/MapLegend';
import { StationList, StationListSkeleton } from '../components/organisms/StationList';
import { StationMap } from '../components/organisms/StationMap';
import { StationSummary } from '../components/organisms/StationSummary';
import { useNearby } from '../hooks/queries';
import { useGeolocation } from '../hooks/useGeolocation';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { cheapest } from '../lib/mapIcons';

export function MapPage() {
  const isDesktop = useIsDesktop();
  const { position, status, locate } = useGeolocation();
  const [fuelType, setFuelType] = useState<FuelType>('GASOLINE_COMMON');
  const [radiusMeters, setRadiusMeters] = useState(5000);
  const [sortBy, setSortBy] = useState<SortBy>('price');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>('peek');
  // Real height of the collapsed sheet (measured), so map controls sit just above it.
  const [peekHeight, setPeekHeight] = useState(120);

  const query = useNearby({ ...position, radiusMeters, fuelType, sortBy, page: 1 });
  const stations = useMemo(() => query.data?.items ?? [], [query.data]);
  const bands = useMemo(
    () => computeBands(stations.map((s) => s.price?.priceMilli ?? null)),
    [stations],
  );

  const activeIndex = stations.findIndex((s) => s.id === activeId);
  const active = activeIndex >= 0 ? stations[activeIndex] : undefined;
  const lowest = cheapest(stations.map((s) => s.price?.priceMilli));

  // Picking from the list on a phone closes the sheet so the map (and the pin) is visible.
  const selectFromList = (id: string) => {
    setActiveId(id);
    if (!isDesktop) setSheet('peek');
  };

  const filters = (
    <MapFilters
      radiusMeters={radiusMeters}
      onRadiusChange={setRadiusMeters}
      sortBy={sortBy}
      onSortChange={setSortBy}
      geoStatus={status}
      onLocate={locate}
    />
  );

  const list = (
    <AsyncStateView
      query={query}
      loading={<StationListSkeleton />}
      errorMessage={() =>
        'Não foi possível carregar os postos. A API pode estar acordando: tente de novo.'
      }
    >
      {() => (
        <StationList
          stations={stations}
          bands={bands}
          activeId={activeId}
          onSelect={selectFromList}
        />
      )}
    </AsyncStateView>
  );

  return (
    <div className="relative h-full md:grid md:grid-cols-[380px_1fr]">
      <h1 className="sr-only">Preços de combustível perto de você</h1>
      {isDesktop && (
        <aside key="sidebar" className="flex min-h-0 flex-col border-r border-border bg-card">
          <div className="space-y-4 border-b border-border p-4">
            <FuelChips value={fuelType} onChange={setFuelType} />
            {filters}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
        </aside>
      )}

      <div key="map" className="relative h-full min-h-0">
        <StationMap
          className="h-full w-full"
          stations={stations}
          bands={bands}
          center={position}
          radiusMeters={radiusMeters}
          activeId={activeId}
          onSelect={setActiveId}
          bottomInset={isDesktop ? 24 : peekHeight + 24}
        />

        {!isDesktop && (
          <div className="absolute inset-x-0 top-0 z-[1000] bg-gradient-to-b from-background/90 to-transparent p-3 pb-6">
            <FuelChips value={fuelType} onChange={setFuelType} />
          </div>
        )}

        <IconButton
          label="Usar minha localização"
          variant="secondary"
          onClick={locate}
          className="absolute right-3 z-[1000] shadow-float"
          style={{ bottom: isDesktop ? 24 : peekHeight + 16 }}
        >
          <LocateFixed aria-hidden className="h-5 w-5" />
        </IconButton>

        {isDesktop && <MapLegend className="absolute bottom-6 left-3 z-[1000]" />}
      </div>

      {!isDesktop && (
        <BottomSheet
          state={sheet}
          onStateChange={setSheet}
          label="Postos no raio"
          onPeekHeight={setPeekHeight}
          peek={
            active ? (
              <StationSummary station={active} band={bands[activeIndex] ?? 'none'} />
            ) : (
              <div>
                <p className="font-semibold">
                  {query.isPending ? 'Buscando postos…' : `${stations.length} postos no raio`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lowest !== null
                    ? `Mais barato: ${formatPrice(lowest)} · toque para ver a lista`
                    : 'Toque para ajustar o raio e ver a lista'}
                </p>
              </div>
            )
          }
        >
          <div className="space-y-4 border-b border-border p-4">{filters}</div>
          {list}
        </BottomSheet>
      )}
    </div>
  );
}
