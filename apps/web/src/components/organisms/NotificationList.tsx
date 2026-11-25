import { formatRelative } from '@bomba-certa/shared';
import { Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { useMarkNotificationRead, useNotifications } from '../../hooks/queries';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { Skeleton } from '../atoms/Skeleton';
import { AsyncStateView } from '../molecules/AsyncStateView';
import { EmptyState } from '../molecules/EmptyState';

const NotificationsSkeleton = () => (
  <div role="status" aria-label="Carregando notificações" className="space-y-2">
    {[0, 1, 2].map((i) => (
      <Skeleton key={i} className="h-20 w-full" />
    ))}
  </div>
);

export function NotificationList() {
  const query = useNotifications();
  const markRead = useMarkNotificationRead();

  async function onRead(id: string) {
    try {
      await markRead.mutateAsync(id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível marcar como lida.');
    }
  }

  return (
    <AsyncStateView
      query={query}
      loading={<NotificationsSkeleton />}
      isEmpty={(d) => d.items.length === 0}
      empty={
        <EmptyState
          icon={Inbox}
          title="Nada por aqui ainda"
          description="Quando um alerta disparar, a notificação aparece nesta lista."
        />
      }
    >
      {(data) => (
        <ul className="space-y-2">
          {data.items.map((n) => {
            const unread = n.readAt === null;
            return (
              <li key={n.id}>
                <Card className={cn('p-3', unread ? 'border-l-4 border-l-primary' : 'opacity-75')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {n.title} {unread && <Badge tone="success">Nova</Badge>}
                      </p>
                      <p className="mt-0.5 text-sm text-foreground">{n.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatRelative(n.createdAt)}
                      </p>
                    </div>
                    {unread && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={markRead.isPending && markRead.variables === n.id}
                        onClick={() => onRead(n.id)}
                        aria-label={`Marcar como lida: ${n.title}`}
                      >
                        Marcar como lida
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </AsyncStateView>
  );
}
