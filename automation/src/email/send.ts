import { FieldValue, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import type { gmail_v1 } from 'googleapis';
import { db } from '../firebaseAdmin';
import {
  BIRTHDAY_CATCHUP_DAYS,
  GROUP_DAILY_HARD_LIMIT,
  MAX_SEND_ATTEMPTS,
  RETRY_DELAY_HOURS,
  istDateMinusDays,
  type ReminderType,
} from '../../../src/lib/emailConfig';
import { renderEmail } from '../../../src/lib/emailTemplates';
import { personVars, reminderVars } from '../../../src/lib/emailVars';
import { classifySendError, sendEmail } from './gmail';
import { countQuery, queueCol, sleep, ts, type RunContext } from './context';

/**
 * Sends queued emails without ever exceeding the day's budget.
 *
 * Safety rules:
 *  - The day's usage is counted from the queue itself (items stamped with
 *    today's `sentDay`), so a second run the same day (manual dispatch,
 *    retry) sees the real remaining budget.
 *  - An item is stamped `sending` + `sentDay` BEFORE the Gmail call and
 *    only un-stamped when we KNOW it failed. A crash in between leaves it
 *    counted and flagged, never silently re-sent.
 *  - Welcome emails are always served before birthdays, oldest first.
 */

const SEND_PAUSE_MS = 250;

type Snap = FirebaseFirestore.QueryDocumentSnapshot;

async function markFailedOrRetry(snap: Snap, attempts: number, message: string, ctx: RunContext, permanent: boolean) {
  if (permanent || attempts >= MAX_SEND_ATTEMPTS) {
    await snap.ref.update({
      status: 'failed',
      sentDay: FieldValue.delete(),
      lastError: message,
      updatedAt: ts(ctx.now),
    });
    ctx.stats.failed++;
  } else {
    await snap.ref.update({
      status: 'pending',
      sentDay: FieldValue.delete(),
      lastError: message,
      dueAt: ts(new Date(ctx.now.getTime() + RETRY_DELAY_HOURS * 3600 * 1000)),
      updatedAt: ts(ctx.now),
    });
  }
}

/** Returns true when the item was delivered. Sets ctx.stop on credential/quota problems. */
async function deliver(
  gmail: gmail_v1.Gmail,
  snap: Snap,
  ctx: RunContext,
  subjectBody: { subject: string; text: string; html: string },
): Promise<boolean> {
  const data = snap.data();
  const attempts = (typeof data.attempts === 'number' ? data.attempts : 0) + 1;
  // Reserve first (counts against today's budget even if we crash right after).
  await snap.ref.update({ status: 'sending', sentDay: ctx.today.key, attempts, updatedAt: ts(ctx.now) });
  try {
    const messageId = await sendEmail(gmail, { to: data.email, ...subjectBody });
    await snap.ref.update({
      status: 'sent',
      sentAt: Timestamp.now(),
      messageId,
      lastError: FieldValue.delete(),
      updatedAt: Timestamp.now(),
    });
    return true;
  } catch (err) {
    const { kind, message } = classifySendError(err);
    if (kind === 'auth' || kind === 'quota') {
      // Not this item's fault: give the attempt back and stop the run.
      await snap.ref.update({
        status: 'pending',
        sentDay: FieldValue.delete(),
        attempts: FieldValue.increment(-1),
        lastError: message,
        updatedAt: ts(ctx.now),
      });
      ctx.stop = { kind, message };
      return false;
    }
    await markFailedOrRetry(snap, attempts, message, ctx, kind === 'permanent');
    return false;
  }
}

async function skip(snap: Snap, reason: string, ctx: RunContext) {
  await snap.ref.update({ status: 'skipped', lastError: reason, updatedAt: ts(ctx.now) });
  ctx.stats.skipped++;
}

/** Marks sends interrupted mid-flight (status `sending`) as failed-unknown so they are never auto-resent. */
export async function recoverInterrupted(ctx: RunContext): Promise<void> {
  const stuck = await queueCol().where('status', '==', 'sending').limit(100).get();
  for (const snap of stuck.docs) {
    await snap.ref.update({
      status: 'failed',
      lastError: 'A previous run was interrupted while sending. Delivery is unknown, so it was not retried automatically. Use "Retry failed" if the member did not receive it.',
      updatedAt: ts(ctx.now),
    });
    ctx.stats.failed++;
  }
}

async function individualsSentToday(ctx: RunContext): Promise<number> {
  return countQuery(queueCol().where('sentDay', '==', ctx.today.key).where('recipient', '==', 'individual'));
}

async function groupsSentToday(ctx: RunContext): Promise<number> {
  return countQuery(queueCol().where('sentDay', '==', ctx.today.key).where('recipient', '==', 'group'));
}

export async function sendIndividuals(ctx: RunContext, gmail: gmail_v1.Gmail): Promise<void> {
  if (ctx.config.paused || ctx.stop || !ctx.templates) return;
  let remaining = Math.max(0, ctx.config.dailyLimit - (await individualsSentToday(ctx)));
  ctx.notes.push(`Individual budget remaining today: ${remaining}/${ctx.config.dailyLimit}.`);

  const kinds: ('welcome' | 'birthday')[] = ['welcome', 'birthday'];
  for (const kind of kinds) {
    const enabled = kind === 'welcome' ? ctx.config.welcomeEnabled || ctx.force.welcome : ctx.config.birthdayEnabled || ctx.force.birthday;
    if (!enabled) continue;
    const oldestBirthday = istDateMinusDays(ctx.today, BIRTHDAY_CATCHUP_DAYS).key;

    for (let round = 0; round < 6 && remaining > 0 && !ctx.stop; round++) {
      const snaps = await queueCol()
        .where('kind', '==', kind)
        .where('status', '==', 'pending')
        .where('dueAt', '<=', ts(ctx.now))
        .orderBy('dueAt', 'asc')
        .limit(remaining)
        .get();
      if (snaps.empty) break;

      // Confirm each recipient is still an approved member (reads <= the day's budget).
      const userSnaps = await db.getAll(...snaps.docs.map((s) => db.collection('users').doc(String(s.data().uid))));
      let progressed = false;
      for (let i = 0; i < snaps.docs.length && remaining > 0 && !ctx.stop; i++) {
        const snap = snaps.docs[i];
        const data = snap.data();
        const user = userSnaps[i];
        if (!user.exists || (user.data() as DocumentData).status !== 'approved') {
          await skip(snap, 'Member is no longer approved.', ctx);
          progressed = true;
          continue;
        }
        if (kind === 'birthday' && String(data.scheduledDay) < oldestBirthday) {
          await skip(snap, 'Birthday greeting expired (not sent within the catch-up window).', ctx);
          progressed = true;
          continue;
        }
        const rendered = renderEmail(ctx.templates[kind], personVars(String(data.name ?? ''), data.batchNumber ?? null));
        const ok = await deliver(gmail, snap, ctx, rendered);
        progressed = true;
        if (ok) {
          remaining--;
          if (kind === 'welcome') ctx.stats.welcomeSent++;
          else ctx.stats.birthdaySent++;
        }
        await sleep(SEND_PAUSE_MS);
      }
      if (!progressed) break;
    }
  }
}

export async function sendGroupReminders(ctx: RunContext, gmail: gmail_v1.Gmail): Promise<void> {
  if (ctx.config.paused || ctx.stop || !ctx.templates) return;
  let remaining = Math.max(0, GROUP_DAILY_HARD_LIMIT - (await groupsSentToday(ctx)));
  if (remaining <= 0) return;

  const snaps = await queueCol()
    .where('kind', '==', 'reminder')
    .where('status', '==', 'pending')
    .where('dueAt', '<=', ts(ctx.now))
    .orderBy('dueAt', 'asc')
    .limit(Math.min(500, remaining + 100))
    .get();

  for (const snap of snaps.docs) {
    if (remaining <= 0 || ctx.stop) break;
    const data = snap.data();
    const type = data.reminderType as ReminderType;
    if (data.monthKey !== ctx.today.monthKey) {
      await skip(snap, 'Reminder expired (it was not sent during its month).', ctx);
      continue;
    }
    const enabled = type === 'meetup' ? ctx.config.meetupEnabled : ctx.config.jobsEnabled;
    if (!enabled && data.source !== 'manual') continue; // switched off: stays queued, never sent
    const rendered = renderEmail(ctx.templates[type], reminderVars(type, Number(data.batchNumber), ctx.today));
    const ok = await deliver(gmail, snap, ctx, rendered);
    if (ok) {
      remaining--;
      ctx.stats.remindersSent++;
    }
    await sleep(SEND_PAUSE_MS);
  }
}
