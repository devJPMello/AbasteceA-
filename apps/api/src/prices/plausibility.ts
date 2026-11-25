/** Minimum number of fresh prices needed before the city median is trusted as a reference. */
export const MIN_SAMPLES_FOR_REFERENCE = 3;

/**
 * A price is plausible when it is within ±pct% of the reference (city median for that fuel).
 * With no reference (not enough data yet) everything is plausible: we cannot judge.
 */
export function isPlausible(priceMilli: number, referenceMilli: number | null, pct: number) {
  if (referenceMilli === null) return true;
  const delta = Math.abs(priceMilli - referenceMilli) / referenceMilli;
  return delta <= pct / 100;
}
