import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin';

export type NotificationType = 'matched' | 'calendar_ready' | 'feedback_open' | 'event_calendar_ready';

export async function createNotification(
  uid: string,
  type: NotificationType,
  title: string,
  body: string,
  cycleId: string,
): Promise<void> {
  // Deterministic ID (one notification per uid+type+cycle) so a rerun
  // of a job that has already notified someone doesn't duplicate it —
  // idempotency per AUTOMATION.md, using `set` (not `add`) deliberately.
  const id = `${cycleId}_${type}`;
  await db
    .collection('notifications')
    .doc(uid)
    .collection('items')
    .doc(id)
    .set({ type, title, body, cycleId, read: false, createdAt: Timestamp.now() }, { merge: true });
}

/**
 * Phase 13 sibling of createNotification() above, for events — which
 * have an eventId, not a cycleId. Kept as a separate function (rather
 * than generalizing createNotification's signature) so every existing
 * Phase 7/8 call site is untouched. Same deterministic-ID idempotency
 * pattern, keyed by eventId instead.
 */
export async function createEventNotification(
  uid: string,
  type: NotificationType,
  title: string,
  body: string,
  eventId: string,
): Promise<void> {
  const id = `${eventId}_${type}`;
  await db
    .collection('notifications')
    .doc(uid)
    .collection('items')
    .doc(id)
    .set({ type, title, body, eventId, read: false, createdAt: Timestamp.now() }, { merge: true });
}
