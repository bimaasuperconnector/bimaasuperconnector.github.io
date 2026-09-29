import {
  Timestamp,
  collection,
  getCountFromServer,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  type QueryConstraint,
  startAfter,
  where,
} from 'firebase/firestore';
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

/** How many notifications one page (bell pane, Home preview, full page) loads. */
export const NOTIFICATIONS_PAGE_SIZE = 20;

/**
 * Read-only. Only automation (Admin SDK) ever writes to
 * `notifications/{uid}/items/{notificationId}` — see firestore.rules.
 *
 * Quota optimisation (post-login UI revamp): this used to download the
 * member's ENTIRE notification history on every call. It is now always a
 * bounded, newest-first page (`max`, default 20) with an optional
 * `before` cursor to fetch the next older page — so a member with a long
 * history costs the same handful of reads as a new member, and the Home
 * preview asks for just 3.
 */
export async function listOwnNotifications(
  uid: string,
  max: number = NOTIFICATIONS_PAGE_SIZE,
  before?: Date | null,
): Promise<Notification[]> {
  if (!db) throw new Error('Firestore is not configured.');
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (before) constraints.push(startAfter(Timestamp.fromDate(before)));
  constraints.push(fsLimit(max));
  const snapshot = await getDocs(query(collection(db, 'notifications', uid, 'items'), ...constraints));
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

/**
 * Number of notifications newer than `since` (or all of them when `since`
 * is null), for the header bell badge. Uses a Firestore count()
 * aggregation: it is billed as ONE document read per 1,000 index entries
 * counted — i.e. effectively 1 read per member per check — instead of
 * downloading any notification documents just to draw a badge.
 * Server-side, read-only, and scoped to the caller's own subcollection by
 * the same Rules as the list query.
 */
export async function countNotificationsSince(uid: string, since: Date | null): Promise<number> {
  if (!db) return 0;
  const col = collection(db, 'notifications', uid, 'items');
  const q = since ? query(col, where('createdAt', '>', Timestamp.fromDate(since))) : query(col);
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}
