import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin';

export interface JobLogEntry {
  jobName: string;
  cycleId?: string;
  status: 'success' | 'failure' | 'skipped';
  summary: string;
  error?: string;
}

/**
 * Simple run-level audit trail per AUTOMATION.md's "Failure handling"
 * section. Deliberately lighter-weight than a full retry-state-machine
 * with external-resource tracking — there are no external resources
 * yet (Calendar/Meet is Phase 8), so "next retry time" / "external ID"
 * bookkeeping would be speculative. This can grow once Phase 8 exists.
 */
export async function logJobRun(entry: JobLogEntry): Promise<void> {
  await db.collection('auditLogs').add({
    ...entry,
    createdAt: Timestamp.now(),
  });
}
