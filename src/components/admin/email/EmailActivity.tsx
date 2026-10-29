import { useCallback, useEffect, useState } from 'react';
import { ErrorNote, SkeletonList, EmptyState } from '../../ui/PageHeader';
import { batchId } from '../../../lib/batches';
import { QUEUE_STATUSES, REMINDER_LABELS, type QueueStatus } from '../../../lib/emailConfig';
import { type QueueItem, listQueue } from '../../../firebase/repositories/emailAutomationRepository';
import { formatIst } from './emailUi';

const FILTERS: (QueueStatus | 'all')[] = ['all', ...QUEUE_STATUSES.filter((s) => s !== 'sending')];

const STATUS_STYLE: Record<QueueStatus, string> = {
  pending: 'bg-signature-yellow/50',
  sending: 'bg-signature-yellow/50',
  sent: 'bg-signature-mint/50',
  failed: 'bg-signature-coral/15 text-signature-coral',
  skipped: 'bg-surface-strong',
};

function kindLabel(i: QueueItem): string {
  if (i.kind === 'welcome') return 'Welcome';
  if (i.kind === 'birthday') return 'Birthday';
  return i.reminderType ? REMINDER_LABELS[i.reminderType] : 'Reminder';
}

export function EmailActivity() {
  const [filter, setFilter] = useState<QueueStatus | 'all'>('all');
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: QueueStatus | 'all') => {
    setItems(null);
    setError(null);
    try {
      setItems(await listQueue(f));
    } catch {
      setError("Couldn't load the activity. If you just deployed, the Firestore index may still be building.");
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  return (
    <div className="space-y-md">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <div className="flex flex-wrap gap-xs" role="tablist" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className="tab-chip capitalize" onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <button type="button" className="text-body-md text-link" onClick={() => void load(filter)}>
          Refresh
        </button>
      </div>
      <p className="text-body-md text-muted">Showing the latest 50. Pending items are waiting for the next run; failed items can be retried from Manual send.</p>
      {error && <ErrorNote>{error}</ErrorNote>}
      {items === null ? (
        <SkeletonList count={4} heightClass="h-14" />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing here yet" />
      ) : (
        <ul className="space-y-xs">
          {items.map((i) => (
            <li key={i.id} className="rounded-lg bg-surface-soft p-sm">
              <div className="flex flex-wrap items-center justify-between gap-sm">
                <p className="min-w-0 truncate text-body-md text-ink">
                  {kindLabel(i)} · {i.name || i.email}
                  {i.batchNumber ? ` · ${batchId(i.batchNumber)}` : ''}
                </p>
                <span className={`chip ${STATUS_STYLE[i.status] ?? ''}`}>{i.status}</span>
              </div>
              <p className="truncate text-caption text-muted">
                {i.email} · {i.recipient === 'group' ? 'Google Group' : 'individual'} · attempts {i.attempts} ·{' '}
                {i.sentAt ? `sent ${formatIst(i.sentAt)}` : `updated ${formatIst(i.updatedAt)}`}
              </p>
              {i.lastError && <p className="text-caption text-signature-coral">{i.lastError}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
