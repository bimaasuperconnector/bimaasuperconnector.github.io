import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin';
import { logJobRun } from './auditLog';

/**
 * Moves 'approved' job postings past their expiration date to
 * 'archived', so the active jobs board query (`where('status', '==',
 * 'approved')`, client-side) never needs to also filter by
 * expirationDate.
 *
 * REQUIRES the composite index jobs(status ASC, expirationDate ASC)
 * (declared in firestore.indexes.json). Firestore does not create
 * indexes from that file automatically when you paste rules by hand —
 * the index must exist in the Firebase console, otherwise this query
 * fails with FAILED_PRECONDITION.
 *
 * Read/write cost: the query only ever returns postings that are
 * approved AND expired, and each is archived right after, so the next
 * day's result set is empty (0 document reads). Archived docs are never
 * re-read. Writes are committed in chunks of 400 (Firestore's hard
 * limit is 500 operations per batch), and each run is capped so a huge
 * backlog can never blow through quota in a single execution — the
 * remainder is simply picked up by the next daily run.
 */
const BATCH_SIZE = 400;
const MAX_PER_RUN = 2000;

export async function runJobsCleanupJob(): Promise<void> {
  const now = Timestamp.now();
  const expired = await db
    .collection('jobs')
    .where('status', '==', 'approved')
    .where('expirationDate', '<=', now)
    .limit(MAX_PER_RUN)
    .get();

  if (expired.empty) return;

  for (let i = 0; i < expired.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const doc of expired.docs.slice(i, i + BATCH_SIZE)) {
      batch.update(doc.ref, { status: 'archived', updatedAt: now });
    }
    await batch.commit();
  }

  await logJobRun({
    jobName: 'jobs-cleanup',
    status: 'success',
    summary: `Archived ${expired.size} expired job posting(s).`,
  });
}