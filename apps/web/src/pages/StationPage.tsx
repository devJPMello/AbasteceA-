import { FUEL_LABEL, FUEL_OPTIONS, type FuelType, type StationDetail } from '@bomba-certa/shared';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../components/atoms/Card';
import { Select } from '../components/atoms/Input';
import { Skeleton } from '../components/atoms/Skeleton';
import { AsyncStateView } from '../components/molecules/AsyncStateView';
import { PriceTag } from '../components/molecules/PriceTag';
import { PendingReports } from '../components/organisms/PendingReports';
import { PriceChart, PriceChartSkeleton } from '../components/organisms/PriceChart';
import { ReportForm } from '../components/organisms/ReportForm';
import { useHistory, useStation } from '../hooks/queries';
import { ApiError } from '../lib/api';

const PERIODS = [7, 30, 90];

function StationSkeleton() {
  return (
    <div role="status" aria-label="Carregando posto" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function StationContent({ station }: { station: StationDetail }) {
  const [fuelType, setFuelType] = useState<FuelType>('GASOLINE_COMMON');
  const [days, setDays] = useState(30);
  const history = useHistory(station.id, fuelType, days);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{station.name}</h1>
        <p className="text-sm text-muted-foreground">
          {station.brand} · {station.address}
        </p>
      </header>

      <section aria-labelledby="prices-title">
        <h2 id="prices-title" className="mb-3 text-base font-semibold">
          Preços atuais
        </h2>
        <ul className="grid grid-cols-2 gap-3">
          {FUEL_OPTIONS.map((fuel) => {
            const price = station.prices.find((p) => p.fuelType === fuel) ?? null;
            return (
              <li key={fuel}>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">{FUEL_LABEL[fuel]}</p>
                  <PriceTag price={price} />
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="history-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="history-title" className="text-base font-semibold">
            Histórico
          </h2>
          <div className="flex gap-2">
            <Select
              aria-label="Combustível do histórico"
              className="h-9 w-auto"
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value as FuelType)}
            >
              {FUEL_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {FUEL_LABEL[f]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Período"
              className="h-9 w-auto"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {PERIODS.map((d) => (
                <option key={d} value={d}>
                  {d} dias
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Card className="p-2">
          <AsyncStateView query={history} loading={<PriceChartSkeleton />}>
            {(data) => <PriceChart points={data.points} />}
          </AsyncStateView>
        </Card>
      </section>

      <section aria-labelledby="report-title">
        <Card className="p-4">
          <h2 id="report-title" className="mb-4 text-base font-semibold">
            Reportar preço
          </h2>
          <ReportForm stationId={station.id} initialFuel={fuelType} />
        </Card>
      </section>

      <PendingReports stationId={station.id} />
    </div>
  );
}

export function StationPage() {
  const { id = '' } = useParams();
  const station = useStation(id);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 p-4 pb-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Mapa
        </Link>
        <AsyncStateView
          query={station}
          loading={<StationSkeleton />}
          errorMessage={(e) =>
            e instanceof ApiError && e.status === 404 ? 'Posto não encontrado.' : undefined
          }
        >
          {(data) => <StationContent station={data} />}
        </AsyncStateView>
      </div>
    </div>
  );
}
