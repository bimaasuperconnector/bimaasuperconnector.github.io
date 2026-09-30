import {
  type DocumentData,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../init';
import type { RegistrationMode, RegistrationSlot } from '../../lib/cycles';

export interface Registration {
  uid: string;
  cycleId: string;
  slot: RegistrationSlot;
  mode: RegistrationMode;
}

function registrationDocRef(cycleId: string, uid: string) {
  if (!db) throw new Error('Firestore is not configured.');
  return doc(db, 'connectionRegistrations', `${cycleId}_${uid}`);
}

function fromSnapshot(data: DocumentData): Registration {
  return {
    uid: data.uid,
    cycleId: data.cycleId,
    slot: data.slot,
    mode: data.mode,
  };
}

export async function getOwnRegistration(
  cycleId: string,
  uid: string,
): Promise<Registration | null> {
  const snapshot = await getDoc(registrationDocRef(cycleId, uid));
  return snapshot.exists() ? fromSnapshot(snapshot.data()) : null;
}

/**
 * Create-or-update the caller's own registration for one cycle. The
 * document ID is deterministically `${cycleId}_${uid}` — Firestore Rules
 * independently verify this matches the document's own `cycleId`/`uid`
 * fields, so a client can't register itself under someone else's uid or
 * smuggle a mismatched cycleId into the ID.
 *
 * Quota: the SuperConnector page has already read this registration when
 * it opened, so it passes `alreadyRegistered` and this becomes a single
 * write with no extra read. Callers that don't know fall back to one
 * getDoc to decide whether `createdAt` should be set.
 */
export async function saveOwnRegistration(
  uid: string,
  cycleId: string,
  slot: RegistrationSlot,
  mode: RegistrationMode,
  alreadyRegistered?: boolean,
): Promise<void> {
  const ref = registrationDocRef(cycleId, uid);
  const exists = alreadyRegistered ?? (await getDoc(ref)).exists();
  const payload: Record<string, unknown> = {
    uid,
    cycleId,
    slot,
    mode,
    updatedAt: serverTimestamp(),
  };
  if (!exists) {
    payload.createdAt = serverTimestamp();
  }
  await setDoc(ref, payload, { merge: true });
}

export async function withdrawOwnRegistration(cycleId: string, uid: string): Promise<void> {
  await deleteDoc(registrationDocRef(cycleId, uid));
}
