import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { findBatch, allBatches } from '../../../lib/batches';
import { useUserRecord } from '../../../context/UserRecordContext';
import {
  type UserRecord,
  type UserRole,
  findUserByEmail,
  setUserRole,
  setUserStatus,
  subscribeToPendingUsers,
} from '../../../firebase/repositories/usersRepository';
import {
  EMPLOYMENT_TYPE_LABELS,
  type Job,
  queryPendingJobs,
  setJobStatus,
} from '../../../firebase/repositories/jobsRepository';
import { type AdminMetrics, loadAdminMetrics } from '../../../firebase/repositories/adminMetricsRepository';
import { type Report, queryOpenReports, setReportStatus } from '../../../firebase/repositories/reportsRepository';
import { type AuditLogEntry, queryRecentAuditLogs } from '../../../firebase/repositories/auditLogsRepository';

function MetricsDashboard() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAdminMetrics()
      .then(setMetrics)
      .catch(() => setError("Couldn't load dashboard metrics."));
  }, []);

  const tiles: [string, number | undefined][] = metrics
    ? [
        ['Approved members', metrics.approvedMembers],
        ['Pending approvals', metrics.pendingApprovals],
        ['Approved job postings', metrics.approvedJobs],
        ['Pending job postings', metrics.pendingJobs],
        ['Open to Work', metrics.openToWorkCount],
        ['Founders', metrics.founderCount],
        ['Open reports', metrics.openReports],
      ]
    : [];

  return (
    <div className="rounded-md border border-hairline p-xl">
      <h1 className="text-title-lg text-ink">Dashboard</h1>
      <p className="mt-sm text-body-md text-body">
        Each number below comes from a Firestore count query, not a full download of the
        underlying collection — safe to load on every visit to this page, even as the alumni base
        grows.
      </p>
      {error && <p className="mt-md text-body-md text-signature-coral">{error}</p>}
      {!metrics && !error && <p className="mt-lg text-body-md text-muted">Loading…</p>}
      {metrics && (
        <div className="mt-lg grid grid-cols-2 gap-md md:grid-cols-4">
          {tiles.map(([label, value]) => (
            <div key={label} className="rounded-sm bg-surface-soft p-md">
              <p className="text-display-md text-ink">{value}</p>
              <p className="text-body-md text-muted">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const REPORT_REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  inappropriate: 'Inappropriate',
  scam: 'Scam',
  other: 'Other',
};

function ReportsQueue() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    queryOpenReports()
      .then(setReports)
      .finally(() => setLoading(false));
  }, []);

  async function resolve(id: string, status: 'resolved' | 'dismissed') {
    setActioningId(id);
    try {
      await setReportStatus(id, status);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setActioningId(null);
    }
  }

  return (
    <div className="mt-lg rounded-md border border-hairline p-xl">
      <h1 className="text-title-lg text-ink">Reports</h1>
      <p className="mt-sm text-body-md text-body">
        Job postings flagged by fellow alumni. Resolving or dismissing a report doesn't remove the
        posting itself — use the pending/approved job tools below for that.
      </p>
      {loading ? (
        <p className="mt-lg text-body-md text-muted">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="mt-lg text-body-md text-muted">No open reports.</p>
      ) : (
        <ul className="mt-lg space-y-md">
          {reports.map((r) => (
            <li key={r.id} className="rounded-sm border border-hairline p-md">
              <p className="text-label-md text-ink">
                {REPORT_REASON_LABELS[r.reason] ?? r.reason} · {r.targetType} {r.targetId}
              </p>
              {r.note && <p className="mt-xs text-body-md text-body">“{r.note}”</p>}
              <div className="mt-sm flex gap-sm">
                <Button
                  variant="secondary"
                  className="px-md py-xs"
                  disabled={actioningId === r.id}
                  onClick={() => void resolve(r.id, 'dismissed')}
                >
                  Dismiss
                </Button>
                <Button
                  variant="primary"
                  className="px-md py-xs"
                  disabled={actioningId === r.id}
                  onClick={() => void resolve(r.id, 'resolved')}
                >
                  Mark resolved
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const BATCHES = allBatches();

function RoleManagement() {
  const [email, setEmail] = useState('');
  const [found, setFound] = useState<UserRecord | null | undefined>(undefined);
  const [selectedBatches, setSelectedBatches] = useState<number[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setError(null);
    setSearching(true);
    try {
      const result = await findUserByEmail(email);
      setFound(result);
      setSelectedBatches(result?.assignedBatchNumbers ?? []);
      if (!result) setError('No approved/pending member found with that email.');
    } catch {
      setError("Couldn't search right now. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  async function apply(role: UserRole) {
    if (!found) return;
    setSaving(true);
    setError(null);
    try {
      await setUserRole(found.uid, role, role === 'batch_admin' ? selectedBatches : []);
      setFound({ ...found, role, assignedBatchNumbers: role === 'batch_admin' ? selectedBatches : [] });
    } catch {
      setError("Couldn't update that member's role.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-lg rounded-md border border-hairline p-xl">
      <h1 className="text-title-lg text-ink">Role management</h1>
      <p className="mt-sm text-body-md text-body">
        Look up a member by email to promote them to batch representative (scoped to specific
        batches) or super admin, or to demote them back to a regular member.
      </p>

      <div className="mt-lg flex gap-sm">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="member@example.com"
          className="flex-1 rounded-sm border border-hairline px-md py-xs text-body-md"
        />
        <Button variant="secondary" disabled={searching || !email.trim()} onClick={() => void search()}>
          {searching ? 'Searching…' : 'Look up'}
        </Button>
      </div>

      {error && <p className="mt-md text-body-md text-signature-coral">{error}</p>}

      {found && (
        <div className="mt-lg rounded-sm border border-hairline p-md">
          <p className="text-label-md text-ink">{found.displayName || 'Unnamed account'}</p>
          <p className="text-body-md text-muted">
            {found.email} · currently <strong>{found.role}</strong>
          </p>

          <div className="mt-md">
            <p className="text-body-md text-body">Assigned batches (only used for batch_admin)</p>
            <div className="mt-xs flex flex-wrap gap-xs">
              {BATCHES.map((b) => (
                <label key={b.batchNumber} className="flex items-center gap-xxs text-body-md text-body">
                  <input
                    type="checkbox"
                    checked={selectedBatches.includes(b.batchNumber)}
                    onChange={(e) =>
                      setSelectedBatches((prev) =>
                        e.target.checked ? [...prev, b.batchNumber] : prev.filter((n) => n !== b.batchNumber),
                      )
                    }
                  />
                  {b.label}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-md flex flex-wrap gap-sm">
            <Button variant="secondary" className="px-md py-xs" disabled={saving} onClick={() => void apply('alumni')}>
              Set as alumni
            </Button>
            <Button
              variant="secondary"
              className="px-md py-xs"
              disabled={saving || selectedBatches.length === 0}
              onClick={() => void apply('batch_admin')}
            >
              Set as batch admin
            </Button>
            <Button variant="primary" className="px-md py-xs" disabled={saving} onClick={() => void apply('super_admin')}>
              Set as super admin
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    queryRecentAuditLogs()
      .then(setLogs)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mt-lg rounded-md border border-hairline p-xl">
      <div className="flex items-center justify-between">
        <h1 className="text-title-lg text-ink">Automation runs</h1>
        <Button variant="secondary" className="px-md py-xs" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Hide' : 'Show'}
        </Button>
      </div>
      <p className="mt-sm text-body-md text-body">
        The most recent 50 scheduled automation job runs (cycle state, matching, calendar, feedback
        scoring), so you don't have to open the Firebase console to check whether last night's run
        succeeded.
      </p>
      {expanded && (
        loading ? (
          <p className="mt-lg text-body-md text-muted">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="mt-lg text-body-md text-muted">No automation runs recorded yet.</p>
        ) : (
          <ul className="mt-lg space-y-sm">
            {logs.map((log) => (
              <li key={log.id} className="rounded-sm border border-hairline p-sm text-body-md">
                <span
                  className={
                    log.status === 'success'
                      ? 'text-success'
                      : log.status === 'failure'
                        ? 'text-signature-coral'
                        : 'text-muted'
                  }
                >
                  {log.status}
                </span>{' '}
                — {log.jobName} {log.cycleId ? `(${log.cycleId})` : ''} —{' '}
                {log.createdAt.toLocaleString()}
                <p className="text-muted">{log.summary}</p>
                {log.error && <p className="text-signature-coral">{log.error}</p>}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

export function AdminIndexPage() {
  const { record } = useUserRecord();
  const isSuperAdmin = record?.role === 'super_admin';
  const [pending, setPending] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningUid, setActioningUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pendingJobs, setPendingJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [actioningJobId, setActioningJobId] = useState<string | null>(null);

  useEffect(() => {
    queryPendingJobs()
      .then(setPendingJobs)
      .finally(() => setJobsLoading(false));
  }, []);

  async function handleJobDecision(jobId: string, status: 'approved' | 'rejected') {
    setActioningJobId(jobId);
    try {
      await setJobStatus(jobId, status);
      setPendingJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch {
      setError("Couldn't update that job posting.");
    } finally {
      setActioningJobId(null);
    }
  }

  useEffect(() => {
    // A batch_admin's console view is scoped to their own assigned
    // batches — display-only filtering; the real security boundary is
    // the approve/reject WRITE, enforced in firestore.rules. See the
    // rules file for why this isn't ALSO enforced as a scoped read: a
    // per-document batch filter on a `list` query would fail the whole
    // query the moment a pending user outside that scope existed
    // (Firestore's "queries are all or nothing" behavior).
    const scopeBatches = isSuperAdmin ? undefined : record?.assignedBatchNumbers;
    const unsubscribe = subscribeToPendingUsers(
      (records) => {
        setPending(records);
        setLoading(false);
      },
      scopeBatches,
    );
    return unsubscribe;
  }, [isSuperAdmin, record?.assignedBatchNumbers]);

  async function handleDecision(uid: string, status: 'approved' | 'rejected') {
    setError(null);
    setActioningUid(uid);
    try {
      await setUserStatus(uid, status);
    } catch {
      setError(
        "Couldn't update that account. If you're a batch representative, this can happen if the request isn't in one of your assigned batches.",
      );
    } finally {
      setActioningUid(null);
    }
  }

  return (
    <>
    <MetricsDashboard />
    <ReportsQueue />
    {isSuperAdmin && <RoleManagement />}
    <AuditLogViewer />
    <div className="mt-lg rounded-md border border-hairline p-xl">
      <h1 className="text-title-lg text-ink">Pending approvals</h1>
      <p className="mt-sm text-body-md text-body">
        {isSuperAdmin
          ? 'Every pending sign-in across all batches.'
          : `Pending sign-ins for your assigned batch${
              (record?.assignedBatchNumbers.length ?? 0) === 1 ? '' : 'es'
            }.`}
      </p>

      {error && <p className="mt-md text-body-md text-signature-coral">{error}</p>}

      {loading ? (
        <p className="mt-lg text-body-md text-muted">Loading…</p>
      ) : pending.length === 0 ? (
        <p className="mt-lg text-body-md text-muted">No pending accounts right now.</p>
      ) : (
        <ul className="mt-lg space-y-md">
          {pending.map((person) => {
            const batch = person.batchNumber !== null ? findBatch(person.batchNumber) : undefined;
            return (
              <li key={person.uid} className="rounded-sm border border-hairline p-md">
                <div className="flex items-center justify-between gap-md">
                  <div className="flex items-center gap-sm">
                    {person.photoURL && (
                      <img src={person.photoURL} alt="" className="h-10 w-10 rounded-full" />
                    )}
                    <div>
                      <p className="text-label-md text-ink">{person.displayName || 'Unnamed account'}</p>
                      <p className="text-body-md text-muted">
                        {person.email} {batch ? `· ${batch.label}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-sm">
                    <Button
                      variant="secondary"
                      className="px-md py-xs"
                      disabled={actioningUid === person.uid}
                      onClick={() => void handleDecision(person.uid, 'rejected')}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      className="px-md py-xs"
                      disabled={actioningUid === person.uid}
                      onClick={() => void handleDecision(person.uid, 'approved')}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
                {person.note && (
                  <p className="mt-sm rounded-sm bg-surface-soft p-sm text-body-md text-body">
                    “{person.note}”
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>

    <div className="mt-lg rounded-md border border-hairline p-xl">
      <h1 className="text-title-lg text-ink">Pending job postings</h1>
      <p className="mt-sm text-body-md text-body">
        New job postings wait here until approved, then appear on the Jobs board.
      </p>

      {jobsLoading ? (
        <p className="mt-lg text-body-md text-muted">Loading…</p>
      ) : pendingJobs.length === 0 ? (
        <p className="mt-lg text-body-md text-muted">No pending job postings right now.</p>
      ) : (
        <ul className="mt-lg space-y-md">
          {pendingJobs.map((job) => (
            <li key={job.id} className="rounded-sm border border-hairline p-md">
              <div className="flex items-start justify-between gap-md">
                <div>
                  <p className="text-label-md text-ink">{job.title}</p>
                  <p className="text-body-md text-muted">
                    {job.company} · {job.location} · {EMPLOYMENT_TYPE_LABELS[job.employmentType]}
                  </p>
                  <p className="mt-xs text-body-md text-body">{job.description}</p>
                  <p className="mt-xs text-caption text-muted">Posted by {job.postedByDisplayName}</p>
                </div>
                <div className="flex shrink-0 gap-sm">
                  <Button
                    variant="secondary"
                    className="px-md py-xs"
                    disabled={actioningJobId === job.id}
                    onClick={() => void handleJobDecision(job.id, 'rejected')}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="primary"
                    className="px-md py-xs"
                    disabled={actioningJobId === job.id}
                    onClick={() => void handleJobDecision(job.id, 'approved')}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
    </>
  );
}
