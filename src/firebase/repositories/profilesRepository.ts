import {
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  collection,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../init';

export interface OrganizationEntry {
  name: string;
  title: string;
  startYear: number | null;
  /** null = current organization */
  endYear: number | null;
  /**
   * Marks this organization as founded/owned by the member. Phase 12
   * (Entrepreneurship & organization history) reads this flag across all
   * profiles to build entrepreneurship views — organization history is
   * the source of truth, per FEATURE_SUPERCONNECTOR.md Phase 12.
   */
  isFounder: boolean;
}

export interface EducationEntry {
  institution: string;
  degree: string;
  field: string;
  endYear: number | null;
}

export interface ProfileLinks {
  linkedin: string;
  website: string;
}

export const NETWORKING_PURPOSES = [
  'mentorship',
  'job_search',
  'hiring',
  'collaboration',
  'industry_insights',
  'reconnecting',
] as const;
export type NetworkingPurpose = (typeof NETWORKING_PURPOSES)[number];

export const NETWORKING_PURPOSE_LABELS: Record<NetworkingPurpose, string> = {
  mentorship: 'Mentorship',
  job_search: 'Job searching',
  hiring: 'Hiring / recruiting',
  collaboration: 'Collaboration / co-founder search',
  industry_insights: 'Industry insights',
  reconnecting: 'Just reconnecting',
};

/** Fields the profile owner edits directly. */
export interface ProfileFormFields {
  batchNumber: number | null;
  headline: string;
  bio: string;
  location: string;
  organizations: OrganizationEntry[];
  education: EducationEntry[];
  skills: string[];
  interests: string[];
  /**
   * Phase 5 schema addition: why this member wants to connect. Added
   * specifically because the matching engine's "networking purpose"
   * factor (15% weight) had nothing to read otherwise — see the Phase 5
   * chat response and completion log for the full reasoning. A small,
   * fixed, owner-adjustable taxonomy (NETWORKING_PURPOSES above), not
   * free text, so it stays usable as a matching signal.
   */
  networkingPurpose: NetworkingPurpose[];
  links: ProfileLinks;
  isComplete: boolean;
  /**
   * Phase 10 addition: member-controlled toggle, per
   * FEATURE_SUPERCONNECTOR.md's Phase 10 spec ("Member-controlled toggle
   * and filters. Never expose hidden Connection Meter."). The
   * Connection Meter constraint is satisfied structurally — it isn't
   * part of Profile at all, it lives in the fully admin-only
   * `connectionMeters` collection (Phase 6) — nothing here touches
   * that boundary.
   */
  openToWork: boolean;
  /** Desired role types, e.g. "Product Manager", "Backend Engineer" — a tag array, same pattern as skills/interests. Only meaningful when openToWork is true. */
  openToWorkRoles: string[];
  /** Optional free-text note, e.g. availability or constraints. */
  openToWorkNote: string;
}

/**
 * Full stored/read shape. Includes denormalized fields written
 * automatically by `saveOwnProfile` (never edited directly by the form):
 * `displayName`/`photoURL` (mirrored from the Google account so the
 * Directory never has to read the access-restricted `users` collection),
 * lowercase copies for case-insensitive matching, and a couple of derived
 * fields that make common Directory filters a single indexed query
 * instead of a client-side scan. See ARCHITECTURE.md: "Claude may refine
 * this schema when implementing phases, but must document schema
 * changes" — this is that documentation; see the Phase 3 completion log
 * in FEATURE_SUPERCONNECTOR.md for the full rationale.
 */
export interface Profile extends ProfileFormFields {
  uid: string;
  displayName: string;
  displayNameLower: string;
  photoURL: string | null;
  locationLower: string;
  skillsLower: string[];
  interestsLower: string[];
  /** true if any organizations[] entry has isFounder: true. Powers the "Entrepreneurs" directory filter without an array-of-maps query. */
  hasFounderOrg: boolean;
  /** Denormalized from the organizations entry with endYear === null, for card display and same-page refine — not itself queried. */
  currentOrganizationName: string;
  currentTitle: string;
}

const ALLOWED_TOP_LEVEL_FIELDS = [
  'uid',
  'displayName',
  'displayNameLower',
  'photoURL',
  'batchNumber',
  'headline',
  'bio',
  'location',
  'locationLower',
  'organizations',
  'education',
  'skills',
  'skillsLower',
  'interests',
  'interestsLower',
  'networkingPurpose',
  'links',
  'isComplete',
  'openToWork',
  'openToWorkRoles',
  'openToWorkNote',
  'hasFounderOrg',
  'currentOrganizationName',
  'currentTitle',
  'approved',
  'createdAt',
  'updatedAt',
] as const;

function profileDocRef(uid: string) {
  if (!db) throw new Error('Firestore is not configured.');
  return doc(db, 'profiles', uid);
}

function profilesCollection() {
  if (!db) throw new Error('Firestore is not configured.');
  return collection(db, 'profiles');
}

function fromSnapshot(uid: string, data: DocumentData): Profile {
  return {
    uid,
    displayName: data.displayName ?? '',
    displayNameLower: data.displayNameLower ?? '',
    photoURL: data.photoURL ?? null,
    batchNumber: typeof data.batchNumber === 'number' ? data.batchNumber : null,
    headline: data.headline ?? '',
    bio: data.bio ?? '',
    location: data.location ?? '',
    locationLower: data.locationLower ?? '',
    organizations: Array.isArray(data.organizations) ? data.organizations : [],
    education: Array.isArray(data.education) ? data.education : [],
    skills: Array.isArray(data.skills) ? data.skills : [],
    skillsLower: Array.isArray(data.skillsLower) ? data.skillsLower : [],
    interests: Array.isArray(data.interests) ? data.interests : [],
    interestsLower: Array.isArray(data.interestsLower) ? data.interestsLower : [],
    networkingPurpose: Array.isArray(data.networkingPurpose) ? data.networkingPurpose : [],
    links: {
      linkedin: data.links?.linkedin ?? '',
      website: data.links?.website ?? '',
    },
    isComplete: data.isComplete === true,
    openToWork: data.openToWork === true,
    openToWorkRoles: Array.isArray(data.openToWorkRoles) ? data.openToWorkRoles : [],
    openToWorkNote: data.openToWorkNote ?? '',
    hasFounderOrg: data.hasFounderOrg === true,
    currentOrganizationName: data.currentOrganizationName ?? '',
    currentTitle: data.currentTitle ?? '',
  };
}

export function emptyProfile(uid: string): Profile {
  return {
    uid,
    displayName: '',
    displayNameLower: '',
    photoURL: null,
    batchNumber: null,
    headline: '',
    bio: '',
    location: '',
    locationLower: '',
    organizations: [],
    education: [],
    skills: [],
    skillsLower: [],
    interests: [],
    interestsLower: [],
    networkingPurpose: [],
    links: { linkedin: '', website: '' },
    isComplete: false,
    openToWork: false,
    openToWorkRoles: [],
    openToWorkNote: '',
    hasFounderOrg: false,
    currentOrganizationName: '',
    currentTitle: '',
  };
}

export async function getProfile(uid: string): Promise<Profile | null> {
  const snapshot = await getDoc(profileDocRef(uid));
  return snapshot.exists() ? fromSnapshot(uid, snapshot.data()) : null;
}

export function subscribeToProfile(
  uid: string,
  onChange: (profile: Profile | null) => void,
): Unsubscribe {
  return onSnapshot(profileDocRef(uid), (snapshot) => {
    onChange(snapshot.exists() ? fromSnapshot(uid, snapshot.data()) : null);
  });
}

/**
 * Create-or-update, always scoped to the caller's own uid by Firestore
 * Rules (see firestore.rules). Takes the signed-in `FirebaseUser` (not
 * just a uid) so `displayName`/`photoURL` can be mirrored from the Google
 * account automatically — the form never edits those two fields itself.
 * `ALLOWED_TOP_LEVEL_FIELDS` mirrors the field allow-list enforced in
 * firestore.rules as a client-side sanity check, not the security
 * boundary.
 */
export async function saveOwnProfile(user: FirebaseUser, fields: ProfileFormFields): Promise<void> {
  const uid = user.uid;
  const existing = await getDoc(profileDocRef(uid));

  const currentOrg = fields.organizations.find((org) => org.endYear === null);
  const payload: Record<string, unknown> = {
    uid,
    displayName: user.displayName ?? '',
    displayNameLower: (user.displayName ?? '').toLowerCase(),
    photoURL: user.photoURL ?? null,
    ...fields,
    locationLower: fields.location.toLowerCase(),
    skillsLower: fields.skills.map((s) => s.toLowerCase()),
    interestsLower: fields.interests.map((s) => s.toLowerCase()),
    hasFounderOrg: fields.organizations.some((org) => org.isFounder),
    currentOrganizationName: currentOrg?.name ?? '',
    currentTitle: currentOrg?.title ?? '',
    // Denormalized so directory list/get rules can be a cheap
    // same-document check instead of a cross-collection lookup. Always
    // true here — the create/update rules already independently require
    // callerIsApproved() (or admin) before this write is even allowed —
    // see firestore.rules for the known staleness tradeoff this implies.
    approved: true,
    updatedAt: serverTimestamp(),
  };
  if (!existing.exists()) {
    payload.createdAt = serverTimestamp();
  }

  const keys = Object.keys(payload);
  const unexpected = keys.filter((key) => !ALLOWED_TOP_LEVEL_FIELDS.includes(key as never));
  if (unexpected.length > 0) {
    throw new Error(`Unexpected profile fields: ${unexpected.join(', ')}`);
  }

  await setDoc(profileDocRef(uid), payload, { merge: true });
}

// --- Directory querying (Phase 3) ---
//
// Firestore has no full-text search. Each mode below drives exactly ONE
// server-side indexed query (equality, array-contains, or a prefix range
// on the SAME field used for ordering) so the set of required composite
// indexes stays small and predictable — see firestore.indexes.json.
// Combining two driving filters at once (e.g. batch + skill) is
// intentionally not supported in this phase; it would multiply the
// number of composite indexes needed for every combination.

export type DirectoryMode =
  | 'all'
  | 'batch'
  | 'name'
  | 'location'
  | 'skill'
  | 'interest'
  | 'founders'
  | 'openToWork';

export interface DirectoryQueryOptions {
  mode: DirectoryMode;
  /** Required for 'batch' (batch number), 'name'/'location' (prefix text), 'skill'/'interest' (exact tag, case-insensitive). Unused for 'all'/'founders'. */
  value?: string | number;
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
}

export interface DirectoryPage {
  profiles: Profile[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

const DEFAULT_PAGE_SIZE = 24;

export async function queryDirectory(options: DirectoryQueryOptions): Promise<DirectoryPage> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const col = profilesCollection();
  const constraints = [];

  switch (options.mode) {
    case 'batch':
      constraints.push(where('batchNumber', '==', Number(options.value)));
      constraints.push(orderBy('displayNameLower'));
      break;
    case 'founders':
      constraints.push(where('hasFounderOrg', '==', true));
      constraints.push(orderBy('displayNameLower'));
      break;
    case 'openToWork':
      // Closes the gap Phase 3 explicitly deferred ("Open to Work has
      // no filter because that feature is Phase 10 — the underlying
      // data doesn't exist yet"). Same safe pattern as 'founders': a
      // plain indexed equality filter, not a cross-collection lookup.
      constraints.push(where('openToWork', '==', true));
      constraints.push(orderBy('displayNameLower'));
      break;
    case 'skill':
      constraints.push(where('skillsLower', 'array-contains', String(options.value).toLowerCase()));
      constraints.push(orderBy('displayNameLower'));
      break;
    case 'interest':
      constraints.push(
        where('interestsLower', 'array-contains', String(options.value).toLowerCase()),
      );
      constraints.push(orderBy('displayNameLower'));
      break;
    case 'name': {
      const prefix = String(options.value ?? '').toLowerCase();
      constraints.push(orderBy('displayNameLower'));
      constraints.push(where('displayNameLower', '>=', prefix));
      constraints.push(where('displayNameLower', '<', prefix + '\uf8ff'));
      break;
    }
    case 'location': {
      const prefix = String(options.value ?? '').toLowerCase();
      constraints.push(orderBy('locationLower'));
      constraints.push(where('locationLower', '>=', prefix));
      constraints.push(where('locationLower', '<', prefix + '\uf8ff'));
      break;
    }
    case 'all':
    default:
      constraints.push(orderBy('displayNameLower'));
      break;
  }

  if (options.cursor) {
    constraints.push(startAfter(options.cursor));
  }
  // Request one extra document so we know whether a next page exists
  // without a separate count query.
  constraints.push(fsLimit(pageSize + 1));

  const snapshot = await getDocs(query(col, ...constraints));
  const docs = snapshot.docs.slice(0, pageSize);
  const hasMore = snapshot.docs.length > pageSize;

  return {
    profiles: docs.map((d) => fromSnapshot(d.id, d.data())),
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore,
  };
}
