import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../init';
import { cachedCatalog, invalidateCatalog } from '../../lib/catalogCache';

/**
 * The super_admin-managed chapter catalog (e.g. "Chennai Chapter",
 * "Europe Chapter", "India Chapter"). Same shape and same safety
 * reasoning as the badge catalog (badgesRepository.ts): a small,
 * admin-created collection, so one unfiltered list is safe at any
 * alumni-base size, and it is cached in memory (lib/catalogCache.ts) so
 * the pickers, the search and the event-targeting editor share one read.
 *
 * Members enrol themselves in up to MAX_PROFILE_CHAPTERS of these on their
 * own profile (ProfileChapterRef in profilesRepository.ts) — this
 * repository only covers the CATALOG, not a member's own selection.
 */
export interface Chapter {
  id: string;
  name: string;
}

export const CHAPTERS_CATALOG_KEY = 'chapters';

function chaptersCollection() {
  if (!db) throw new Error('Firestore is not configured.');
  return collection(db, 'chapters');
}

export async function listChapters(): Promise<Chapter[]> {
  return cachedCatalog(CHAPTERS_CATALOG_KEY, async () => {
    const snapshot = await getDocs(query(chaptersCollection(), orderBy('name')));
    return snapshot.docs.map((d) => ({ id: d.id, name: d.data().name ?? '' }));
  });
}

/** super_admin only — enforced by firestore.rules, not just this client check. */
export async function createChapter(user: FirebaseUser, name: string): Promise<void> {
  await addDoc(chaptersCollection(), {
    name: name.trim(),
    createdByUid: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  invalidateCatalog(CHAPTERS_CATALOG_KEY);
}

/** super_admin only — enforced by firestore.rules, not just this client check. */
export async function deleteChapter(chapterId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not configured.');
  await deleteDoc(doc(db, 'chapters', chapterId));
  invalidateCatalog(CHAPTERS_CATALOG_KEY);
}
