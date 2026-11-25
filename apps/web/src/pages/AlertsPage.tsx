import { BellRing } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonVariants } from '../components/atoms/Button';
import { Card } from '../components/atoms/Card';
import { EmptyState } from '../components/molecules/EmptyState';
import { AlertForm } from '../components/organisms/AlertForm';
import { AlertList } from '../components/organisms/AlertList';
import { NotificationList } from '../components/organisms/NotificationList';
import { useGeolocation } from '../hooks/useGeolocation';
import { useNotifications } from '../hooks/queries';
import { useSession } from '../lib/session';

export function AlertsPage() {
  const session = useSession();
  const { position, status } = useGeolocation();
  const { data } = useNotifications();

  if (!session) {
    return (
      <EmptyState
        className="pt-16"
        icon={BellRing}
        title="Entre para criar alertas"
        description="Defina um preço-alvo e seja avisado quando algum posto perto de você chegar nele."
        action={
          <div className="mt-2 flex gap-2">
            <Link to="/login" className={buttonVariants({ variant: 'secondary' })}>
              Entrar
            </Link>
            <Link to="/register" className={buttonVariants()}>
              Cadastrar
            </Link>
          </div>
        }
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 p-4 pb-10">
        <h1 className="text-2xl font-bold tracking-tight">Alertas e notificações</h1>

        <section aria-labelledby="new-alert">
          <h2 id="new-alert" className="mb-3 text-base font-semibold">
            Novo alerta
          </h2>
          <Card className="p-4">
            <AlertForm position={position} geoStatus={status} />
          </Card>
        </section>

        <section aria-labelledby="my-alerts">
          <h2 id="my-alerts" className="mb-3 text-base font-semibold">
            Meus alertas
          </h2>
          <AlertList />
        </section>

        <section aria-labelledby="notifications">
          <h2 id="notifications" className="mb-3 text-base font-semibold">
            Notificações
            {data && data.unread > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({data.unread} {data.unread === 1 ? 'nova' : 'novas'})
              </span>
            )}
          </h2>
          <NotificationList />
        </section>
      </div>
    </div>
  );
}
