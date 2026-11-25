import {
  FUEL_LABEL,
  FUEL_OPTIONS,
  createPriceReportSchema,
  parsePriceInput,
  type FuelType,
} from '@bomba-certa/shared';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useReportPrice } from '../../hooks/queries';
import { ApiError } from '../../lib/api';
import { useSession } from '../../lib/session';
import { Button } from '../atoms/Button';
import { Input, Select } from '../atoms/Input';
import { FormField } from '../molecules/FormField';

export function ReportForm({
  stationId,
  initialFuel,
}: {
  stationId: string;
  initialFuel: FuelType;
}) {
  const current = useSession();
  const report = useReportPrice(stationId);
  const [fuelType, setFuelType] = useState<FuelType>(initialFuel);
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!current) {
    return (
      <p className="text-sm text-muted-foreground">
        <Link to="/login" className="font-medium text-primary underline">
          Entre
        </Link>{' '}
        para reportar um preço.
      </p>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const priceMilli = parsePriceInput(price);
    // Same Zod schema the API uses: client and server cannot drift apart.
    const parsed = createPriceReportSchema.safeParse({ stationId, fuelType, priceMilli });
    if (priceMilli === null || !parsed.success) {
      setError('Informe um preço válido entre R$ 1,000 e R$ 20,000 (ex.: 6,29).');
      return;
    }
    try {
      const result = await report.mutateAsync({ fuelType, priceMilli });
      setPrice('');
      if (result.status === 'PENDING') {
        toast.info('Reporte enviado', {
          description: 'O valor está fora da faixa usual e aguarda confirmação de outros usuários.',
        });
      } else {
        toast.success('Preço atualizado. Obrigado!');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o reporte.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Combustível">
          <Select value={fuelType} onChange={(e) => setFuelType(e.target.value as FuelType)}>
            {FUEL_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {FUEL_LABEL[f]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Preço (R$)" error={error} hint="Ex.: 6,299">
          <Input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            placeholder="6,299"
            autoComplete="off"
          />
        </FormField>
      </div>
      <Button type="submit" loading={report.isPending}>
        {report.isPending ? 'Enviando…' : 'Reportar preço'}
      </Button>
    </form>
  );
}
