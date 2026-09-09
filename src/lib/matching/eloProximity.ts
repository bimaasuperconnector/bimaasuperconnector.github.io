/**
 * Connection Meter proximity: how close two members' hidden scores are,
 * as a similarity in [0, 1]. This ONLY reads scores — it never mutates
 * them. Score movement (+3 to +5 / -3 to -5 after feedback) is Phase 6's
 * job entirely; see ../connectionMeter.ts.
 *
 * Everyone defaults to 1000 (Phase 6's documented starting value) until
 * Phase 7's automation ships and starts moving real scores based on
 * feedback, so this factor is neutral (proximity = 1 for everyone) in
 * practice today. That's expected, not a bug — the function is correct
 * now and will start differentiating the moment real score variance
 * exists.
 */

import { DEFAULT_CONNECTION_METER, SOFT_RANGE_MAX, SOFT_RANGE_MIN } from '../connectionMeter';

export { DEFAULT_CONNECTION_METER };

const SOFT_RANGE_WIDTH = SOFT_RANGE_MAX - SOFT_RANGE_MIN;

export function connectionMeterProximity(scoreA: number, scoreB: number): number {
  const distance = Math.abs(scoreA - scoreB);
  const normalized = 1 - distance / SOFT_RANGE_WIDTH;
  return Math.max(0, Math.min(1, normalized));
}
