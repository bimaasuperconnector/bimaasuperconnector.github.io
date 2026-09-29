import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { type Profile, subscribeToProfile } from '../firebase/repositories/profilesRepository';

interface OwnProfileValue {
  /** The signed-in member's own profile document, or null if they have none yet. */
  profile: Profile | null;
  /** True once the first snapshot (or an error) has arrived. */
  loaded: boolean;
  /** True if the live listener failed (e.g. offline before the first load). */
  failed: boolean;
}

const OwnProfileContext = createContext<OwnProfileValue | undefined>(undefined);

/**
 * ONE live listener on the member's own `profiles/{uid}` document for the
 * whole signed-in session. It replaces the separate one-shot getProfile()
 * reads that Home, Events, Open to Work and the Profile page each used to
 * make every time they were opened, and it is the same listener that keeps
 * the header photo current: one read when the app opens, then one read per
 * actual change — no matter how many pages the member visits.
 */
export function OwnProfileProvider({ uid, children }: { uid: string | undefined; children: ReactNode }) {
  const [state, setState] = useState<OwnProfileValue>({ profile: null, loaded: false, failed: false });

  useEffect(() => {
    if (!uid) return;
    setState({ profile: null, loaded: false, failed: false });
    return subscribeToProfile(
      uid,
      (profile) => setState({ profile, loaded: true, failed: false }),
      () => setState({ profile: null, loaded: true, failed: true }),
    );
  }, [uid]);

  const value = useMemo(() => state, [state]);
  return <OwnProfileContext.Provider value={value}>{children}</OwnProfileContext.Provider>;
}

export function useOwnProfile(): OwnProfileValue {
  const ctx = useContext(OwnProfileContext);
  if (!ctx) throw new Error('useOwnProfile must be used within an OwnProfileProvider');
  return ctx;
}
