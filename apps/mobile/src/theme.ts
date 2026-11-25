import type { PriceBand } from '@bomba-certa/shared';

export const colors = {
  brand: '#0f766e',
  brandDark: '#115e59',
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  danger: '#b91c1c',
  success: '#15803d',
};

export const bandColor: Record<PriceBand, string> = {
  cheap: '#15803d',
  mid: '#b45309',
  expensive: '#b91c1c',
  none: '#6b7280',
};
