import { FUEL_LABEL, formatPrice, formatRelative, type AlertDto } from '@bomba-certa/shared';
import { BellOff, BellRing, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAlerts, useCreateAlert, useDeleteAlert } from '../../hooks/queries';
import { ApiError } from '../../lib/api';
import { Badge } from '../atoms/Badge';
import { IconButton } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { Skeleton } from '../atoms/Skeleton';
import { AsyncStateView } from '../molecules/AsyncStateView';
import { EmptyState } from '../molecules/EmptyState';

const AlertsSkeleton = () => (
  <div role="status" aria-label="Carregando alertas" className="space-y-2">
    {[0, 1].map((i) => (
      <Skeleton key={i} className="h-16 w-full" />
    ))}
  </div>
);

export function AlertList() {
  const query = useAlerts();
  const remove = useDeleteAlert();
  const recreate = useCreateAlert();

  async function onDelete(alert: AlertDto) {
    try {
      await remove.mutateAsync(alert.id);
      toast('Alerta excluído', {
        action: {
          label: 'Desfazer',
          // The API has no "restore": undo simply creates the same alert again.
          onClick: () =>
            recreate.mutate({
              fuelType: alert.fuelType,
              targetPriceMilli: alert.targetPriceMilli,
              radiusMeters: alert.radiusMeters,
              lat: alert.lat,
              lng: alert.lng,
            }),
        },
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível excluir o alerta.');
    }
  }

  return (
    <AsyncStateView
      query={query}
      loading={<AlertsSkeleton />}
      isEmpty={(alerts) => alerts.length === 0}
      empty={
        <EmptyState
          icon={BellOff}
          title="Nenhum alerta ainda"
          description="Crie um acima para ser avisado quando o preço cair."
        />
      }
    >
      {(alerts) => (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li key={a.id}>
              <Card className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {FUEL_LABEL[a.fuelType]} ≤ {formatPrice(a.targetPriceMilli)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    raio de {a.radiusMeters / 1000} km · criado {formatRelative(a.createdAt)}
                  </p>
                  <div className="mt-1.5">
                    {a.lastNotifiedAt ? (
                      <Badge tone="success">
                        <BellRing aria-hidden className="h-3 w-3" />
                        Disparou {formatRelative(a.lastNotifiedAt)}
                      </Badge>
                    ) : (
                      <Badge>Aguardando</Badge>
                    )}
                  </div>
                </div>
                <IconButton
                  label={`Excluir alerta de ${FUEL_LABEL[a.fuelType]} até ${formatPrice(a.targetPriceMilli)}`}
                  onClick={() => onDelete(a)}
                  disabled={remove.isPending && remove.variables === a.id}
                >
                  <Trash2 aria-hidden className="h-5 w-5" />
                </IconButton>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </AsyncStateView>
  );
}
