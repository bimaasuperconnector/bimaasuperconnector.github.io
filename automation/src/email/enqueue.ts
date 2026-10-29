import { Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { db } from '../firebaseAdmin';
import { currentMaxBatchNumber, isValidBatchNumber } from '../../../src/lib/batches';
import {
  BIRTHDAY_CATCHUP_DAYS,
  REMINDER_TYPES,
  REMINDER_WINDOW_DAYS,
  birthdayKeysForDate,
  birthdayQueueId,
  dobToMonthDay,
  isValidEmail,
  istDateMinusDays,
  reminderQueueId,
  type IstDate,
  type ReminderType,
} from '../../../src/lib/emailConfig';
import { createIfAbsent, ts, type RunContext } from './context';

// ---------------------------------------------------------------------
// Birthdays
// ---------------------------------------------------------------------

/**
 * One-off (and on "Rebuild indexes"): fills the private `dobMD` ('MM-DD')
 * field on profileContacts documents saved before that field existed, so
 * the daily query can find "today's birthdays" without reading everyone.
 * Reads each contact document once; writes only the ones that need it.
 */
async function backfillDobIndex(ctx: RunContext): Promise<void> {
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let scanned = 0;
  let updated = 0;
  for (;;) {
    let q = db.collection('profileContacts').orderBy('__name__').select('dob', 'dobMD').limit(500);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    const writer = db.batch();
    let ops = 0;
    for (const doc of snap.docs) {
      scanned++;
      const md = dobToMonthDay(doc.data().dob);
      if (md && doc.data().dobMD !== md) {
        writer.update(doc.ref, { dobMD: md });
        ops++;
      }
    }
    if (ops > 0) {
      await writer.commit();
      updated += ops;
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 500) break;
  }
  ctx.state.dobBackfilledAt = ts(ctx.now);
  ctx.notes.push(`Birthday index: scanned ${scanned} contact record(s), updated ${updated}.`);
}

async function queueBirthdaysFor(ctx: RunContext, day: IstDate): Promise<void> {
  const keys = birthdayKeysForDate(day);
  const contacts = await db.collection('profileContacts').where('dobMD', 'in', keys).select('dobMD').get();
  if (contacts.empty) return;
  const userSnaps = await db.getAll(...contacts.docs.map((d) => db.collection('users').doc(d.id)));
  for (const u of userSnaps) {
    if (!u.exists) continue;
    const data = u.data() as DocumentData;
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    if (data.status !== 'approved' || !isValidEmail(email)) continue;
    const batch = typeof data.batchNumber === 'number' && isValidBatchNumber(data.batchNumber) ? data.batchNumber : null;
    const created = await createIfAbsent(birthdayQueueId(u.id, day.year), {
      kind: 'birthday',
      recipient: 'individual',
      uid: u.id,
      email,
      name: typeof data.displayName === 'string' ? data.displayName : '',
      batchNumber: batch,
      status: 'pending',
      attempts: 0,
      createdAt: ts(ctx.now),
      dueAt: ts(ctx.now),
      scheduledDay: day.key,
      source: 'auto',
      updatedAt: ts(ctx.now),
    });
    if (created) ctx.stats.birthdayQueued++;
  }
}

/** Queues today's birthday greetings (plus any missed in the last few days). Once per IST day, safe to re-run. */
export async function enqueueBirthdays(ctx: RunContext): Promise<void> {
  const enabled = ctx.config.birthdayEnabled || ctx.force.birthday;
  if (ctx.config.paused || !enabled) return;

  if (ctx.force.rebuild || !(ctx.state.dobBackfilledAt instanceof Timestamp)) await backfillDobIndex(ctx);

  const last = typeof ctx.state.birthdayProcessedDay === 'string' ? ctx.state.birthdayProcessedDay : null;
  const days: IstDate[] = [];
  for (let back = BIRTHDAY_CATCHUP_DAYS; back >= 0; back--) {
    const d = istDateMinusDays(ctx.today, back);
    // Only days after the last fully-processed day (or just today on the very first run / a forced run).
    if (back === 0 || (last !== null && d.key > last)) days.push(d);
  }
  for (const d of days) await queueBirthdaysFor(ctx, d);
  ctx.state.birthdayProcessedDay = ctx.today.key;
}

// ---------------------------------------------------------------------
// Monthly Google Group reminders
// ---------------------------------------------------------------------

function groupAddress(ctx: RunContext, batch: number): string | null {
  const v = ctx.groups?.[String(batch)];
  return typeof v === 'string' && isValidEmail(v) ? v.trim().toLowerCase() : null;
}

async function queueReminders(ctx: RunContext, type: ReminderType, batches: number[]): Promise<void> {
  const markerKey = `${type}_${ctx.today.monthKey}`;
  const marked = new Set<number>(
    Array.isArray(ctx.state.remindersEnqueued?.[markerKey]) ? (ctx.state.remindersEnqueued[markerKey] as number[]) : [],
  );
  for (const n of batches) {
    if (marked.has(n)) continue;
    const email = groupAddress(ctx, n);
    if (!email) continue; // no (valid) group address yet: skipped until the superadmin adds one
    const created = await createIfAbsent(reminderQueueId(type, n, ctx.today.monthKey), {
      kind: 'reminder',
      reminderType: type,
      recipient: 'group',
      email,
      name: '',
      batchNumber: n,
      status: 'pending',
      attempts: 0,
      createdAt: ts(ctx.now),
      dueAt: ts(ctx.now),
      scheduledDay: ctx.today.key,
      monthKey: ctx.today.monthKey,
      source: ctx.force.reminders.has(type) ? 'manual' : 'auto',
      updatedAt: ts(ctx.now),
    });
    if (created) ctx.stats.remindersQueued++;
    marked.add(n);
  }
  const current = (ctx.state.remindersEnqueued ?? {}) as Record<string, number[]>;
  // keep only the current month's markers
  const pruned: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(current)) if (k.endsWith(ctx.today.monthKey)) pruned[k] = v;
  pruned[markerKey] = [...marked].sort((a, b) => a - b);
  ctx.state.remindersEnqueued = pruned;
}

export async function enqueueReminders(ctx: RunContext): Promise<void> {
  if (ctx.config.paused) return;

  // Manual sends: exactly the requested batches, regardless of the date window / enabled switch / target list.
  for (const [type, batches] of ctx.force.reminders) {
    await queueReminders(ctx, type, batches.filter(isValidBatchNumber));
  }

  // Scheduled sends: on the chosen day, or a few days later if a run was missed.
  const { monthlyDay } = ctx.config;
  const inWindow = ctx.today.day >= monthlyDay && ctx.today.day <= monthlyDay + REMINDER_WINDOW_DAYS;
  if (!inWindow) return;
  const targets = ctx.config.targetBatches.length
    ? ctx.config.targetBatches.filter(isValidBatchNumber)
    : Array.from({ length: currentMaxBatchNumber() }, (_, i) => i + 1);
  for (const type of REMINDER_TYPES) {
    const enabled = type === 'meetup' ? ctx.config.meetupEnabled : ctx.config.jobsEnabled;
    if (!enabled || ctx.force.reminders.has(type)) continue;
    await queueReminders(ctx, type, targets);
  }
}
