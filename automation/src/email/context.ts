import { Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { db } from '../firebaseAdmin';
import type { EmailAutomationConfig, IstDate, ReminderType } from '../../../src/lib/emailConfig';
import type { EmailTemplates } from '../../../src/lib/emailTemplates';

export const queueCol = () => db.collection('emailQueue');
export const automationDoc = (id: string) => db.collection('emailAutomation').doc(id);
export const reportsCol = () => db.collection('emailGroupReports');
export const commandsCol = () => db.collection('emailCommands');

export interface RunStats {
  welcomeQueued: number;
  birthdayQueued: number;
  remindersQueued: number;
  welcomeSent: number;
  birthdaySent: number;
  remindersSent: number;
  failed: number;
  skipped: number;
  groupBatchesUpdated: number;
  commandsRun: number;
}

export interface RunContext {
  now: Date;
  today: IstDate;
  config: EmailAutomationConfig;
  /** Persistent bookkeeping (the emailAutomation/status document). Saved at the end of the run. */
  state: DocumentData;
  templates: EmailTemplates | null;
  groups: Record<string, string> | null;
  stats: RunStats;
  force: {
    welcome: boolean;
    birthday: boolean;
    rebuild: boolean;
    /** Manual reminder sends: type -> batches */
    reminders: Map<ReminderType, number[]>;
  };
  /** Set when sending must stop for the rest of the run (bad credentials / quota). */
  stop: { kind: 'auth' | 'quota' | 'not_configured'; message: string } | null;
  notes: string[];
}

export function ts(d: Date): Timestamp {
  return Timestamp.fromDate(d);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Firestore Admin "ALREADY_EXISTS" (gRPC code 6). */
export function isAlreadyExists(err: unknown): boolean {
  const e = err as { code?: number | string; message?: string };
  return e?.code === 6 || e?.code === 'already-exists' || /ALREADY_EXISTS/.test(String(e?.message));
}

/** Creates the document only if absent. Returns true when created (the idempotency primitive for every queue item). */
export async function createIfAbsent(id: string, data: DocumentData): Promise<boolean> {
  try {
    await queueCol().doc(id).create(data);
    return true;
  } catch (err) {
    if (isAlreadyExists(err)) return false;
    throw err;
  }
}

/** One aggregation read (billed as 1 read per 1,000 matching index entries), never a document download. */
export async function countQuery(q: FirebaseFirestore.Query): Promise<number> {
  const snap = await q.count().get();
  return snap.data().count;
}
