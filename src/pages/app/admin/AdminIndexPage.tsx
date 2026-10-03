import { type ReactNode, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { findBatch, allBatches } from '../../../lib/batches';
import { useUserRecord } from '../../../context/UserRecordContext';
import {
  type UserRecord,
  type UserRole,
  effectiveAdminBatches,
  findUserByEmail,
  setUserRole,
  setUserStatus,
  subscribeToPendingUsers,
} from '../../../firebase/repositories/usersRepository';
import { EMPLOYMENT_TYPE_LABELS, type Job, getJob, setJobStatus } from '../../../firebase/repositories/jobsRepository';
import { type AdminMetrics, loadAdminMetrics } from '../../../firebase/repositories/adminMetricsRepository';
import { type Report, queryOpenReports, setReportStatus } from '../../../firebase/repositories/reportsRepository';
import { type AuditLogEntry, queryRecentAuditLogs } from '../../../firebase/repositories/auditLogsRepository';
import { CommunicationSegments } from '../../../components/admin/CommunicationSegments';
import { Avatar } from '../../../components/ui/Avatar';
import { ProfileView } from '../../../components/profile/ProfileView';
import { type Profile, getPendingProfile } from '../../../firebase/repositories/profilesRepository';
import { BadgesManagement } from '../../../components/admin/BadgesManagement';
import { ChaptersManagement } from '../../../components/admin/ChaptersManagement';
import { EmptyState, ErrorNote, PageHeader, SkeletonList } from '../../../components/ui/PageHeader';

function AdminSection({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="surface-card scroll-mt-20 p-lg md:p-xl">
      <div className="flex items-center justify-between gap-md">
        <h2 className="font-haas-disp text-title-md text-ink">{title}</h2>
        {action}
      </div>
      <div className="mt-sm">{children}</div>
    </section>
  );
}

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
        ['Open to Work', metrics.openToWorkCount],
        ['Founders', metrics.founderCount],
        ['Open reports', metrics.openReports],
      ]
    : [];

  return (
    <AdminSection id="dashboard" title="Dashboard">
      <p className="copy">
        Each number below comes from a Firestore count query, not a full download of the underlying collection —
        safe to load on every visit to this page, even as the alumni base grows.
      </p>
      {error && (
        <div className="mt-md">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      {!metrics && !error && (
        <div className="mt-lg">
          <SkeletonList count={1} heightClass="h-20" />
        </div>
      )}
      {metrics && (
        <div className="mt-lg grid grid-cols-2 gap-md md:grid-cols-4">
          {tiles.map(([label, value]) => (
            <div key={label} className="surface-soft-card p-md">
              <p className="font-haas-disp text-display-md text-ink">{value}</p>
              <p className="text-body-md text-muted">{label}</p>
            </div>
          ))}
        </div>
      )}
    </AdminSection>
  );
}

const REPORT_REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  inappropriate: 'Inappropriate',
  scam: 'Scam',
  other: 'Other',
};

/**
 * A reported job posting, loaded on demand. Nothing is fetched until an
 * admin clicks "View posting" (one document read per click), so a long
 * report queue costs no extra reads up front.
 */
