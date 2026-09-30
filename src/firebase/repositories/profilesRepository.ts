import {
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
  deleteDoc,
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
import { normalizeCity, normalizeCityLower } from '../../lib/geography';

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
  /**
   * Only meaningful when isFounder is true. The venture's website plus any
   * extra handles (LinkedIn, X/Twitter, Instagram…) the founder chose to add
   * by hand. Stored on the organization entry itself (no new collection), so
   * the Entrepreneurship page gets them from the profile it already fetched:
   * zero extra Firestore reads.
   */
  website?: string;
  handles?: OrganizationHandle[];
}

export interface OrganizationHandle {
  /** One of HANDLE_PLATFORMS ids. */
  platform: string;
  url: string;
}

export const HANDLE_PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'twitter', label: 'X / Twitter' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'github', label: 'GitHub' },
  { id: 'other', label: 'Other' },
] as const;

export const MAX_ORG_HANDLES = 6;

/** Adds https:// when a link was typed without a scheme; blocks non-http(s) schemes. */
export function toSafeHref(raw: string | undefined): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return ''; // javascript:, data:, mailto: etc.
  return `https://${value}`;
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

/**
 * The four contact channels a member can optionally reveal to fellow
 * alumni. Keys present here are exactly the channels currently visible
 * to other members — see profileContactsRepository.ts, which owns the
 * raw values + per-channel visibility toggles in the separate,
 * owner-only `profileContacts/{uid}` document. This map is the
 * PUBLIC-safe subset denormalized onto the profile itself so Directory/
 * Open to Work cards can render a contact button at zero extra
 * Firestore read cost (the profile doc is already being fetched for
 * every card shown) instead of an extra per-profile-viewed read.
 */
export interface ContactVisibleMap {
  phone?: string;
  whatsapp?: string;
  email?: string;
  linkedin?: string;
}

/**
 * A badge a member has chosen to display on their profile — denormalized
 * (id + the badge's name/colorKey AT THE TIME IT WAS SELECTED) directly
 * onto profiles/{uid} so Directory/Open to Work/Entrepreneurship cards
 * can render badge chips at zero extra Firestore read cost, the same
 * "denormalize onto the profile doc already being fetched" pattern used
 * throughout this project (currentOrganizationName, hasFounderOrg,
 * contactVisible). The badge catalog itself lives in badges/{badgeId}
 * (see badgesRepository.ts) and is only read on the Profile edit page,
 * to power the picker. If a super_admin later renames a badge, an
 * already-selected member's card shows the old name until they next
 * resave their profile — the same self-healing-on-next-save tradeoff
 * this project has accepted for every other denormalized field.
 */
export interface ProfileBadgeRef {
  id: string;
  name: string;
  colorKey: string;
}

export const MAX_PROFILE_BADGES = 5;

/** Fields the profile owner edits directly. */
export interface ProfileFormFields {
  /**
   * Phase 2/11 revision (2026-09-13): a real, owner-editable name field —
   * fixes both the "Unnamed alum" bug (this could previously go blank
   * if the Firebase Auth displayName was ever empty) and the lack of
   * any way to update a name after e.g. marriage. Seeded once from the
   * onboarding name (`users/{uid}.displayName`, which is immutable
   * after onboarding) the first time a profile is created, then fully
   * owner-controlled from then on — no longer silently overwritten
   * from the Google account's live displayName on every save.
   */
  displayName: string;
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
  /** Up to MAX_PROFILE_BADGES badges the member has chosen to display — see ProfileBadgeRef above. */
  badges: ProfileBadgeRef[];
  /**
   * ImageKit-hosted profile photo (2026-09-27 addition). Owner-uploaded,
   * via ProfilePhotoUpload.tsx — replaces the old "always mirrored from
   * the live Google account photoURL" behavior from Phase 0/saveOwnProfile.
   * `photoURL` is the public delivery URL (safe to read/display
   * anywhere); `photoFileId` is ImageKit's internal file identifier,
   * kept so a replace/remove can ask the Cloudflare Worker to delete the
   * previous asset. Both null until the member uploads a photo, in
   * which case the Profile page falls back to the Google account photo
   * for display only (never stored here).
   */
  photoURL: string | null;
  photoFileId: string | null;
}

