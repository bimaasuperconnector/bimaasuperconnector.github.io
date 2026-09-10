import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin';
import { logJobRun } from './auditLog';
import { applyFeedback, DEFAULT_CONNECTION_METER, type FeedbackSentiment } from '../../src/lib/connectionMeter';

/**
 * Finds every cycle whose feedback window has closed ('archived' — see
 * cycles.ts's determineNextStatus, which only moves a cycle to
 * 'archived' once feedbackClosesAt has passed) and applies any
 * not-yet-applied feedback to the relevant members' hidden
 * connectionMeters scores.
 *
 * Idempotency: each feedback doc gets `applied: true` set once
 * processed, and is skipped on any future run. As a side effect
 * (documented in firestore.rules and FEATURE_SUPERCONNECTOR.md), a
 * client can no longer update a feedback doc's sentiment once
 * `applied` is set — the client-side shape validation's `hasOnly` list
 * doesn't include `applied`, so a merge-update that would leave it in
 * place gets rejected. This is intentional: editing feedback after its
 * score effect has already been committed shouldn't silently do
 * nothing while looking like it worked.
 */
export async function runFeedbackScoreJob(): Promise<void> {
  const archivedCycles = await db.collection('connectionCycles').where('status', '==', 'archived').get();

  for (const cycleDoc of archivedCycles.docs) {
    if (cycleDoc.data().scored === true) continue; // already fully scored, skip
    const cycleId = cycleDoc.id;
    try {
      const feedbackSnapshot = await db.collection('feedback').where('cycleId', '==', cycleId).get();

      let appliedCount = 0;
      for (const feedbackDoc of feedbackSnapshot.docs) {
        const data = feedbackDoc.data();
        if (data.applied === true) continue;

        const aboutUid = data.aboutUid as string;
        const sentiment = data.sentiment as FeedbackSentiment;

        const meterRef = db.collection('connectionMeters').doc(aboutUid);
        await db.runTransaction(async (tx) => {
          const meterSnap = await tx.get(meterRef);
          const currentScore = meterSnap.exists ? (meterSnap.data()!.score as number) : DEFAULT_CONNECTION_METER;
          const nextScore = applyFeedback(currentScore, sentiment);
          tx.set(meterRef, { score: nextScore, updatedAt: Timestamp.now() }, { merge: true });
          tx.set(feedbackDoc.ref, { applied: true }, { merge: true });
        });
        appliedCount++;
      }

      await cycleDoc.ref.set({ scored: true, updatedAt: Timestamp.now() }, { merge: true });
      await logJobRun({
        jobName: 'feedback-score',
        cycleId,
        status: 'success',
        summary: `Applied ${appliedCount} feedback record(s) to Connection Meter scores.`,
      });
    } catch (err) {
      await logJobRun({
        jobName: 'feedback-score',
        cycleId,
        status: 'failure',
        summary: 'Feedback/score job threw an error.',
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}
