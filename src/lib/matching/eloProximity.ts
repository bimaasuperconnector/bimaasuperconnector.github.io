/**
 * Connection Meter proximity: how close two members' hidden scores are,
 * as a similarity in [0, 1]. This ONLY reads scores — it never mutates
 * them. Score movement (+3 to +5 / -3 to -5 after feedback) is Phase 6's
 * job entirely; see FEATURE_SUPERCONNECTOR.md Phase 6.
 *
 * Everyone defaults to 1000 (Phase 6's documented starting value) until
 * Phase 6 ships and feedback starts moving real scores, so this factor
 * is neutral (proximity = 1 for everyone) in practice today. That's
 * expected, not a bug — the function is correct now and will start
 * differentiating the moment real score variance exists.
 */

export const DEFAULT_CONNECTION_METER = 1000;

/** Matches Phase 6's documented soft range (800–1200), used to normalize distance into [0, 1]. */
const SOFT_RANGE_WIDTH = 1200 - 800;

export function connectionMeterProximity(scoreA: number, scoreB: number): number {
  const distance = Math.abs(scoreA - scoreB);
  const normalized = 1 - distance / SOFT_RANGE_WIDTH;
  return Math.max(0, Math.min(1, normalized));
}