/**
 * Full stored/read shape. `displayName` is owner-edited (see
 * ProfileFormFields above); everything else here is denormalized and
 * written automatically by `saveOwnProfile`: `photoURL` (mirrored from
 * the Google account — there's no separate upload flow, see Phase 0's
 * Storage decision), lowercase copies for case-insensitive matching,
 * `contactVisible` (see ContactVisibleMap above), and a couple of
 * derived fields that make common Directory filters a single indexed
 * query instead of a client-side scan. See ARCHITECTURE.md: "Claude may
 * refine this schema when implementing phases, but must document schema
 * changes" — this is that documentation; see the Phase 3 completion log
 * in FEATURE_SUPERCONNECTOR.md for the full rationale.
 */
export interface Profile extends ProfileFormFields {
  uid: string;
  displayNameLower: string;
  locationLower: string;
  /**
   * Phase 14 addition: `location` normalized against a controlled
   * reference table (src/lib/geography.ts) so "Bangalore" and
   * "Bengaluru" collapse to one canonical value — used for
   * communication-segment resolution (city segments) and for matching
   * Phase 13 event city-targeting against a viewer's profile, without
   * changing the existing free-text `location`/`locationLower` fields
   * Directory's location-prefix search already relies on. See
   * FEATURE_SUPERCONNECTOR.md's Phase 14 entry for the full rationale.
   */
  cityCanonical: string;
  cityCanonicalLower: string;
  skillsLower: string[];
  interestsLower: string[];
  /** true if any organizations[] entry has isFounder: true. Powers the "Entrepreneurs" directory filter without an array-of-maps query. */
  hasFounderOrg: boolean;
  /** Denormalized from the organizations entry with endYear === null, for card display and same-page refine — not itself queried. */
  currentOrganizationName: string;
  currentTitle: string;
  contactVisible: ContactVisibleMap;
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
  'cityCanonical',
  'cityCanonicalLower',
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
  'contactVisible',
  'badges',
  'photoFileId',
  'createdAt',
  'updatedAt',
] as const;

function profileDocRef(uid: string) {
  if (!db) throw new Error('Firestore is not configured.');
  return doc(db, 'profiles', uid);
}

/**
 * The private profile a brand-new applicant fills in while waiting for
 * approval. Deliberately a SEPARATE collection from `profiles`: the
 * directory queries never filter on `approved`, so a pending person's
 * data in `profiles` would leak into search. Only the applicant and the
 * admin(s) governing their batch can read it — see firestore.rules.
 */
