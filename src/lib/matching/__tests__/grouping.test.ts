import { describe, expect, it } from 'vitest';
import { computeGroupSizes } from '../grouping';

function sumSizes(sizes: number[]): number {
  return sizes.reduce((a, b) => a + b, 0);
}

describe('computeGroupSizes (target=6, min=3, max=6)', () => {
  const T = 6;
  const MIN = 3;
  const MAX = 6;

  it('returns no groups and everyone unmatched below the minimum', () => {
    expect(computeGroupSizes(2, T, MIN, MAX)).toEqual({ sizes: [], unmatchedCount: 2 });
    expect(computeGroupSizes(0, T, MIN, MAX)).toEqual({ sizes: [], unmatchedCount: 0 });
  });

  it('forms one group at exactly the minimum', () => {
    expect(computeGroupSizes(3, T, MIN, MAX)).toEqual({ sizes: [3], unmatchedCount: 0 });
  });

  it('forms one group of remainder size when remainder >= min', () => {
    expect(computeGroupSizes(4, T, MIN, MAX)).toEqual({ sizes: [4], unmatchedCount: 0 });
    expect(computeGroupSizes(5, T, MIN, MAX)).toEqual({ sizes: [5], unmatchedCount: 0 });
  });

  it('forms one full group at exactly target', () => {
    expect(computeGroupSizes(6, T, MIN, MAX)).toEqual({ sizes: [6], unmatchedCount: 0 });
  });

  it('forms two full groups with no remainder', () => {
    expect(computeGroupSizes(12, T, MIN, MAX)).toEqual({ sizes: [6, 6], unmatchedCount: 0 });
  });

  it('borrows from a full group when remainder (1) is below min, rather than leaving 1 unmatched', () => {
    const result = computeGroupSizes(7, T, MIN, MAX);
    expect(sumSizes(result.sizes)).toBe(7);
    expect(result.unmatchedCount).toBe(0);
    for (const size of result.sizes) {
      expect(size).toBeGreaterThanOrEqual(MIN);
      expect(size).toBeLessThanOrEqual(MAX);
    }
  });

  it('borrows from a full group when remainder (2) is below min', () => {
    const result = computeGroupSizes(8, T, MIN, MAX);
    expect(sumSizes(result.sizes)).toBe(8);
    expect(result.unmatchedCount).toBe(0);
    for (const size of result.sizes) {
      expect(size).toBeGreaterThanOrEqual(MIN);
      expect(size).toBeLessThanOrEqual(MAX);
    }
  });

  it('handles a larger remainder-below-min case (14 people: two full groups + remainder 2)', () => {
    const result = computeGroupSizes(14, T, MIN, MAX);
    expect(sumSizes(result.sizes)).toBe(14);
    expect(result.unmatchedCount).toBe(0);
    for (const size of result.sizes) {
      expect(size).toBeGreaterThanOrEqual(MIN);
      expect(size).toBeLessThanOrEqual(MAX);
    }
  });

  it('every returned group size across a full sweep of totals 0..30 is always within [min, max] or explicitly unmatched', () => {
    for (let total = 0; total <= 30; total++) {
      const result = computeGroupSizes(total, T, MIN, MAX);
      const placed = sumSizes(result.sizes);
      expect(placed + result.unmatchedCount).toBe(total);
      for (const size of result.sizes) {
        expect(size).toBeGreaterThanOrEqual(MIN);
        expect(size).toBeLessThanOrEqual(MAX);
      }
    }
  });

  it('throws on an invalid config where target > max', () => {
    expect(() => computeGroupSizes(10, 7, 3, 6)).toThrow();
  });

  it('throws on an invalid config where min > target', () => {
    expect(() => computeGroupSizes(10, 2, 3, 6)).toThrow();
  });
});

describe('computeGroupSizes with a different config (target=4, min=2, max=5)', () => {
  it('still keeps every group within bounds across a sweep', () => {
    for (let total = 0; total <= 25; total++) {
      const result = computeGroupSizes(total, 4, 2, 5);
      const placed = result.sizes.reduce((a, b) => a + b, 0);
      expect(placed + result.unmatchedCount).toBe(total);
      for (const size of result.sizes) {
        expect(size).toBeGreaterThanOrEqual(2);
        expect(size).toBeLessThanOrEqual(5);
      }
    }
  });
});
