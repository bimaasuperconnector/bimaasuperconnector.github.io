import { doc, getDoc } from 'firebase/firestore';
import { db } from '../init';
import type { CycleStatus } from '../../lib/cycles';

export interface CycleState {
  status: CycleStatus;
}

/**
 * Read-only. Only the cycle-state automation job (Admin SDK) ever
 * writes `connectionCycles/{cycleId}` — see firestore.rules. Returns
 * null if the cycle-state job hasn't run for this cycleId yet, which
 * the UI should treat the same as "registration open" (matches the
 * rules' own default-open behavior for the same reason).
 */
export async function getCycleState(cycleId: string): Promise<CycleState | null> {
  if (!db) throw new Error('Firestore is not configured.');
  const snapshot = await getDoc(doc(db, 'connectionCycles', cycleId));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return { status: data.status as CycleStatus };
}
