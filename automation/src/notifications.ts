import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin';

export type NotificationType = 'matched' | 'calendar_ready' | 'feedback_open';

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
