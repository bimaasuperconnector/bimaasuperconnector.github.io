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
 * The super_admin-managed badge catalog (e.g. "Messcom", "Finclub",
 * "Astronomy Club"). Small, admin-created collection — see
 * firestore.rules' badges/{badgeId} block for why an unfiltered list is
 * safe here regardless of alumni-base size. Members pick up to 5 of
 * these onto their own profile (see ProfileBadgeRef in
 * profilesRepository.ts and BadgePicker.tsx) — this repository only
 * covers the CATALOG itself (super_admin create/delete + the read used
 * to power the picker), not a member's own selection.
 */
export interface Badge {
  id: string;
  name: string;
  colorKey: BadgeColorKey;
}

/**
 * Fixed palette matching Design-superconnector.md's signature card
 * colors, so a badge chip never introduces a color the design system
 * doesn't already define. `ink` is the default/neutral option.
 */
export const BADGE_COLOR_KEYS = [
  'ink',
  'coral',
  'forest',
  'cream',
  'peach',
  'mint',
  'yellow',
  'mustard',
] as const;
export type BadgeColorKey = (typeof BADGE_COLOR_KEYS)[number];

function badgesCollection() {
  if (!db) throw new Error('Firestore is not configured.');
  return collection(db, 'badges');
}

/**
 * Fetches the full badge catalog — small and admin-managed, so a
 * single unfiltered read is the right shape here (see firestore.rules'
 * comment on the badges/{badgeId} collection). Used by both the
 * Profile-edit badge picker and the admin badge-management panel.
 */
export const BADGES_CATALOG_KEY = 'badges';

export async function listBadges(): Promise<Badge[]> {
  // Cached in memory for 10 minutes (lib/catalogCache.ts): the picker, the
  // search and the admin panel all share ONE read of the catalog.
  return cachedCatalog(BADGES_CATALOG_KEY, async () => {
    const snapshot = await getDocs(query(badgesCollection(), orderBy('name')));
    return snapshot.docs.map((d) => ({
      id: d.id,
      name: d.data().name ?? '',
      colorKey: (d.data().colorKey as BadgeColorKey) ?? 'ink',
    }));
  });
}

/** super_admin only — enforced by firestore.rules, not just this client check. */
export async function createBadge(
  user: FirebaseUser,
  name: string,
  colorKey: BadgeColorKey,
): Promise<void> {
  await addDoc(badgesCollection(), {
    name: name.trim(),
    colorKey,
    createdByUid: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  invalidateCatalog(BADGES_CATALOG_KEY);
}

/** super_admin only — enforced by firestore.rules, not just this client check. */
export async function deleteBadge(badgeId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not configured.');
  await deleteDoc(doc(db, 'badges', badgeId));
  invalidateCatalog(BADGES_CATALOG_KEY);
}
