import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin';
import { logJobRun } from './auditLog';

/**
 * Moves 'approved' job postings past their expiration date to
 * 'archived', so the active jobs board query (`where('status', '==',
 * 'approved')`, client-side) never needs to also filter by
 * expirationDate — keeps that query a simple single-field equality
 * filter, no composite index or client-side date math required there.
 *
 * This is the "archives expired jobs" cleanup job AUTOMATION.md
 * described from the start — Phase 7's completion log explicitly
 * deferred it ("there's nothing to clean up yet, Jobs board is Phase 9,
 * not built"). Now that Phase 9 exists, this closes that gap.
 */
export async function runJobsCleanupJob(): Promise<void> {
  const now = Timestamp.now();
  const expired = await db
    .collection('jobs')
    .where('status', '==', 'approved')
    .where('expirationDate', '<=', now)
    .get();

  if (expired.empty) return;

  const batch = db.batch();
  for (const doc of expired.docs) {
    batch.set(doc.ref, { status: 'archived', updatedAt: now }, { merge: true });
  }
  await batch.commit();

  await logJobRun({
    jobName: 'jobs-cleanup',
    status: 'success',
    summary: `Archived ${expired.size} expired job posting(s).`,
  });
}
