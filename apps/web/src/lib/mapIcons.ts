import type { PriceBand } from '@bomba-certa/shared';

/**
 * HTML for Leaflet divIcons. Pure functions: they only interpolate numbers and fixed class
 * names (never user text), so the strings are safe to inject and trivial to unit-test.
 *
 * Each band has a distinct SHAPE besides its colour, so the map stays readable for people
 * with colour-vision deficiency: ▼ cheap, ◆ middle, ▲ expensive, ▬ no price.
 */
const GLYPH: Record<PriceBand, string> = {
  cheap: '<path d="M6 10 1 3h10z"/>',
  mid: '<path d="M6 1 11 6 6 11 1 6z"/>',
  expensive: '<path d="M6 2 11 9H1z"/>',
  none: '<rect x="2" y="5" width="8" height="2" rx="1"/>',
};

/** 6190 -> "6,19" (two decimals fit a map pin). */
export function shortPrice(priceMilli: number): string {
  return (priceMilli / 1000).toFixed(2).replace('.', ',');
}

export function pillHtml(opts: {
  band: PriceBand;
  priceMilli: number | null;
  stale?: boolean;
  active?: boolean;
}): string {
  const classes = [
    'price-pill',
    `price-pill--${opts.band}`,
    opts.stale ? 'price-pill--stale' : '',
    opts.active ? 'price-pill--active' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const label = opts.priceMilli === null ? '—' : shortPrice(opts.priceMilli);
  return `<div class="${classes}"><svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">${GLYPH[opts.band]}</svg><span>${label}</span></div>`;
}

/** Cluster bubble: how many stations, and the cheapest price inside (what the user wants). */
export function clusterHtml(count: number, cheapestMilli: number | null): string {
  const hint = cheapestMilli === null ? '' : `<small>desde ${shortPrice(cheapestMilli)}</small>`;
  return `<div class="price-cluster"><div>${count}${hint}</div></div>`;
}

/** Smallest defined price in a list, or null. */
export function cheapest(prices: (number | null | undefined)[]): number | null {
  const valid = prices.filter((p): p is number => typeof p === 'number');
  return valid.length ? Math.min(...valid) : null;
}
