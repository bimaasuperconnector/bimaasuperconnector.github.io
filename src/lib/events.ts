/**
 * Pure, testable helpers for Phase 13 (Events & meetups). Kept free of
 * any Firestore import, same precedent as src/lib/matching/* and
 * src/lib/cycles.ts — these functions are the single source of truth
 * for "is this event still open for RSVPs" / "who is it visible to"
 * logic, used by both the UI (as a client-side sanity check /
 * pre-filter) and firestore-rules-tests.mjs (which re-derives the same
 * decisions by hand against the Rules file, since the two are
 * different languages and can't literally share code).
 *
 * IMPORTANT: `canViewEvent` below is a convenience mirror of
 * firestore.rules' `canSeeEvent()` — it is NOT the security boundary.
 * The Rules file is authoritative; this only helps the UI decide what
 * to render (e.g. avoid flashing an RSVP button the write would be
 * rejected for) and helps merge/dedupe the four targeted queries in
 * eventsRepository.ts.
 */

export const EVENT_FORMATS = ['virtual', 'physical'] as const;
export type EventFormat = (typeof EVENT_FORMATS)[number];

export const EVENT_FORMAT_LABELS: Record<EventFormat, string> = {
  virtual: 'Virtual',
  physical: 'In person',
};

export const EVENT_TARGET_TYPES = ['everyone', 'batch', 'city', 'chapter', 'badge', 'selected'] as const;
export type EventTargetType = (typeof EVENT_TARGET_TYPES)[number];

export const EVENT_TARGET_TYPE_LABELS: Record<EventTargetType, string> = {
  everyone: 'Everyone',
  batch: 'Specific batch(es)',
  city: 'A city',
  chapter: 'Chapter(s)',
  badge: 'Club / committee badge(s)',
  selected: 'Selected people',
};

