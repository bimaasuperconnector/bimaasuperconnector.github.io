import type { PairHistoryRecord } from './types';

/**
 * "Strong repeat-match penalties and negative prior-pair signals" from
 * FEATURE_SUPERCONNECTOR.md's Phase 5 spec.
 *
 * Returns a multiplier in (0, 1] applied to a pair's raw compatibility
 * score — 1 means no penalty, smaller means a stronger penalty. Never
 * returns exactly 0: even a heavily-penalized repeat pair should still
 * be matchable as an absolute last resort (e.g. a tiny alumni cohort
 * where everyone has already met everyone) rather than becoming
 * permanently unmatchable.
 */

const REPEAT_MATCH_PENALTY_PER_PRIOR_MATCH = 0.5; // halves the score per prior match, before the negative-feedback penalty
const NEGATIVE_FEEDBACK_PENALTY = 0.3; // further multiplies the score if the most recent feedback was negative
const MINIMUM_MULTIPLIER = 0.05; // floor, so a pair is never truly unmatchable

function pairKey(uidA: string, uidB: string): [string, string] {
  return uidA < uidB ? [uidA, uidB] : [uidB, uidA];
}

export function historyMultiplier(
  uidA: string,
  uidB: string,
  pairHistory: PairHistoryRecord[],
): number {
  const [a, b] = pairKey(uidA, uidB);
  const priorMatches = pairHistory.filter((record) => {
    const [ra, rb] = pairKey(record.uidA, record.uidB);
    return ra === a && rb === b;
  });

  if (priorMatches.length === 0) return 1;

  let multiplier = REPEAT_MATCH_PENALTY_PER_PRIOR_MATCH ** priorMatches.length;

  // "Negative prior-pair signals": the feedback from Phase 6, once it
  // exists. Sorted by cycleId so "most recent" is well-defined even if
  // records arrive out of order.
  const mostRecent = [...priorMatches].sort((x, y) => y.cycleId.localeCompare(x.cycleId))[0];
  if (mostRecent.feedbackSentiment === 'negative') {
    multiplier *= NEGATIVE_FEEDBACK_PENALTY;
  }

  return Math.max(MINIMUM_MULTIPLIER, multiplier);
}
