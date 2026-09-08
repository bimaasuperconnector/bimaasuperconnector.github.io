import { describe, expect, it } from 'vitest';
import { pairCandidates, slotsCompatible } from '../pairing';
import { makeCandidate } from './fixtures';

describe('slotsCompatible', () => {
  it('both is compatible with anything', () => {
    expect(slotsCompatible('both', 'saturday')).toBe(true);
    expect(slotsCompatible('sunday', 'both')).toBe(true);
    expect(slotsCompatible('both', 'both')).toBe(true);
  });

  it('saturday and sunday are not compatible with each other', () => {
    expect(slotsCompatible('saturday', 'sunday')).toBe(false);
  });

  it('matching strict days are compatible', () => {
    expect(slotsCompatible('saturday', 'saturday')).toBe(true);
  });
});

describe('pairCandidates', () => {
  it('pairs two compatible candidates', () => {
    const a = makeCandidate({ uid: 'a', interests: ['ai', 'design'] });
    const b = makeCandidate({ uid: 'b', interests: ['ai', 'design'] });
    const { pairs, unmatched } = pairCandidates([a, b], []);
    expect(pairs).toHaveLength(1);
    expect(unmatched).toHaveLength(0);
    expect([pairs[0].uidA, pairs[0].uidB].sort()).toEqual(['a', 'b']);
  });

  it('never pairs incompatible slots', () => {
    const a = makeCandidate({ uid: 'a', slot: 'saturday' });
    const b = makeCandidate({ uid: 'b', slot: 'sunday' });
    const { pairs, unmatched } = pairCandidates([a, b], []);
    expect(pairs).toHaveLength(0);
    expect(unmatched.sort()).toEqual(['a', 'b']);
  });

  it('leaves an odd one out unmatched', () => {
    const a = makeCandidate({ uid: 'a' });
    const b = makeCandidate({ uid: 'b' });
    const c = makeCandidate({ uid: 'c' });
    const { pairs, unmatched } = pairCandidates([a, b, c], []);
    expect(pairs).toHaveLength(1);
    expect(unmatched).toHaveLength(1);
  });

  it('prefers the higher-compatibility pairing over a lower one when both are available', () => {
    // a-b share everything; a-c and b-c share nothing. The optimal
    // greedy assignment should pair a-b and leave c unmatched, not
    // break up the strong pair to include c.
    const a = makeCandidate({ uid: 'a', interests: ['ai', 'design', 'music'] });
    const b = makeCandidate({ uid: 'b', interests: ['ai', 'design', 'music'] });
    const c = makeCandidate({ uid: 'c', interests: [] });
    const { pairs, unmatched } = pairCandidates([a, b, c], []);
    expect(pairs).toHaveLength(1);
    expect([pairs[0].uidA, pairs[0].uidB].sort()).toEqual(['a', 'b']);
    expect(unmatched).toEqual(['c']);
  });

  it('applies the history penalty so a repeat pair scores lower than the same pair fresh', () => {
    const a = makeCandidate({ uid: 'a', interests: ['ai'] });
    const b = makeCandidate({ uid: 'b', interests: ['ai'] });
    const noHistory = pairCandidates([a, b], []);
    const withHistory = pairCandidates([a, b], [{ uidA: 'a', uidB: 'b', cycleId: '2026-01' }]);
    expect(withHistory.pairs[0].breakdown.finalScore).toBeLessThan(
      noHistory.pairs[0].breakdown.finalScore,
    );
  });
});
