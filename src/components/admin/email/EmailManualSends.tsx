import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Button } from '../../ui/Button';
import { ErrorNote, SkeletonList } from '../../ui/PageHeader';
import { useAuth } from '../../../context/AuthContext';
import { allBatches, batchId } from '../../../lib/batches';
import { REMINDER_LABELS, REMINDER_TYPES, type ReminderType } from '../../../lib/emailConfig';
import {
  type EmailCommand,
  type EmailCommandAction,
  getGroupAddresses,
  listEmailCommands,
  requestEmailCommand,
} from '../../../firebase/repositories/emailAutomationRepository';
import { GITHUB_RUN_URL, formatIst } from './emailUi';

const ACTION_LABELS: Record<EmailCommandAction, string> = {
  process_welcome: 'Process welcome backlog now',
  process_birthday: "Process today's birthdays now",
  send_reminder: 'Send monthly reminder',
  retry_failed: 'Retry failed emails',
  rebuild_indexes: 'Rebuild member lists and birthday index',
};

const STATUS_STYLE: Record<EmailCommand['status'], string> = {
  requested: 'bg-signature-yellow/50',
  running: 'bg-signature-yellow/50',
  done: 'bg-signature-mint/50',
  failed: 'bg-signature-coral/15 text-signature-coral',
  rejected: 'bg-signature-coral/15 text-signature-coral',
};

function ActionCard({
  title,
  description,
  busy,
  disabled,
  onClick,
  label,
  children,
}: {
  title: string;
  description: string;
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-hairline p-md">
      <p className="text-label-md text-ink">{title}</p>
      <p className="mt-xxs text-body-md text-muted">{description}</p>
      {children}
      <div className="mt-sm">
        <Button variant="secondary" className="px-md py-xs" disabled={busy || disabled} onClick={onClick}>
          {busy ? 'Requesting…' : label}
        </Button>
      </div>
    </div>
  );
}

