import {
  type DocumentData,
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../init';
import {
  type EmailAutomationConfig,
  type QueueStatus,
  type ReminderType,
  normalizeEmailConfig,
} from '../../lib/emailConfig';
import { type EmailTemplates, resolveTemplates } from '../../lib/emailTemplates';

/**
 * Superadmin-only data access for the Email Automation & Reminders
 * console. Every read here is either a single document or a query with a
 * small fixed limit, and each is run only when the superadmin opens the
 * relevant console tab (nothing polls, nothing subscribes), so the
 * console costs a few dozen reads per visit regardless of member count.
 * Firestore Rules (not this file) restrict all of it to super_admin.
 */

function database() {
  if (!db) throw new Error('Firestore is not configured.');
  return db;
}

const toDate = (v: unknown): Date | null => (v instanceof Timestamp ? v.toDate() : null);

// ---------------------------------------------------------------------
// Config / templates / group addresses (3 single-document reads)
// ---------------------------------------------------------------------

export async function getEmailConfig(): Promise<EmailAutomationConfig> {
  const snap = await getDoc(doc(database(), 'emailAutomation', 'config'));
  return normalizeEmailConfig(snap.exists() ? snap.data() : null);
}

export async function saveEmailConfig(uid: string, config: EmailAutomationConfig): Promise<void> {
  await setDoc(doc(database(), 'emailAutomation', 'config'), {
    ...normalizeEmailConfig(config),
    updatedAt: serverTimestamp(),
    updatedByUid: uid,
  });
}

export async function getEmailTemplates(): Promise<EmailTemplates> {
  const snap = await getDoc(doc(database(), 'emailAutomation', 'templates'));
  return resolveTemplates(snap.exists() ? snap.data() : null);
}

export async function saveEmailTemplates(uid: string, templates: EmailTemplates): Promise<void> {
  const pick = (t: { subject: string; body: string }) => ({ subject: t.subject, body: t.body });
  await setDoc(doc(database(), 'emailAutomation', 'templates'), {
    welcome: pick(templates.welcome),
    birthday: pick(templates.birthday),
    meetup: pick(templates.meetup),
    jobs: pick(templates.jobs),
    updatedAt: serverTimestamp(),
    updatedByUid: uid,
  });
}

/** batchNumber (as string) -> Google Group address. */
export async function getGroupAddresses(): Promise<Record<string, string>> {
  const snap = await getDoc(doc(database(), 'emailAutomation', 'groups'));
  const raw = snap.exists() ? (snap.data().addresses as Record<string, unknown> | undefined) : undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw ?? {})) if (typeof v === 'string') out[k] = v;
  return out;
}

export async function saveGroupAddresses(uid: string, addresses: Record<string, string>): Promise<void> {
  await setDoc(doc(database(), 'emailAutomation', 'groups'), {
    addresses,
    updatedAt: serverTimestamp(),
    updatedByUid: uid,
  });
}

// ---------------------------------------------------------------------
// Status written by the automation job (1 document)
// ---------------------------------------------------------------------

export interface EmailStatus {
  lastRunAt: Date | null;
  lastRunStatus: 'success' | 'partial' | 'failed' | null;
  lastRunSummary: string;
  nextRunAt: Date | null;
  sentTodayDay: string | null;
  sentTodayIndividual: number;
  sentTodayGroup: number;
  dailyLimit: number | null;
  pendingWelcome: number;
  pendingBirthday: number;
  pendingReminders: number;
  failedCount: number;
  gmailConfigured: boolean | null;
}

export async function getEmailStatus(): Promise<EmailStatus | null> {
  const snap = await getDoc(doc(database(), 'emailAutomation', 'status'));
  if (!snap.exists()) return null;
  const d = snap.data();
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);
  return {
    lastRunAt: toDate(d.lastRunAt),
    lastRunStatus: d.lastRunStatus === 'success' || d.lastRunStatus === 'partial' || d.lastRunStatus === 'failed' ? d.lastRunStatus : null,
    lastRunSummary: typeof d.lastRunSummary === 'string' ? d.lastRunSummary : '',
    nextRunAt: toDate(d.nextRunAt),
    sentTodayDay: typeof d.sentTodayDay === 'string' ? d.sentTodayDay : null,
    sentTodayIndividual: num(d.sentTodayIndividual),
    sentTodayGroup: num(d.sentTodayGroup),
    dailyLimit: typeof d.dailyLimit === 'number' ? d.dailyLimit : null,
    pendingWelcome: num(d.pendingWelcome),
    pendingBirthday: num(d.pendingBirthday),
    pendingReminders: num(d.pendingReminders),
    failedCount: num(d.failedCount),
    gmailConfigured: typeof d.gmailConfigured === 'boolean' ? d.gmailConfigured : null,
  };
}

// ---------------------------------------------------------------------
// Queue / history (one limited query per view)
// ---------------------------------------------------------------------

export interface QueueItem {
  id: string;
  kind: 'welcome' | 'birthday' | 'reminder';
  reminderType: ReminderType | null;
  recipient: 'individual' | 'group';
  email: string;
  name: string;
  batchNumber: number | null;
  status: QueueStatus;
  attempts: number;
  lastError: string;
  scheduledDay: string;
  sentAt: Date | null;
  updatedAt: Date | null;
}

