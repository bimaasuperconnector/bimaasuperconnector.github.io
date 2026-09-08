import type { CycleMatchResult, MatchCandidate, PairHistoryRecord } from './types';
import { pairCandidates } from './pairing';
import { groupCandidates } from './grouping';
import { SMALL_CIRCLE_MAX, SMALL_CIRCLE_MIN, SMALL_CIRCLE_TARGET } from '../cycles';

/**
 * The single entry point Phase 7's automation will call after fetching
 * real registrations/profiles via the Admin SDK. Pure and deterministic
 * given the same inputs — no Firestore access here at all.
 */
export function orchestrateCycle(
  cycleId: string,
  candidates: MatchCandidate[],
  pairHistory: PairHistoryRecord[],
): CycleMatchResult {
  const oneToOne = candidates.filter((c) => c.mode === 'one_to_one');
  const smallCircle = candidates.filter((c) => c.mode === 'small_circle');

  const { pairs, unmatched: unmatchedPairs } = pairCandidates(oneToOne, pairHistory);
  const { groups, unmatched: unmatchedGroups } = groupCandidates(
    smallCircle,
    pairHistory,
    SMALL_CIRCLE_TARGET,
    SMALL_CIRCLE_MIN,
    SMALL_CIRCLE_MAX,
  );

  return {
    cycleId,
    pairs,
    groups,
    unmatched: [...unmatchedPairs, ...unmatchedGroups],
  };
}