function ReportedJobPanel({
  jobId,
  busy,
  onRemoveAndResolve,
}: {
  jobId: string;
  busy: boolean;
  onRemoveAndResolve: () => void;
}) {
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function show() {
    setLoading(true);
    setFailed(false);
    try {
      setJob(await getJob(jobId));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  if (job === undefined) {
    return (
      <div className="mt-sm">
        <Button variant="secondary" className="px-md py-xs" disabled={loading} onClick={() => void show()}>
          {loading ? 'Loading…' : 'View posting'}
        </Button>
        {failed && <p className="mt-xs text-caption text-signature-coral">Couldn't load that posting.</p>}
      </div>
    );
  }

  if (job === null) {
    return <p className="mt-sm text-body-md text-muted">This posting no longer exists (the poster may have withdrawn it).</p>;
  }

  return (
    <div className="mt-sm rounded-lg border border-hairline bg-canvas p-md">
      <p className="text-label-md text-ink">{job.title}</p>
      <p className="text-body-md text-muted">
        {job.company} · {job.location} · {EMPLOYMENT_TYPE_LABELS[job.employmentType]} · posted by {job.postedByDisplayName}
      </p>
      <p className="copy mt-xs max-h-60 overflow-y-auto whitespace-pre-line">{job.description}</p>
      <p className="mt-xs text-body-md text-body [overflow-wrap:anywhere]">
        {job.contactPerson} · {job.contactDetails}
      </p>
      {job.status === 'approved' ? (
        <Button variant="primary" className="mt-sm px-md py-xs" disabled={busy} onClick={onRemoveAndResolve}>
          Remove posting &amp; resolve
        </Button>
      ) : (
        <p className="mt-sm text-caption text-muted">Status: {job.status} — not shown on the Jobs board.</p>
      )}
    </div>
  );
}

function ReportsQueue() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    queryOpenReports()
      .then(setReports)
      .finally(() => setLoading(false));
  }, []);

  async function resolve(id: string, status: 'resolved' | 'dismissed', removeJobId?: string) {
    setActioningId(id);
    setError(null);
    try {
      if (removeJobId) await setJobStatus(removeJobId, 'rejected');
      await setReportStatus(id, status);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError("Couldn't update that report. Please try again.");
    } finally {
      setActioningId(null);
    }
  }

  return (
    <AdminSection id="reports" title="Reports">
      <p className="copy">
        Job postings go live as soon as they're posted; they only reach you here if a member flags them. Open the
        posting to review it, then remove it or dismiss the report.
      </p>
      {error && (
        <div className="mt-md">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      {loading ? (
        <div className="mt-lg">
          <SkeletonList count={2} heightClass="h-16" />
        </div>
      ) : reports.length === 0 ? (
        <div className="mt-lg">
          <EmptyState title="No open reports" />
        </div>
      ) : (
        <ul className="mt-lg space-y-md">
          {reports.map((r) => (
            <li key={r.id} className="rounded-lg bg-surface-soft p-md">
              <p className="text-label-md text-ink">
                {REPORT_REASON_LABELS[r.reason] ?? r.reason} · {r.targetType}
              </p>
              {r.note && <p className="mt-xs text-body-md text-body">"{r.note}"</p>}
              {r.targetType === 'job' && (
                <ReportedJobPanel
                  jobId={r.targetId}
                  busy={actioningId === r.id}
                  onRemoveAndResolve={() => void resolve(r.id, 'resolved', r.targetId)}
                />
              )}
              <div className="mt-sm flex flex-wrap gap-sm">
                <Button
                  variant="secondary"
                  className="px-md py-xs"
                  disabled={actioningId === r.id}
                  onClick={() => void resolve(r.id, 'dismissed')}
                >
                  Dismiss
                </Button>
                <Button
                  variant="secondary"
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
    </AdminSection>
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
    <AdminSection id="roles" title="Role management">
      <p className="copy">
        Look up a member by email to promote them to batch representative (scoped to specific batches) or super
        admin, or to demote them back to a regular member.
      </p>

      <div className="mt-lg flex flex-col gap-sm sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="member@example.com"
          className="field flex-1"
        />
        <Button variant="secondary" disabled={searching || !email.trim()} onClick={() => void search()}>
          {searching ? 'Searching…' : 'Look up'}
        </Button>
      </div>

      {error && (
        <div className="mt-md">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {found && (
        <div className="fade-enter mt-lg rounded-lg bg-surface-soft p-md">
          <p className="text-label-md text-ink">{found.displayName || 'Unnamed account'}</p>
          <p className="text-body-md text-muted">
            {found.email} · currently <strong className="text-ink">{found.role}</strong>
          </p>

          <div className="mt-md">
            <p className="text-label-md text-ink">Extra batches (optional — only used for batch admins)</p>
            <p className="text-caption text-muted">
              A batch admin can always approve applicants from their own batch automatically. Tick more only to
              give them additional batches.
            </p>
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
              disabled={saving}
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
    </AdminSection>
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
    <AdminSection
      id="automation"
      title="Automation runs"
      action={
        <Button variant="secondary" className="px-md py-xs" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Hide' : 'Show'}
        </Button>
      }
    >
      <p className="copy">
        The most recent 50 scheduled automation job runs (cycle state, matching, calendar, feedback scoring), so you
        don't have to open the Firebase console to check whether last night's run succeeded.
      </p>
      {expanded &&
        (loading ? (
          <div className="mt-lg">
            <SkeletonList count={3} heightClass="h-14" />
          </div>
        ) : logs.length === 0 ? (
          <div className="mt-lg">
            <EmptyState title="No automation runs recorded yet" />
          </div>
        ) : (
          <ul className="fade-enter mt-lg space-y-sm">
            {logs.map((log) => (
              <li key={log.id} className="rounded-lg border border-hairline p-md">
                <p className="text-body-md text-body">
                  <span
                    className={`text-label-md ${
                      log.status === 'success'
                        ? 'text-success'
                        : log.status === 'failure'
                          ? 'text-signature-coral'
                          : 'text-muted'
                    }`}
                  >
                    {log.status}
                  </span>{' '}
                  — {log.jobName} {log.cycleId ? `(${log.cycleId})` : ''} — {log.createdAt.toLocaleString()}
                </p>
                <p className="mt-xxs text-body-md text-muted">{log.summary}</p>
                {log.error && <p className="mt-xxs text-body-md text-signature-coral">{log.error}</p>}
              </li>
            ))}
          </ul>
        ))}
    </AdminSection>
  );
}

/**
 * "View profile" for one pending applicant: loads their private
 * pending-approval profile ONLY when an approver clicks (one document
 * read, never in bulk), so opening the queue stays cheap however many
 * applications are waiting.
 */
function PendingApplicantProfile({ uid }: { uid: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || loaded) return;
    setLoading(true);
    setError(null);
    try {
      setProfile(await getPendingProfile(uid));
      setLoaded(true);
    } catch {
      setError("Couldn't open this profile. If you're a batch representative, it may not be in one of your assigned batches.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-sm">
      <button
        type="button"
        onClick={() => void toggle()}
        aria-expanded={open}
        className="text-body-md text-link hover:text-link-active"
      >
        {open ? 'Hide profile' : 'View profile'}
      </button>
      {open && (
        <div className="mt-sm">
          {loading ? (
            <SkeletonList count={1} heightClass="h-32" />
          ) : error ? (
            <ErrorNote>{error}</ErrorNote>
          ) : profile ? (
            <ProfileView profile={profile} contactCaption="Applicant chose to share" />
          ) : (
            <p className="rounded-md bg-canvas p-sm text-body-md text-muted">
              This applicant hasn't filled in their profile yet.
            </p>
          )}
        </div>
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

  useEffect(() => {
    // A batch_admin's console view is scoped to their own assigned
    // batches — display-only filtering; the real security boundary is
    // the approve/reject WRITE, enforced in firestore.rules. See the
    // rules file for why this isn't ALSO enforced as a scoped read: a
    // per-document batch filter on a `list` query would fail the whole
    // query the moment a pending user outside that scope existed
    // (Firestore's "queries are all or nothing" behavior).
    const scopeBatches = isSuperAdmin ? undefined : (effectiveAdminBatches(record) ?? []);
    const unsubscribe = subscribeToPendingUsers(
      (records) => {
        setPending(records);
        setLoading(false);
      },
      scopeBatches,
    );
    return unsubscribe;
  }, [isSuperAdmin, record?.batchNumber, record?.assignedBatchNumbers]);

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

  const sections: [string, string][] = [
    ['dashboard', 'Dashboard'],
    ['reports', 'Reports'],
    ...(isSuperAdmin ? ([['roles', 'Roles'], ['chapters', 'Chapters'], ['badges', 'Badges']] as [string, string][]) : []),
    ['segments', 'Segments'],
    ['automation', 'Automation'],
    ['approvals', 'Approvals'],
  ];

  return (
    <div className="space-y-lg">
      <PageHeader title="Admin console" description="Moderation, roles, communication and automation for BIM AA." />

      <nav aria-label="Admin sections" className="-mx-md flex gap-xs overflow-x-auto px-md pb-xxs no-scrollbar md:mx-0 md:px-0">
        {sections.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="tab-chip shrink-0 !border-hairline">
            {label}
          </a>
        ))}
      </nav>

      <MetricsDashboard />
      <ReportsQueue />
      {isSuperAdmin && <RoleManagement />}
      {isSuperAdmin && <ChaptersManagement />}
      {isSuperAdmin && <BadgesManagement />}
      <CommunicationSegments />
      <AuditLogViewer />

      <AdminSection
        id="approvals"
        title="Pending approvals"
      >
        <p className="copy">
          {isSuperAdmin
            ? 'Every pending sign-in across all batches.'
            : `Pending sign-ins for ${(() => {
                const list = effectiveAdminBatches(record) ?? [];
                return list.length === 0
                  ? 'your batch'
                  : list.map((n) => findBatch(n)?.label ?? `BIM${n}`).join(', ');
              })()} — your own batch is included automatically.`}
        </p>

        {!isSuperAdmin && (effectiveAdminBatches(record) ?? []).length === 0 && (
          <div className="mt-md">
            <ErrorNote>
              Your account has no batch recorded (it was created before batch selection existed), so no applications
              can appear here. Ask a super admin to add your batch under Roles.
            </ErrorNote>
          </div>
        )}

        {error && (
          <div className="mt-md">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        {loading ? (
          <div className="mt-lg">
            <SkeletonList count={2} heightClass="h-20" />
          </div>
        ) : pending.length === 0 ? (
          <div className="mt-lg">
            <EmptyState title="No pending accounts right now" />
          </div>
        ) : (
          <ul className="mt-lg space-y-md">
            {pending.map((person) => {
              const batch = person.batchNumber !== null ? findBatch(person.batchNumber) : undefined;
              return (
                <li key={person.uid} className="rounded-lg bg-surface-soft p-md">
                  <div className="flex flex-wrap items-center justify-between gap-md">
                    <div className="flex items-center gap-sm">
                      <Avatar sizeClass="h-10 w-10" />
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
                  {person.note && <p className="mt-sm rounded-md bg-canvas p-sm text-body-md text-body">"{person.note}"</p>}
                  <PendingApplicantProfile uid={person.uid} />
                </li>
              );
            })}
          </ul>
        )}
      </AdminSection>
    </div>
  );
}
