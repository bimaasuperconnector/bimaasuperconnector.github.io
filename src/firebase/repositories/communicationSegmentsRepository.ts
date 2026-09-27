/**
 * Phase 14 (Autonomous communication & segmentation).
 *
 * Firestore is the source of truth for WHO a segment refers to
 * (`communicationSegments/{segmentId}` stores a named, admin-authored
 * segment DEFINITION), but this project deliberately does NOT introduce
 * ARCHITECTURE.md's originally-suggested `communicationMemberships`
 * collection to separately materialize/maintain who's currently IN each
 * segment. See FEATURE_SUPERCONNECTOR.md's Phase 14 entry for the full
 * reasoning; in short: a materialized membership collection would need
 * to be kept in sync with every profile save (batch/city/openToWork/
 * founder status can all change), which is exactly the kind of
 * write-amplification the 2026-09-26 quota-optimization pass steered
 * away from elsewhere in this project (e.g. Phase 12 reusing
 * `queryDirectory` rather than a new collection). Instead, segment
 * MEMBERSHIP is resolved on demand, at the moment an admin actually
 * wants to communicate with a segment — reusing the exact same indexed
 * fields (`batchNumber`, `cityCanonicalLower`, `openToWork`,
 * `hasFounderOrg`) Directory/Open to Work/Entrepreneurship already rely
 * on, so this phase needed zero new Firestore indexes.
 *
 * Google Groups is explicitly NOT wired up here. Per ARCHITECTURE.md:
 * "A consumer Gmail account does not automatically provide Workspace
 * Admin Directory group-management authority... If unavailable, retain
 * Firestore segmentation and provide an admin export/manual
 * communication path." Phase 8 already confirmed
 * bimaasuperconnector@gmail.com is a standard consumer account, not
 * Workspace — so `resolveSegmentMembers` below is the "manual
 * communication path": it returns exactly the member list an admin
 * needs to paste into a BCC field or a Google Group they manage by
 * hand, without silently attempting an API that would fail (or worse,
 * requiring a paid Workspace upgrade the owner hasn't approved).
 */
