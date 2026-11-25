import { isPlausible } from './plausibility';

describe('isPlausible', () => {
  it('accepts everything when there is no reference yet', () => {
    expect(isPlausible(9999, null, 15)).toBe(true);
  });

  it('accepts prices within the percentage band (inclusive)', () => {
    expect(isPlausible(6000, 6000, 15)).toBe(true);
    expect(isPlausible(6900, 6000, 15)).toBe(true); // +15% exactly
    expect(isPlausible(5100, 6000, 15)).toBe(true); // -15% exactly
  });

  it('rejects prices outside the band, above or below', () => {
    expect(isPlausible(6901, 6000, 15)).toBe(false);
    expect(isPlausible(5099, 6000, 15)).toBe(false);
  });

  it('honours a custom percentage', () => {
    expect(isPlausible(6500, 6000, 5)).toBe(false);
    expect(isPlausible(6500, 6000, 10)).toBe(true);
  });
});
