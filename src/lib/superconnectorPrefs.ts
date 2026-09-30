/**
 * Pure helpers for the three inputs a member keeps on the SuperConnector
 * page — skills, networking interests and what they're looking for.
 *
 * They are saved once (on profiles/{uid}) and reused every month; a member
 * cannot join a cycle until all three have something in them. Firestore
 * free: everything here is plain data in, plain data out.
 */

export const MAX_PREF_TAGS = 20; // mirrors the list-size cap in firestore.rules

export interface PrefsShape {
  skills: readonly string[];
  interests: readonly string[];
  networkingPurpose: readonly string[];
}

export type PrefKey = keyof PrefsShape;

export const PREF_LABELS: Record<PrefKey, string> = {
  skills: 'skills',
  interests: 'networking interests',
  networkingPurpose: 'what you are looking for',
};

/** Which of the three inputs are still empty (in display order). */
export function missingPrefs(prefs: PrefsShape | null | undefined): PrefKey[] {
  const missing: PrefKey[] = [];
  if (!prefs || prefs.skills.length === 0) missing.push('skills');
  if (!prefs || prefs.interests.length === 0) missing.push('interests');
  if (!prefs || prefs.networkingPurpose.length === 0) missing.push('networkingPurpose');
  return missing;
}

export function hasCompletePrefs(prefs: PrefsShape | null | undefined): boolean {
  return missingPrefs(prefs).length === 0;
}

/**
 * Trims, drops blanks, removes case-insensitive duplicates (keeping the
 * first spelling) and caps the list. The matching engine compares
 * lowercased strings, so "Marketing" and "marketing" must not both be stored.
 */
export function normalizeTags(values: readonly string[], max: number = MAX_PREF_TAGS): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}

/** True when two string lists hold the same items, ignoring order. */
export function sameItems(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((item) => set.has(item));
}
