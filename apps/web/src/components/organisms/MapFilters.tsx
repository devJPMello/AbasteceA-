import { LocateFixed } from 'lucide-react';
import type { SortBy } from '@bomba-certa/shared';
import type { GeoStatus } from '../../hooks/useGeolocation';
import { Button } from '../atoms/Button';
import { Select } from '../atoms/Input';
import { FormField } from '../molecules/FormField';

export const RADII = [1000, 3000, 5000, 10000, 20000];

const GEO_TEXT: Record<GeoStatus, string> = {
  loading: 'Obtendo sua localização…',
  granted: 'Usando a sua localização.',
  denied: 'Localização negada: mostrando o centro de Palmas.',
  unavailable: 'Localização indisponível: mostrando o centro de Palmas.',
};

/** Radius + sort selects and the location status line. */
export function MapFilters({
  radiusMeters,
  onRadiusChange,
  sortBy,
  onSortChange,
  geoStatus,
  onLocate,
}: {
  radiusMeters: number;
  onRadiusChange: (radius: number) => void;
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
  geoStatus: GeoStatus;
  onLocate: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Raio">
          <Select value={radiusMeters} onChange={(e) => onRadiusChange(Number(e.target.value))}>
            {RADII.map((r) => (
              <option key={r} value={r}>
                {r / 1000} km
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Ordenar por">
          <Select value={sortBy} onChange={(e) => onSortChange(e.target.value as SortBy)}>
            <option value="price">Menor preço</option>
            <option value="distance">Mais perto</option>
          </Select>
        </FormField>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p role="status" className="text-xs text-muted-foreground">
          {GEO_TEXT[geoStatus]}
        </p>
        <Button variant="ghost" size="sm" onClick={onLocate}>
          <LocateFixed aria-hidden className="h-4 w-4" />
          Atualizar
        </Button>
      </div>
    </div>
  );
}
