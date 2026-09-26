import { randomUUID } from 'node:crypto';
import { acquireLock, releaseLock } from './lock';
import { runCycleStateJob } from './cycleStateJob';
import { runMatchingJob } from './matchingJob';
import { runCalendarJob } from './calendarJob';
import { runFeedbackScoreJob } from './feedbackScoreJob';
import { runJobsCleanupJob } from './jobsCleanupJob';
import { runEventsCalendarJob } from './eventsCalendarJob';
import { logJobRun } from './auditLog';

/**
 * Single daily entrypoint. Per AUTOMATION.md's "Schedule caveat" —
 * GitHub Actions scheduled workflows aren't an exact real-time
 * scheduler — this runs once a day and each job internally decides
 * what (if anything) is actually due, rather than assuming the cron
 * fired at a meaningful moment.
 *
 * Order: cycle-state first (so a freshly-due transition is visible to
 * the jobs below in the same run), then matching (acts on cycles that
 * just closed), then calendar (needs matches to exist first), then
 * feedback/score, then events-calendar (Phase 13 — independent of
 * cycles entirely, so its position relative to the cycle jobs doesn't
 * matter; kept after them for readability), then jobs-cleanup last.
 */
async function main() {
  const runId = randomUUID();
  const gotLock = await acquireLock(runId);
  if (!gotLock) {
    console.log('Another automation run is already in progress. Exiting.');
    return;
  }

  try {
    await runCycleStateJob();
    await runMatchingJob();
    await runCalendarJob();
    await runFeedbackScoreJob();
    await runEventsCalendarJob();
    await runJobsCleanupJob();
    console.log('Automation run completed successfully.');
  } catch (err) {
    console.error('Automation run failed:', err);
    await logJobRun({
      jobName: 'run',
      status: 'failure',
      summary: 'Top-level automation run failed.',
      error: err instanceof Error ? err.message : String(err),
    });
    process.exitCode = 1;
  } finally {
    await releaseLock();
  }
}

void main();