const QUEUE_PAGE = 50;

export async function listQueue(status: QueueStatus | 'all'): Promise<QueueItem[]> {
  const col = collection(database(), 'emailQueue');
  const q =
    status === 'all'
      ? query(col, orderBy('updatedAt', 'desc'), fsLimit(QUEUE_PAGE))
      : query(col, where('status', '==', status), orderBy('updatedAt', 'desc'), fsLimit(QUEUE_PAGE));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      kind: x.kind,
      reminderType: x.reminderType === 'meetup' || x.reminderType === 'jobs' ? x.reminderType : null,
      recipient: x.recipient === 'group' ? 'group' : 'individual',
      email: String(x.email ?? ''),
      name: String(x.name ?? ''),
      batchNumber: typeof x.batchNumber === 'number' ? x.batchNumber : null,
      status: x.status,
      attempts: typeof x.attempts === 'number' ? x.attempts : 0,
      lastError: typeof x.lastError === 'string' ? x.lastError : '',
      scheduledDay: String(x.scheduledDay ?? ''),
      sentAt: toDate(x.sentAt),
      updatedAt: toDate(x.updatedAt),
    } as QueueItem;
  });
}

// ---------------------------------------------------------------------
// Manual-send commands
// ---------------------------------------------------------------------

export type EmailCommandAction = 'process_welcome' | 'process_birthday' | 'send_reminder' | 'retry_failed' | 'rebuild_indexes';

export interface EmailCommand {
  id: string;
  action: EmailCommandAction;
  reminderType: ReminderType | null;
  batches: number[];
  status: 'requested' | 'running' | 'done' | 'failed' | 'rejected';
  result: string;
  requestedAt: Date | null;
  completedAt: Date | null;
}

export async function requestEmailCommand(
  uid: string,
  command: { action: EmailCommandAction; reminderType?: ReminderType; batches?: number[] },
): Promise<void> {
  const payload: DocumentData = {
    action: command.action,
    status: 'requested',
    confirmed: true, // the console only calls this after an explicit confirmation dialog
    requestedByUid: uid,
    requestedAt: serverTimestamp(),
  };
  if (command.reminderType) payload.reminderType = command.reminderType;
  if (command.batches) payload.batches = command.batches;
  await addDoc(collection(database(), 'emailCommands'), payload);
}

export async function listEmailCommands(): Promise<EmailCommand[]> {
  const snap = await getDocs(query(collection(database(), 'emailCommands'), orderBy('requestedAt', 'desc'), fsLimit(10)));
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      action: x.action,
      reminderType: x.reminderType === 'meetup' || x.reminderType === 'jobs' ? x.reminderType : null,
      batches: Array.isArray(x.batches) ? x.batches.filter((n: unknown): n is number => typeof n === 'number') : [],
      status: x.status,
      result: typeof x.result === 'string' ? x.result : '',
      requestedAt: toDate(x.requestedAt),
      completedAt: toDate(x.completedAt),
    } as EmailCommand;
  });
}

// ---------------------------------------------------------------------
// Google Group membership reports (1 document per batch)
// ---------------------------------------------------------------------

export interface GroupReport {
  batchNumber: number;
  emails: string[];
  baseline: string[];
  updatedAt: Date | null;
  baselineAt: Date | null;
}

function toReport(id: string, x: DocumentData): GroupReport {
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((e): e is string => typeof e === 'string') : []);
  return {
    batchNumber: typeof x.batchNumber === 'number' ? x.batchNumber : Number(id),
    emails: arr(x.emails),
    baseline: arr(x.baseline),
    updatedAt: toDate(x.updatedAt),
    baselineAt: toDate(x.baselineAt),
  };
}

export async function getGroupReport(batchNumber: number): Promise<GroupReport | null> {
  const snap = await getDoc(doc(database(), 'emailGroupReports', String(batchNumber)));
  return snap.exists() ? toReport(snap.id, snap.data()) : null;
}

/** One read per batch — only when the superadmin explicitly asks for the all-batches view. */
export async function listGroupReports(): Promise<GroupReport[]> {
  const snap = await getDocs(query(collection(database(), 'emailGroupReports'), fsLimit(100)));
  return snap.docs.map((d) => toReport(d.id, d.data())).sort((a, b) => a.batchNumber - b.batchNumber);
}

/** "I have updated the Google Group": moves the baseline to exactly the current list (Rules enforce that). */
export async function markGroupApplied(batchNumber: number, currentEmails: string[]): Promise<void> {
  await updateDoc(doc(database(), 'emailGroupReports', String(batchNumber)), {
    baseline: currentEmails,
    baselineAt: serverTimestamp(),
  });
}

export function diffReport(report: GroupReport): { added: string[]; removed: string[] } {
  const base = new Set(report.baseline);
  const cur = new Set(report.emails);
  return {
    added: report.emails.filter((e) => !base.has(e)),
    removed: report.baseline.filter((e) => !cur.has(e)),
  };
}
