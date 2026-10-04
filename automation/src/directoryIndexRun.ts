import { runDirectoryIndexSync } from './directoryIndexJob';
import { logJobRun } from './auditLog';

/**
 * Entrypoint for .github/workflows/directory-index.yml — hourly, separate from
 * the daily monthly-automation run (different purpose, different cadence, no
 * shared state), so a problem in one never blocks the other.
 *
 * Set DIRECTORY_INDEX_FULL=true (the workflow's manual "full rebuild" option)
 * to rebuild the whole index from every profile.
 */
async function main() {
  const full = process.env.DIRECTORY_INDEX_FULL === 'true';
  try {
    const result = await runDirectoryIndexSync({ full });
    console.log(
      `Directory index (${result.mode}): ${result.profilesRead} profile(s) read, ` +
        `${result.shardsWritten} shard(s) written, ${result.members} searchable member(s).`,
    );
    // Only a full rebuild is worth an audit entry — hourly no-op runs would just be noise.
    if (result.mode === 'full') {
      await logJobRun({
        jobName: 'directory-index',
        status: 'success',
        summary: `Rebuilt the member-name index from ${result.profilesRead} profile(s) — ${result.members} searchable member(s).`,
      });
    }
  } catch (err) {
    console.error('Directory index sync failed:', err);
    try {
      await logJobRun({
        jobName: 'directory-index',
        status: 'failure',
        summary: 'The member-name index sync failed.',
        error: err instanceof Error ? err.message : String(err),
      });
    } catch {
      // The audit log is best-effort here; the non-zero exit below is what flags the run.
    }
    process.exitCode = 1;
  }
}

void main();
