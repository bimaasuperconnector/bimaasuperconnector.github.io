import { describe, expect, it } from 'vitest';
import { orchestrateCycle } from '../cycleOrchestration';
import { makeCandidate } from './fixtures';

describe('orchestrateCycle', () => {
  it('splits candidates by mode and routes them to pairing vs grouping', () => {
    const oneToOne = [
      makeCandidate({ uid: 'a', mode: 'one_to_one' }),
      makeCandidate({ uid: 'b', mode: 'one_to_one' }),
    ];
    const smallCircle = Array.from({ length: 6 }, (_, i) =>
      makeCandidate({ uid: `sc${i}`, mode: 'small_circle', slot: 'saturday' }),
    );
    const result = orchestrateCycle('2026-09', [...oneToOne, ...smallCircle], []);
    expect(result.cycleId).toBe('2026-09');
    expect(result.pairs).toHaveLength(1);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].uids).toHaveLength(6);
    expect(result.unmatched).toHaveLength(0);
  });

  it('is deterministic given the same input', () => {
    const candidates = [
      makeCandidate({ uid: 'a', interests: ['ai'] }),
      makeCandidate({ uid: 'b', interests: ['ai'] }),
      makeCandidate({ uid: 'c', interests: ['design'] }),
      makeCandidate({ uid: 'd', interests: ['design'] }),
    ];
    const first = orchestrateCycle('2026-09', candidates, []);
    const second = orchestrateCycle('2026-09', candidates, []);
    expect(first).toEqual(second);
  });

  it('produces no output for an empty cycle', () => {
    const result = orchestrateCycle('2026-09', [], []);
    expect(result).toEqual({ cycleId: '2026-09', pairs: [], groups: [], unmatched: [] });
  });
});
