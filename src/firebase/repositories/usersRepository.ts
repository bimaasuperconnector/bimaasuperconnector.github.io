import {
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../init';

export type AccountStatus = 'pending' | 'approved' | 'rejected';
export type UserRole = 'alumni' | 'batch_admin' | 'super_admin';

export interface UserRecord {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  batchNumber: number | null;
  note: string;
  status: AccountStatus;
  role: UserRole;
  /** Only meaningful when role === 'batch_admin'. Which batch numbers this person can approve/reject pending members for. */
  assignedBatchNumbers: number[];
}

function usersCollection() {
  if (!db) throw new Error('Firestore is not configured.');
  return collection(db, 'users');
}

function userDocRef(uid: string) {
  if (!db) throw new Error('Firestore is not configured.');
  return doc(db, 'users', uid);
}

function fromSnapshot(uid: string, data: DocumentData): UserRecord {
  return {
    uid,
    email: data.email ?? null,
    displayName: data.displayName ?? null,
    photoURL: data.photoURL ?? null,
    batchNumber: typeof data.batchNumber === 'number' ? data.batchNumber : null,
    note: data.note ?? '',
    status: (data.status as AccountStatus) ?? 'pending',
    role: (data.role as UserRole) ?? 'alumni',
    assignedBatchNumbers: Array.isArray(data.assignedBatchNumbers) ? data.assignedBatchNumbers : [],
  };
}

/**
 * super_admin-only lookup used by the role-management control on the
 * admin dashboard (Phase 11): finds the one user with this email so an
 * admin can promote/demote by typing an email address rather than
 * needing a full member-browsing UI. A single `limit(1)` equality
 * query — one read, not a collection scan — kept deliberately narrow
 * rather than building a general "browse all 5,000 users" admin view,
 * which would be both a real quota cost and isn't needed for this.
 *
 * Note: this relies on `email` being an exact, lowercase match. Google
 * Sign-In emails are already lowercase in practice, but if that ever
 * proves untrue for some account, the lookup will simply report "not
 * found" rather than something misleading.
 */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const snapshot = await getDocs(
    query(usersCollection(), where('email', '==', email.trim().toLowerCase()), fsLimit(1)),
  );
  const first = snapshot.docs[0];
  return first ? fromSnapshot(first.id, first.data()) : null;
}

export async function getUserRecord(uid: string): Promise<UserRecord | null> {
  const snapshot = await getDoc(userDocRef(uid));
  return snapshot.exists() ? fromSnapshot(uid, snapshot.data()) : null;
}

/**
 * Submits the one-time onboarding form: full name, batch, and an optional
 * note to the approver. This REPLACES the old auto-created-on-sign-in
 * flow — the `users/{uid}` doc is now only created once the member
 * actually fills this in, not silently on first Google sign-in. Firestore
 * Rules independently enforce that a client can only ever create its OWN
 * doc, and only with status: 'pending' and role: 'alumni' — nobody can
 * self-approve or self-elevate no matter what this function sends.
 */
export async function submitOnboarding(
  user: FirebaseUser,
  fields: { displayName: string; batchNumber: number; note: string },
): Promise<void> {
  const ref = userDocRef(user.uid);
  await setDoc(ref, {
    uid: user.uid,
    email: user.email,
    displayName: fields.displayName.trim(),
    photoURL: user.photoURL,
    batchNumber: fields.batchNumber,
    note: fields.note.trim(),
    status: 'pending',
    role: 'alumni',
    assignedBatchNumbers: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToUserRecord(
  uid: string,
  onChange: (record: UserRecord | null) => void,
): Unsubscribe {
  return onSnapshot(userDocRef(uid), (snapshot) => {
    onChange(snapshot.exists() ? fromSnapshot(uid, snapshot.data()) : null);
  });
}

/**
 * Approve/reject. Firestore Rules independently enforce that:
 * - a super_admin can do this for anyone,
 * - a batch_admin can only do this for a pending user whose batchNumber
 *   is in the batch_admin's own assignedBatchNumbers,
 * - the write can only touch status/updatedAt (can't also grant a role).
 */
export async function setUserStatus(uid: string, status: AccountStatus): Promise<void> {
  await updateDoc(userDocRef(uid), {
    status,
    updatedAt: serverTimestamp(),
  });
}

/**
 * super_admin only (enforced by Rules): promotes an approved alumni to
 * batch_admin scoped to the given batch numbers, or demotes back to
 * alumni (pass an empty array). There's no dedicated UI for this yet —
 * see the Phase 1 revision notes in FEATURE_SUPERCONNECTOR.md — but the
 * repository function exists so a minimal admin-console control can call
 * it directly.
 */
export async function setUserRole(
  uid: string,
  role: UserRole,
  assignedBatchNumbers: number[] = [],
): Promise<void> {
  await updateDoc(userDocRef(uid), {
    role,
    assignedBatchNumbers: role === 'batch_admin' ? assignedBatchNumbers : [],
    updatedAt: serverTimestamp(),
  });
}

/**
 * Pending members, optionally scoped to a set of batch numbers (used by
 * batch_admin's console view). Pass `undefined` for a super_admin's
 * unscoped view of everyone pending.
 */
export function subscribeToPendingUsers(
  onChange: (records: UserRecord[]) => void,
  scopedToBatchNumbers?: number[],
): Unsubscribe {
  const constraints = [where('status', '==', 'pending')];
  const pendingQuery = query(usersCollection(), ...constraints);
  return onSnapshot(pendingQuery, (snapshot) => {
    const all = snapshot.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) =>
      fromSnapshot(docSnap.id, docSnap.data()),
    );
    const filtered = scopedToBatchNumbers
      ? all.filter((r) => r.batchNumber !== null && scopedToBatchNumbers.includes(r.batchNumber))
      : all;
    onChange(filtered);
  });
}
