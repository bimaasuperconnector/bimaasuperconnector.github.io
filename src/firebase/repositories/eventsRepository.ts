import {
  type DocumentData,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../init';
import {
  type EventFormat,
  type EventStatus,
  type EventTargetType,
  type EventTargeting,
} from '../../lib/events';

export interface EventFormFields {
  title: string;
  description: string;
  format: EventFormat;
  location: string;
  virtualNote: string;
  startTime: Date;
  endTime: Date;
  rsvpDeadline: Date | null;
  capacity: number | null;
}

export interface AlumniEvent extends EventFormFields, EventTargeting {
  id: string;
  organizerUid: string;
  organizerDisplayName: string;
  status: EventStatus;
  createdAt: Date | null;
  /** Automation-only (see automation/src/eventsCalendarJob.ts). Never written by this repository. */
  calendarEventHtmlLink: string | null;
  meetLink: string | null;
}

const CREATE_ALLOWED_FIELDS = [
  'organizerUid',
  'organizerDisplayName',
  'title',
  'description',
  'format',
  'location',
  'virtualNote',
  'startTime',
  'endTime',
  'rsvpDeadline',
  'capacity',
  'targetType',
  'targetBatchNumbers',
  'targetCityLower',
  'targetUids',
  'status',
  'createdAt',
  'updatedAt',
] as const;

/** Fields an organizer's edit may touch — mirrors firestore.rules' update diff().affectedKeys() allow-list exactly. Organizer/targeting fields and anything automation writes (calendarEventId etc.) are structurally untouched by this call. */
const EDIT_ALLOWED_FIELDS = [
  'title',
  'description',
  'format',
  'location',
  'virtualNote',
  'startTime',
  'endTime',
  'rsvpDeadline',
  'capacity',
  'status',
  'updatedAt',
] as const;

function eventsCollection() {
  if (!db) throw new Error('Firestore is not configured.');
  return collection(db, 'events');
}

function eventDocRef(id: string) {
  if (!db) throw new Error('Firestore is not configured.');
  return doc(db, 'events', id);
}

function fromSnapshot(id: string, data: DocumentData): AlumniEvent {
  return {
    id,
    organizerUid: data.organizerUid,
    organizerDisplayName: data.organizerDisplayName ?? '',
    title: data.title ?? '',
    description: data.description ?? '',
    format: data.format ?? 'virtual',
    location: data.location ?? '',
    virtualNote: data.virtualNote ?? '',
    startTime: data.startTime?.toDate?.() ?? new Date(),
    endTime: data.endTime?.toDate?.() ?? new Date(),
    rsvpDeadline: data.rsvpDeadline?.toDate?.() ?? null,
    capacity: typeof data.capacity === 'number' ? data.capacity : null,
    targetType: (data.targetType as EventTargetType) ?? 'everyone',
    targetBatchNumbers: Array.isArray(data.targetBatchNumbers) ? data.targetBatchNumbers : [],
    targetCityLower: data.targetCityLower ?? '',
    targetUids: Array.isArray(data.targetUids) ? data.targetUids : [],
    status: (data.status as EventStatus) ?? 'scheduled',
    createdAt: data.createdAt?.toDate?.() ?? null,
    calendarEventHtmlLink: data.calendarEventHtmlLink ?? null,
    meetLink: data.meetLink ?? null,
  };
}

function toTimestampOrNull(value: Date | null) {
  return value ? Timestamp.fromDate(value) : null;
}

/**
 * Creates a new event. `targeting` picks exactly one of
 * batch/city/selected (or 'everyone', which needs none) — see
 * isValidEventTargeting in src/lib/events.ts, mirrored in
 * firestore.rules' isValidEventTargeting(). The organizer is always
 * the signed-in caller; Rules independently enforce this regardless of
 * what this function sends.
 */
export async function createEvent(
  user: FirebaseUser,
  fields: EventFormFields,
  targeting: EventTargeting,
): Promise<string> {
  const payload: Record<string, unknown> = {
    organizerUid: user.uid,
    organizerDisplayName: user.displayName ?? '',
    ...fields,
    startTime: Timestamp.fromDate(fields.startTime),
    endTime: Timestamp.fromDate(fields.endTime),
    rsvpDeadline: toTimestampOrNull(fields.rsvpDeadline),
    targetType: targeting.targetType,
    targetBatchNumbers: targeting.targetBatchNumbers,
    targetCityLower: targeting.targetCityLower,
    targetUids: targeting.targetUids,
    status: 'scheduled',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const unexpected = Object.keys(payload).filter((k) => !CREATE_ALLOWED_FIELDS.includes(k as never));
  if (unexpected.length > 0) {
    throw new Error(`Unexpected event fields: ${unexpected.join(', ')}`);
  }

  const ref = doc(eventsCollection());
  await setDoc(ref, payload);
  return ref.id;
}

/** Organizer edit — see EDIT_ALLOWED_FIELDS above; targeting/organizer fields are immutable after creation by design (create a new event to re-target). */
export async function updateEvent(eventId: string, fields: EventFormFields): Promise<void> {
  const payload: Record<string, unknown> = {
    ...fields,
    startTime: Timestamp.fromDate(fields.startTime),
    endTime: Timestamp.fromDate(fields.endTime),
    rsvpDeadline: toTimestampOrNull(fields.rsvpDeadline),
    updatedAt: serverTimestamp(),
  };
  const unexpected = Object.keys(payload).filter((k) => !EDIT_ALLOWED_FIELDS.includes(k as never));
  if (unexpected.length > 0) {
    throw new Error(`Unexpected event edit fields: ${unexpected.join(', ')}`);
  }
  await updateDoc(eventDocRef(eventId), payload);
}

/** Cancels without deleting — preserves the RSVP list/history and lets the automation calendar job cancel the real Calendar event on its next run. Prefer this over deleteEvent once RSVPs exist. */
export async function cancelEvent(eventId: string): Promise<void> {
  await updateDoc(eventDocRef(eventId), { status: 'cancelled', updatedAt: serverTimestamp() });
}

/** Full removal — the organizer/admin path Rules allow unconditionally (same posture as jobs.delete). The UI should steer toward cancelEvent() once RSVPs exist; this is intentionally not blocked at the Rules layer, since Rules can't cheaply check "are there zero RSVPs" without a count query. */
export async function deleteEvent(eventId: string): Promise<void> {
  await deleteDoc(eventDocRef(eventId));
}

export async function getEvent(eventId: string): Promise<AlumniEvent | null> {
  const snapshot = await getDoc(eventDocRef(eventId));
  return snapshot.exists() ? fromSnapshot(eventId, snapshot.data()) : null;
}

// --- Visibility-scoped queries ---
//
// Firestore has no native OR across different fields the way this
// needs (an event is visible via exactly one of four different
// targeting shapes). Rather than one combined query, this runs one
// safe indexed query PER targeting shape the viewer could match
// (mirroring firestore.rules' canSeeEvent() OR branches), plus one for
// events the viewer organizes themselves, then merges and dedupes
// client-side. Each individual query is a plain equality/array-contains
// + orderBy(startTime) — see firestore.indexes.json for the composite
// indexes this relies on. Bounded per query (not truly unbounded) —
// this project's alumni-event volume is expected to stay small; a
// per-query cap this generous is a deliberate scale assumption,
// documented rather than silently relied on (same posture as Phase 8's
// calendar-job scan-scope note).
const VISIBLE_EVENTS_PAGE_SIZE = 50;

export interface VisibleEventsViewer {
  uid: string;
  batchNumber: number | null;
  locationLower: string;
}

export async function queryVisibleEvents(viewer: VisibleEventsViewer): Promise<AlumniEvent[]> {
  const col = eventsCollection();
  const queries = [
    query(col, where('targetType', '==', 'everyone'), orderBy('startTime', 'asc'), fsLimit(VISIBLE_EVENTS_PAGE_SIZE)),
    query(col, where('organizerUid', '==', viewer.uid), orderBy('startTime', 'desc'), fsLimit(VISIBLE_EVENTS_PAGE_SIZE)),
  ];
  if (viewer.batchNumber != null) {
    queries.push(
      query(
        col,
        where('targetType', '==', 'batch'),
        where('targetBatchNumbers', 'array-contains', viewer.batchNumber),
        orderBy('startTime', 'asc'),
        fsLimit(VISIBLE_EVENTS_PAGE_SIZE),
      ),
    );
  }
  if (viewer.locationLower) {
    queries.push(
      query(
        col,
        where('targetType', '==', 'city'),
        where('targetCityLower', '==', viewer.locationLower),
        orderBy('startTime', 'asc'),
        fsLimit(VISIBLE_EVENTS_PAGE_SIZE),
      ),
    );
  }
  queries.push(
    query(
      col,
      where('targetType', '==', 'selected'),
      where('targetUids', 'array-contains', viewer.uid),
      orderBy('startTime', 'asc'),
      fsLimit(VISIBLE_EVENTS_PAGE_SIZE),
    ),
  );

  const snapshots = await Promise.all(queries.map((q) => getDocs(q)));
  const byId = new Map<string, AlumniEvent>();
  for (const snapshot of snapshots) {
    for (const docSnap of snapshot.docs) {
      byId.set(docSnap.id, fromSnapshot(docSnap.id, docSnap.data()));
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

/** Confirmed-attendee count for one event — a single count() aggregation, not a document download. See computeAvailability() in src/lib/events.ts for the accepted race-condition caveat this implies at RSVP time. */
export async function countAttending(eventId: string): Promise<number> {
  if (!db) throw new Error('Firestore is not configured.');
  const snapshot = await getCountFromServer(
    query(collection(db, 'eventRsvps'), where('eventId', '==', eventId), where('status', '==', 'attending')),
  );
  return snapshot.data().count;
}
