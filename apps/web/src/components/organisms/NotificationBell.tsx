import { Bell } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useNotifications } from '../../hooks/queries';
import { cn } from '../../lib/cn';
import { buttonVariants } from '../atoms/Button';

/**
 * Header bell: links to the alerts page and shows how many notifications are unread.
 * When the count GOES UP while the app is open (a price alert fired in the background), it also
 * raises a toast, so the user does not have to be looking at the bell.
 */
export function NotificationBell() {
  const { data } = useNotifications();
  const navigate = useNavigate();
  const unread = data?.unread ?? 0;
  const previous = useRef<number | null>(null);

  useEffect(() => {
    if (data === undefined) return; // not loaded yet: do not treat the first value as "new"
    if (previous.current !== null && unread > previous.current) {
      const latest = data.items[0];
      toast.info(latest?.title ?? 'Novo alerta de preço', {
        description: latest?.body,
        action: { label: 'Ver', onClick: () => navigate('/alerts') },
      });
    }
    previous.current = unread;
  }, [data, unread, navigate]);

  return (
    <Link
      to="/alerts"
      aria-label={
        unread > 0 ? `Alertas e notificações: ${unread} não lidas` : 'Alertas e notificações'
      }
      title="Alertas e notificações"
      className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'relative')}
    >
      <Bell aria-hidden className="h-5 w-5" />
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground"
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
