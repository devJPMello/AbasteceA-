import { computeBands } from './priceBand';

describe('computeBands', () => {
  it('splits prices into terciles', () => {
    expect(computeBands([5900, 6000, 6100, 6200, 6300, 6400])).toEqual([
      'cheap',
      'cheap',
      'mid',
      'mid',
      'expensive',
      'expensive',
    ]);
  });

  it('keeps the input order and marks missing prices as none', () => {
    expect(computeBands([6400, null, 5900, 6100])).toEqual(['expensive', 'none', 'cheap', 'mid']);
  });

  it('gives tied prices the same band without letting a tie swallow a whole band', () => {
    expect(computeBands([6125, 6125, 6195, 6195, 6195, 6195, 6265])).toEqual([
      'cheap',
      'cheap',
      'mid',
      'mid',
      'mid',
      'mid',
      'expensive',
    ]);
  });

  it('uses mid when all prices are equal or there is a single one', () => {
    expect(computeBands([6000, 6000, 6000])).toEqual(['mid', 'mid', 'mid']);
    expect(computeBands([6000])).toEqual(['mid']);
  });

  it('handles empty and all-null input', () => {
    expect(computeBands([])).toEqual([]);
    expect(computeBands([null, null])).toEqual(['none', 'none']);
  });
});