function pendingProfileDocRef(uid: string) {
  if (!db) throw new Error('Firestore is not configured.');
  return doc(db, 'pendingProfiles', uid);
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
    // Only a photo the member UPLOADED (which always has a photoFileId) is
    // ever exposed. Older profiles saved before uploads existed may hold a
    // mirrored Google account picture in photoURL with no photoFileId —
    // those are deliberately hidden here, so no consumer (Directory,
    // Open to Work, Entrepreneurship, the header, Profile) can ever show
    // a Google picture. The stale value is also dropped on the member's
    // next save (see saveOwnProfile).
    photoURL:
      typeof data.photoFileId === 'string' && typeof data.photoURL === 'string' ? data.photoURL : null,
    photoFileId: typeof data.photoFileId === 'string' ? data.photoFileId : null,
    batchNumber: typeof data.batchNumber === 'number' ? data.batchNumber : null,
    headline: data.headline ?? '',
    bio: data.bio ?? '',
    location: data.location ?? '',
    locationLower: data.locationLower ?? '',
    // Falls back to '' for a profile saved before Phase 14 shipped —
    // same self-healing-on-next-save pattern as every prior schema
    // addition in this project (Phase 3, 5, 6, 10).
    cityCanonical: data.cityCanonical ?? '',
    cityCanonicalLower: data.cityCanonicalLower ?? '',
    organizations: Array.isArray(data.organizations) ? data.organizations.map(cleanOrganization) : [],
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
    // BUGFIX (2026-09-27): must OMIT a key entirely for a channel that
    // isn't revealed, never include it with an explicit `undefined`
    // value. The previous version built { phone: undefined, ... } for
    // any channel not currently visible — which is the common case for
    // almost every profile, since contactVisible only ever gains a key
    // when a member switches a channel on. The Firestore JS SDK throws
    // ("Unsupported field value: undefined") on ANY write containing a
    // literal `undefined`, at ANY nesting depth, before the request
    // even reaches the network. Because ProfilePage's handleSave()
    // always spreads the full in-memory profile (including this
    // round-tripped contactVisible map) back into saveOwnProfile(),
    // this made EVERY save of an already-existing profile throw
    // immediately and surface as "Couldn't save your profile" — for
    // any edit at all, not just contact-related ones. See
    // isValidContactVisibleMap in firestore.rules, which already
    // expects (and only ever allows) a map with just the *present*
    // keys — this fix makes the client actually produce that shape.
    contactVisible: buildContactVisibleFromSnapshot(data.contactVisible),
    badges: parseBadgesFromSnapshot(data.badges),
  };
}

/**
 * Normalises one organization entry. Firestore rejects literal `undefined`
 * values, so website/handles are only present when they hold something.
 * Website and handles are dropped for non-founder entries.
 */
function cleanOrganization(raw: OrganizationEntry): OrganizationEntry {
  const org: OrganizationEntry = {
    name: raw.name ?? '',
    title: raw.title ?? '',
    startYear: typeof raw.startYear === 'number' ? raw.startYear : null,
    endYear: typeof raw.endYear === 'number' ? raw.endYear : null,
    isFounder: raw.isFounder === true,
  };
  if (org.isFounder) {
    const website = typeof raw.website === 'string' ? raw.website.trim().slice(0, 300) : '';
    if (website) org.website = website;
    const handles = Array.isArray(raw.handles)
      ? raw.handles
          .filter((h) => h && typeof h.url === 'string' && h.url.trim() !== '')
          .slice(0, MAX_ORG_HANDLES)
          .map((h) => ({
            platform: HANDLE_PLATFORMS.some((p) => p.id === h.platform) ? h.platform : 'other',
            url: h.url.trim().slice(0, 300),
          }))
      : [];
    if (handles.length > 0) org.handles = handles;
  }
  return org;
}

function buildContactVisibleFromSnapshot(raw: unknown): ContactVisibleMap {
  const map: ContactVisibleMap = {};
  const source = raw as Record<string, unknown> | undefined;
  if (typeof source?.phone === 'string') map.phone = source.phone;
  if (typeof source?.whatsapp === 'string') map.whatsapp = source.whatsapp;
  if (typeof source?.email === 'string') map.email = source.email;
  if (typeof source?.linkedin === 'string') map.linkedin = source.linkedin;
  return map;
}

function parseBadgesFromSnapshot(raw: unknown): ProfileBadgeRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (b): b is ProfileBadgeRef =>
        b && typeof b === 'object' && typeof b.id === 'string' && typeof b.name === 'string',
    )
    .slice(0, MAX_PROFILE_BADGES)
    .map((b) => ({ id: b.id, name: b.name, colorKey: typeof b.colorKey === 'string' ? b.colorKey : 'ink' }));
}

/**
 * `seedDisplayName` prefills the name field for a brand-new profile —
 * pass the onboarding name (`users/{uid}.displayName`, already loaded
 * via UserRecordContext with zero extra reads) so a first-time editor
 * doesn't start from a blank "Unnamed alum" state.
 */
