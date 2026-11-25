import { createPriceReportSchema, type FuelType } from '@bomba-certa/shared';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useReportPrice } from '../hooks/queries';
import { ApiError } from '../lib/api';
import { FUEL_LABEL, FUEL_OPTIONS, parsePriceInput } from '../lib/format';
import { useSession } from '../lib/session';

export function ReportForm({
  stationId,
  initialFuel,
}: {
  stationId: string;
  initialFuel: FuelType;
}) {
  const current = useSession();
  const report = useReportPrice(stationId);
  const [fuelType, setFuelType] = useState<FuelType>(initialFuel);
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!current) {
    return (
      <p className="text-sm text-slate-600">
        <Link to="/login" className="font-medium text-brand underline">
          Entre
        </Link>{' '}
        para reportar um preço.
      </p>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const priceMilli = parsePriceInput(price);
    // Same Zod schema the API uses: client and server cannot drift apart.
    const parsed = createPriceReportSchema.safeParse({ stationId, fuelType, priceMilli });
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
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Combustível</span>
          <select
            value={fuelType}
            onChange={(e) => setFuelType(e.target.value as FuelType)}
            className="w-full rounded border border-slate-300 bg-white px-2 py-2"
          >
            {FUEL_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {FUEL_LABEL[f]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Preço (R$)</span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            placeholder="6,299"
            className="w-full rounded border border-slate-300 px-2 py-2"
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-green-700">
          {notice}
        </p>
      )}
      <button
        type="submit"
        disabled={report.isPending}
        className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {report.isPending ? 'Enviando…' : 'Reportar preço'}
      </button>
    </form>
  );
}
