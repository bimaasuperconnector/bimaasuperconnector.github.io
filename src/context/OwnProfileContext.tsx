import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  type Profile,
  promotePendingProfile,
  subscribeToPendingProfile,
  subscribeToProfile,
} from '../firebase/repositories/profilesRepository';
import { useAuth } from './AuthContext';

interface OwnProfileValue {
  /** The signed-in member's own profile document, or null if they have none yet. */
  profile: Profile | null;
  /** True once the first snapshot (or an error) has arrived. */
  loaded: boolean;
  /** True if the live listener failed (e.g. offline before the first load). */
  failed: boolean;
}

const OwnProfileContext = createContext<OwnProfileValue | undefined>(undefined);

/** Per-device marker: "this member's pending profile has already been checked/copied". */
function migratedKey(uid: string) {
  return `sc:pending-profile-checked:${uid}`;
}
function readMigrated(uid: string): boolean {
  try {
    return window.localStorage.getItem(migratedKey(uid)) === '1';
  } catch {
    return false;
  }
}
function writeMigrated(uid: string) {
  try {
    window.localStorage.setItem(migratedKey(uid), '1');
  } catch {
    // storage unavailable — the check simply repeats next session
  }
}

/**
 * ONE live listener on the member's own profile document for the whole
 * signed-in session. It replaces the separate one-shot getProfile()
 * reads that Home, Events, Open to Work and the Profile page each used to
 * make every time they were opened, and it is the same listener that keeps
 * the header photo current: one read when the app opens, then one read per
 * actual change — no matter how many pages the member visits.
 *
 * `source` selects WHICH document that listener watches:
 *  - 'profile' (approved members): `profiles/{uid}`;
 *  - 'pending' (applicants awaiting approval): the private
 *    `pendingProfiles/{uid}`, so the same Profile page works unchanged.
 *
 * For an approved member with no `profiles/{uid}` yet, the provider makes
 * ONE read of `pendingProfiles/{uid}` (once per device — remembered in
 * localStorage) and, if the member filled one in while pending, copies it
 * into their real profile so nothing they entered is lost.
 */
export function OwnProfileProvider({
  uid,
  source = 'profile',
  children,
}: {
  uid: string | undefined;
  source?: 'profile' | 'pending';
  children: ReactNode;
}) {
  const { user } = useAuth();
  const [state, setState] = useState<OwnProfileValue>({ profile: null, loaded: false, failed: false });
  const [checkedUid, setCheckedUid] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    setState({ profile: null, loaded: false, failed: false });
    const subscribe = source === 'pending' ? subscribeToPendingProfile : subscribeToProfile;
    return subscribe(
      uid,
      (profile) => setState({ profile, loaded: true, failed: false }),
      () => setState({ profile: null, loaded: true, failed: true }),
    );
  }, [uid, source]);

  const awaitingCopy = Boolean(
    uid &&
      user &&
      source === 'profile' &&
      state.loaded &&
      !state.profile &&
      !state.failed &&
      checkedUid !== uid &&
      !readMigrated(uid),
  );

  useEffect(() => {
    if (!awaitingCopy || !user || !uid) return;
    let cancelled = false;
    promotePendingProfile(user)
      .then(() => writeMigrated(uid))
      .catch(() => {
        // Leave the marker unset so a later session retries.
      })
      .finally(() => {
        if (!cancelled) setCheckedUid(uid);
      });
    return () => {
      cancelled = true;
    };
  }, [awaitingCopy, user, uid]);

  const value = useMemo<OwnProfileValue>(
    // Hold "loaded" back while the one-time copy runs, so the Profile page
    // doesn't seed itself with an empty form a moment before the copy lands.
    () => ({ ...state, loaded: state.loaded && !awaitingCopy }),
    [state, awaitingCopy],
  );
  return <OwnProfileContext.Provider value={value}>{children}</OwnProfileContext.Provider>;
}

export function useOwnProfile(): OwnProfileValue {
  const ctx = useContext(OwnProfileContext);
  if (!ctx) throw new Error('useOwnProfile must be used within an OwnProfileProvider');
  return ctx;
}
