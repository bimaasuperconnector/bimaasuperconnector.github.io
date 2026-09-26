import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../init';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  cycleId: string | null;
  /** Present on Phase 13 event-related notifications instead of cycleId — see automation/src/notifications.ts' createEventNotification(). */
  eventId: string | null;
  read: boolean;
  createdAt: Date | null;
}

/**
 * Read-only. Only automation (Admin SDK) ever writes to
 * `notifications/{uid}/items/{notificationId}` — see firestore.rules.
 * No mark-as-read yet; this phase ships the feed as read-only so the
 * owner can actually observe automation results end-to-end. A scoped
 * update (touching only `read`) is a reasonable small addition once
 * this page's UX is actually being used day to day.
 */
export async function listOwnNotifications(uid: string): Promise<Notification[]> {
  if (!db) throw new Error('Firestore is not configured.');
  const snapshot = await getDocs(
    query(collection(db, 'notifications', uid, 'items'), orderBy('createdAt', 'desc')),
  );
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      type: data.type ?? 'info',
      title: data.title ?? '',
      body: data.body ?? '',
      cycleId: data.cycleId ?? null,
      eventId: data.eventId ?? null,
      read: data.read === true,
      createdAt: data.createdAt?.toDate?.() ?? null,
    };
  });
}
