import {
  type DocumentData,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../init';
import type { ContactVisibleMap } from './profilesRepository';

/**
 * Private contact channels + date of birth. See firestore.rules'
 * `profileContacts/{uid}` block: this document is readable ONLY by its
 * own owner — not even an admin can read it. DOB in particular is
 * collected purely for a future "Happy Birthday" automation (Admin SDK,
 * bypasses these Rules entirely) — per the explicit product
 * requirement, it must never be shown to anyone, including in this
 * app's own UI.
 */
export interface ProfileContact {
  /** ISO date string 'YYYY-MM-DD', or null if not provided. Never shown to anyone else. */
  dob: string | null;
  phoneNumber: string;
  whatsappNumber: string;
  contactEmail: string;
  linkedinUrl: string;
  visibility: {
    phone: boolean;
    whatsapp: boolean;
    email: boolean;
    linkedin: boolean;
  };
}

export function emptyProfileContact(): ProfileContact {
  return {
    dob: null,
    phoneNumber: '',
    whatsappNumber: '',
    contactEmail: '',
    linkedinUrl: '',
    visibility: { phone: false, whatsapp: false, email: false, linkedin: false },
  };
}

const ALLOWED_FIELDS = [
  'uid',
  'dob',
  'phoneNumber',
  'whatsappNumber',
  'contactEmail',
  'linkedinUrl',
  'visibility',
  'createdAt',
  'updatedAt',
] as const;

function contactDocRef(uid: string) {
  if (!db) throw new Error('Firestore is not configured.');
  return doc(db, 'profileContacts', uid);
}

function profileDocRef(uid: string) {
  if (!db) throw new Error('Firestore is not configured.');
  return doc(db, 'profiles', uid);
}

function fromSnapshot(data: DocumentData): ProfileContact {
  return {
    dob: typeof data.dob === 'string' ? data.dob : null,
    phoneNumber: data.phoneNumber ?? '',
    whatsappNumber: data.whatsappNumber ?? '',
    contactEmail: data.contactEmail ?? '',
    linkedinUrl: data.linkedinUrl ?? '',
    visibility: {
      phone: data.visibility?.phone === true,
      whatsapp: data.visibility?.whatsapp === true,
      email: data.visibility?.email === true,
      linkedin: data.visibility?.linkedin === true,
    },
  };
}

/** Owner-only read — used by the Profile edit page only (never Directory/Open to Work, which read the profiles/{uid}.contactVisible subset instead). */
export async function getOwnProfileContact(uid: string): Promise<ProfileContact | null> {
  const snapshot = await getDoc(contactDocRef(uid));
  return snapshot.exists() ? fromSnapshot(snapshot.data()) : null;
}

/** Builds the public-safe subset that gets denormalized onto profiles/{uid}.contactVisible — a key is present ONLY for a channel the owner has switched on. */
function buildVisibleMap(contact: ProfileContact): ContactVisibleMap {
  const map: ContactVisibleMap = {};
  if (contact.visibility.phone && contact.phoneNumber.trim()) map.phone = contact.phoneNumber.trim();
  if (contact.visibility.whatsapp && contact.whatsappNumber.trim())
    map.whatsapp = contact.whatsappNumber.trim();
  if (contact.visibility.email && contact.contactEmail.trim()) map.email = contact.contactEmail.trim();
  if (contact.visibility.linkedin && contact.linkedinUrl.trim()) map.linkedin = contact.linkedinUrl.trim();
  return map;
}

/**
 * Writes BOTH the private `profileContacts/{uid}` document and the
 * public-safe `contactVisible` subset on `profiles/{uid}`, in a single
 * atomic batch (one network round trip, two document writes — no more
 * than a plain two-write save would cost, and this only ever runs when
 * the OWNER edits their own contact settings, never per profile viewed,
 * so it doesn't scale with how many of the 5,000 members look at this
 * profile). Requires a `profiles/{uid}` document to already exist
 * (created via `saveOwnProfile` first) since this only patches it.
 */
export async function saveOwnProfileContact(uid: string, contact: ProfileContact): Promise<void> {
  const payload: Record<string, unknown> = {
    uid,
    ...contact,
    updatedAt: serverTimestamp(),
  };

  const existing = await getDoc(contactDocRef(uid));
  if (!existing.exists()) {
    payload.createdAt = serverTimestamp();
  }

  const unexpected = Object.keys(payload).filter((k) => !ALLOWED_FIELDS.includes(k as never));
  if (unexpected.length > 0) {
    throw new Error(`Unexpected contact fields: ${unexpected.join(', ')}`);
  }

  const batch = writeBatch(db!);
  batch.set(contactDocRef(uid), payload, { merge: true });
  batch.set(
    profileDocRef(uid),
    { contactVisible: buildVisibleMap(contact), updatedAt: serverTimestamp() },
    { merge: true },
  );
  await batch.commit();
}
