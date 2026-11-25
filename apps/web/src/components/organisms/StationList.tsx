import { Link } from 'react-router-dom';
import { formatDistance, formatPrice, formatRelative } from '../lib/format';
import { BAND_LABEL, type PriceBand } from '../lib/priceBand';
import type { NearbyStation } from '../lib/types';

const BAND_STYLE: Record<PriceBand, string> = {
  cheap: 'bg-green-100 text-green-800',
  mid: 'bg-amber-100 text-amber-800',
  expensive: 'bg-red-100 text-red-800',
  none: 'bg-slate-100 text-slate-600',
};

interface Props {
  stations: NearbyStation[];
  bands: PriceBand[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function StationList({ stations, bands, activeId, onSelect }: Props) {
  if (stations.length === 0) {
    return <p className="p-4 text-sm text-slate-600">Nenhum posto neste raio. Tente aumentá-lo.</p>;
  }
  return (
    <ul className="divide-y divide-slate-200">
      {stations.map((s, i) => {
        const band = bands[i] ?? 'none';
        return (
          <li
            key={s.id}
            className={`cursor-pointer p-3 hover:bg-slate-100 ${s.id === activeId ? 'bg-teal-50' : ''}`}
            onClick={() => onSelect(s.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  to={`/stations/${s.id}`}
                  className="block truncate font-semibold text-brand hover:underline"
                >
                  {s.name}
                </Link>
                <p className="truncate text-xs text-slate-500">{s.address}</p>
                <p className="mt-1 text-xs text-slate-600">{formatDistance(s.distanceMeters)}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold">
                  {s.price ? formatPrice(s.price.priceMilli) : '—'}
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${BAND_STYLE[band]}`}
                >
                  {BAND_LABEL[band]}
                </span>
                {s.price?.stale && (
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    Desatualizado
                    {s.price.reportedAt ? ` · ${formatRelative(s.price.reportedAt)}` : ''}
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
