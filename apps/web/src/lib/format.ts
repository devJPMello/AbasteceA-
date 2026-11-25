import type { FuelType } from '@bomba-certa/shared';

export const FUEL_LABEL: Record<FuelType, string> = {
  GASOLINE_COMMON: 'Gasolina comum',
  GASOLINE_PREMIUM: 'Gasolina aditivada',
  ETHANOL: 'Etanol',
  DIESEL_S10: 'Diesel S10',
};

export const FUEL_OPTIONS = Object.keys(FUEL_LABEL) as FuelType[];

/** 5899 -> "R$ 5,899" (pumps show three decimals). */
export function formatPrice(priceMilli: number): string {
  return `R$ ${(priceMilli / 1000).toFixed(3).replace('.', ',')}`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

export function formatRelative(iso: string | Date, now = Date.now()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86400), 'day');
}

/**
 * Parses what a user types ("6,29", "6.299", "R$ 6,299") into thousandths of BRL.
 * Returns null when it is not a valid price.
 */
export function parsePriceInput(raw: string): number | null {
  const cleaned = raw.replace(/R\$|\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 1000);
}
