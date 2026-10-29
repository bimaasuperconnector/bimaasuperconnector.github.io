import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { acquireLock, releaseLock } from '../lock';
import { logJobRun } from '../auditLog';
import { DEFAULT_EMAIL_CONFIG, INDIVIDUAL_DAILY_HARD_LIMIT, istDate, nextScheduledRun, normalizeEmailConfig } from '../../../src/lib/emailConfig';
import { resolveTemplates } from '../../../src/lib/emailTemplates';
import { automationDoc, countQuery, queueCol, ts, type RunContext, type RunStats } from './context';
import { runCommands } from './commands';
import { syncGroupReportsAndWelcomeQueue } from './groupSync';
import { enqueueBirthdays, enqueueReminders } from './enqueue';
import { gmailConfigured, getGmailClient } from './gmail';
import { recoverInterrupted, sendGroupReminders, sendIndividuals } from './send';

/**
 * Email Automation & Reminders — daily entry point
 * (.github/workflows/email-automation.yml, `npm run email`).
 *
 * Order of work each run (every step is idempotent, so a re-run is safe):
 *   1. recover sends interrupted by an earlier crash
 *   2. run superadmin manual requests (emailCommands)
 *   3. refresh Google Group member lists + queue welcome emails
 *   4. queue today's birthdays and (on the chosen day) monthly reminders
 *   5. send: welcome first, then birthdays (shared daily budget), then
 *      the Google Group reminders (their own budget)
 *   6. publish a status summary for the console + one audit-log entry
 *
 * Firestore reads per quiet day: ~10 (config, templates, groups, status,
 * command check, changed users, pending counts) — nowhere near any quota.
 */

const LOCK_ID = 'emailAutomationLock';

function emptyStats(): RunStats {
  return {
    welcomeQueued: 0, birthdayQueued: 0, remindersQueued: 0,
    welcomeSent: 0, birthdaySent: 0, remindersSent: 0,
    failed: 0, skipped: 0, groupBatchesUpdated: 0, commandsRun: 0,
  };
}

async function main(): Promise<number> {
  const runId = randomUUID();
  if (!(await acquireLock(runId, LOCK_ID))) {
    console.log('Another email run is in progress; exiting without doing anything.');
    return 0;
  }
  const now = new Date();
  const today = istDate(now);
  let exitCode = 0;
  try {
    const [cfgSnap, statusSnap] = await Promise.all([automationDoc('config').get(), automationDoc('status').get()]);
    const config = normalizeEmailConfig(cfgSnap.exists ? cfgSnap.data() : DEFAULT_EMAIL_CONFIG);
    const ctx: RunContext = {
      now, today, config,
      state: statusSnap.exists ? { ...statusSnap.data() } : {},
      templates: null, groups: null,
      stats: emptyStats(),
      force: { welcome: false, birthday: false, rebuild: false, reminders: new Map() },
      stop: null, notes: [],
    };

    await recoverInterrupted(ctx);
    await runCommands(ctx);
    await syncGroupReportsAndWelcomeQueue(ctx);
    await enqueueBirthdays(ctx);

    // Group addresses are only needed when reminders may be queued.
    const [groupsSnap, templatesSnap] = await Promise.all([automationDoc('groups').get(), automationDoc('templates').get()]);
    ctx.groups = (groupsSnap.exists ? (groupsSnap.data()?.addresses as Record<string, string>) : null) ?? {};
    ctx.templates = resolveTemplates(templatesSnap.exists ? templatesSnap.data() : null);
    await enqueueReminders(ctx);

    if (config.paused) {
      ctx.notes.push('Automation is PAUSED: nothing was sent.');
    } else if (!gmailConfigured()) {
      ctx.stop = { kind: 'not_configured', message: 'Gmail credentials (GMAIL_REFRESH_TOKEN etc.) are not configured.' };
      ctx.notes.push(ctx.stop.message);
    } else {
      const gmail = getGmailClient();
      await sendIndividuals(ctx, gmail);
      await sendGroupReminders(ctx, gmail);
    }
    if (ctx.stop && ctx.stop.kind !== 'not_configured') {
      ctx.notes.push(`Sending stopped early (${ctx.stop.kind}): ${ctx.stop.message}`);
      exitCode = 1; // make the failure visible in GitHub Actions
    }

    // ---- status for the console (a handful of cheap aggregation reads) ----
    const [pendingWelcome, pendingBirthday, pendingReminders, failedCount, sentIndividual, sentGroup] = await Promise.all([
      countQuery(queueCol().where('kind', '==', 'welcome').where('status', '==', 'pending')),
      countQuery(queueCol().where('kind', '==', 'birthday').where('status', '==', 'pending')),
      countQuery(queueCol().where('kind', '==', 'reminder').where('status', '==', 'pending')),
      countQuery(queueCol().where('status', '==', 'failed')),
      countQuery(queueCol().where('sentDay', '==', today.key).where('recipient', '==', 'individual')),
      countQuery(queueCol().where('sentDay', '==', today.key).where('recipient', '==', 'group')),
    ]);
    const s = ctx.stats;
    const summary =
      `Sent ${s.welcomeSent} welcome, ${s.birthdaySent} birthday, ${s.remindersSent} group reminder(s). ` +
      `Queued ${s.welcomeQueued} welcome, ${s.birthdayQueued} birthday, ${s.remindersQueued} reminder(s). ` +
      `${s.failed} failed, ${s.skipped} skipped, ${s.commandsRun} manual request(s). ` +
      ctx.notes.join(' ');
    const runStatus = exitCode !== 0 ? 'failed' : ctx.stop || s.failed > 0 ? 'partial' : 'success';

    await automationDoc('status').set(
      {
        ...ctx.state,
        lastRunAt: Timestamp.now(),
        lastRunDay: today.key,
        lastRunStatus: runStatus,
        lastRunSummary: summary.slice(0, 900),
        lastRunStats: s,
        sentTodayDay: today.key,
        sentTodayIndividual: sentIndividual,
        sentTodayGroup: sentGroup,
        dailyLimit: Math.min(config.dailyLimit, INDIVIDUAL_DAILY_HARD_LIMIT),
        pendingWelcome,
        pendingBirthday,
        pendingReminders,
        failedCount,
        paused: config.paused,
        gmailConfigured: gmailConfigured(),
        nextRunAt: ts(nextScheduledRun(new Date())),
      },
      { merge: true },
    );
    await logJobRun({
      jobName: 'email-automation',
      status: runStatus === 'failed' ? 'failure' : 'success',
      summary: summary.slice(0, 500),
      ...(ctx.stop && ctx.stop.kind !== 'not_configured' ? { error: ctx.stop.message.slice(0, 300) } : {}),
    });
    console.log(summary);
  } catch (err) {
    exitCode = 1;
    const message = err instanceof Error ? err.message : String(err);
    console.error('Email automation failed:', message);
    try {
      await logJobRun({ jobName: 'email-automation', status: 'failure', summary: 'Run crashed.', error: message.slice(0, 300) });
      await automationDoc('status').set(
        { lastRunAt: Timestamp.now(), lastRunStatus: 'failed', lastRunSummary: `Run crashed: ${message}`.slice(0, 900) },
        { merge: true },
      );
    } catch {
      /* nothing more we can do */
    }
  } finally {
    await releaseLock(LOCK_ID);
  }
  return exitCode;
}

main().then((code) => process.exit(code));
