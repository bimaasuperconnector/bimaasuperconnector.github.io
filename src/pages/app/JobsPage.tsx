import { useEffect, useState } from 'react';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { TagInput } from '../../components/profile/TagInput';
import {
  type EmploymentType,
  type Job,
  type JobFormFields,
  type JobUrgency,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  JOB_URGENCY_LEVELS,
  createJob,
  queryActiveJobs,
  queryMyJobs,
  withdrawJob,
} from '../../firebase/repositories/jobsRepository';

const EMPTY_FORM: JobFormFields = {
  company: '',
  title: '',
  location: '',
  employmentType: 'full_time',
  urgency: 'standard',
  description: '',
  skills: [],
  experienceLevel: '',
  contactPerson: '',
  contactDetails: '',
  applicationMethod: '',
  expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // default: 30 days out
};

function JobCard({ job, onWithdraw }: { job: Job; onWithdraw?: () => void }) {
  return (
    <div className="rounded-md border border-hairline p-md">
      <div className="flex items-start justify-between gap-md">
        <div>
          <p className="text-label-md text-ink">{job.title}</p>
          <p className="text-body-md text-muted">
            {job.company} · {job.location} · {EMPLOYMENT_TYPE_LABELS[job.employmentType]}
          </p>
        </div>
        {job.urgency === 'urgent' && (
          <span className="shrink-0 rounded-sm bg-signature-coral px-xs py-xxs text-caption text-on-primary">
            Urgent
          </span>
        )}
      </div>
      <p className="mt-sm text-body-md text-body">{job.description}</p>
      {job.skills.length > 0 && (
        <p className="mt-sm text-body-md text-muted">{job.skills.join(', ')}</p>
      )}
      {job.experienceLevel && <p className="mt-xs text-body-md text-muted">{job.experienceLevel}</p>}
      <div className="mt-sm text-body-md text-body">
        <p>Apply: {job.applicationMethod}</p>
        <p className="text-muted">
          Contact: {job.contactPerson} · {job.contactDetails}
        </p>
      </div>
      <p className="mt-xs text-caption text-muted">
        Posted by {job.postedByDisplayName} · Expires{' '}
        {job.expirationDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        {job.status !== 'approved' && ` · ${job.status}`}
      </p>
      {onWithdraw && (
        <button
          type="button"
          onClick={onWithdraw}
          className="mt-sm text-body-md text-signature-coral hover:underline"
        >
          Withdraw
        </button>
      )}
    </div>
  );
}

export function JobsPage() {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<JobFormFields>(EMPTY_FORM);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    if (!user) return;
    setLoading(true);
    try {
      const [mine, page] = await Promise.all([queryMyJobs(user.uid), queryActiveJobs()]);
      setMyJobs(mine);
      setActiveJobs(page.jobs);
      setCursor(page.lastDoc);
      setHasMore(page.hasMore);
    } catch {
      setError("Couldn't load jobs. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadMore() {
    const page = await queryActiveJobs(cursor);
    setActiveJobs((prev) => [...prev, ...page.jobs]);
    setCursor(page.lastDoc);
    setHasMore(page.hasMore);
  }

  async function handleSubmit() {
    if (!user) return;
    setError(null);
    setPosting(true);
    try {
      await createJob(user, form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadAll();
    } catch {
      setError("Couldn't post that job. Please check the fields and try again.");
    } finally {
      setPosting(false);
    }
  }

  async function handleWithdraw(jobId: string) {
    await withdrawJob(jobId);
    await loadAll();
  }

  const canSubmit =
    form.company.trim() &&
    form.title.trim() &&
    form.location.trim() &&
    form.description.trim() &&
    form.contactPerson.trim() &&
    form.contactDetails.trim() &&
    form.applicationMethod.trim();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-title-lg text-ink">Jobs</h1>
        <Button variant="primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'Post a job'}
        </Button>
      </div>
      <p className="mt-sm text-body-md text-body">
        Roles shared by fellow alumni. New postings are reviewed by an admin before appearing here.
      </p>

      {error && <p className="mt-md text-body-md text-signature-coral">{error}</p>}

      {showForm && (
        <div className="mt-lg rounded-md border border-hairline p-xl">
          <div className="grid gap-md md:grid-cols-2">
            <input
              placeholder="Company"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="rounded-sm border border-hairline px-md py-xs text-body-md"
            />
            <input
              placeholder="Job title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="rounded-sm border border-hairline px-md py-xs text-body-md"
            />
            <input
              placeholder="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="rounded-sm border border-hairline px-md py-xs text-body-md"
            />
            <select
              value={form.employmentType}
              onChange={(e) => setForm({ ...form, employmentType: e.target.value as EmploymentType })}
              className="rounded-sm border border-hairline px-md py-xs text-body-md"
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EMPLOYMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-md flex items-center gap-lg">
            <label className="text-body-md text-body">Urgency</label>
            {JOB_URGENCY_LEVELS.map((u: JobUrgency) => (
              <label key={u} className="flex items-center gap-xs text-body-md text-body">
                <input
                  type="radio"
                  name="urgency"
                  checked={form.urgency === u}
                  onChange={() => setForm({ ...form, urgency: u })}
                />
                {u === 'urgent' ? 'Urgent' : 'Standard'}
              </label>
            ))}
          </div>

          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            maxLength={3000}
            className="mt-md block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
          />

          <div className="mt-md">
            <TagInput
              label="Skills"
              placeholder="Type a skill and press Enter"
              values={form.skills}
              onChange={(skills) => setForm({ ...form, skills })}
            />
          </div>

          <input
            placeholder="Experience level (e.g. 3-5 years, entry level)"
            value={form.experienceLevel}
            onChange={(e) => setForm({ ...form, experienceLevel: e.target.value })}
            maxLength={200}
            className="mt-md block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
          />

          <div className="mt-md grid gap-md md:grid-cols-2">
            <input
              placeholder="Contact person"
              value={form.contactPerson}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              className="rounded-sm border border-hairline px-md py-xs text-body-md"
            />
            <input
              placeholder="Contact details (email/phone)"
              value={form.contactDetails}
              onChange={(e) => setForm({ ...form, contactDetails: e.target.value })}
              className="rounded-sm border border-hairline px-md py-xs text-body-md"
            />
          </div>

          <input
            placeholder="How should people apply?"
            value={form.applicationMethod}
            onChange={(e) => setForm({ ...form, applicationMethod: e.target.value })}
            maxLength={500}
            className="mt-md block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
          />

          <div className="mt-md">
            <label className="text-body-md text-body" htmlFor="expiration">
              Listing expires
            </label>
            <input
              id="expiration"
              type="date"
              value={form.expirationDate.toISOString().slice(0, 10)}
              onChange={(e) => setForm({ ...form, expirationDate: new Date(e.target.value) })}
              className="mt-xs block rounded-sm border border-hairline px-md py-xs text-body-md"
            />
          </div>

          <Button
            variant="primary"
            className="mt-lg"
            disabled={!canSubmit || posting}
            onClick={() => void handleSubmit()}
          >
            {posting ? 'Posting…' : 'Submit for review'}
          </Button>
        </div>
      )}

      {myJobs.length > 0 && (
        <div className="mt-xl">
          <h2 className="text-title-sm text-ink">Your postings</h2>
          <div className="mt-md space-y-md">
            {myJobs.map((job) => (
              <JobCard key={job.id} job={job} onWithdraw={() => void handleWithdraw(job.id)} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-xl">
        <h2 className="text-title-sm text-ink">Open roles</h2>
        {loading ? (
          <p className="mt-md text-body-md text-muted">Loading…</p>
        ) : activeJobs.length === 0 ? (
          <p className="mt-md text-body-md text-muted">No open roles right now.</p>
        ) : (
          <div className="mt-md space-y-md">
            {activeJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
        {hasMore && (
          <Button variant="secondary" className="mt-md" onClick={() => void loadMore()}>
            Load more
          </Button>
        )}
      </div>
    </div>
  );
}
