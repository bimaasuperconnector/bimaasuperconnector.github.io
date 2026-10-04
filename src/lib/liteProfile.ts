import { type Profile, emptyProfile } from '../firebase/repositories/profilesRepository';
import type { DirectoryEntry } from './directoryIndexFormat';

/**
 * A "lite" profile is built from a name-index entry (name, batch, role, photo,
 * Founder / Open to Work markers) — enough to draw a search-result row with
 * ZERO Firestore reads. It is NOT a real profile: it must never be handed to
 * the full-profile page as if it were one. Anything that links to a profile
 * checks isLiteProfile() and lets the page load the real document instead.
 */
const lite = new WeakSet<Profile>();

export function liteProfileFromEntry(entry: DirectoryEntry): Profile {
  const profile = emptyProfile(entry.uid, entry.name);
  profile.batchNumber = entry.batch;
  // The result row shows organization ?? headline; the index already holds the combined text.
  profile.headline = entry.role;
  profile.photoURL = entry.photoURL || null;
  profile.hasFounderOrg = entry.founder;
  profile.openToWork = entry.openToWork;
  lite.add(profile);
  return profile;
}

export function isLiteProfile(profile: Profile): boolean {
  return lite.has(profile);
}
