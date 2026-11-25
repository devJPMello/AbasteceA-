import { formatDistance, type NearbyStation, type PriceBand } from '@bomba-certa/shared';
import { MapPinOff } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { Skeleton } from '../atoms/Skeleton';
import { BandBadge } from '../molecules/BandBadge';
import { EmptyState } from '../molecules/EmptyState';
import { PriceTag } from '../molecules/PriceTag';

interface Props {
  stations: NearbyStation[];
  bands: PriceBand[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function StationList({ stations, bands, activeId, onSelect }: Props) {
  const rows = useRef(new Map<string, HTMLLIElement>());

  // Keep the selected station visible when it was picked on the map.
  useEffect(() => {
    if (activeId)
      rows.current.get(activeId)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  if (stations.length === 0) {
    return (
      <EmptyState
        icon={MapPinOff}
        title="Nenhum posto neste raio"
        description="Aumente o raio de busca ou troque o combustível."
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {stations.map((s, i) => {
        const active = s.id === activeId;
        return (
          <li
            key={s.id}
            ref={(el) => {
              if (el) rows.current.set(s.id, el);
              else rows.current.delete(s.id);
            }}
            className={cn('transition-colors', active ? 'bg-primary-soft' : 'hover:bg-muted')}
          >
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(s.id)}
              className="flex w-full items-start justify-between gap-3 px-4 pt-3 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">{s.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{s.address}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {formatDistance(s.distanceMeters)}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <PriceTag price={s.price} compact emptyLabel="—" />
                <BandBadge band={bands[i] ?? 'none'} />
              </span>
            </button>
            <div className="px-4 pb-3 pt-1">
              <Link
                to={`/stations/${s.id}`}
                aria-label={`Ver detalhes de ${s.name}`}
                className="text-xs font-medium text-primary hover:underline"
              >
                Ver detalhes →
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function StationListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Carregando postos" className="divide-y divide-border">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="w-2/3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <div className="flex w-1/4 flex-col items-end gap-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-4 w-2/3 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
