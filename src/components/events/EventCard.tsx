import { useState } from 'react';
import { Button } from '../ui/Button';
import { ClockIcon, EventsIcon, MapPinIcon, UsersIcon, VideoIcon } from '../icons/NavIcons';
import {
  EVENT_FORMAT_LABELS,
  computeAvailability,
  isRsvpWindowOpen,
  targetingSummary,
  type EventRsvpStatus,
} from '../../lib/events';
import { type AlumniEvent, countAttending } from '../../firebase/repositories/eventsRepository';

const TIME_OPTS: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
const DATE_OPTS: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Small ticket-field: an uppercase label over a value. */
function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? 'col-span-2 sm:col-span-3' : ''}`}>
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{label}</dt>
      <dd className="mt-xxs text-body-md text-ink [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** Decorative barcode derived from the event id (purely visual). */
function Barcode({ seed }: { seed: string }) {
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  let h = 7;
  for (let i = 0; i < 34; i++) {
    h = (h * 31 + seed.charCodeAt(i % seed.length) + i) >>> 0;
    const w = 1 + (h % 3);
    if (i % 2 === 0) bars.push({ x, w });
    x += w + 1;
  }
  return (
    <svg viewBox={`0 0 ${x} 24`} preserveAspectRatio="none" className="h-6 w-full text-ink" aria-hidden="true">
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={24} fill="currentColor" />
      ))}
    </svg>
  );
}

/**
 * An event rendered as a boarding pass: a coloured header band and the
 * journey-style fields on the left, a perforated tear-off stub on the right
 * (below on phones) carrying the date and every action — RSVP / cancel RSVP,
 * waitlist state, Manage. All the data the previous card showed is still
 * here: title, date/time, format, location or virtual note, description,
 * organizer, audience, capacity, cancelled state and availability messages.
 */
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
  const isVirtual = event.format === 'virtual';

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

  const start = event.startTime;
  const end = event.endTime;
  const band = isCancelled ? 'bg-surface-strong text-ink' : isVirtual ? 'bg-signature-forest text-on-primary' : 'bg-signature-coral text-on-primary';
  const weekday = start.toLocaleDateString(undefined, { weekday: 'short' });
  const month = start.toLocaleDateString(undefined, { month: 'short' });
  const day = start.getDate();
  const ref = event.id.slice(0, 6).toUpperCase();

  return (
    <article
      aria-label={`${event.title}${isCancelled ? ' (cancelled)' : ''}`}
      className="relative flex flex-col overflow-hidden rounded-lg border border-hairline bg-canvas md:flex-row"
    >
      {/* ---- Main pass ---- */}
      <div className="min-w-0 flex-1">
        <div className={`flex items-center justify-between gap-sm px-lg py-sm text-[12px] font-medium uppercase tracking-[0.1em] ${band}`}>
          <span className="flex items-center gap-xs">
            <EventsIcon width={16} height={16} /> Alumni event
          </span>
          <span className="flex items-center gap-xs">
            {isVirtual ? <VideoIcon width={16} height={16} /> : <MapPinIcon width={16} height={16} />}
            {EVENT_FORMAT_LABELS[event.format]}
          </span>
        </div>

        <div className="p-lg">
          <div className="flex flex-wrap items-start justify-between gap-sm">
            <h3 className={`font-haas-disp text-title-lg text-ink ${isCancelled ? 'line-through decoration-1' : ''}`}>
              {event.title}
            </h3>
            {isCancelled && <span className="chip shrink-0 bg-surface-strong text-body">Cancelled</span>}
          </div>

          {event.description && <p className="copy mt-xs whitespace-pre-line">{event.description}</p>}

          <dl className="mt-lg grid grid-cols-2 gap-x-md gap-y-md sm:grid-cols-3">
            <Field label="Date">{start.toLocaleDateString(undefined, DATE_OPTS)}</Field>
            <Field label="Time">
              <span className="inline-flex items-center gap-xxs">
                <ClockIcon width={14} height={14} />
                {start.toLocaleTimeString(undefined, TIME_OPTS)}
                {' – '}
                {end.toLocaleTimeString(undefined, TIME_OPTS)}
                {!sameDay(start, end) && ` (${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})`}
              </span>
            </Field>
            <Field label={isVirtual ? 'Where' : 'Location'}>
              {isVirtual ? 'Online' : event.location || 'To be announced'}
            </Field>
            <Field label="Organizer">{event.organizerDisplayName}</Field>
            <Field label="Open to">
              <span className="inline-flex items-center gap-xxs">
                <UsersIcon width={14} height={14} />
                {targetingSummary(event)}
              </span>
            </Field>
            {event.capacity != null && <Field label="Capacity">{event.capacity}</Field>}
            {isVirtual && event.virtualNote && (
              <Field label="How to join" wide>
                {event.virtualNote}
              </Field>
            )}
          </dl>
        </div>
      </div>

      {/* ---- Perforation ---- */}
      <div aria-hidden="true" className="relative h-0 border-t-2 border-dashed border-hairline md:h-auto md:w-0 md:border-l-2 md:border-t-0">
        <span className="absolute -left-[11px] -top-[12px] h-[22px] w-[22px] rounded-full border border-hairline bg-canvas md:-left-[12px] md:-top-[11px]" />
        <span className="absolute -top-[12px] right-[-11px] h-[22px] w-[22px] rounded-full border border-hairline bg-canvas md:-bottom-[11px] md:-left-[12px] md:right-auto md:top-auto" />
      </div>

      {/* ---- Tear-off stub ---- */}
      <div className="flex flex-col gap-md bg-surface-soft p-lg md:w-[236px] md:shrink-0">
        <div className="flex items-end justify-between gap-md md:block">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Admit one</p>
            <p className="mt-xxs flex items-baseline gap-xs">
              <span className="font-haas-disp text-[44px] font-normal leading-none text-ink">{day}</span>
              <span className="text-label-md uppercase text-ink">
                {month} · {weekday}
              </span>
            </p>
            <p className="mt-xxs text-body-md text-body">{start.toLocaleTimeString(undefined, TIME_OPTS)}</p>
          </div>
          <div className="w-[96px] shrink-0 md:mt-md md:w-full">
            <Barcode seed={event.id} />
            <p className="mt-xxs text-[11px] tracking-[0.12em] text-muted">REF {ref}</p>
          </div>
        </div>

        {checkingAvailability && <p className="text-caption text-muted">Checking availability…</p>}
        {availability?.isFull && myRsvpStatus === 'waitlisted' && (
          <p className="text-caption text-signature-coral">Full — you're on the waitlist.</p>
        )}

        {!isCancelled && (
          <div className="mt-auto flex flex-col gap-sm" aria-live="polite">
            {isAttendingOrWaitlisted ? (
              <>
                <span
                  className={`chip w-fit ${myRsvpStatus === 'attending' ? 'bg-signature-mint' : 'bg-signature-yellow'}`}
                >
                  You're {myRsvpStatus === 'attending' ? 'attending' : 'on the waitlist'}
                </span>
                <button
                  type="button"
                  onClick={() => void onWithdraw()}
                  className="inline-flex min-h-[44px] w-fit items-center rounded-lg text-body-md text-signature-coral active:opacity-70"
                >
                  Cancel RSVP
                </button>
              </>
            ) : rsvpOpen ? (
              <Button variant="primary" className="w-full px-md py-sm" disabled={responding} onClick={() => void handleRespond()}>
                {responding ? 'Responding…' : 'RSVP'}
              </Button>
            ) : (
              <span className="text-body-md text-muted">RSVPs are closed for this event.</span>
            )}

            {canManage && (
              <button
                type="button"
                onClick={onManage}
                className="inline-flex min-h-[44px] w-fit items-center rounded-lg text-body-md text-link active:text-link-active"
              >
                Manage event
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
