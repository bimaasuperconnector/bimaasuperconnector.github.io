import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRecord } from '../context/UserRecordContext';

/**
 * Gates /app/admin on holding either admin-tier role (super_admin or
 * batch_admin). As with ProtectedRoute, this is UX only — Firestore
 * Rules independently enforce the real boundary (and additionally scope
 * a batch_admin's actual write capability to their assigned batches).
 *
 * A full Phase 11 admin dashboard (analytics, audit history) is still
 * ahead of us. This is the smallest console that supports the
 * super_admin / batch_admin / alumni model from the Phase 1 revision.
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { record, loading } = useUserRecord();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-body-md text-muted">
        Loading…
      </div>
    );
  }

  const isAnyAdmin = record?.role === 'super_admin' || record?.role === 'batch_admin';
  if (!isAnyAdmin) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
