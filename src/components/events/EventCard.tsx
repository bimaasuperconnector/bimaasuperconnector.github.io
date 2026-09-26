import { useState } from 'react';
import { Button } from '../ui/Button';
import {
  EVENT_FORMAT_LABELS,
  computeAvailability,
  isRsvpWindowOpen,
  targetingSummary,
  type EventRsvpStatus,
} from '../../lib/events';
import { type AlumniEvent, countAttending } from '../../firebase/repositories/eventsRepository';

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

export function EventCard({
  event,
  myRsvpStatus,
  onRespond,
  onWithdraw,
  canManage,
  onManage,
}: {
  event: AlumniEvent;
  myRsvpStatus: EventRsvpStatus | null;
  onRespond: (status: 'attending' | 'waitlisted') => Promise<void>;
  onWithdraw: () => Promise<void>;
  canManage?: boolean;
  onManage?: () => void;
}) {
  const [responding, setResponding] = useState(false);
  const [availability, setAvailability] = useState<{ remaining: number | null; isFull: boolean } | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const rsvpOpen = isRsvpWindowOpen(event);
  const isCancelled = event.status === 'cancelled';
  const isAttendingOrWaitlisted = myRsvpStatus === 'attending' || myRsvpStatus === 'waitlisted';

  // Lazy: only checked when the person is actually about to RSVP, not
  // for every card rendered in the feed — see countAttending()'s doc
  // comment on why this stays a single count() call, not a download.
  async function handleRespond() {
    setResponding(true);
    try {
      if (event.capacity != null && myRsvpStatus !== 'attending') {
        setCheckingAvailability(true);
        const attending = await countAttending(event.id);
        const avail = computeAvailability(event.capacity, attending);
        setAvailability(avail);
        setCheckingAvailability(false);
        await onRespond(avail.isFull ? 'waitlisted' : 'attending');
      } else {
        await onRespond('attending');
      }
    } finally {
      setResponding(false);
    }
  }

  return (
    <div className="rounded-md border border-hairline p-md">
      <div className="flex items-start justify-between gap-md">
        <div>
          <p className="text-label-md text-ink">{event.title}</p>
          <p className="text-body-md text-muted">
            {event.startTime.toLocaleString(undefined, DATE_OPTS)} · {EVENT_FORMAT_LABELS[event.format]}
            {event.format === 'physical' && event.location ? ` · ${event.location}` : ''}
          </p>
        </div>
        {isCancelled && (
          <span className="shrink-0 rounded-sm bg-surface-strong px-xs py-xxs text-caption text-body">Cancelled</span>
        )}
      </div>

      {event.description && <p className="mt-sm text-body-md text-body">{event.description}</p>}
      {event.format === 'virtual' && event.virtualNote && (
        <p className="mt-xs text-caption text-muted">{event.virtualNote}</p>
      )}

      <p className="mt-sm text-caption text-muted">
        Organized by {event.organizerDisplayName} · {targetingSummary(event)}
        {event.capacity != null && ` · Capacity ${event.capacity}`}
      </p>

      {checkingAvailability && <p className="mt-xs text-caption text-muted">Checking availability…</p>}
      {availability?.isFull && myRsvpStatus === 'waitlisted' && (
        <p className="mt-xs text-caption text-signature-mustard">Full — you're on the waitlist.</p>
      )}

      {!isCancelled && (
        <div className="mt-sm flex flex-wrap items-center gap-sm">
          {isAttendingOrWaitlisted ? (
            <>
              <span className="text-body-md text-body">
                You're {myRsvpStatus === 'attending' ? 'attending' : 'on the waitlist'}.
              </span>
              <button type="button" onClick={() => void onWithdraw()} className="text-body-md text-signature-coral hover:underline">
                Cancel RSVP
              </button>
            </>
          ) : rsvpOpen ? (
            <Button variant="primary" className="px-md py-xs" disabled={responding} onClick={() => void handleRespond()}>
              {responding ? 'Responding…' : 'RSVP'}
            </Button>
          ) : (
            <span className="text-body-md text-muted">RSVPs are closed for this event.</span>
          )}

          {canManage && (
            <button type="button" onClick={onManage} className="text-body-md text-link hover:text-link-active">
              Manage
            </button>
          )}
        </div>
      )}
    </div>
  );
}
