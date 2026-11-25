import { cn } from '../../lib/cn';
import { Card } from '../atoms/Card';
import { BandBadge } from '../molecules/BandBadge';

/** Explains the pin shapes/colours. Shown on desktop, where there is room. */
export function MapLegend({ className }: { className?: string }) {
  return (
    <Card className={cn('space-y-1.5 p-2.5', className)} aria-label="Legenda do mapa" role="group">
      <div className="flex gap-1.5">
        <BandBadge band="cheap" />
        <BandBadge band="mid" />
        <BandBadge band="expensive" />
      </div>
      <p className="text-[11px] text-muted-foreground">Borda tracejada = preço desatualizado</p>
    </Card>
  );
}
