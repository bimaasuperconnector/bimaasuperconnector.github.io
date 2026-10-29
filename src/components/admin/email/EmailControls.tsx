import { useEffect, useState } from 'react';
import { Button } from '../../ui/Button';
import { ErrorNote, SkeletonList } from '../../ui/PageHeader';
import { useAuth } from '../../../context/AuthContext';
import { allBatches } from '../../../lib/batches';
import {
  DEFAULT_EMAIL_CONFIG,
  INDIVIDUAL_DAILY_HARD_LIMIT,
  type EmailAutomationConfig,
} from '../../../lib/emailConfig';
import {
  type EmailStatus,
  getEmailConfig,
  getEmailStatus,
  saveEmailConfig,
} from '../../../firebase/repositories/emailAutomationRepository';
import { formatIst } from './emailUi';

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg bg-surface-soft p-md">
      <p className="text-caption text-muted">{label}</p>
      <p className="mt-xxs font-haas-disp text-title-md text-ink">{value}</p>
      {hint && <p className="text-caption text-muted">{hint}</p>}
    </div>
  );
}

function Switch({
  label,
  help,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-sm rounded-lg border border-hairline p-md">
      <input
        type="checkbox"
        className="mt-xxs h-5 w-5 shrink-0 accent-[#181d26]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-label-md text-ink">{label}</span>
        <span className="block text-body-md text-muted">{help}</span>
      </span>
    </label>
  );
}

const RUN_STATUS_LABEL = { success: 'Succeeded', partial: 'Completed with issues', failed: 'Failed' } as const;

