import { COMPATIBILITY_WEIGHTS, type CompatibilityBreakdown, type MatchCandidate, type PairHistoryRecord } from './types';
import { complementarity, jaccardSimilarity, normalizeTags } from './topicAnalysis';
import { connectionMeterProximity } from './eloProximity';
import { otherFactor } from './otherFactor';
import { historyMultiplier } from './history';

/**
 * Computes the full weighted compatibility breakdown between two
 * candidates, including the repeat-match history penalty. See
 * types.ts's field-level comments for what each factor actually reads
 * and docs/the Phase 5 chat response for the reasoning behind each
 * factor's data-source mapping.
 */
export function computeCompatibility(
  a: MatchCandidate,
  b: MatchCandidate,
  pairHistory: PairHistoryRecord[],
): CompatibilityBreakdown {
  const interestsA = normalizeTags(a.interests);
  const interestsB = normalizeTags(b.interests);
  const skillsA = normalizeTags(a.skills);
  const skillsB = normalizeTags(b.skills);
  const purposeA = normalizeTags(a.networkingPurpose);
  const purposeB = normalizeTags(b.networkingPurpose);

  const sharedTopics = jaccardSimilarity(interestsA, interestsB);
  const professionalInterests = jaccardSimilarity(skillsA, skillsB);
  const networkingPurpose = jaccardSimilarity(purposeA, purposeB);
  const complementarySkills = complementarity(skillsA, skillsB);
  const connMeterProximity = connectionMeterProximity(a.connectionMeter, b.connectionMeter);
  const other = otherFactor(a.batchNumber, b.batchNumber);

  const rawScore =
    sharedTopics * COMPATIBILITY_WEIGHTS.sharedTopics +
    professionalInterests * COMPATIBILITY_WEIGHTS.professionalInterests +
    networkingPurpose * COMPATIBILITY_WEIGHTS.networkingPurpose +
    complementarySkills * COMPATIBILITY_WEIGHTS.complementarySkills +
    connMeterProximity * COMPATIBILITY_WEIGHTS.connectionMeterProximity +
    other * COMPATIBILITY_WEIGHTS.other;

  const multiplier = historyMultiplier(a.uid, b.uid, pairHistory);

  return {
    sharedTopics,
    professionalInterests,
    networkingPurpose,
    complementarySkills,
    connectionMeterProximity: connMeterProximity,
    other,
    rawScore,
    historyMultiplier: multiplier,
    finalScore: rawScore * multiplier,
  };
}
