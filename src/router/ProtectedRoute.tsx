import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUserRecord } from '../context/UserRecordContext';

/**
 * Gate: signed out -> /login; no record yet or rejected -> /pending
 * (onboarding form / rejection notice); pending -> the profile page only;
 * approved -> render.
 *
 * This is a UX convenience only. Firestore Rules remain the authoritative
 * enforcement point for every collection this app will ever read/write —
 * this component just avoids flashing private UI at someone who isn't
 * approved yet.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, configured } = useAuth();
  const { record, loading: recordLoading } = useUserRecord();
  const { pathname } = useLocation();

  if (!configured) {
    return <Navigate to="/login" replace />;
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-body-md text-muted">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (recordLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-body-md text-muted">
        Loading…
      </div>
    );
  }

  // A member whose application is still pending may use the app shell for
  // exactly ONE page — their own profile — so approvers can see who they
  // are. Every other /app route sends them back to it. (UX only; the real
  // boundary is firestore.rules, which gives a pending member no access
  // to anything but their own pending profile.)
  if (record?.status === 'pending') {
    if (pathname !== '/app/profile') {
      return <Navigate to="/app/profile" replace />;
    }
    return <>{children}</>;
  }

  if (!record || record.status !== 'approved') {
    return <Navigate to="/pending" replace />;
  }

  return <>{children}</>;
}
