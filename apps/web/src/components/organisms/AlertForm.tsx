import {
  FUEL_LABEL,
  FUEL_OPTIONS,
  createAlertSchema,
  parsePriceInput,
  type FuelType,
} from '@bomba-certa/shared';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { GeoStatus } from '../../hooks/useGeolocation';
import { useCreateAlert } from '../../hooks/queries';
import { ApiError } from '../../lib/api';
import { Button } from '../atoms/Button';
import { Input, Select } from '../atoms/Input';
import { FormField } from '../molecules/FormField';
import { RADII } from './MapFilters';

/**
 * Creates a price alert centred on the user's position: "tell me when any station within R km
 * of here reaches this price or less". Validated with the same Zod schema as the API.
 */
export function AlertForm({
  position,
  geoStatus,
}: {
  position: { lat: number; lng: number };
  geoStatus: GeoStatus;
}) {
  const create = useCreateAlert();
  const [fuelType, setFuelType] = useState<FuelType>('GASOLINE_COMMON');
  const [radiusMeters, setRadiusMeters] = useState(3000);
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);

  const where = geoStatus === 'granted' ? 'de você' : 'do centro de Palmas';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const targetPriceMilli = parsePriceInput(target);
    const parsed = createAlertSchema.safeParse({
      fuelType,
      targetPriceMilli,
      radiusMeters,
      lat: position.lat,
      lng: position.lng,
    });
    if (targetPriceMilli === null || !parsed.success) {
      setError('Informe um preço-alvo válido entre R$ 1,000 e R$ 20,000 (ex.: 5,99).');
      return;
    }
    try {
      await create.mutateAsync(parsed.data);
      setTarget('');
      toast.success('Alerta criado', {
        description: 'Você será avisado quando algum posto chegar a esse preço.',
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar o alerta.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-muted-foreground">
        Avisa quando um posto a até {radiusMeters / 1000} km {where} chegar ao preço-alvo ou menos.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Combustível">
          <Select value={fuelType} onChange={(e) => setFuelType(e.target.value as FuelType)}>
            {FUEL_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {FUEL_LABEL[f]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Raio">
          <Select value={radiusMeters} onChange={(e) => setRadiusMeters(Number(e.target.value))}>
            {RADII.map((r) => (
              <option key={r} value={r}>
                {r / 1000} km
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Preço-alvo (R$)" error={error} hint="Ex.: 5,99">
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            inputMode="decimal"
            placeholder="5,990"
            autoComplete="off"
          />
        </FormField>
      </div>
      <Button type="submit" loading={create.isPending}>
        {create.isPending ? 'Criando…' : 'Criar alerta'}
      </Button>
    </form>
  );
}
