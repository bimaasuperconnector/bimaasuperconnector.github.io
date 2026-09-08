import { describe, expect, it } from 'vitest';
import { complementarity, jaccardSimilarity, normalizeTag, normalizeTags } from '../topicAnalysis';

describe('normalizeTag / normalizeTags', () => {
  it('lowercases and trims', () => {
    expect(normalizeTag('  Product Design ')).toBe('product design');
  });

  it('drops empty tags after trimming', () => {
    expect(normalizeTags(['AI', '  ', 'Design'])).toEqual(new Set(['ai', 'design']));
  });
});

describe('jaccardSimilarity', () => {
  it('is 1 for identical sets', () => {
    const a = normalizeTags(['AI', 'Design']);
    const b = normalizeTags(['ai', 'design']);
    expect(jaccardSimilarity(a, b)).toBe(1);
  });

  it('is 0 for disjoint sets', () => {
    const a = normalizeTags(['AI']);
    const b = normalizeTags(['Design']);
    expect(jaccardSimilarity(a, b)).toBe(0);
  });

  it('is 0 if either set is empty (no data = no evidence, not a free pass)', () => {
    const a = normalizeTags(['AI']);
    const empty = normalizeTags([]);
    expect(jaccardSimilarity(a, empty)).toBe(0);
    expect(jaccardSimilarity(empty, empty)).toBe(0);
  });

  it('computes partial overlap correctly', () => {
    const a = normalizeTags(['AI', 'Design', 'Product']);
    const b = normalizeTags(['Design', 'Product', 'Marketing']);
    // intersection = {design, product} = 2, union = {ai,design,product,marketing} = 4
    expect(jaccardSimilarity(a, b)).toBeCloseTo(0.5, 5);
  });
});

describe('complementarity', () => {
  it('is 0 for identical sets (no complementary value in pure overlap)', () => {
    const a = normalizeTags(['AI', 'Design']);
    expect(complementarity(a, a)).toBe(0);
  });

  it('is 1 for fully disjoint sets', () => {
    const a = normalizeTags(['AI']);
    const b = normalizeTags(['Design']);
    expect(complementarity(a, b)).toBe(1);
  });

  it('is 0 if either set is empty', () => {
    const a = normalizeTags(['AI']);
    const empty = normalizeTags([]);
    expect(complementarity(a, empty)).toBe(0);
  });

  it('computes partial complementarity correctly', () => {
    const a = normalizeTags(['AI', 'Design', 'Product']);
    const b = normalizeTags(['Design', 'Product', 'Marketing']);
    // symmetric diff = {ai, marketing} = 2, union = 4 -> 0.5
    expect(complementarity(a, b)).toBeCloseTo(0.5, 5);
  });
});
