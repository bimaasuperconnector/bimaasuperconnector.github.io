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
const LOCK_COLLECTION = 'systemConfig';
const DEFAULT_LOCK_ID = 'automationLock';
const STALE_AFTER_MS = 20 * 60 * 1000; // 20 minutes — generous for how long one run should ever take

/** `lockId` lets independent jobs (e.g. the email job) hold their own lock without blocking each other. */
export async function acquireLock(runId: string, lockId: string = DEFAULT_LOCK_ID): Promise<boolean> {
  const ref = db.collection(LOCK_COLLECTION).doc(lockId);

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

export async function releaseLock(lockId: string = DEFAULT_LOCK_ID): Promise<void> {
  const ref = db.collection(LOCK_COLLECTION).doc(lockId);
  await ref.set({ locked: false, lockedAt: Timestamp.now() }, { merge: true });
}
