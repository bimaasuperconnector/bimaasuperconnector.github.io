import type { GroupAssignment, MatchCandidate, PairHistoryRecord } from './types';
import { computeCompatibility } from './compatibility';

/**
 * Splits small-circle candidates into a Saturday pool and a Sunday pool.
 * Strict-day candidates go straight to their pool; 'both' candidates are
 * flexible and are assigned one at a time to whichever pool currently
 * has fewer people, so a single circle never ends up needing two
 * different meeting times. This is a simple deterministic balancing
 * heuristic, not a globally optimal split.
 */
export function resolveSlotPools(
  candidates: MatchCandidate[],
): { saturdayPool: MatchCandidate[]; sundayPool: MatchCandidate[] } {
  const saturdayPool: MatchCandidate[] = [];
  const sundayPool: MatchCandidate[] = [];
  const flexible: MatchCandidate[] = [];

  for (const c of candidates) {
    if (c.slot === 'saturday') saturdayPool.push(c);
    else if (c.slot === 'sunday') sundayPool.push(c);
    else flexible.push(c);
  }

  // Deterministic order for the flexible assignment so results are
  // reproducible given the same input.
  const sortedFlexible = [...flexible].sort((a, b) => a.uid.localeCompare(b.uid));
  for (const c of sortedFlexible) {
    if (saturdayPool.length <= sundayPool.length) saturdayPool.push(c);
    else sundayPool.push(c);
  }

  return { saturdayPool, sundayPool };
}

/**
 * Computes a list of group sizes (each within [min, max]) that sum to
 * `total`, preferring `target`-sized groups and only ever shrinking a
 * full group (down to `min`) to make room for a valid remainder group —
 * never leaving a group below `min` or above `max`. If no valid
 * arrangement exists (e.g. total < min, or borrowing capacity is too
 * small), the leftover count is reported as unmatched rather than
 * forcing an invalid group.
 */
export function computeGroupSizes(
  total: number,
  target: number,
  min: number,
  max: number,
): { sizes: number[]; unmatchedCount: number } {
  if (target > max || min > target) {
    throw new Error(
      `Invalid group sizing config: expected min (${min}) <= target (${target}) <= max (${max}).`,
    );
  }
  if (total < min) return { sizes: [], unmatchedCount: total };

  const numFull = Math.floor(total / target);
  const remainder = total % target;

  if (remainder === 0) {
    return { sizes: Array(numFull).fill(target), unmatchedCount: 0 };
  }
  if (remainder >= min) {
    return { sizes: [...Array(numFull).fill(target), remainder], unmatchedCount: 0 };
  }
  if (numFull === 0) {
    // total >= min but < target and remainder < min is impossible here
    // (remainder === total when numFull === 0), so this is unreachable
    // in practice — kept as a safe fallback.
    return { sizes: [], unmatchedCount: total };
  }

  const needed = min - remainder;
  const borrowCapacity = numFull * (target - min);
  if (borrowCapacity < needed) {
    return { sizes: Array(numFull).fill(target), unmatchedCount: remainder };
  }

  const sizes = Array(numFull).fill(target);
  let stillNeeded = needed;
  for (let i = sizes.length - 1; i >= 0 && stillNeeded > 0; i--) {
    const take = Math.min(sizes[i] - min, stillNeeded);
    sizes[i] -= take;
    stillNeeded -= take;
  }
  sizes.push(remainder + needed); // always exactly `min`
  return { sizes, unmatchedCount: 0 };
}

/**
 * Greedily builds groups of the given sizes from `pool`: seed each group
 * with the next unplaced candidate (by uid, for determinism), then
 * repeatedly add whoever has the highest average compatibility with the
 * group's current members, until the group reaches its target size.
 *
 * This optimizes whole-group compatibility via a simple, auditable
 * greedy heuristic rather than a full combinatorial optimization (which
 * would be computationally infeasible to reason about at any scale) —
 * a deliberate, documented tradeoff, same as pairCandidates.
 */
function growGroups(
  pool: MatchCandidate[],
  sizes: number[],
  pairHistory: PairHistoryRecord[],
  meetingDay: 'saturday' | 'sunday',
): GroupAssignment[] {
  const remaining = [...pool].sort((a, b) => a.uid.localeCompare(b.uid));
  const groups: GroupAssignment[] = [];

  for (const size of sizes) {
    if (remaining.length === 0) break;
    const seed = remaining.shift()!;
    const members = [seed];

    while (members.length < size && remaining.length > 0) {
      let bestIndex = 0;
      let bestAvg = -Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        let sum = 0;
        for (const member of members) {
          sum += computeCompatibility(member, candidate, pairHistory).finalScore;
        }
        const avg = sum / members.length;
        if (avg > bestAvg) {
          bestAvg = avg;
          bestIndex = i;
        }
      }
      members.push(remaining.splice(bestIndex, 1)[0]);
    }

    let pairSum = 0;
    let pairCount = 0;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        pairSum += computeCompatibility(members[i], members[j], pairHistory).finalScore;
        pairCount++;
      }
    }

    groups.push({
      uids: members.map((m) => m.uid),
      averageCompatibility: pairCount > 0 ? pairSum / pairCount : 0,
      meetingDay,
    });
  }

  return groups;
}

export function groupCandidates(
  candidates: MatchCandidate[],
  pairHistory: PairHistoryRecord[],
  target: number,
  min: number,
  max: number,
): { groups: GroupAssignment[]; unmatched: string[] } {
  const { saturdayPool, sundayPool } = resolveSlotPools(candidates);
  const groups: GroupAssignment[] = [];
  const unmatched: string[] = [];

  for (const [pool, meetingDay] of [
    [saturdayPool, 'saturday'] as const,
    [sundayPool, 'sunday'] as const,
  ]) {
    const { sizes, unmatchedCount } = computeGroupSizes(pool.length, target, min, max);
    const poolGroups = growGroups(pool, sizes, pairHistory, meetingDay);
    groups.push(...poolGroups);

    const placedUids = new Set(poolGroups.flatMap((g) => g.uids));
    const leftover = pool.filter((c) => !placedUids.has(c.uid));
    // Sanity check rather than blind trust: computeGroupSizes promised
    // `unmatchedCount` leftover people; if growGroups somehow placed
    // fewer than expected (it shouldn't), surface everyone actually
    // unplaced rather than silently under-reporting.
    unmatched.push(...leftover.map((c) => c.uid));
    if (leftover.length !== unmatchedCount) {
      // eslint-disable-next-line no-console
      console.warn(
        `[matching] Expected ${unmatchedCount} unmatched in pool, got ${leftover.length}.`,
      );
    }
  }

  return { groups, unmatched };
}
