import { useEffect, useState } from 'react';
import { Button } from '../../ui/Button';
import { EmptyState, ErrorNote, SkeletonList } from '../../ui/PageHeader';
import { useAuth } from '../../../context/AuthContext';
import { allBatches, batchId, batchLabel } from '../../../lib/batches';
import { isValidEmail } from '../../../lib/emailConfig';
import {
  type GroupReport,
  diffReport,
  getGroupAddresses,
  getGroupReport,
  listGroupReports,
  markGroupApplied,
  saveGroupAddresses,
} from '../../../firebase/repositories/emailAutomationRepository';
import { copyText, csvCell, downloadTextFile, formatIst } from './emailUi';

// ---------------------------------------------------------------------
// Group addresses
// ---------------------------------------------------------------------

function GroupAddresses({ onSaved }: { onSaved: (a: Record<string, string>) => void }) {
  const { user } = useAuth();
  const [saved, setSaved] = useState<Record<string, string> | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGroupAddresses()
      .then((a) => {
        setSaved(a);
        setDraft(a);
        onSaved(a);
      })
      .catch(() => setError("Couldn't load the group addresses."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!saved) return error ? <ErrorNote>{error}</ErrorNote> : <SkeletonList count={2} heightClass="h-12" />;

  const clean = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(draft)) if (v.trim()) out[k] = v.trim().toLowerCase();
    return out;
  };
  const dirty = JSON.stringify(clean()) !== JSON.stringify(saved);
  const configured = Object.keys(clean()).length;

  async function save() {
    if (!user) return;
    const next = clean();
    const bad = Object.entries(next).find(([, v]) => !isValidEmail(v));
    if (bad) return setError(`${batchId(Number(bad[0]))}: "${bad[1]}" is not a valid email address.`);
    const seen = new Map<string, string>();
    for (const [k, v] of Object.entries(next)) {
      if (seen.has(v)) return setError(`${batchId(Number(k))} and ${batchId(Number(seen.get(v)))} use the same address (${v}).`);
      seen.set(v, k);
    }
    setSaving(true);
    setError(null);
    try {
      await saveGroupAddresses(user.uid, next);
      setSaved(next);
      setDraft(next);
      onSaved(next);
      setMessage('Group addresses saved.');
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="copy">
        Enter the Google Group address for each batch as you create it. Monthly reminders go to these addresses; a batch with no address is simply skipped.
        <span className="text-ink"> {configured} of {allBatches().length} batches configured.</span>
      </p>
      <div className="mt-md grid gap-xs md:grid-cols-2">
        {allBatches().map((b) => (
          <label key={b.batchNumber} className="flex items-center gap-sm">
            <span className="w-24 shrink-0 text-body-md text-ink" title={b.label}>{b.id}</span>
            <input
              type="email"
              inputMode="email"
              className="field min-w-0 flex-1"
              placeholder="batch-group@googlegroups.com"
              value={draft[String(b.batchNumber)] ?? ''}
              onChange={(e) => {
                setMessage(null);
                setDraft((d) => ({ ...d, [String(b.batchNumber)]: e.target.value }));
              }}
            />
          </label>
        ))}
      </div>
      {error && (
        <div className="mt-sm">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      <div className="mt-md flex flex-wrap items-center gap-md">
        <Button disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save group addresses'}
        </Button>
        {message && <p className="text-body-md text-success">{message}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Membership reports
// ---------------------------------------------------------------------

function EmailBlock({ title, emails, filename }: { title: string; emails: string[]; filename: string }) {
  const [copied, setCopied] = useState(false);
  const text = emails.join(', ');
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <p className="text-label-md text-ink">
          {title} <span className="text-muted">({emails.length})</span>
        </p>
        {emails.length > 0 && (
          <div className="flex gap-xs">
            <Button
              variant="secondary"
              className="px-md py-xs"
              onClick={async () => {
                setCopied(await copyText(text));
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? 'Copied' : 'Copy list'}
            </Button>
            <Button variant="secondary" className="px-md py-xs" onClick={() => downloadTextFile(filename, text)}>
              Download
            </Button>
          </div>
        )}
      </div>
      {emails.length === 0 ? (
        <p className="copy mt-xs text-muted">None.</p>
      ) : (
        <textarea readOnly rows={Math.min(8, Math.max(2, Math.ceil(text.length / 90)))} className="field mt-xs w-full font-mono text-[13px]" value={text} onFocus={(e) => e.currentTarget.select()} />
      )}
    </div>
  );
}

function ReportPanel({ report, address, onApplied }: { report: GroupReport; address: string | null; onApplied: (r: GroupReport) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { added, removed } = diffReport(report);
  const id = batchId(report.batchNumber);

  async function apply() {
    if (!confirm(`Confirm you have already updated the ${id} Google Group${address ? ` (${address})` : ''} with these additions and removals?`)) return;
    setBusy(true);
    setError(null);
    try {
      await markGroupApplied(report.batchNumber, report.emails);
      onApplied({ ...report, baseline: report.emails, baselineAt: new Date() });
    } catch {
      setError("Couldn't record that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-md rounded-lg bg-surface-soft p-md">
      <div>
        <p className="text-label-md text-ink">{batchLabel(report.batchNumber)}</p>
        <p className="text-body-md text-muted">
          {report.emails.length} approved member(s) · list refreshed {formatIst(report.updatedAt)} · last marked as applied {formatIst(report.baselineAt)}
          {address ? ` · group: ${address}` : ' · no group address saved yet'}
        </p>
      </div>
      <EmailBlock title="All members (paste into the Google Group)" emails={report.emails} filename={`${id}-members.txt`} />
      <div className="grid gap-md md:grid-cols-2">
        <EmailBlock title="To ADD since last update" emails={added} filename={`${id}-add.txt`} />
        <EmailBlock title="To REMOVE since last update" emails={removed} filename={`${id}-remove.txt`} />
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex flex-wrap items-center gap-md">
        <Button disabled={busy || (added.length === 0 && removed.length === 0)} onClick={() => void apply()}>
          {busy ? 'Saving…' : "I've updated the Google Group"}
        </Button>
        <p className="text-body-md text-muted">Pressing this resets the additions/removals lists, so the next report shows only what changes after today.</p>
      </div>
    </div>
  );
}

function MembershipReports({ addresses }: { addresses: Record<string, string> }) {
  const [batch, setBatch] = useState<number | ''>('');
  const [report, setReport] = useState<GroupReport | null | undefined>(undefined);
  const [all, setAll] = useState<GroupReport[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open(n: number) {
    setBatch(n);
    setReport(undefined);
    setError(null);
    setLoading(true);
    try {
      setReport(await getGroupReport(n));
    } catch {
      setError("Couldn't load that report.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAll() {
    setError(null);
    setLoading(true);
    try {
      setAll(await listGroupReports());
    } catch {
      setError("Couldn't load the reports.");
    } finally {
      setLoading(false);
    }
  }

  function downloadAllCsv() {
    if (!all) return;
    const rows = ['batch,group_address,email'];
    for (const r of all) for (const e of r.emails) rows.push([batchId(r.batchNumber), addresses[String(r.batchNumber)] ?? '', e].map(csvCell).join(','));
    downloadTextFile('google-group-members-all-batches.csv', rows.join('\n'), 'text/csv');
  }

  return (
    <div className="space-y-md">
      <p className="copy">
        The member lists are refreshed automatically every day from approved members. Pick a batch, copy the comma-separated list, and paste it into that batch's Google Group
        (Google Groups → the group → Members → Add members). Google Groups is updated by you; this app never changes a group itself.
      </p>
      <div className="flex flex-wrap items-center gap-sm">
        <select className="field" aria-label="Batch" value={batch} onChange={(e) => e.target.value && void open(Number(e.target.value))}>
          <option value="">Choose a batch…</option>
          {allBatches().map((b) => (
            <option key={b.batchNumber} value={b.batchNumber}>
              {b.label}
            </option>
          ))}
        </select>
        <Button variant="secondary" className="px-md py-xs" disabled={loading} onClick={() => void loadAll()}>
          Load all batches overview
        </Button>
        {all && all.length > 0 && (
          <Button variant="secondary" className="px-md py-xs" onClick={downloadAllCsv}>
            Download all (CSV)
          </Button>
        )}
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && <SkeletonList count={1} heightClass="h-24" />}
      {report === null && batch !== '' && <EmptyState title="No list for this batch yet">It appears after the automation's next run once the batch has approved members.</EmptyState>}
      {report && batch !== '' && <ReportPanel report={report} address={addresses[String(batch)] ?? null} onApplied={setReport} />}

      {all && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-body-md">
            <thead>
              <tr className="border-b border-hairline text-caption text-muted">
                <th className="py-xs pr-md font-medium">Batch</th>
                <th className="py-xs pr-md font-medium">Group address</th>
                <th className="py-xs pr-md font-medium">Members</th>
                <th className="py-xs pr-md font-medium">To add</th>
                <th className="py-xs pr-md font-medium">To remove</th>
                <th className="py-xs font-medium" />
              </tr>
            </thead>
            <tbody>
              {all.map((r) => {
                const d = diffReport(r);
                return (
                  <tr key={r.batchNumber} className="border-b border-hairline">
                    <td className="py-xs pr-md text-ink">{batchId(r.batchNumber)}</td>
                    <td className="py-xs pr-md text-muted">{addresses[String(r.batchNumber)] ?? '—'}</td>
                    <td className="py-xs pr-md">{r.emails.length}</td>
                    <td className="py-xs pr-md">{d.added.length}</td>
                    <td className="py-xs pr-md">{d.removed.length}</td>
                    <td className="py-xs text-right">
                      <button type="button" className="text-link" onClick={() => { setReport(r); setBatch(r.batchNumber); }}>
                        Open
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function EmailGroups() {
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  return (
    <div className="space-y-xl">
      <section>
        <h3 className="font-haas-disp text-title-sm text-ink">1. Google Group addresses</h3>
        <div className="mt-sm">
          <GroupAddresses onSaved={setAddresses} />
        </div>
      </section>
      <section>
        <h3 className="font-haas-disp text-title-sm text-ink">2. Membership lists and changes</h3>
        <div className="mt-sm">
          <MembershipReports addresses={addresses} />
        </div>
      </section>
    </div>
  );
}
