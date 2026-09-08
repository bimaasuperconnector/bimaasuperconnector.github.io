import type { MatchCandidate, PairAssignment, PairHistoryRecord } from './types';
import type { RegistrationSlot } from '../cycles';
import { computeCompatibility } from './compatibility';

/**
 * Two candidates can be paired if they share an available slot: 'both'
 * is compatible with anything; 'saturday' only with 'saturday'/'both';
 * 'sunday' only with 'sunday'/'both'.
 */
export function slotsCompatible(a: RegistrationSlot, b: RegistrationSlot): boolean {
  if (a === 'both' || b === 'both') return true;
  return a === b;
}

/**
 * Greedy maximum-weight pairing: score every valid (slot-compatible)
 * pair, sort descending, then walk the list assigning the
 * highest-scoring pair first and skipping anyone already assigned.
 *
 * This is NOT a provably-optimal assignment (that would need a full
 * blossom/Hungarian-style algorithm) — it's a well-established,
 * simple, auditable approximation that's more than sufficient at the
 * scale a monthly alumni cycle actually runs at (dozens to low
 * hundreds of participants), and it's easy to reason about when
 * something looks wrong in production. Documented as a deliberate
 * tradeoff, not an oversight.
 */
export function pairCandidates(
  candidates: MatchCandidate[],
  pairHistory: PairHistoryRecord[],
): { pairs: PairAssignment[]; unmatched: string[] } {
  const scored: PairAssignment[] = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      if (!slotsCompatible(a.slot, b.slot)) continue;
      const breakdown = computeCompatibility(a, b, pairHistory);
      scored.push({ uidA: a.uid, uidB: b.uid, breakdown });
    }
  }

  scored.sort((x, y) => y.breakdown.finalScore - x.breakdown.finalScore);

  const assigned = new Set<string>();
  const pairs: PairAssignment[] = [];
  for (const candidate of scored) {
    if (assigned.has(candidate.uidA) || assigned.has(candidate.uidB)) continue;
    pairs.push(candidate);
    assigned.add(candidate.uidA);
    assigned.add(candidate.uidB);
  }

  const unmatched = candidates.map((c) => c.uid).filter((uid) => !assigned.has(uid));
  return { pairs, unmatched };
}
