import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { findBatch } from '../../../lib/batches';
import { useUserRecord } from '../../../context/UserRecordContext';
import {
  type UserRecord,
  setUserStatus,
  subscribeToPendingUsers,
} from '../../../firebase/repositories/usersRepository';
import {
  EMPLOYMENT_TYPE_LABELS,
  type Job,
  queryPendingJobs,
  setJobStatus,
} from '../../../firebase/repositories/jobsRepository';

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
    <div className="rounded-md border border-hairline p-xl">
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
