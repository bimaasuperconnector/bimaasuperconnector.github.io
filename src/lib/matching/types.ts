/**
 * Phase 5 matching engine — pure, deterministic, side-effect-free.
 *
 * These functions never touch Firestore. Phase 7's automation is
 * responsible for reading real registrations/profiles via the Admin SDK,
 * calling `orchestrateCycle`, and writing the result — everything in
 * this module is the trusted logic that produces WHAT to write, not the
 * writing itself. See ARCHITECTURE.md's "Matching: Pure functions" list
 * and SECURITY_AND_TESTING.md's "Matching is trusted application logic."
 */

import type { RegistrationMode, RegistrationSlot } from '../cycles';

export interface OrganizationSummary {
  name: string;
  isFounder: boolean;
}

/** The subset of a member's data the matching engine actually reads. */
export interface MatchCandidate {
  uid: string;
  batchNumber: number | null;
  /** "Shared topics" factor input. */
  interests: string[];
  /** "Professional interests" + "complementary skills" factor input. */
  skills: string[];
  /** "Networking purpose" factor input. */
  networkingPurpose: string[];
  organizations: OrganizationSummary[];
  /** Hidden Connection Meter score. Defaults to 1000 (Phase 6's documented starting value) until Phase 6 ships and can move it. */
  connectionMeter: number;
  slot: RegistrationSlot;
  mode: RegistrationMode;
}

/** One historical pairing, used for repeat-match penalties. */
export interface PairHistoryRecord {
  uidA: string;
  uidB: string;
  cycleId: string;
  /**
   * Feedback sentiment from Phase 6. Not populated by anything yet since
   * Phase 6 (Feedback & Connection Meter) hasn't shipped — always
   * undefined today. The history function is built to use it correctly
   * the moment it exists.
   */
  feedbackSentiment?: 'positive' | 'neutral' | 'negative';
}

export interface CompatibilityBreakdown {
  sharedTopics: number;
  professionalInterests: number;
  networkingPurpose: number;
  complementarySkills: number;
  connectionMeterProximity: number;
  other: number;
  /** Weighted sum of the six components above, before any history penalty. */
  rawScore: number;
  /** Multiplier applied for repeat-match history (1 = no penalty). */
  historyMultiplier: number;
  /** rawScore * historyMultiplier — what pairing/grouping actually optimizes on. */
  finalScore: number;
}

export interface PairAssignment {
  uidA: string;
  uidB: string;
  breakdown: CompatibilityBreakdown;
}

export interface GroupAssignment {
  uids: string[];
  /** Average pairwise finalScore across all pairs within the group. */
  averageCompatibility: number;
}

export interface CycleMatchResult {
  cycleId: string;
  pairs: PairAssignment[];
  groups: GroupAssignment[];
  /** Registrants who couldn't be placed this cycle (e.g. odd one out below the small-circle minimum), for visibility/manual follow-up. */
  unmatched: string[];
}

export const COMPATIBILITY_WEIGHTS = {
  sharedTopics: 0.4,
  professionalInterests: 0.2,
  networkingPurpose: 0.15,
  complementarySkills: 0.1,
  connectionMeterProximity: 0.1,
  other: 0.05,
} as const;