export function emptyProfile(uid: string, seedDisplayName = ''): Profile {
  return {
    uid,
    displayName: seedDisplayName,
    displayNameLower: seedDisplayName.toLowerCase(),
    photoURL: null,
    photoFileId: null,
    batchNumber: null,
    headline: '',
    bio: '',
    location: '',
    locationLower: '',
    cityCanonical: '',
    cityCanonicalLower: '',
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
    contactVisible: {},
    badges: [],
  };
}

// --- Session profile cache (post-login UI revamp) ---
//
// Quota optimisation: every profile that a directory/search/Open to Work/
// Entrepreneurship query has ALREADY downloaded is remembered in memory for
// a few minutes, so opening someone's full profile from a search result is
// zero extra Firestore reads instead of one read per click. The cache is
// per browser tab, never persisted, and is only ever used for *other
// members'* read-only views — the owner's own Profile page always reads
// fresh (getProfile) so editing never works from stale data.
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const PROFILE_CACHE_MAX = 300;
const profileCache = new Map<string, { profile: Profile; at: number }>();

export function rememberProfiles(profiles: Profile[]): void {
  const now = Date.now();
  for (const profile of profiles) {
    profileCache.delete(profile.uid); // re-insert so it becomes the newest entry
    profileCache.set(profile.uid, { profile, at: now });
  }
  while (profileCache.size > PROFILE_CACHE_MAX) {
    const oldest = profileCache.keys().next().value;
    if (oldest === undefined) break;
    profileCache.delete(oldest);
  }
}

export function getRememberedProfile(uid: string): Profile | null {
  const hit = profileCache.get(uid);
  if (!hit) return null;
  if (Date.now() - hit.at > PROFILE_CACHE_TTL_MS) {
    profileCache.delete(uid);
    return null;
  }
  return hit.profile;
}

/**
 * Read-only lookup of another member's profile for the full-profile view:
 * served from the session cache when a search already fetched it, otherwise
 * a single document read (which the Rules only allow for approved members).
 */
export async function getMemberProfile(uid: string): Promise<Profile | null> {
  const remembered = getRememberedProfile(uid);
  if (remembered) return remembered;
  const profile = await getProfile(uid);
  if (profile) rememberProfiles([profile]);
  return profile;
}

export async function getProfile(uid: string): Promise<Profile | null> {
  const snapshot = await getDoc(profileDocRef(uid));
  return snapshot.exists() ? fromSnapshot(uid, snapshot.data()) : null;
}

export function subscribeToProfile(
  uid: string,
  onChange: (profile: Profile | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    profileDocRef(uid),
    (snapshot) => {
      onChange(snapshot.exists() ? fromSnapshot(uid, snapshot.data()) : null);
    },
    onError,
  );
}

/** Live listener on the applicant's own pending-approval profile. */
export function subscribeToPendingProfile(
  uid: string,
  onChange: (profile: Profile | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    pendingProfileDocRef(uid),
    (snapshot) => {
      onChange(snapshot.exists() ? fromSnapshot(uid, snapshot.data()) : null);
    },
    onError,
  );
}

/**
 * One-off read of an applicant's pending profile — used by the approvers'
 * console when an admin chooses to open an application (a single
 * document read, only on demand). Firestore Rules restrict this to the
 * applicant and the admin(s) governing their batch.
 */
export async function getPendingProfile(uid: string): Promise<Profile | null> {
  const snapshot = await getDoc(pendingProfileDocRef(uid));
  return snapshot.exists() ? fromSnapshot(uid, snapshot.data()) : null;
}

/**
 * Called once for a member who has just been approved and has no
 * `profiles/{uid}` yet: copies what they entered while pending into their
 * real profile (so nothing they typed is lost), then removes the pending
 * copy. Returns true if a profile was copied. Safe to call more than
 * once — it does nothing if there is no pending profile.
 */
