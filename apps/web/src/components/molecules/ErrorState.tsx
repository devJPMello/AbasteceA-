import { TriangleAlert } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from '../atoms/Button';

export function ErrorState({
  message = 'Não foi possível carregar.',
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center',
        className,
      )}
    >
      <TriangleAlert aria-hidden className="h-6 w-6 text-destructive" />
      <p className="text-sm text-destructive">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
