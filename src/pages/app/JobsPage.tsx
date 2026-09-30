import { useEffect, useState } from 'react';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorNote, PageHeader, SkeletonList } from '../../components/ui/PageHeader';
import { ClockIcon, MapPinIcon } from '../../components/icons/NavIcons';
import { TagInput } from '../../components/profile/TagInput';
import {
  type EmploymentType,
  type Job,
  type JobFormFields,
  type JobUrgency,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  JOB_DESCRIPTION_MAX,
  JOB_URGENCY_LEVELS,
  createJob,
  queryActiveJobs,
  queryMyJobs,
  withdrawJob,
} from '../../firebase/repositories/jobsRepository';
import { type ReportReason, REPORT_REASONS, reportJob } from '../../firebase/repositories/reportsRepository';

const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam',
  inappropriate: 'Inappropriate',
  scam: 'Scam',
  other: 'Other',
};

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

function ReportJobControl({ jobId, reporterUid }: { jobId: string; reporterUid: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('spam');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) {
    return <p className="mt-sm text-caption text-muted">Reported — thanks for flagging this.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-xs inline-flex min-h-[36px] items-center text-caption text-muted underline-offset-2 hover:underline"
      >
        Report this posting
      </button>
    );
  }

  async function submit() {
    setSending(true);
    try {
      await reportJob(reporterUid, jobId, reason, note);
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-sm rounded-lg bg-surface-soft p-md">
      <div className="flex flex-wrap gap-md">
        {REPORT_REASONS.map((r) => (
          <label key={r} className="flex min-h-[32px] items-center gap-xs text-body-md text-body">
            <input type="radio" name={`reason-${jobId}`} checked={reason === r} onChange={() => setReason(r)} />
            {REPORT_REASON_LABELS[r]}
          </label>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note for the admin"
        maxLength={500}
        rows={2}
        className="mt-xs block w-full field"
      />
      <div className="mt-xs flex gap-sm">
        <Button variant="secondary" className="px-md py-xs" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button variant="primary" className="px-md py-xs" disabled={sending} onClick={() => void submit()}>
          {sending ? 'Sending…' : 'Submit report'}
        </Button>
      </div>
    </div>
  );
}

const COLLAPSED_SKILLS = 4;

function formatShortDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * One posting. Collapsed by default to the high-level overview (title,
 * company, location, type, skills); the description, apply/contact
 * details and report control only render once the member opens it.
 * Everything needed for the overview is already on the listing
 * document, so opening a card costs zero extra Firestore reads.
 */
function JobCard({
  job,
  onWithdraw,
  reporterUid,
}: {
  job: Job;
  onWithdraw?: () => void;
  reporterUid?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = `job-${job.id}`;
  const shownSkills = job.skills.slice(0, COLLAPSED_SKILLS);
  const extraSkills = job.skills.length - shownSkills.length;

  return (
    <article className="surface-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="block w-full p-lg text-left transition-colors duration-150 hover:bg-surface-soft active:bg-surface-strong"
      >
        <span className="flex items-start justify-between gap-md">
          <span className="min-w-0">
            <span className="block font-haas-disp text-title-md text-ink [overflow-wrap:anywhere]">{job.title}</span>
            <span className="mt-xxs block text-label-md text-body [overflow-wrap:anywhere]">{job.company}</span>
          </span>
          <span className="flex shrink-0 items-center gap-xs">
            {job.urgency === 'urgent' && <span className="chip bg-signature-coral text-on-primary">Urgent</span>}
            {job.status !== 'approved' && <span className="chip bg-signature-yellow">{job.status}</span>}
            <span
              aria-hidden="true"
              className={`text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </span>
        </span>

        <span className="mt-sm flex flex-wrap items-center gap-x-md gap-y-xxs text-body-md text-muted">
          <span className="flex items-center gap-xxs">
            <MapPinIcon width={14} height={14} /> {job.location}
          </span>
          <span className="rounded-md bg-surface-soft px-sm py-xxs text-ink">
            {EMPLOYMENT_TYPE_LABELS[job.employmentType]}
          </span>
          {job.experienceLevel && <span>{job.experienceLevel}</span>}
        </span>

        {job.skills.length > 0 && (
          <span className="mt-sm flex flex-wrap gap-xs">
            {shownSkills.map((skill) => (
              <span key={skill} className="rounded-md border border-hairline px-sm py-xxs text-caption text-ink">
                {skill}
              </span>
            ))}
            {extraSkills > 0 && <span className="px-xs py-xxs text-caption text-muted">+{extraSkills} more</span>}
          </span>
        )}

        {!open && (
          <span className="mt-md flex items-center justify-between gap-md text-caption text-muted">
            <span>
              {job.createdAt ? `Posted ${formatShortDate(job.createdAt)}` : 'Just posted'}
              {job.postedByDisplayName ? ` · ${job.postedByDisplayName}` : ''}
            </span>
            <span className="text-link">View details</span>
          </span>
        )}
      </button>

      {open && (
        <div id={panelId} className="fade-enter border-t border-hairline p-lg pt-md">
          <p className="copy whitespace-pre-line [overflow-wrap:anywhere]">{job.description}</p>

          {job.skills.length > shownSkills.length && (
            <ul className="mt-md flex flex-wrap gap-xs">
              {job.skills.map((skill) => (
                <li key={skill} className="rounded-md border border-hairline bg-surface-soft px-sm py-xxs text-caption text-ink">
                  {skill}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-md rounded-lg bg-surface-soft p-md text-body-md text-body [overflow-wrap:anywhere]">
            <p>
              <span className="text-muted">Apply: </span>
              {job.applicationMethod}
            </p>
            <p className="mt-xxs">
              <span className="text-muted">Contact: </span>
              {job.contactPerson} · {job.contactDetails}
            </p>
          </div>

          <p className="mt-md flex flex-wrap items-center gap-x-sm gap-y-xxs text-caption text-muted">
            <span>Posted by {job.postedByDisplayName}</span>
            <span className="flex items-center gap-xxs">
              <ClockIcon width={13} height={13} />
              Expires {formatShortDate(job.expirationDate)}
            </span>
          </p>

          {onWithdraw && (
            <button
              type="button"
              onClick={onWithdraw}
              className="mt-xs inline-flex min-h-[44px] items-center text-body-md text-signature-coral active:opacity-70"
            >
              Withdraw
            </button>
          )}
          {reporterUid && job.postedByUid !== reporterUid && (
            <ReportJobControl jobId={job.id} reporterUid={reporterUid} />
          )}
        </div>
      )}
    </article>
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
    setError(null);
    // Split into two independent calls rather than one Promise.all: if
    // the active-jobs board query fails (e.g. a missing Firestore index
    // — see the chat setup notes), "Your postings" should still load
    // instead of the whole page going blank behind one generic error.
    const results = await Promise.allSettled([queryMyJobs(user.uid), queryActiveJobs()]);
    if (results[0].status === 'fulfilled') {
      setMyJobs(results[0].value);
    }
    if (results[1].status === 'fulfilled') {
      setActiveJobs(results[1].value.jobs);
      setCursor(results[1].value.lastDoc);
      setHasMore(results[1].value.hasMore);
    }
    const failure = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    if (failure) {
      // Surfaced verbatim (not just a generic string) specifically
      // because "missing index" errors are a real, common Firestore
      // setup gap and this message is what tells the owner what to fix.
      const detail = failure.reason instanceof Error ? failure.reason.message : String(failure.reason);
      setError(`Couldn't load all jobs data. ${detail}`);
    }
    setLoading(false);
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
      <PageHeader
        title="Jobs"
        description="Roles shared by fellow alumni. Postings go live immediately and every member is notified — tap one to see the full details."
        actions={
          <Button variant="primary" onClick={() => setShowForm((s) => !s)} aria-expanded={showForm}>
            {showForm ? 'Cancel' : 'Post a job'}
          </Button>
        }
      />

      {error && (
        <div className="mt-md">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {showForm && (
        <div className="fade-enter surface-card mt-lg p-lg md:p-xl">
          <div className="grid gap-md md:grid-cols-2">
            <input
              placeholder="Company"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="field"
            />
            <input
              placeholder="Job title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="field"
            />
            <input
              placeholder="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="field"
            />
            <select
              value={form.employmentType}
              onChange={(e) => setForm({ ...form, employmentType: e.target.value as EmploymentType })}
              className="field"
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EMPLOYMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-md flex flex-wrap items-center gap-x-lg gap-y-xs">
            <span className="text-label-md text-ink">Urgency</span>
            {JOB_URGENCY_LEVELS.map((u: JobUrgency) => (
              <label key={u} className="flex min-h-[44px] items-center gap-xs text-body-md text-body">
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
            placeholder="Description — responsibilities, requirements, benefits, anything applicants should know"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={8}
            maxLength={JOB_DESCRIPTION_MAX}
            aria-describedby="job-description-count"
            className="mt-md block w-full field"
          />
          <p id="job-description-count" className="mt-xxs text-right text-caption text-muted">
            {form.description.length.toLocaleString()} / {JOB_DESCRIPTION_MAX.toLocaleString()}
          </p>

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
            className="mt-md block w-full field"
          />

          <div className="mt-md grid gap-md md:grid-cols-2">
            <input
              placeholder="Contact person"
              value={form.contactPerson}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              className="field"
            />
            <input
              placeholder="Contact details (email/phone)"
              value={form.contactDetails}
              onChange={(e) => setForm({ ...form, contactDetails: e.target.value })}
              className="field"
            />
          </div>

          <input
            placeholder="How should people apply?"
            value={form.applicationMethod}
            onChange={(e) => setForm({ ...form, applicationMethod: e.target.value })}
            maxLength={500}
            className="mt-md block w-full field"
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
              className="mt-xs block field"
            />
          </div>

          <Button
            variant="primary"
            className="mt-lg"
            disabled={!canSubmit || posting}
            onClick={() => void handleSubmit()}
          >
            {posting ? 'Posting…' : 'Post job'}
          </Button>
        </div>
      )}

      {myJobs.length > 0 && (
        <div className="mt-xl">
          <h2 className="font-haas-disp text-title-md text-ink">Your postings</h2>
          <div className="mt-md space-y-md">
            {myJobs.map((job) => (
              <JobCard key={job.id} job={job} onWithdraw={() => void handleWithdraw(job.id)} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-xl">
        <h2 className="font-haas-disp text-title-md text-ink">Open roles</h2>
        {loading ? (
          <div className="mt-md">
            <SkeletonList count={3} heightClass="h-[140px]" />
          </div>
        ) : activeJobs.length === 0 ? (
          <div className="mt-md">
            <EmptyState title="No open roles right now">New postings appear here as soon as a member shares one.</EmptyState>
          </div>
        ) : (
          <div className="mt-md space-y-md">
            {activeJobs.filter((job) => !myJobs.some((mine) => mine.id === job.id)).map((job) => (
              <JobCard key={job.id} job={job} reporterUid={user?.uid} />
            ))}
          </div>
        )}
        {hasMore && (
          <div className="mt-lg flex justify-center">
            <Button variant="secondary" onClick={() => void loadMore()}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
