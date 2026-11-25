import { formatDistance, type NearbyStation, type PriceBand } from '@bomba-certa/shared';
import { Link } from 'react-router-dom';
import { buttonVariants } from '../atoms/Button';
import { BandBadge } from '../molecules/BandBadge';
import { PriceTag } from '../molecules/PriceTag';

/** Compact card for the selected station (shown in the mobile sheet's peek bar). */
export function StationSummary({ station, band }: { station: NearbyStation; band: PriceBand }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate font-semibold">{station.name}</p>
        <p className="text-xs text-muted-foreground">
          {station.brand} · {formatDistance(station.distanceMeters)}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <PriceTag price={station.price} compact emptyLabel="Sem preço" className="!items-start" />
          <BandBadge band={band} />
        </div>
      </div>
      <Link to={`/stations/${station.id}`} className={buttonVariants({ size: 'sm' })}>
        Detalhes
      </Link>
    </div>
  );
}