import {
  type DocumentData,
  type QueryDocumentSnapshot,
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../init';

export const SEGMENT_TYPES = ['everyone', 'batch', 'city', 'openToWork', 'founders', 'customUids'] as const;
export type SegmentType = (typeof SEGMENT_TYPES)[number];

export const SEGMENT_TYPE_LABELS: Record<SegmentType, string> = {
  everyone: 'Everyone (all approved members)',
  batch: 'A specific batch',
  city: 'A city',
  openToWork: 'Open to Work members',
  founders: 'Founders / entrepreneurs',
  customUids: 'Hand-picked members',
};

export interface CommunicationSegment {
  id: string;
  name: string;
  type: SegmentType;
  batchNumber: number | null;
  /** Stored in canonical form (src/lib/geography.ts) so "Bangalore"/"Bengaluru" resolve the same segment. */
  cityCanonical: string;
  customUids: string[];
  createdByUid: string;
  createdAt: Date | null;
}

export interface ResolvedMember {
  uid: string;
  displayName: string;
  email: string | null;
}

interface UserLite {
  displayName?: string;
  email?: string;
  status?: string;
}

function segmentsCollection() {
  if (!db) throw new Error('Firestore is not configured.');
  return collection(db, 'communicationSegments');
}

function usersCollectionRef() {
  if (!db) throw new Error('Firestore is not configured.');
  return collection(db, 'users');
}

function profilesCollectionRef() {
  if (!db) throw new Error('Firestore is not configured.');
  return collection(db, 'profiles');
}

function fromSnapshot(snap: QueryDocumentSnapshot<DocumentData>): CommunicationSegment {
  const data = snap.data();
  return {
    id: snap.id,
    name: data.name ?? '',
    type: (data.type as SegmentType) ?? 'everyone',
    batchNumber: typeof data.batchNumber === 'number' ? data.batchNumber : null,
    cityCanonical: data.cityCanonical ?? '',
    customUids: Array.isArray(data.customUids) ? data.customUids : [],
    createdByUid: data.createdByUid ?? '',
    createdAt: data.createdAt?.toDate?.() ?? null,
  };
}

/** admin-only (enforced by firestore.rules); a small, low-volume collection — segments are created rarely, not per-viewer. */
export async function createSegment(
  admin: FirebaseUser,
  fields: { name: string; type: SegmentType; batchNumber: number | null; cityCanonical: string; customUids: string[] },
): Promise<string> {
  const ref = await addDoc(segmentsCollection(), {
    name: fields.name.trim(),
    type: fields.type,
    batchNumber: fields.type === 'batch' ? fields.batchNumber : null,
    cityCanonical: fields.type === 'city' ? fields.cityCanonical : '',
    customUids: fields.type === 'customUids' ? fields.customUids : [],
    createdByUid: admin.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Bounded to 200 — an admin's saved-segment list, not an export; segments are created rarely so this will never realistically approach the cap. */
export async function listSegments(): Promise<CommunicationSegment[]> {
  const snap = await getDocs(query(segmentsCollection(), orderBy('createdAt', 'desc'), fsLimit(200)));
  return snap.docs.map(fromSnapshot);
}

export async function deleteSegment(segmentId: string): Promise<void> {
  await deleteDoc(doc(segmentsCollection(), segmentId));
}

// --- Resolution (member lookup) -------------------------------------
//
// "Reduce the number of calls made to the database" (the owner's
// standing directive) governs this section specifically:
//   1. Resolving WHO is in a segment is always exactly one query
//      (against `users` for everyone/batch, or `profiles` for
//      city/openToWork/founders) — never a per-member read.
//   2. Turning those uids into displayName+email is a BATCH lookup via
//      `where(documentId(), 'in', chunk)` in chunks of up to 30 —
//      i.e. ceil(N/30) calls total, not N individual getDoc() calls.
//   3. This is an admin-only, infrequent (broadcast-prep) operation,
//      bounded by total platform size — not a per-viewer cost like
//      Directory/Open to Work/Entrepreneurship. SEGMENT_RESOLVE_LIMIT
//      below is a safety ceiling, set comfortably above the owner's
//      stated 5,000-user target scale, not a pagination page size —
//      see FEATURE_SUPERCONNECTOR.md's Phase 14 entry for why a single
//      bounded query was chosen over cursor pagination here (fewer
//      calls, not more, for the same bounded result).

const SEGMENT_RESOLVE_LIMIT = 5500;
const USERS_IN_QUERY_CHUNK = 30; // Firestore's `in` operator supports up to 30 values per query.

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Batched users/{uid} lookup: ceil(uids.length / 30) query calls, not `uids.length` getDoc calls. */
async function fetchUsersByUids(uids: string[]): Promise<Map<string, UserLite>> {
  const unique = Array.from(new Set(uids));
  if (unique.length === 0) return new Map();
  const chunks = chunk(unique, USERS_IN_QUERY_CHUNK);
  const snapshots = await Promise.all(
    chunks.map((c) => getDocs(query(usersCollectionRef(), where(documentId(), 'in', c)))),
  );
  const map = new Map<string, UserLite>();
  for (const snap of snapshots) {
    for (const d of snap.docs) map.set(d.id, d.data() as UserLite);
  }
  return map;
}

function toResolvedMember(uid: string, u: UserLite): ResolvedMember {
  return { uid, displayName: u.displayName ?? '', email: u.email ?? null };
}

/**
 * Returns the (approved-only) members currently in a segment. Every
 * branch is exactly ONE query against `users` or `profiles`, plus (for
 * the profiles-driven branches) one batched `users` lookup — see the
 * call-count reasoning above. Never downloads the whole member base
 * just to filter it client-side.
 */
export async function resolveSegmentMembers(segment: CommunicationSegment): Promise<ResolvedMember[]> {
  switch (segment.type) {
    case 'customUids': {
      const byUid = await fetchUsersByUids(segment.customUids);
      return segment.customUids
        .map((uid) => {
          const u = byUid.get(uid);
          return u && u.status === 'approved' ? toResolvedMember(uid, u) : null;
        })
        .filter((m): m is ResolvedMember => m !== null);
    }

    case 'everyone': {
      const snap = await getDocs(
        query(usersCollectionRef(), where('status', '==', 'approved'), fsLimit(SEGMENT_RESOLVE_LIMIT)),
      );
      return snap.docs.map((d) => toResolvedMember(d.id, d.data() as UserLite));
    }

    case 'batch': {
      if (segment.batchNumber == null) return [];
      // Single equality filter only (no composite index required,
      // consistent with this phase's "zero new indexes" design — see
      // the module doc comment above) — the approved-only check is
      // done client-side on the small, batch-sized result instead of
      // adding a second `where()` clause that would otherwise need a
      // dedicated composite index just for this one admin export path.
      const snap = await getDocs(
        query(usersCollectionRef(), where('batchNumber', '==', segment.batchNumber), fsLimit(SEGMENT_RESOLVE_LIMIT)),
      );
      return snap.docs
        .map((d) => ({ uid: d.id, data: d.data() as UserLite }))
        .filter(({ data }) => data.status === 'approved')
        .map(({ uid, data }) => toResolvedMember(uid, data));
    }

    case 'city':
    case 'openToWork':
    case 'founders': {
      // These three flags live on `profiles`, not `users` — this is an
      // inherent architecture reality (the same split Phase 8's
      // calendarJob and Phase 6's feedback flow already live with:
      // read the collection that has the filter field, then batch-
      // resolve emails from `users`), not something this phase could
      // avoid without duplicating openToWork/hasFounderOrg/city onto
      // `users` and keeping two documents in sync on every profile
      // save — a worse quota tradeoff than one extra batched query.
      const constraints =
        segment.type === 'city'
          ? [where('cityCanonicalLower', '==', segment.cityCanonical.toLowerCase())]
          : segment.type === 'openToWork'
            ? [where('openToWork', '==', true)]
            : [where('hasFounderOrg', '==', true)];
      const snap = await getDocs(query(profilesCollectionRef(), ...constraints, fsLimit(SEGMENT_RESOLVE_LIMIT)));
      const uids = snap.docs.map((d) => d.id);
      const byUid = await fetchUsersByUids(uids);
      return uids
        .map((uid) => {
          const u = byUid.get(uid);
          return u && u.status === 'approved' ? toResolvedMember(uid, u) : null;
        })
        .filter((m): m is ResolvedMember => m !== null);
    }
  }
}

/** Simple two-column CSV (Name,Email) for pasting into Gmail/Groups — see the module doc comment above for why this stays a manual export rather than an automated send. */
export function segmentMembersToCsv(members: ResolvedMember[]): string {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = members.map((m) => `${escape(m.displayName)},${escape(m.email ?? '')}`);
  return ['Name,Email', ...rows].join('\n');
}
