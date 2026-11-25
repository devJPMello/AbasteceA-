import {
  CONFIRMATIONS_REQUIRED,
  FUEL_LABEL,
  formatPrice,
  formatRelative,
} from '@bomba-certa/shared';
import { ShieldQuestion } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirmReport, usePendingReports } from '../../hooks/queries';
import { ApiError } from '../../lib/api';
import { useSession } from '../../lib/session';
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';

export function PendingReports({ stationId }: { stationId: string }) {
  const current = useSession();
  const { data } = usePendingReports(stationId);
  const confirm = useConfirmReport(stationId);

  if (!data || data.length === 0) return null;

  async function onConfirm(id: string) {
    try {
      await confirm.mutateAsync(id);
      toast.success('Obrigado por confirmar!');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível confirmar.');
    }
  }

  return (
    <section aria-labelledby="pending-title">
      <h2 id="pending-title" className="flex items-center gap-2 text-base font-semibold">
        <ShieldQuestion aria-hidden className="h-5 w-5 text-warning" />
        Aguardando confirmação
      </h2>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        Preços fora da faixa usual só entram após {CONFIRMATIONS_REQUIRED} confirmações de outros
        usuários.
      </p>
      <ul className="space-y-2">
        {data.map((r) => (
          <li key={r.id}>
            <Card className="flex items-center justify-between gap-3 p-3 text-sm">
              <span>
                {FUEL_LABEL[r.fuelType]}: <strong>{formatPrice(r.priceMilli)}</strong>
                <span className="ml-2 text-xs text-muted-foreground">
                  {formatRelative(r.reportedAt)} · {r.confirmationsCount}/{CONFIRMATIONS_REQUIRED}
                </span>
              </span>
              {r.isMine ? (
                <Badge>Seu reporte</Badge>
              ) : r.confirmedByMe ? (
                <Badge tone="success">Você confirmou</Badge>
              ) : (
                current && (
                  <Button
                    variant="soft"
                    size="sm"
                    loading={confirm.isPending && confirm.variables === r.id}
                    onClick={() => onConfirm(r.id)}
                  >
                    Confirmar
                  </Button>
                )
              )}
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
