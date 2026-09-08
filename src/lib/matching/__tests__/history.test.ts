import { describe, expect, it } from 'vitest';
import { historyMultiplier } from '../history';
import type { PairHistoryRecord } from '../types';

describe('historyMultiplier', () => {
  it('is 1 with no prior history', () => {
    expect(historyMultiplier('a', 'b', [])).toBe(1);
  });

  it('is order-independent (uidA/uidB order in the record does not matter)', () => {
    const history: PairHistoryRecord[] = [{ uidA: 'b', uidB: 'a', cycleId: '2026-01' }];
    expect(historyMultiplier('a', 'b', history)).toBe(historyMultiplier('b', 'a', history));
  });

  it('penalizes a single prior match', () => {
    const history: PairHistoryRecord[] = [{ uidA: 'a', uidB: 'b', cycleId: '2026-01' }];
    const mult = historyMultiplier('a', 'b', history);
    expect(mult).toBeLessThan(1);
    expect(mult).toBeGreaterThan(0);
  });

  it('penalizes repeated prior matches more than a single one', () => {
    const once: PairHistoryRecord[] = [{ uidA: 'a', uidB: 'b', cycleId: '2026-01' }];
    const twice: PairHistoryRecord[] = [
      { uidA: 'a', uidB: 'b', cycleId: '2026-01' },
      { uidA: 'a', uidB: 'b', cycleId: '2026-02' },
    ];
    expect(historyMultiplier('a', 'b', twice)).toBeLessThan(historyMultiplier('a', 'b', once));
  });

  it('applies an additional penalty when the most recent feedback was negative', () => {
    const neutral: PairHistoryRecord[] = [
      { uidA: 'a', uidB: 'b', cycleId: '2026-01', feedbackSentiment: 'positive' },
    ];
    const negative: PairHistoryRecord[] = [
      { uidA: 'a', uidB: 'b', cycleId: '2026-01', feedbackSentiment: 'negative' },
    ];
    expect(historyMultiplier('a', 'b', negative)).toBeLessThan(historyMultiplier('a', 'b', neutral));
  });

  it('uses the most recent cycle\'s feedback, not an older one', () => {
    const improvedRelationship: PairHistoryRecord[] = [
      { uidA: 'a', uidB: 'b', cycleId: '2026-01', feedbackSentiment: 'negative' },
      { uidA: 'a', uidB: 'b', cycleId: '2026-05', feedbackSentiment: 'positive' },
    ];
    const stillNegative: PairHistoryRecord[] = [
      { uidA: 'a', uidB: 'b', cycleId: '2026-01', feedbackSentiment: 'positive' },
      { uidA: 'a', uidB: 'b', cycleId: '2026-05', feedbackSentiment: 'negative' },
    ];
    expect(historyMultiplier('a', 'b', improvedRelationship)).toBeGreaterThan(
      historyMultiplier('a', 'b', stillNegative),
    );
  });

  it('never returns exactly 0 (a pair should never become permanently unmatchable)', () => {
    const manyNegativeMatches: PairHistoryRecord[] = Array.from({ length: 10 }, (_, i) => ({
      uidA: 'a',
      uidB: 'b',
      cycleId: `2026-${String(i + 1).padStart(2, '0')}`,
      feedbackSentiment: 'negative' as const,
    }));
    expect(historyMultiplier('a', 'b', manyNegativeMatches)).toBeGreaterThan(0);
  });

  it('does not penalize an unrelated pair', () => {
    const history: PairHistoryRecord[] = [{ uidA: 'a', uidB: 'b', cycleId: '2026-01' }];
    expect(historyMultiplier('a', 'c', history)).toBe(1);
  });
});
