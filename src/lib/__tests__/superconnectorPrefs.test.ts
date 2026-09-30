import { describe, expect, it } from 'vitest';
import { hasCompletePrefs, missingPrefs, normalizeTags, sameItems } from '../superconnectorPrefs';

const full = { skills: ['Design'], interests: ['AI'], networkingPurpose: ['mentorship'] };

describe('missingPrefs / hasCompletePrefs', () => {
  it('treats a null profile as missing everything', () => {
    expect(missingPrefs(null)).toEqual(['skills', 'interests', 'networkingPurpose']);
    expect(hasCompletePrefs(undefined)).toBe(false);
  });
  it('is complete only when all three lists have an entry', () => {
    expect(hasCompletePrefs(full)).toBe(true);
    expect(missingPrefs({ ...full, skills: [] })).toEqual(['skills']);
    expect(missingPrefs({ ...full, interests: [] })).toEqual(['interests']);
    expect(missingPrefs({ ...full, networkingPurpose: [] })).toEqual(['networkingPurpose']);
  });
  it('reports several gaps in display order', () => {
    expect(missingPrefs({ skills: [], interests: ['AI'], networkingPurpose: [] })).toEqual([
      'skills',
      'networkingPurpose',
    ]);
  });
});

describe('normalizeTags', () => {
  it('trims and drops blanks', () => {
    expect(normalizeTags(['  Design ', '', '   '])).toEqual(['Design']);
  });
  it('removes case-insensitive duplicates, keeping the first spelling', () => {
    expect(normalizeTags(['Marketing', 'marketing', 'MARKETING', 'Sales'])).toEqual(['Marketing', 'Sales']);
  });
  it('caps the list length', () => {
    const many = Array.from({ length: 30 }, (_, i) => `tag${i}`);
    expect(normalizeTags(many)).toHaveLength(20);
    expect(normalizeTags(many, 5)).toHaveLength(5);
  });
});

describe('sameItems', () => {
  it('ignores order', () => {
    expect(sameItems(['a', 'b'], ['b', 'a'])).toBe(true);
  });
  it('detects differences and length changes', () => {
    expect(sameItems(['a'], ['a', 'b'])).toBe(false);
    expect(sameItems(['a', 'b'], ['a', 'c'])).toBe(false);
  });
});
