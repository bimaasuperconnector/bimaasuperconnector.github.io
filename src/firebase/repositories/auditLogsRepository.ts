import { type DocumentData, type QueryDocumentSnapshot, collection, getDocs, limit as fsLimit, orderBy, query } from 'firebase/firestore';
import { db } from '../init';

export interface AuditLogEntry {
  id: string;
  jobName: string;
  cycleId?: string;
  status: 'success' | 'failure' | 'skipped';
  summary: string;
  error?: string;
  createdAt: Date;
}

function auditLogsCollection() {
  if (!db) throw new Error('Firestore is not configured.');
  return collection(db, 'auditLogs');
}

function fromSnapshot(snap: QueryDocumentSnapshot<DocumentData>): AuditLogEntry {
  const data = snap.data();
  return {
    id: snap.id,
    jobName: data.jobName,
    cycleId: data.cycleId,
    status: data.status,
    summary: data.summary,
    error: data.error,
    createdAt: data.createdAt?.toDate() ?? new Date(),
  };
}

/**
 * Admin-only (see firestore.rules). Bounded to the most recent 50 runs
 * — a single-field orderBy needs no composite index, and 50 rows is
 * enough for "did last night's automation run OK" without scanning a
 * collection that grows daily forever.
 */
export async function queryRecentAuditLogs(): Promise<AuditLogEntry[]> {
  const snap = await getDocs(query(auditLogsCollection(), orderBy('createdAt', 'desc'), fsLimit(50)));
  return snap.docs.map(fromSnapshot);
}
