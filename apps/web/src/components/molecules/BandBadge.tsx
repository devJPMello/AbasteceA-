import { BAND_LABEL, type PriceBand } from '@bomba-certa/shared';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '../atoms/Badge';

const ICON = { cheap: TrendingDown, mid: Minus, expensive: TrendingUp, none: Minus } as const;

/** Price band as icon + text: colour is reinforcement, never the only signal. */
export function BandBadge({ band }: { band: PriceBand }) {
  const Icon = ICON[band];
  return (
    <Badge tone={band}>
      <Icon aria-hidden className="h-3 w-3" />
      {BAND_LABEL[band]}
    </Badge>
  );
}
