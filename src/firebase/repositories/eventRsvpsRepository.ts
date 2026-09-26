import {
  type DocumentData,
  type QueryDocumentSnapshot,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../init';
import type { EventRsvpStatus } from '../../lib/events';

export interface EventRsvp {
  id: string;
  eventId: string;
  uid: string;
  organizerUid: string;
  status: EventRsvpStatus;
  respondedAt: Date | null;
}

function rsvpsCollection() {
  if (!db) throw new Error('Firestore is not configured.');
  return collection(db, 'eventRsvps');
}

function rsvpDocRef(eventId: string, uid: string) {
  if (!db) throw new Error('Firestore is not configured.');
  return doc(db, 'eventRsvps', `${eventId}_${uid}`);
}

function fromSnapshot(id: string, data: DocumentData): EventRsvp {
  return {
    id,
    eventId: data.eventId,
    uid: data.uid,
    organizerUid: data.organizerUid,
    status: data.status,
    respondedAt: data.respondedAt?.toDate?.() ?? null,
  };
}

export async function getOwnRsvp(eventId: string, uid: string): Promise<EventRsvp | null> {
  const snapshot = await getDoc(rsvpDocRef(eventId, uid));
  return snapshot.exists() ? fromSnapshot(snapshot.id, snapshot.data()) : null;
}

/**
 * Create-or-update, doc ID always `${eventId}_${uid}` — same immutable-
 * composite-ID pattern as connectionRegistrations (Phase 4) and
 * feedback (Phase 6). `organizerUid` is denormalized from the event at
 * write time specifically so the organizer's attendee-list `list` query
 * (see listEventAttendees below) is a same-document field check in
 * firestore.rules, not a cross-collection lookup per result — the same
 * reasoning documented throughout this project for `approved`,
 * `postedByUid`, etc. Firestore Rules independently re-verify this
 * value against the event's real organizerUid at write time (see
 * eventOrganizerUid() in firestore.rules), so a client cannot forge it.
 */
export async function upsertRsvp(
  eventId: string,
  uid: string,
  organizerUid: string,
  status: EventRsvpStatus,
): Promise<void> {
  const ref = rsvpDocRef(eventId, uid);
  const existing = await getDoc(ref);
  await setDoc(
    ref,
    {
      eventId,
      uid,
      organizerUid,
      status,
      respondedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: existing.exists() },
  );
}

/** Full withdrawal — always allowed regardless of event status, same posture as connectionRegistrations' delete. */
export async function withdrawRsvp(eventId: string, uid: string): Promise<void> {
  await deleteDoc(rsvpDocRef(eventId, uid));
}

/** Every event a member has ever RSVPed to — a safe, same-document "uid == caller" query, no composite index needed. Unbounded but scoped to the caller's OWN activity, same accepted-tradeoff class as queryMyJobs/listOwnNotifications (see the 2026-09-26 quota-optimization pass). */
export async function listOwnRsvps(uid: string): Promise<EventRsvp[]> {
  const snapshot = await getDocs(query(rsvpsCollection(), where('uid', '==', uid)));
  return snapshot.docs.map((d) => fromSnapshot(d.id, d.data()));
}

/**
 * Organizer-only attendee list for one event — a safe "organizerUid ==
 * caller" same-document query, two plain equality filters with no
 * orderBy, which Firestore can serve from its automatic single-field
 * indexes without a composite index. Sorted client-side by response
 * time instead of via orderBy() specifically to avoid needing a new
 * composite index for what is always a small, per-event, capacity-
 * bounded list.
 */
export async function listEventAttendees(eventId: string, organizerUid: string): Promise<EventRsvp[]> {
  const snapshot = await getDocs(
    query(rsvpsCollection(), where('eventId', '==', eventId), where('organizerUid', '==', organizerUid)),
  );
  return snapshot.docs
    .map((d: QueryDocumentSnapshot<DocumentData>) => fromSnapshot(d.id, d.data()))
    .sort((a, b) => (a.respondedAt?.getTime() ?? 0) - (b.respondedAt?.getTime() ?? 0));
}
