import { describe, expect, it } from 'vitest';
import { cheapest, clusterHtml, pillHtml, shortPrice } from './mapIcons';

describe('mapIcons', () => {
  it('formats short prices with two decimals and a comma', () => {
    expect(shortPrice(6190)).toBe('6,19');
    expect(shortPrice(4575)).toBe('4,58');
  });

  it('renders a pill with band class, a shape and the price', () => {
    const html = pillHtml({ band: 'cheap', priceMilli: 5899 });
    expect(html).toContain('price-pill--cheap');
    expect(html).toContain('<svg');
    expect(html).toContain('<span>5,90</span>');
  });

  it('uses a different shape for every band (not colour alone)', () => {
    const shapes = (['cheap', 'mid', 'expensive', 'none'] as const).map(
      (band) => pillHtml({ band, priceMilli: 6000 }).match(/<svg[^>]*>(.*?)<\/svg>/)![1],
    );
    expect(new Set(shapes).size).toBe(4);
  });

  it('marks stale and active pills and shows a dash without price', () => {
    const html = pillHtml({ band: 'none', priceMilli: null, stale: true, active: true });
    expect(html).toContain('price-pill--stale');
    expect(html).toContain('price-pill--active');
    expect(html).toContain('<span>—</span>');
  });

  it('renders cluster bubbles with the count and the cheapest price', () => {
    expect(clusterHtml(7, 5990)).toContain('7<small>desde 5,99</small>');
    expect(clusterHtml(3, null)).not.toContain('<small>');
  });

  it('finds the cheapest defined price', () => {
    expect(cheapest([6200, null, 5990, undefined, 6100])).toBe(5990);
    expect(cheapest([null, undefined])).toBeNull();
    expect(cheapest([])).toBeNull();
  });
});
