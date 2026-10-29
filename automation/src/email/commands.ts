import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { db } from '../firebaseAdmin';
import { isValidBatchNumber } from '../../../src/lib/batches';
import { REMINDER_TYPES, type ReminderType } from '../../../src/lib/emailConfig';
import { commandsCol, queueCol, ts, type RunContext } from './context';

/**
 * Executes manual requests created from the superadmin console.
 * The browser can only create a confirmed `requested` command in the
 * superadmin's own name (Firestore Rules); here the job additionally
 * re-checks that the requester is STILL a superadmin before acting.
 * Commands never bypass the safety rails: the daily budget, the pause
 * switch and the one-document-per-email dedupe all still apply, so a
 * manual send can never duplicate an email or exceed the limit.
 */

const MAX_COMMANDS_PER_RUN = 10;

async function isSuperAdmin(uid: unknown): Promise<boolean> {
  if (typeof uid !== 'string' || !uid) return false;
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists && snap.data()?.role === 'super_admin' && snap.data()?.status === 'approved';
}

async function retryFailed(ctx: RunContext): Promise<number> {
  const failed = await queueCol().where('status', '==', 'failed').limit(200).get();
  if (failed.empty) return 0;
  const writer = db.batch();
  for (const d of failed.docs) {
    writer.update(d.ref, {
      status: 'pending',
      attempts: 0,
      dueAt: ts(ctx.now),
      sentDay: FieldValue.delete(),
      lastError: FieldValue.delete(),
      updatedAt: ts(ctx.now),
    });
  }
  await writer.commit();
  return failed.size;
}

export async function runCommands(ctx: RunContext): Promise<void> {
  const pending = await commandsCol().where('status', '==', 'requested').orderBy('requestedAt', 'asc').limit(MAX_COMMANDS_PER_RUN).get();
  for (const snap of pending.docs) {
    const cmd = snap.data() as DocumentData;
    const finish = (status: 'done' | 'failed' | 'rejected', result: string) =>
      snap.ref.update({ status, result, completedAt: ts(new Date()) });

    if (cmd.confirmed !== true || !(await isSuperAdmin(cmd.requestedByUid))) {
      await finish('rejected', 'Requester is not an approved superadmin, or the request was not confirmed.');
      continue;
    }
    try {
      await snap.ref.update({ status: 'running', startedAt: ts(new Date()) });
      let result = 'Accepted.';
      switch (cmd.action) {
        case 'process_welcome':
          ctx.force.welcome = true;
          result = 'Welcome backlog will be processed now (within today\u2019s limit).';
          break;
        case 'process_birthday':
          ctx.force.birthday = true;
          result = 'Today\u2019s birthday greetings will be processed now (within today\u2019s limit).';
          break;
        case 'send_reminder': {
          const type = cmd.reminderType as ReminderType;
          if (!REMINDER_TYPES.includes(type)) throw new Error('Unknown reminder type.');
          const batches = (Array.isArray(cmd.batches) ? (cmd.batches as unknown[]) : [])
            .filter((n): n is number => typeof n === 'number' && isValidBatchNumber(n));
          if (batches.length === 0) throw new Error('No valid batches selected.');
          const merged = new Set([...(ctx.force.reminders.get(type) ?? []), ...batches]);
          ctx.force.reminders.set(type, [...merged].sort((a, b) => a - b));
          result = `${type} reminder queued for ${batches.length} batch(es). Batches already sent this month are skipped automatically.`;
          break;
        }
        case 'retry_failed':
          result = `${await retryFailed(ctx)} failed item(s) put back in the queue.`;
          break;
        case 'rebuild_indexes':
          ctx.force.rebuild = true;
          result = 'Google Group reports and the birthday index will be rebuilt.';
          break;
        default:
          throw new Error('Unknown action.');
      }
      ctx.stats.commandsRun++;
      await finish('done', result);
    } catch (err) {
      await finish('failed', err instanceof Error ? err.message.slice(0, 300) : 'Failed.');
    }
  }
}
