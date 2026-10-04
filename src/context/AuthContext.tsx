import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, firebaseConfigured } from '../firebase/init';
import { clearDirectoryIndexCache } from '../lib/directoryIndex';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Start not-loading when Firebase isn't configured so static routes
  // (landing, terms, privacy) still render instantly.
  const [loading, setLoading] = useState(firebaseConfigured);

  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      // Signed out (by any route): don't leave the downloaded member list in this browser.
      if (!nextUser) clearDirectoryIndexCache();
      setUser(nextUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured: firebaseConfigured,
      async signInWithGoogle() {
        if (!firebaseConfigured || !auth) {
          throw new Error('Firebase is not configured yet.');
        }
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      },
      async signOutUser() {
        if (!firebaseConfigured || !auth) return;
        await signOut(auth);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
