import { randomUUID } from 'node:crypto';
import { acquireLock, releaseLock } from './lock';
import { runCycleStateJob } from './cycleStateJob';
import { runMatchingJob } from './matchingJob';
import { runCalendarJob } from './calendarJob';
import { runFeedbackScoreJob } from './feedbackScoreJob';
import { runJobsCleanupJob } from './jobsCleanupJob';
import { runEventsCalendarJob } from './eventsCalendarJob';
import { runPublicStatsJob } from './publicStatsJob';
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
 * matter; kept after them for readability), then jobs-cleanup, then
 * public-stats last (Phase 15 — reads the results of every job above,
 * so it belongs at the end; see the dedicated try/catch below for why
 * it's the one job in this file that can fail without failing the run).
 */
async function main() {
  const runId = randomUUID();
  const gotLock = await acquireLock(runId);
  if (!gotLock) {
    console.log('Another automation run is already in progress. Exiting.');
    return;
  }

  try {
    // Core cycle jobs: sequential and dependent (cycle state -> matching
    // -> calendar -> feedback/score). A failure here stops the run —
    // later cycle steps must never run against a half-finished earlier
    // step. Errors propagate to the catch below.
    await runCycleStateJob();
    await runMatchingJob();
    await runCalendarJob();
    await runFeedbackScoreJob();

    // Independent housekeeping jobs. None depends on another's output,
    // so one failing (e.g. a missing Firestore index) must NOT prevent
    // the others from running. Each failure is logged to auditLogs and
    // the run is still marked failed at the end (exit code 1) — never
    // silently swallowed — but the remaining jobs get their turn first.
    const independentJobs: Array<[string, () => Promise<void>]> = [
      ['events-calendar', runEventsCalendarJob],
      ['jobs-cleanup', runJobsCleanupJob],
    ];
    let independentFailures = 0;
    for (const [name, job] of independentJobs) {
      try {
        await job();
      } catch (err) {
        independentFailures += 1;
        console.error(`${name} job failed (other jobs still ran):`, err);
        await logJobRun({
          jobName: name,
          status: 'failure',
          summary: `The ${name} job failed.`,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Deliberately non-fatal: recomputing the public landing page's
    // aggregate counters is low-stakes (a stale marketing counter, at
    // worst) and should never fail the run on its own.
    try {
      await runPublicStatsJob();
    } catch (err) {
      console.error('public-stats job failed (non-fatal, rest of the run still succeeded):', err);
      await logJobRun({
        jobName: 'public-stats',
        status: 'failure',
        summary: 'Failed to recompute public landing-page stats.',
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (independentFailures > 0) {
      console.error(`Automation run finished with ${independentFailures} failed housekeeping job(s).`);
      process.exitCode = 1;
    } else {
      console.log('Automation run completed successfully.');
    }
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