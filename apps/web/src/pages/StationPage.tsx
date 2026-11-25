import type { FuelType } from '@bomba-certa/shared';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PendingReports } from '../components/PendingReports';
import { PriceChart } from '../components/PriceChart';
import { ReportForm } from '../components/ReportForm';
import { useHistory, useStation } from '../hooks/queries';
import { ApiError } from '../lib/api';
import { FUEL_LABEL, FUEL_OPTIONS, formatPrice, formatRelative } from '../lib/format';

const PERIODS = [7, 30, 90];
const SOURCE_LABEL = { USER: 'Usuário', ANP: 'ANP' } as const;

export function StationPage() {
  const { id = '' } = useParams();
  const station = useStation(id);
  const [fuelType, setFuelType] = useState<FuelType>('GASOLINE_COMMON');
  const [days, setDays] = useState(30);
  const history = useHistory(id, fuelType, days);

  if (station.isLoading) return <p className="p-6">Carregando…</p>;
  if (station.isError || !station.data) {
    const notFound = station.error instanceof ApiError && station.error.status === 404;
    return (
      <p role="alert" className="p-6">
        {notFound ? 'Posto não encontrado.' : 'Erro ao carregar o posto.'}{' '}
        <Link to="/" className="text-brand underline">
          Voltar ao mapa
        </Link>
      </p>
    );
  }

  const s = station.data;
  return (
    <div className="mx-auto h-full max-w-3xl space-y-6 overflow-y-auto p-4">
      <Link to="/" className="text-sm text-brand underline">
        ← Mapa
      </Link>
      <header>
        <h1 className="text-2xl font-bold">{s.name}</h1>
        <p className="text-sm text-slate-600">
          {s.brand} · {s.address}
        </p>
      </header>

      <section aria-labelledby="prices-title">
        <h2 id="prices-title" className="mb-2 text-base font-semibold">
          Preços atuais
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {FUEL_OPTIONS.map((fuel) => {
            const p = s.prices.find((x) => x.fuelType === fuel);
            return (
              <li key={fuel} className="rounded border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">{FUEL_LABEL[fuel]}</p>
                {p ? (
                  <>
                    <p className="text-xl font-bold">{formatPrice(p.priceMilli)}</p>
                    <p className="text-xs text-slate-500">
                      {SOURCE_LABEL[p.source ?? 'USER']} ·{' '}
                      {p.reportedAt ? formatRelative(p.reportedAt) : ''}
                      {p.stale && (
                        <span className="ml-1 font-medium text-amber-700">· Desatualizado</span>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Sem preço</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="history-title">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="history-title" className="text-base font-semibold">
            Histórico
          </h2>
          <div className="flex gap-2">
            <select
              aria-label="Combustível do histórico"
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value as FuelType)}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              {FUEL_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {FUEL_LABEL[f]}
                </option>
              ))}
            </select>
            <select
              aria-label="Período"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              {PERIODS.map((d) => (
                <option key={d} value={d}>
                  {d} dias
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-2">
          {history.isLoading ? (
            <p className="p-4 text-sm">Carregando…</p>
          ) : (
            <PriceChart points={history.data?.points ?? []} />
          )}
        </div>
      </section>

      <section
        aria-labelledby="report-title"
        className="rounded border border-slate-200 bg-white p-4"
      >
        <h2 id="report-title" className="mb-3 text-base font-semibold">
          Reportar preço
        </h2>
        <ReportForm stationId={id} initialFuel={fuelType} />
      </section>

      <PendingReports stationId={id} />
    </div>
  );
}