export async function promotePendingProfile(user: FirebaseUser): Promise<boolean> {
  const snapshot = await getDoc(pendingProfileDocRef(user.uid));
  if (!snapshot.exists()) return false;
  const pending = fromSnapshot(user.uid, snapshot.data());
  await saveOwnProfile(user, pending);
  try {
    await deleteDoc(pendingProfileDocRef(user.uid));
  } catch {
    // Best-effort cleanup only — a leftover pending copy is harmless.
  }
  return true;
}

/**
 * Create-or-update, always scoped to the caller's own uid by Firestore
 * Rules (see firestore.rules). Takes the signed-in `FirebaseUser` (not
 * just a uid) so `photoURL` can still be mirrored from the Google
 * account automatically (no upload flow exists — see Phase 0's Storage
 * decision) and so a still-blank name has a sane fallback. `displayName`
 * itself is now owner-edited (Phase 2/11 revision) and simply passed
 * through from `fields`. `ALLOWED_TOP_LEVEL_FIELDS` mirrors the field
 * allow-list enforced in firestore.rules as a client-side sanity check,
 * not the security boundary.
 */
export async function saveOwnProfile(user: FirebaseUser, fields: ProfileFormFields): Promise<void> {
  await writeOwnProfile(user, fields, 'profile');
}

/**
 * Same write as `saveOwnProfile`, but into the private
 * `pendingProfiles/{uid}` document (approved: false) for a member whose
 * application is still awaiting review. Never visible in the directory.
 */
export async function saveOwnPendingProfile(user: FirebaseUser, fields: ProfileFormFields): Promise<void> {
  await writeOwnProfile(user, fields, 'pending');
}

async function writeOwnProfile(
  user: FirebaseUser,
  fields: ProfileFormFields,
  target: 'profile' | 'pending',
): Promise<void> {
  const uid = user.uid;
  const targetRef = target === 'pending' ? pendingProfileDocRef(uid) : profileDocRef(uid);
  const existing = await getDoc(targetRef);

  // Phase 2/11 revision: `displayName` is now the owner-edited value in
  // `fields` (a real "Name" field in the Profile form), NOT re-derived
  // from the live Google Auth displayName on every save — that
  // overwrite is exactly what caused a saved name to silently
  // disappear/reset, and gave members no way to update a changed name
  // (e.g. after marriage) independent of their Google account. Falls
  // back to the Google account's name only if the field is somehow
  // still blank (shouldn't happen once the form requires it), so a save
  // never produces the empty string firestore.rules now rejects anyway.
  const name = fields.displayName.trim() || user.displayName?.trim() || '';
  const currentOrg = fields.organizations.find((org) => org.endYear === null);
  // Only an UPLOADED photo (one with a photoFileId) is ever stored in
  // photoURL. No Google account picture is ever mirrored or used as a
  // fallback — a member with no uploaded photo simply has photoURL null
  // and is shown the built-in placeholder (components/ui/Avatar.tsx).
  // This also cleans out any Google URL a pre-upload profile still holds.
  const photoURL = fields.photoFileId ? fields.photoURL : null;
  const payload: Record<string, unknown> = {
    uid,
    ...fields,
    organizations: fields.organizations.map(cleanOrganization),
    photoURL,
    badges: fields.badges.slice(0, MAX_PROFILE_BADGES),
    displayName: name,
    displayNameLower: name.toLowerCase(),
    locationLower: fields.location.toLowerCase(),
    // Phase 14: denormalized, controlled-reference-data-normalized
    // twin of `location` — see src/lib/geography.ts. Computed on every
    // save so it never drifts from the freehand `location` text the
    // member actually typed.
    cityCanonical: normalizeCity(fields.location),
    cityCanonicalLower: normalizeCityLower(fields.location),
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
    approved: target === 'profile',
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

  await setDoc(targetRef, payload, { merge: true });
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

  const profiles = docs.map((d) => fromSnapshot(d.id, d.data()));
  rememberProfiles(profiles);
  return {
    profiles,
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore,
  };
}
