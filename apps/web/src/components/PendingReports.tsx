import { CONFIRMATIONS_REQUIRED } from '@bomba-certa/shared';
import { useState } from 'react';
import { useConfirmReport, usePendingReports } from '../hooks/queries';
import { ApiError } from '../lib/api';
import { FUEL_LABEL, formatPrice, formatRelative } from '../lib/format';
import { useSession } from '../lib/session';

export function PendingReports({ stationId }: { stationId: string }) {
  const current = useSession();
  const { data } = usePendingReports(stationId);
  const confirm = useConfirmReport(stationId);
  const [error, setError] = useState<string | null>(null);

  if (!data || data.length === 0) return null;

  async function onConfirm(id: string) {
    setError(null);
    try {
      await confirm.mutateAsync(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível confirmar.');
    }
  }

  return (
    <section>
      <h2 className="mb-1 text-base font-semibold">Aguardando confirmação</h2>
      <p className="mb-2 text-xs text-slate-600">
        Preços fora da faixa usual só entram após {CONFIRMATIONS_REQUIRED} confirmações de outros
        usuários.
      </p>
      {error && (
        <p role="alert" className="mb-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <ul className="space-y-2">
        {data.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between rounded border border-slate-200 bg-white p-2 text-sm"
          >
            <span>
              {FUEL_LABEL[r.fuelType]}: <strong>{formatPrice(r.priceMilli)}</strong>
              <span className="ml-2 text-xs text-slate-500">
                {formatRelative(r.reportedAt)} · {r.confirmationsCount}/{CONFIRMATIONS_REQUIRED}
              </span>
            </span>
            {current && (
              <button
                onClick={() => onConfirm(r.id)}
                disabled={confirm.isPending}
                className="rounded border border-brand px-2 py-1 text-xs font-medium text-brand hover:bg-teal-50 disabled:opacity-60"
              >
                Confirmar
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