export const EVENT_STATUSES = ['scheduled', 'cancelled'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_RSVP_STATUSES = ['attending', 'waitlisted', 'cancelled'] as const;
export type EventRsvpStatus = (typeof EVENT_RSVP_STATUSES)[number];

/** Mirrors firestore.rules' isValidEventTargeting size caps. */
export const MAX_TARGET_BATCH_NUMBERS = 43;
export const MAX_TARGET_UIDS = 50;
/** Mirrors firestore.rules' isValidEventTargeting caps for chapter / badge targeting. */
export const MAX_TARGET_CHAPTERS = 10;
export const MAX_TARGET_BADGES = 10;
export const MAX_CAPACITY = 1000;

export interface EventTargeting {
  targetType: EventTargetType;
  targetBatchNumbers: number[];
  targetCityLower: string;
  targetUids: string[];
  /** Chapter ids — only for targetType 'chapter' (a member matches if ANY of their chapters is listed). */
  targetChapterIds: string[];
  /** Badge ids — only for targetType 'badge' (a member matches if they wear ANY listed badge). */
  targetBadgeIds: string[];
  /**
   * Display names for the chapter / badge ids above (same order), stored on
   * the event so event cards can say "Chennai Chapter" with zero catalog
   * reads. Display only — visibility is decided by the ids.
   */
  targetLabels: string[];
}

export const EMPTY_EVENT_TARGETING: EventTargeting = {
  targetType: 'everyone',
  targetBatchNumbers: [],
  targetCityLower: '',
  targetUids: [],
  targetChapterIds: [],
  targetBadgeIds: [],
  targetLabels: [],
};

/** For display only — what a viewer is told about why an event reached them. */
export function targetingSummary(t: EventTargeting): string {
  switch (t.targetType) {
    case 'everyone':
      return 'Open to everyone';
    case 'batch':
      return t.targetBatchNumbers.length > 0
        ? `Batch ${t.targetBatchNumbers.join(', ')}`
        : 'Specific batch(es)';
    case 'city':
      return t.targetCityLower ? `${t.targetCityLower} alumni` : 'A specific city';
    case 'chapter':
      return t.targetLabels.length > 0 ? `${t.targetLabels.join(', ')} members` : 'Specific chapter(s)';
    case 'badge':
      return t.targetLabels.length > 0 ? `${t.targetLabels.join(', ')} badge holders` : 'Specific badge(s)';
    case 'selected':
      return 'Invited members only';
  }
}

/**
 * Convenience mirror of firestore.rules' canSeeEvent(). See the module
 * doc comment above — Rules remain authoritative; this is a client-side
 * pre-filter/UX helper only.
 */
export function canViewEvent(
  event: EventTargeting & { organizerUid: string },
  viewer: {
    uid: string;
    batchNumber: number | null;
    cityCanonicalLower: string;
    /** The viewer's chapter ids (max 2). Omit/empty = none. */
    chapterIds?: string[];
    /** The viewer's badge ids (max 5). Omit/empty = none. */
    badgeIds?: string[];
  },
): boolean {
  if (event.organizerUid === viewer.uid) return true;
  switch (event.targetType) {
    case 'everyone':
      return true;
    case 'batch':
      return viewer.batchNumber != null && event.targetBatchNumbers.includes(viewer.batchNumber);
    case 'city':
      return viewer.cityCanonicalLower !== '' && viewer.cityCanonicalLower === event.targetCityLower;
    case 'chapter':
      return (viewer.chapterIds ?? []).some((id) => event.targetChapterIds.includes(id));
    case 'badge':
      return (viewer.badgeIds ?? []).some((id) => event.targetBadgeIds.includes(id));
    case 'selected':
      return event.targetUids.includes(viewer.uid);
  }
}

export interface RsvpWindowInput {
  status: EventStatus;
  startTime: Date;
  rsvpDeadline: Date | null;
}

/** Whether a new/changed RSVP (other than cancelling) may still be submitted. */
export function isRsvpWindowOpen(event: RsvpWindowInput, now: Date = new Date()): boolean {
  if (event.status !== 'scheduled') return false;
  const deadline = event.rsvpDeadline ?? event.startTime;
  return now < deadline;
}

export interface Availability {
  /** null = unlimited capacity. */
  remaining: number | null;
  isFull: boolean;
}

/**
 * Given a capacity (null = unlimited) and the number of people currently
 * `attending` (NOT including waitlisted), decides whether a new RSVP
 * should be offered a confirmed spot or the waitlist.
 *
 * Known, accepted limitation (documented in FEATURE_SUPERCONNECTOR.md
 * and in the chat response): Firestore Security Rules cannot reference
 * a count() aggregate as a write condition, so this check is
 * necessarily a client-side read-then-write, not one atomic operation.
 * Two people RSVPing for the last open spot at the exact same moment
 * could theoretically both be told "confirmed" (a race condition), the
 * same class of limitation this project has already accepted elsewhere
 * (e.g. Phase 3's directory-enumeration note). Not fixed with a Cloud
 * Function per CLAUDE.md section 6 without separate explicit approval.
 */
export function computeAvailability(capacity: number | null, attendingCount: number): Availability {
  if (capacity == null) return { remaining: null, isFull: false };
  const remaining = Math.max(0, capacity - attendingCount);
  return { remaining, isFull: remaining <= 0 };
}

export function isValidCapacity(capacity: number | null): boolean {
  return capacity == null || (Number.isInteger(capacity) && capacity >= 1 && capacity <= MAX_CAPACITY);
}

export function isValidEventTargeting(t: EventTargeting): boolean {
  if (!EVENT_TARGET_TYPES.includes(t.targetType)) return false;
  if (t.targetBatchNumbers.length > MAX_TARGET_BATCH_NUMBERS) return false;
  if (t.targetUids.length > MAX_TARGET_UIDS) return false;
  if (t.targetChapterIds.length > MAX_TARGET_CHAPTERS) return false;
  if (t.targetBadgeIds.length > MAX_TARGET_BADGES) return false;
  const chapterOk = t.targetType === 'chapter' ? t.targetChapterIds.length > 0 : t.targetChapterIds.length === 0;
  const badgeOk = t.targetType === 'badge' ? t.targetBadgeIds.length > 0 : t.targetBadgeIds.length === 0;
  // Display names must line up one-to-one with the ids they describe.
  const labelIdCount = t.targetType === 'chapter' ? t.targetChapterIds.length : t.targetType === 'badge' ? t.targetBadgeIds.length : 0;
  const labelsOk = t.targetLabels.length === labelIdCount;
  const batchOk = t.targetType === 'batch' ? t.targetBatchNumbers.length > 0 : t.targetBatchNumbers.length === 0;
  const cityOk = t.targetType === 'city' ? t.targetCityLower.length > 0 : t.targetCityLower === '';
  const selectedOk = t.targetType === 'selected' ? t.targetUids.length > 0 : t.targetUids.length === 0;
  return batchOk && cityOk && selectedOk && chapterOk && badgeOk && labelsOk;
}