export function EmailControls() {
  const { user } = useAuth();
  const [config, setConfig] = useState<EmailAutomationConfig>(DEFAULT_EMAIL_CONFIG);
  const [saved, setSaved] = useState<EmailAutomationConfig>(DEFAULT_EMAIL_CONFIG);
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getEmailConfig(), getEmailStatus()])
      .then(([c, s]) => {
        setConfig(c);
        setSaved(c);
        setStatus(s);
      })
      .catch(() => setError("Couldn't load the email settings."))
      .finally(() => setLoading(false));
  }, []);

  const dirty = JSON.stringify(config) !== JSON.stringify(saved);
  const update = (patch: Partial<EmailAutomationConfig>) => {
    setMessage(null);
    setConfig((c) => ({ ...c, ...patch }));
  };

  async function persist(next: EmailAutomationConfig, done: string) {
    if (!user) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await saveEmailConfig(user.uid, next);
      setConfig(next);
      setSaved(next);
      setMessage(done);
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function togglePause() {
    const next = { ...config, paused: !config.paused };
    const ask = next.paused
      ? 'Pause ALL email automation? Nothing will be sent until you resume. Welcome requests will keep queueing.'
      : 'Resume email automation? Queued emails will start going out at the next run (within the daily limit).';
    if (!confirm(ask)) return;
    void (async () => {
      if (!user) return;
      setSaving(true);
      setError(null);
      try {
        // Only the pause switch is saved here; other unsaved edits stay as they are on screen.
        const nextSaved = { ...saved, paused: next.paused };
        await saveEmailConfig(user.uid, nextSaved);
        setSaved(nextSaved);
        setConfig((c) => ({ ...c, paused: next.paused }));
        setMessage(next.paused ? 'Automation paused.' : 'Automation resumed.');
      } catch {
        setError("Couldn't change the pause setting. Please try again.");
      } finally {
        setSaving(false);
      }
    })();
  }

  function toggleBatch(n: number) {
    const has = config.targetBatches.includes(n);
    update({ targetBatches: has ? config.targetBatches.filter((b) => b !== n) : [...config.targetBatches, n].sort((a, b) => a - b) });
  }

  if (loading) return <SkeletonList count={3} heightClass="h-24" />;

  const limit = status?.dailyLimit ?? config.dailyLimit;
  return (
    <div className="space-y-lg">
      {error && <ErrorNote>{error}</ErrorNote>}

      <div
        className={`flex flex-wrap items-center justify-between gap-md rounded-lg p-md ${
          config.paused ? 'bg-signature-yellow/40' : 'bg-signature-mint/40'
        }`}
      >
        <div>
          <p className="text-label-md text-ink">{config.paused ? 'Automation is PAUSED' : 'Automation is running'}</p>
          <p className="text-body-md text-body">
            {config.paused
              ? 'No emails are sent and no birthday or reminder is queued. Welcome requests keep queueing so nobody is missed.'
              : 'Emails are processed once a day at 9:00 AM IST.'}
          </p>
        </div>
        <Button variant={config.paused ? 'primary' : 'secondary'} className="px-md py-xs" disabled={saving} onClick={togglePause}>
          {config.paused ? 'Resume automation' : 'Pause all automation'}
        </Button>
      </div>

      <section>
        <h3 className="text-label-md text-ink">Status</h3>
        {status === null ? (
          <p className="copy mt-xs">The automation has not run yet. Status appears here after its first run.</p>
        ) : (
          <>
            <div className="mt-sm grid grid-cols-2 gap-sm md:grid-cols-4">
              <Stat label="Sent today (individual)" value={`${status.sentTodayIndividual} / ${limit}`} hint="Welcome + birthday, combined" />
              <Stat label="Group messages today" value={status.sentTodayGroup} hint="Google Group reminders" />
              <Stat label="Welcome emails waiting" value={status.pendingWelcome} />
              <Stat label="Birthdays waiting" value={status.pendingBirthday} />
              <Stat label="Group reminders waiting" value={status.pendingReminders} />
              <Stat label="Failed (need attention)" value={status.failedCount} />
              <Stat label="Last run" value={status.lastRunStatus ? RUN_STATUS_LABEL[status.lastRunStatus] : '—'} hint={formatIst(status.lastRunAt)} />
              <Stat label="Next run" value={formatIst(status.nextRunAt)} />
            </div>
            {status.gmailConfigured === false && (
              <div className="mt-sm">
                <ErrorNote>Gmail is not connected yet, so nothing can be sent. Add the GMAIL_REFRESH_TOKEN secret in GitHub.</ErrorNote>
              </div>
            )}
            {status.lastRunSummary && <p className="copy mt-sm text-muted">Last run: {status.lastRunSummary}</p>}
          </>
        )}
      </section>

      <section className="space-y-sm">
        <h3 className="text-label-md text-ink">What gets sent</h3>
        <div className="grid gap-sm md:grid-cols-2">
          <Switch
            label="Welcome emails"
            help="A personal welcome to each newly approved member, oldest approval first."
            checked={config.welcomeEnabled}
            onChange={(v) => update({ welcomeEnabled: v })}
          />
          <Switch
            label="Birthday greetings"
            help="A personal greeting on each member's birthday. Welcome emails are always sent first."
            checked={config.birthdayEnabled}
            onChange={(v) => update({ birthdayEnabled: v })}
          />
          <Switch
            label="Monthly reminder: SuperConnector meetup"
            help="Sent to each batch's Google Group with the month's meetup dates."
            checked={config.meetupEnabled}
            onChange={(v) => update({ meetupEnabled: v })}
          />
          <Switch
            label="Monthly reminder: job openings"
            help="Sent to each batch's Google Group, encouraging alumni to post openings."
            checked={config.jobsEnabled}
            onChange={(v) => update({ jobsEnabled: v })}
          />
        </div>
      </section>

      <section className="grid gap-md md:grid-cols-2">
        <div>
          <h3 className="text-label-md text-ink">Monthly reminder date</h3>
          <div className="mt-sm flex gap-sm" role="radiogroup" aria-label="Monthly reminder day">
            {([1, 2] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={config.monthlyDay === d}
                aria-pressed={config.monthlyDay === d}
                className="tab-chip"
                onClick={() => update({ monthlyDay: d })}
              >
                {d === 1 ? '1st of the month' : '2nd of the month'}
              </button>
            ))}
          </div>
          <p className="mt-xs text-body-md text-muted">If a run is missed, the reminder still goes out within the next 3 days.</p>
        </div>
        <div>
          <h3 className="text-label-md text-ink">Daily limit (individual emails)</h3>
          <input
            type="number"
            min={1}
            max={INDIVIDUAL_DAILY_HARD_LIMIT}
            value={config.dailyLimit}
            onChange={(e) => update({ dailyLimit: Math.min(INDIVIDUAL_DAILY_HARD_LIMIT, Math.max(1, Number(e.target.value) || 1)) })}
            className="field mt-sm w-28"
            aria-label="Daily limit"
          />
          <p className="mt-xs text-body-md text-muted">Shared by welcome emails and birthdays. Hard maximum: {INDIVIDUAL_DAILY_HARD_LIMIT}.</p>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <h3 className="text-label-md text-ink">Batches that receive the monthly reminders</h3>
          <div className="flex gap-xs">
            <button type="button" className="tab-chip" onClick={() => update({ targetBatches: [] })} aria-pressed={config.targetBatches.length === 0}>
              All batches
            </button>
            <button type="button" className="tab-chip" onClick={() => update({ targetBatches: allBatches().map((b) => b.batchNumber) })}>
              Select every batch
            </button>
          </div>
        </div>
        <p className="mt-xs text-body-md text-muted">
          {config.targetBatches.length === 0
            ? 'Currently: every batch that has a Google Group address saved.'
            : `Currently: ${config.targetBatches.length} selected batch(es), and only those with a Google Group address.`}
        </p>
        <div className="mt-sm grid grid-cols-3 gap-xs sm:grid-cols-5 md:grid-cols-8">
          {allBatches().map((b) => (
            <label key={b.batchNumber} className="flex cursor-pointer items-center gap-xs rounded-md border border-hairline px-sm py-xs text-body-md">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#181d26]"
                checked={config.targetBatches.includes(b.batchNumber)}
                onChange={() => toggleBatch(b.batchNumber)}
              />
              {b.id}
            </label>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-md">
        <Button disabled={!dirty || saving} onClick={() => void persist(config, 'Settings saved. They apply from the next run.')}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
        {dirty && (
          <Button variant="secondary" onClick={() => setConfig(saved)}>
            Discard changes
          </Button>
        )}
        {message && <p className="text-body-md text-success">{message}</p>}
      </div>
    </div>
  );
}
