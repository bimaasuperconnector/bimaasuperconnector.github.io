/**
 * Hidden ELO-like Connection Meter — Phase 6.
 *
 * This module ONLY computes what a score movement WOULD be. It never
 * writes to Firestore. The actual mutation of a member's stored score is
 * trusted server-side logic (Phase 7's "feedback/score job" — see
 * AUTOMATION.md), executed via the Admin SDK. Firestore Rules
 * independently deny every client write to `connectionMeters/{uid}` —
 * see firestore.rules. "Do not expose or client-edit the score" from
 * FEATURE_SUPERCONNECTOR.md's Phase 6 spec is enforced at that layer,
 * not by this module simply not being called from the client — belt and
 * suspenders.
 */

export const DEFAULT_CONNECTION_METER = 1000;
export const SOFT_RANGE_MIN = 800;
export const SOFT_RANGE_MAX = 1200;

/**
 * The four feedback options from the spec's "How was your connection
 * with [Name]?" prompt. `skip` is deliberately distinct from `okay`:
 * `okay` is a real neutral data point (they answered, connection was
 * fine), `skip` means they declined to answer at all and should not be
 * treated as evidence of anything — see `toHistorySentiment` below.
 */
export const FEEDBACK_SENTIMENTS = ['great', 'okay', 'not_good', 'skip'] as const;
export type FeedbackSentiment = (typeof FEEDBACK_SENTIMENTS)[number];

export const FEEDBACK_SENTIMENT_LABELS: Record<FeedbackSentiment, string> = {
  great: 'Great connection',
  okay: 'Okay',
  not_good: 'Not a good connection',
  skip: 'Skip',
};

/**
 * A single representative value within the spec's recommended ranges
 * (+3 to +5 positive, -3 to -5 negative) rather than a variable amount —
 * kept as a named constant so the actual number is visible and easy to
 * revisit in one place, not buried in arithmetic.
 */
const POSITIVE_DELTA = 4;
const NEGATIVE_DELTA = -4;

export function connectionMeterDelta(sentiment: FeedbackSentiment): number {
  switch (sentiment) {
    case 'great':
      return POSITIVE_DELTA;
    case 'not_good':
      return NEGATIVE_DELTA;
    case 'okay':
    case 'skip':
      return 0;
  }
}

/**
 * Applies one feedback movement to a current score, clamped to the soft
 * range. The spec calls the range "configurable," but doesn't say what
 * happens at the edges — treating it as a hard clamp here is a
 * simplification worth flagging, not a settled requirement.
 */
export function applyFeedback(currentScore: number, sentiment: FeedbackSentiment): number {
  const next = currentScore + connectionMeterDelta(sentiment);
  return Math.max(SOFT_RANGE_MIN, Math.min(SOFT_RANGE_MAX, next));
}

/**
 * Bridges a Phase 6 feedback sentiment into the 3-value sentiment Phase
 * 5's `history.ts` already consumes for the "negative prior-pair
 * signal" penalty. `skip` maps to `undefined` (no data point) rather
 * than `neutral`, since declining to answer isn't evidence either way.
 */
export function toHistorySentiment(
  sentiment: FeedbackSentiment,
): 'positive' | 'neutral' | 'negative' | undefined {
  switch (sentiment) {
    case 'great':
      return 'positive';
    case 'not_good':
      return 'negative';
    case 'okay':
      return 'neutral';
    case 'skip':
      return undefined;
  }
}
