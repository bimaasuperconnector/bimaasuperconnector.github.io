import { describe, expect, it } from 'vitest';
import { groupCandidates, resolveSlotPools } from '../grouping';
import { makeCandidate } from './fixtures';

describe('resolveSlotPools', () => {
  it('puts strict-day candidates in their own pool', () => {
    const sat = makeCandidate({ uid: 'a', slot: 'saturday' });
    const sun = makeCandidate({ uid: 'b', slot: 'sunday' });
    const { saturdayPool, sundayPool } = resolveSlotPools([sat, sun]);
    expect(saturdayPool.map((c) => c.uid)).toEqual(['a']);
    expect(sundayPool.map((c) => c.uid)).toEqual(['b']);
  });

  it('balances flexible ("both") candidates across pools', () => {
    const flexible = Array.from({ length: 4 }, (_, i) => makeCandidate({ uid: `f${i}`, slot: 'both' }));
    const { saturdayPool, sundayPool } = resolveSlotPools(flexible);
    expect(saturdayPool.length).toBe(2);
    expect(sundayPool.length).toBe(2);
  });

  it('tops up whichever strict pool is short using flexible candidates', () => {
    const strictSaturday = [makeCandidate({ uid: 's1', slot: 'saturday' })];
    const flexible = Array.from({ length: 3 }, (_, i) => makeCandidate({ uid: `f${i}`, slot: 'both' }));
    const { saturdayPool, sundayPool } = resolveSlotPools([...strictSaturday, ...flexible]);
    // Saturday starts at 1, Sunday at 0 — flexible people should preferentially fill Sunday first.
    expect(sundayPool.length).toBeGreaterThanOrEqual(saturdayPool.length - 1);
    expect(saturdayPool.length + sundayPool.length).toBe(4);
  });
});

describe('groupCandidates', () => {
  it('places everyone from a single well-sized pool into valid groups', () => {
    const candidates = Array.from({ length: 12 }, (_, i) =>
      makeCandidate({ uid: `u${i}`, slot: 'saturday', mode: 'small_circle' }),
    );
    const { groups, unmatched } = groupCandidates(candidates, [], 6, 3, 6);
    expect(unmatched).toHaveLength(0);
    const totalPlaced = groups.reduce((sum, g) => sum + g.uids.length, 0);
    expect(totalPlaced).toBe(12);
    for (const group of groups) {
      expect(group.uids.length).toBeGreaterThanOrEqual(3);
      expect(group.uids.length).toBeLessThanOrEqual(6);
    }
  });

  it('never mixes strict-Saturday and strict-Sunday people in the same group', () => {
    const sat = Array.from({ length: 6 }, (_, i) =>
      makeCandidate({ uid: `sat${i}`, slot: 'saturday', mode: 'small_circle' }),
    );
    const sun = Array.from({ length: 6 }, (_, i) =>
      makeCandidate({ uid: `sun${i}`, slot: 'sunday', mode: 'small_circle' }),
    );
    const { groups } = groupCandidates([...sat, ...sun], [], 6, 3, 6);
    for (const group of groups) {
      const hasSat = group.uids.some((uid) => uid.startsWith('sat'));
      const hasSun = group.uids.some((uid) => uid.startsWith('sun'));
      expect(hasSat && hasSun).toBe(false);
    }
  });

  it('reports everyone unmatched when the pool is below the minimum', () => {
    const candidates = Array.from({ length: 2 }, (_, i) =>
      makeCandidate({ uid: `u${i}`, slot: 'saturday', mode: 'small_circle' }),
    );
    const { groups, unmatched } = groupCandidates(candidates, [], 6, 3, 6);
    expect(groups).toHaveLength(0);
    expect(unmatched).toHaveLength(2);
  });

  it('groups people with shared interests together over a mixed pool', () => {
    const aiFolks = Array.from({ length: 3 }, (_, i) =>
      makeCandidate({ uid: `ai${i}`, slot: 'saturday', mode: 'small_circle', interests: ['ai', 'ml'] }),
    );
    const artFolks = Array.from({ length: 3 }, (_, i) =>
      makeCandidate({
        uid: `art${i}`,
        slot: 'saturday',
        mode: 'small_circle',
        interests: ['painting', 'sculpture'],
      }),
    );
    const { groups } = groupCandidates([...aiFolks, ...artFolks], [], 3, 3, 3);
    expect(groups).toHaveLength(2);
    for (const group of groups) {
      const allAi = group.uids.every((uid) => uid.startsWith('ai'));
      const allArt = group.uids.every((uid) => uid.startsWith('art'));
      expect(allAi || allArt).toBe(true);
    }
  });
});
