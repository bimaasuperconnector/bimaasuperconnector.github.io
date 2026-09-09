import {
  type DocumentData,
  type Unsubscribe,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../init';
import type { FeedbackSentiment } from '../../lib/connectionMeter';

export interface MatchParticipantRecord {
  matchId: string;
  uid: string;
  cycleId: string;
  otherParticipantUids: string[];
}

export interface FeedbackRecord {
  matchId: string;
  fromUid: string;
  aboutUid: string;
  cycleId: string;
  sentiment: FeedbackSentiment;
}

function matchParticipantDocRef(matchId: string, uid: string) {
  if (!db) throw new Error('Firestore is not configured.');
  return doc(db, 'matchParticipants', `${matchId}_${uid}`);
}

function matchParticipantsCollection() {
  if (!db) throw new Error('Firestore is not configured.');
  return collection(db, 'matchParticipants');
}

/**
 * Discovers every match the caller has ever been part of, via the
 * `where('uid', '==', uid)` query the widened matchParticipants list
 * rule relies on (see firestore.rules). This is how the feedback flow
 * finds "who should I be asked about," rather than needing Phase 7 to
 * separately hand the member their matchId via a notification.
 */
export async function listOwnMatchParticipants(uid: string): Promise<MatchParticipantRecord[]> {
  const snapshot = await getDocs(query(matchParticipantsCollection(), where('uid', '==', uid)));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      matchId: data.matchId,
      uid: data.uid,
      cycleId: data.cycleId,
      otherParticipantUids: Array.isArray(data.otherParticipantUids) ? data.otherParticipantUids : [],
    };
  });
}

function feedbackDocRef(matchId: string, fromUid: string, aboutUid: string) {
  if (!db) throw new Error('Firestore is not configured.');
  return doc(db, 'feedback', `${matchId}_${fromUid}_${aboutUid}`);
}

/**
 * Reads the caller's own match assignment for one specific match. In
 * practice, `listOwnMatchParticipants` (above) is how the feedback flow
 * discovers WHICH matches to look at; this is for fetching one by ID
 * once known.
 */
export async function getOwnMatchParticipant(
  matchId: string,
  uid: string,
): Promise<MatchParticipantRecord | null> {
  const snapshot = await getDoc(matchParticipantDocRef(matchId, uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    matchId,
    uid,
    cycleId: data.cycleId,
    otherParticipantUids: Array.isArray(data.otherParticipantUids) ? data.otherParticipantUids : [],
  };
}

export function subscribeToFeedback(
  matchId: string,
  fromUid: string,
  aboutUid: string,
  onChange: (record: FeedbackRecord | null) => void,
): Unsubscribe {
  return onSnapshot(feedbackDocRef(matchId, fromUid, aboutUid), (snapshot) => {
    if (!snapshot.exists()) {
      onChange(null);
      return;
    }
    const data: DocumentData = snapshot.data();
    onChange({
      matchId,
      fromUid,
      aboutUid,
      cycleId: data.cycleId,
      sentiment: data.sentiment,
    });
  });
}

/**
 * Submits (or updates) feedback about one other participant in one
 * match. Firestore Rules independently verify the caller actually has a
 * matchParticipants record for this matchId listing `aboutUid` among
 * `otherParticipantUids` — a client cannot leave feedback about someone
 * it was never matched with, no matter what this function is called
 * with.
 */
export async function submitFeedback(
  matchId: string,
  fromUid: string,
  aboutUid: string,
  cycleId: string,
  sentiment: FeedbackSentiment,
): Promise<void> {
  const ref = feedbackDocRef(matchId, fromUid, aboutUid);
  const existing = await getDoc(ref);
  const payload: Record<string, unknown> = {
    matchId,
    fromUid,
    aboutUid,
    cycleId,
    sentiment,
    updatedAt: serverTimestamp(),
  };
  if (!existing.exists()) {
    payload.createdAt = serverTimestamp();
  }
  await setDoc(ref, payload, { merge: true });
}
