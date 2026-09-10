import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin';
import { logJobRun } from './auditLog';
import { createNotification } from './notifications';
import {
  currentCycle,
  computeCycleSchedule,
  determineNextStatus,
  type CycleStatus,
} from '../../src/lib/cycles';

const NON_TERMINAL_STATUSES: CycleStatus[] = [
  'registration_open',
  'registration_closed',
  'matching_complete',
  'feedback_open',
];

/**
 * 1. Ensures a connectionCycles doc exists for the computed "current"
 *    cycle (idempotent — no-op if it already exists).
 * 2. For every cycle not yet 'archived', checks whether its time-based
 *    cutoff has passed and transitions it if so. `registration_closed`
 *    -> `matching_complete` is intentionally NOT handled here — that
 *    only happens once the matching job has actually produced results
 *    (see matchingJob.ts) — a pure clock check should never claim
 *    matching happened when it didn't.
 */
export async function runCycleStateJob(): Promise<void> {
  const cycle = currentCycle();
  const ref = db.collection('connectionCycles').doc(cycle.id);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    await ref.set({
      id: cycle.id,
      year: cycle.year,
      month: cycle.month,
      saturday: Timestamp.fromDate(cycle.saturday),
      sunday: Timestamp.fromDate(cycle.sunday),
      status: 'registration_open' satisfies CycleStatus,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await logJobRun({
      jobName: 'cycle-state',
      cycleId: cycle.id,
      status: 'success',
      summary: `Created new cycle ${cycle.id} as registration_open.`,
    });
  }

  // Check every non-terminal cycle for a due time-based transition, not
  // just the "current" one — a prior cycle can still be in
  // feedback_open while a new one is registration_open.
  const now = new Date();
  const activeCycles = await db
    .collection('connectionCycles')
    .where('status', 'in', NON_TERMINAL_STATUSES)
    .get();

  for (const doc of activeCycles.docs) {
    const data = doc.data();
    const status = data.status as CycleStatus;
    const cycleForSchedule = {
      id: doc.id,
      year: data.year,
      month: data.month,
      saturday: (data.saturday as Timestamp).toDate(),
      sunday: (data.sunday as Timestamp).toDate(),
    };
    const schedule = computeCycleSchedule(cycleForSchedule);
    const next = determineNextStatus(status, schedule, now);

    if (next && next !== status) {
      await doc.ref.set({ status: next, updatedAt: Timestamp.now() }, { merge: true });
      await logJobRun({
        jobName: 'cycle-state',
        cycleId: doc.id,
        status: 'success',
        summary: `Transitioned ${doc.id}: ${status} -> ${next}.`,
      });

      if (next === 'feedback_open') {
        await notifyFeedbackWindowOpen(doc.id);
      }
    }
  }
}

async function notifyFeedbackWindowOpen(cycleId: string): Promise<void> {
  const participants = await db.collection('matchParticipants').where('cycleId', '==', cycleId).get();
  for (const p of participants.docs) {
    const uid = p.data().uid as string;
    await createNotification(
      uid,
      'feedback_open',
      'How did your connection go?',
      "Your SuperConnector meeting for this cycle should have happened by now — let us know how it went.",
      cycleId,
    );
  }
}