export function EmailManualSends() {
  const { user } = useAuth();
  const [commands, setCommands] = useState<EmailCommand[] | null>(null);
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [type, setType] = useState<ReminderType>('meetup');
  const [selected, setSelected] = useState<number[]>([]);

  const refresh = useCallback(async () => {
    try {
      setCommands(await listEmailCommands());
    } catch {
      setError("Couldn't load recent requests.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    getGroupAddresses().then(setAddresses).catch(() => undefined);
  }, [refresh]);

  const inFlight = (action: EmailCommandAction) => (commands ?? []).some((c) => c.action === action && (c.status === 'requested' || c.status === 'running'));
  const withAddress = allBatches().filter((b) => addresses[String(b.batchNumber)]);

  async function request(action: EmailCommandAction, confirmText: string, extra?: { reminderType?: ReminderType; batches?: number[] }) {
    if (!user) return;
    if (!confirm(`${confirmText}\n\nThis is sent as a request and runs at the next automation run. It still respects the daily limit and never re-sends an email that was already sent.`)) return;
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      await requestEmailCommand(user.uid, { action, ...extra });
      setMessage('Request recorded. It will run at the next automation run (daily at 9:00 AM IST), or immediately if you press "Run workflow" on GitHub.');
      await refresh();
    } catch {
      setError("Couldn't record the request. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function toggle(n: number) {
    setSelected((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n].sort((a, b) => a - b)));
  }

  return (
    <div className="space-y-lg">
      <p className="copy">
        Manual sends are requests: the automation checks you are a superadmin, then runs them with the same safety rules as scheduled sends (daily limit, pause switch, no
        duplicates). They run at the next 9:00 AM IST run, or straight away if you open{' '}
        <a className="text-link" href={GITHUB_RUN_URL} target="_blank" rel="noreferrer">
          the GitHub workflow page
        </a>{' '}
        and press <span className="text-ink">Run workflow</span>.
      </p>
      {error && <ErrorNote>{error}</ErrorNote>}
      {message && <p className="text-body-md text-success">{message}</p>}

      <div className="grid gap-md md:grid-cols-2">
        <ActionCard
          title={ACTION_LABELS.process_welcome}
          description="Sends waiting welcome emails oldest first, even if welcome emails are switched off in Controls. Still limited to today's remaining budget."
          busy={busy === 'process_welcome'}
          disabled={inFlight('process_welcome')}
          label={inFlight('process_welcome') ? 'Already requested' : 'Request'}
          onClick={() => void request('process_welcome', 'Process the welcome-email backlog now?')}
        />
        <ActionCard
          title={ACTION_LABELS.process_birthday}
          description="Queues and sends today's birthday greetings, even if birthdays are switched off in Controls. Anyone already greeted this year is skipped."
          busy={busy === 'process_birthday'}
          disabled={inFlight('process_birthday')}
          label={inFlight('process_birthday') ? 'Already requested' : 'Request'}
          onClick={() => void request('process_birthday', "Process today's birthday greetings now?")}
        />
        <ActionCard
          title={ACTION_LABELS.retry_failed}
          description="Puts emails that failed permanently back in the queue (up to 200) so they are tried again."
          busy={busy === 'retry_failed'}
          disabled={inFlight('retry_failed')}
          label={inFlight('retry_failed') ? 'Already requested' : 'Request'}
          onClick={() => void request('retry_failed', 'Put all failed emails back in the queue?')}
        />
        <ActionCard
          title={ACTION_LABELS.rebuild_indexes}
          description="Recounts every approved member to rebuild the Google Group lists and the birthday index. Reads each member once, so use it only if lists look wrong."
          busy={busy === 'rebuild_indexes'}
          disabled={inFlight('rebuild_indexes')}
          label={inFlight('rebuild_indexes') ? 'Already requested' : 'Request'}
          onClick={() => void request('rebuild_indexes', 'Rebuild the member lists and birthday index? This reads every approved member once.')}
        />
      </div>

      <div className="rounded-lg border border-hairline p-md">
        <p className="text-label-md text-ink">{ACTION_LABELS.send_reminder}</p>
        <p className="mt-xxs text-body-md text-muted">
          Sends this month's reminder to the selected batches' Google Groups. A batch that already received this reminder this month is skipped automatically.
        </p>
        <div className="mt-sm flex flex-wrap gap-xs" role="radiogroup" aria-label="Reminder type">
          {REMINDER_TYPES.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={type === t} aria-pressed={type === t} className="tab-chip" onClick={() => setType(t)}>
              {REMINDER_LABELS[t]}
            </button>
          ))}
        </div>
        {withAddress.length === 0 ? (
          <p className="copy mt-sm text-muted">No Google Group addresses saved yet. Add them in the Google Groups tab first.</p>
        ) : (
          <>
            <div className="mt-sm flex gap-xs">
              <button type="button" className="tab-chip" onClick={() => setSelected(withAddress.map((b) => b.batchNumber))}>
                Select all with a group
              </button>
              <button type="button" className="tab-chip" onClick={() => setSelected([])}>
                Clear
              </button>
            </div>
            <div className="mt-sm grid grid-cols-3 gap-xs sm:grid-cols-5 md:grid-cols-8">
              {withAddress.map((b) => (
                <label key={b.batchNumber} className="flex cursor-pointer items-center gap-xs rounded-md border border-hairline px-sm py-xs text-body-md">
                  <input type="checkbox" className="h-4 w-4 accent-[#181d26]" checked={selected.includes(b.batchNumber)} onChange={() => toggle(b.batchNumber)} />
                  {b.id}
                </label>
              ))}
            </div>
          </>
        )}
        <div className="mt-sm">
          <Button
            variant="secondary"
            className="px-md py-xs"
            disabled={selected.length === 0 || busy === 'send_reminder'}
            onClick={() =>
              void request(
                'send_reminder',
                `Send the "${REMINDER_LABELS[type]}" to ${selected.length} batch group(s): ${selected.map(batchId).join(', ')}?`,
                { reminderType: type, batches: selected },
              )
            }
          >
            {busy === 'send_reminder' ? 'Requesting…' : `Request send to ${selected.length} batch(es)`}
          </Button>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between gap-sm">
          <h3 className="text-label-md text-ink">Recent requests</h3>
          <button type="button" className="text-body-md text-link" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
        {commands === null ? (
          <div className="mt-sm"><SkeletonList count={2} heightClass="h-12" /></div>
        ) : commands.length === 0 ? (
          <p className="copy mt-xs text-muted">No manual requests yet.</p>
        ) : (
          <ul className="mt-sm space-y-xs">
            {commands.map((c) => (
              <li key={c.id} className="rounded-lg bg-surface-soft p-sm">
                <div className="flex flex-wrap items-center justify-between gap-sm">
                  <p className="text-body-md text-ink">
                    {ACTION_LABELS[c.action]}
                    {c.reminderType ? ` (${REMINDER_LABELS[c.reminderType]}, ${c.batches.length} batch(es))` : ''}
                  </p>
                  <span className={`chip ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                </div>
                <p className="text-caption text-muted">
                  Requested {formatIst(c.requestedAt)}
                  {c.completedAt ? ` · finished ${formatIst(c.completedAt)}` : ''}
                </p>
                {c.result && <p className="text-body-md text-body">{c.result}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
