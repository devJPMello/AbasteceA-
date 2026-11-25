import { formatPrice, formatRelative, type CurrentPrice } from '@bomba-certa/shared';
import { Clock } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Badge } from '../atoms/Badge';

const SOURCE_LABEL = { USER: 'Usuário', ANP: 'ANP' } as const;

const StaleBadge = () => (
  <Badge tone="warning">
    <Clock aria-hidden className="h-3 w-3" />
    Desatualizado
  </Badge>
);

/**
 * A price with its origin and freshness.
 * `compact` (lists): price plus a stale badge only. Full (detail pages): adds source and age.
 */
export function PriceTag({
  price,
  compact,
  emptyLabel = 'Sem preço',
  className,
}: {
  price: CurrentPrice | null;
  compact?: boolean;
  emptyLabel?: string;
  className?: string;
}) {
  if (!price) return <span className={cn('text-muted-foreground', className)}>{emptyLabel}</span>;
  return (
    <div className={cn('flex flex-col', compact && 'items-end', className)}>
      <span className="text-xl font-bold tabular-nums">{formatPrice(price.priceMilli)}</span>
      {compact ? (
        price.stale && <StaleBadge />
      ) : (
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {SOURCE_LABEL[price.source ?? 'USER']}
          {price.reportedAt && <> · {formatRelative(price.reportedAt)}</>}
          {price.stale && <StaleBadge />}
        </span>
      )}
    </div>
  );
}
