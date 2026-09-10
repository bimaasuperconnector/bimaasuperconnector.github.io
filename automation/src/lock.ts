import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin';

/**
 * Prevents two automation runs from executing concurrently — e.g. a
 * slow scheduled run overlapping with a manual workflow_dispatch. Per
 * SECURITY_AND_TESTING.md: "Use a Firestore lock/lease... to prevent
 * duplicate monthly execution."
 *
 * A lock older than STALE_AFTER_MS is treated as abandoned (the run
 * that held it presumably crashed without releasing it) and can be
 * taken over — otherwise a single crashed run would permanently wedge
 * all future automation.
 */
const LOCK_DOC_PATH = ['systemConfig', 'automationLock'] as const;
const STALE_AFTER_MS = 20 * 60 * 1000; // 20 minutes — generous for how long one run should ever take

export async function acquireLock(runId: string): Promise<boolean> {
  const ref = db.collection(LOCK_DOC_PATH[0]).doc(LOCK_DOC_PATH[1]);

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (snapshot.exists) {
      const data = snapshot.data()!;
      const lockedAt: Timestamp | undefined = data.lockedAt;
      const isStale = !lockedAt || Date.now() - lockedAt.toMillis() > STALE_AFTER_MS;
      if (data.locked === true && !isStale) {
        return false; // another run genuinely in progress
      }
    }
    tx.set(ref, { locked: true, lockedAt: Timestamp.now(), runId });
    return true;
  });
}

export async function releaseLock(): Promise<void> {
  const ref = db.collection(LOCK_DOC_PATH[0]).doc(LOCK_DOC_PATH[1]);
  await ref.set({ locked: false, lockedAt: Timestamp.now() }, { merge: true });
}
