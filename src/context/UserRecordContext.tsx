import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { type UserRecord, subscribeToUserRecord } from '../firebase/repositories/usersRepository';
import { firebaseConfigured } from '../firebase/init';

interface UserRecordContextValue {
  record: UserRecord | null;
  /** True while we don't yet know whether a record exists (auth resolving or the initial subscription hasn't reported back yet). */
  loading: boolean;
  /**
   * True once we know for certain: signed in, but no `users/{uid}` doc
   * exists yet. The onboarding form (name/batch/note) should be shown —
   * see PendingPage.tsx. This REPLACES the old behavior of silently
   * auto-creating a pending doc from the Google account alone.
   */
  needsOnboarding: boolean;
}

const UserRecordContext = createContext<UserRecordContextValue | undefined>(undefined);

export function UserRecordProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [record, setRecord] = useState<UserRecord | null>(null);
  // Distinguishes "haven't heard from Firestore yet" from "heard back, and there's genuinely no doc."
  const [hasResolved, setHasResolved] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured || !user) {
      setRecord(null);
      setHasResolved(false);
      return;
    }

    setHasResolved(false);
    const unsubscribe = subscribeToUserRecord(user.uid, (nextRecord) => {
      setRecord(nextRecord);
      setHasResolved(true);
    });

    return unsubscribe;
  }, [user]);

  const loading = authLoading || (Boolean(user) && !hasResolved);
  const needsOnboarding = Boolean(user) && hasResolved && record === null;

  return (
    <UserRecordContext.Provider value={{ record, loading, needsOnboarding }}>
      {children}
    </UserRecordContext.Provider>
  );
}

export function useUserRecord(): UserRecordContextValue {
  const ctx = useContext(UserRecordContext);
  if (!ctx) {
    throw new Error('useUserRecord must be used within a UserRecordProvider');
  }
  return ctx;
}
