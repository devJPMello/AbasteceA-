import { FUEL_LABEL, FUEL_OPTIONS, type FuelType } from '@bomba-certa/shared';
import { cn } from '../../lib/cn';
import { Chip } from '../atoms/Chip';

export function FuelChips({
  value,
  onChange,
  className,
}: {
  value: FuelType;
  onChange: (fuel: FuelType) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Combustível"
      className={cn('flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]', className)}
    >
      {FUEL_OPTIONS.map((fuel) => (
        <Chip key={fuel} selected={fuel === value} onClick={() => onChange(fuel)}>
          {FUEL_LABEL[fuel]}
        </Chip>
      ))}
    </div>
  );
}
