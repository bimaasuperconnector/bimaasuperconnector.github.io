import { FieldPath, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { db } from '../firebaseAdmin';
import { CURRENT_MAX_BATCH_NUMBER, isValidBatchNumber } from '../../../src/lib/batches';
import { isValidEmail, istDate, welcomeQueueId } from '../../../src/lib/emailConfig';
import { createIfAbsent, reportsCol, ts, type RunContext } from './context';

/**
 * Two jobs from ONE cheap query:
 *  1. keeps a per-batch list of approved members' emails (the Google
 *     Group membership reports the superadmin copies from), and
 *  2. queues the welcome email for newly approved members.
 *
 * READ COST: after the first run, only users whose document changed since
 * the previous run are read (users.updatedAt watermark) — typically a
 * handful per day, 1 read when nothing changed. The one-off full rebuild
 * (first run, or the superadmin's "Rebuild indexes" command) reads each
 * approved member once.
 *
 * A welcome email is queued for any approved member whose users document
 * carries `approvedAt` (stamped by the app at approval time, so members
 * approved before this feature existed are never emailed). The queue
 * document ID is deterministic, so re-queuing is a harmless no-op.
 */

const PAGE = 500;
const SAFETY_MS = 5 * 60 * 1000;
const USER_FIELDS = ['email', 'displayName', 'batchNumber', 'status', 'approvedAt', 'updatedAt'];

interface Change {
  email: string;
  member: boolean;
}

function readUser(data: DocumentData) {
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  const batch = typeof data.batchNumber === 'number' ? data.batchNumber : null;
  return {
    email,
    batch: batch !== null && isValidBatchNumber(batch) ? batch : null,
    approved: data.status === 'approved',
    name: typeof data.displayName === 'string' ? data.displayName : '',
    approvedAt: data.approvedAt instanceof Timestamp ? (data.approvedAt as Timestamp) : null,
  };
}

async function queueWelcome(ctx: RunContext, uid: string, u: ReturnType<typeof readUser>): Promise<void> {
  if (!u.approved || !u.approvedAt || !isValidEmail(u.email)) return;
  const created = await createIfAbsent(welcomeQueueId(uid), {
    kind: 'welcome',
    recipient: 'individual',
    uid,
    email: u.email,
    name: u.name,
    batchNumber: u.batch,
    status: 'pending',
    attempts: 0,
    createdAt: u.approvedAt,
    dueAt: u.approvedAt, // FIFO: oldest approval first
    scheduledDay: istDate(u.approvedAt.toDate()).key,
    source: 'auto',
    updatedAt: ts(ctx.now),
  });
  if (created) ctx.stats.welcomeQueued++;
}

async function writeReports(ctx: RunContext, desired: Map<number, Change[]>, replaceAll: Map<number, Set<string>> | null) {
  const batches = replaceAll ? Array.from({ length: CURRENT_MAX_BATCH_NUMBER }, (_, i) => i + 1) : [...desired.keys()];
  if (batches.length === 0) return;
  const refs = batches.map((n) => reportsCol().doc(String(n)));
  const snaps = await db.getAll(...refs);
  let writer = db.batch();
  let ops = 0;
  for (let i = 0; i < batches.length; i++) {
    const n = batches[i];
    const snap = snaps[i];
    let emails: Set<string>;
    if (replaceAll) {
      emails = replaceAll.get(n) ?? new Set();
    } else {
      emails = new Set<string>(snap.exists ? ((snap.data()!.emails as string[]) ?? []) : []);
      for (const c of desired.get(n) ?? []) {
        if (c.member) emails.add(c.email);
        else emails.delete(c.email);
      }
    }
    const list = [...emails].sort();
    const previous = snap.exists ? ((snap.data()!.emails as string[]) ?? []) : null;
    if (previous && previous.length === list.length && previous.every((e, k) => e === list[k])) continue;
    if (!snap.exists && list.length === 0) continue;
    const payload: DocumentData = { batchNumber: n, emails: list, count: list.length, updatedAt: ts(ctx.now) };
    if (!snap.exists) {
      payload.baseline = [];
      payload.baselineAt = null;
    }
    writer.set(refs[i], payload, { merge: true });
    ctx.stats.groupBatchesUpdated++;
    if (++ops >= 400) {
      await writer.commit();
      writer = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await writer.commit();
}

async function fullRebuild(ctx: RunContext): Promise<void> {
  const byBatch = new Map<number, Set<string>>();
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let scanned = 0;
  for (;;) {
    let q = db
      .collection('users')
      .where('status', '==', 'approved')
      .orderBy(FieldPath.documentId())
      .select(...USER_FIELDS)
      .limit(1000);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      scanned++;
      const u = readUser(doc.data());
      if (u.batch !== null && isValidEmail(u.email)) {
        if (!byBatch.has(u.batch)) byBatch.set(u.batch, new Set());
        byBatch.get(u.batch)!.add(u.email);
      }
      await queueWelcome(ctx, doc.id, u);
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 1000) break;
  }
  await writeReports(ctx, new Map(), byBatch);
  ctx.state.groupSyncWatermark = ts(new Date(ctx.now.getTime() - SAFETY_MS));
  ctx.notes.push(`Rebuilt Google Group reports from ${scanned} approved members.`);
}

async function incremental(ctx: RunContext): Promise<void> {
  const watermark = ctx.state.groupSyncWatermark as Timestamp;
  const desired = new Map<number, Map<string, boolean>>();
  let cursor: Timestamp = watermark;
  let latest: Timestamp = watermark;
  let seen = 0;
  for (;;) {
    const snap = await db
      .collection('users')
      .where('updatedAt', '>=', cursor)
      .orderBy('updatedAt', 'asc')
      .select(...USER_FIELDS)
      .limit(PAGE)
      .get();
    for (const doc of snap.docs) {
      seen++;
      const u = readUser(doc.data());
      if (u.batch !== null && isValidEmail(u.email)) {
        if (!desired.has(u.batch)) desired.set(u.batch, new Map());
        desired.get(u.batch)!.set(u.email, u.approved);
      }
      await queueWelcome(ctx, doc.id, u);
      const updatedAt = doc.data().updatedAt;
      if (updatedAt instanceof Timestamp && updatedAt.toMillis() > latest.toMillis()) latest = updatedAt;
    }
    if (snap.size < PAGE) break;
    const next = latest;
    if (next.toMillis() === cursor.toMillis()) break; // a full page at a single instant: avoid looping forever
    cursor = next;
  }
  const changes = new Map<number, Change[]>();
  for (const [n, m] of desired) changes.set(n, [...m].map(([email, member]) => ({ email, member })));
  await writeReports(ctx, changes, null);
  ctx.state.groupSyncWatermark = latest;
  if (seen > 0) ctx.notes.push(`Processed ${seen} changed member record(s).`);
}

export async function syncGroupReportsAndWelcomeQueue(ctx: RunContext): Promise<void> {
  if (ctx.force.rebuild || !(ctx.state.groupSyncWatermark instanceof Timestamp)) {
    await fullRebuild(ctx);
  } else {
    await incremental(ctx);
  }
  ctx.state.groupSyncAt = ts(ctx.now);
}
