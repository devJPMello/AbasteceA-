import { describe, expect, it } from 'vitest';
import { formatDistance, formatPrice, formatRelative, parsePriceInput } from './format';

describe('format', () => {
  it('formats prices with three decimals and a comma', () => {
    expect(formatPrice(5899)).toBe('R$ 5,899');
    expect(formatPrice(6190)).toBe('R$ 6,190');
  });

  it('formats distances', () => {
    expect(formatDistance(450)).toBe('450 m');
    expect(formatDistance(1782)).toBe('1,8 km');
  });

  it('formats relative time in pt-BR', () => {
    const now = new Date('2025-11-25T12:00:00Z').getTime();
    expect(formatRelative('2025-11-23T12:00:00Z', now)).toBe('anteontem');
    expect(formatRelative('2025-11-21T12:00:00Z', now)).toBe('há 4 dias');
    expect(formatRelative('2025-11-25T09:00:00Z', now)).toBe('há 3 horas');
  });

  it('parses typed prices into thousandths', () => {
    expect(parsePriceInput('6,29')).toBe(6290);
    expect(parsePriceInput('6.299')).toBe(6299);
    expect(parsePriceInput('R$ 5,899')).toBe(5899);
    expect(parsePriceInput('abc')).toBeNull();
    expect(parsePriceInput('6,2999')).toBeNull();
    expect(parsePriceInput('')).toBeNull();
  });
});
