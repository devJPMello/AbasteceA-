export type PriceBand = 'cheap' | 'mid' | 'expensive' | 'none';

/**
 * Splits prices into terciles by rank: cheapest third = cheap, priciest third = expensive.
 * Bands are relative to the prices currently on screen, so the colours stay meaningful
 * whatever the radius or fuel. Tied prices share the average rank of their group, so equal
 * prices always get the same colour and a big tie does not swallow a whole band.
 * With a single distinct price everything is "mid".
 */
export function computeBands(prices: (number | null)[]): PriceBand[] {
  const values = prices.filter((p): p is number => p !== null);
  const n = values.length;
  if (n === 0 || Math.min(...values) === Math.max(...values)) {
    return prices.map((p) => (p === null ? 'none' : 'mid'));
  }
  return prices.map((p) => {
    if (p === null) return 'none';
    const less = values.filter((v) => v < p).length;
    const equal = values.filter((v) => v === p).length;
    const position = (less + equal / 2) / n; // 0..1, centre of the tie group
    if (position < 1 / 3) return 'cheap';
    if (position > 2 / 3) return 'expensive';
    return 'mid';
  });
}

export const BAND_LABEL: Record<PriceBand, string> = {
  cheap: 'Barato',
  mid: 'Médio',
  expensive: 'Caro',
  none: 'Sem preço',
};
