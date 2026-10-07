import { Link } from 'react-router-dom';
import type { EventPass } from '../../firebase/repositories/eventPassesRepository';

const TIME_OPTS: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

/**
 * A miniature boarding pass for an event the member has RSVPed to: coloured
 * date stub, perforation, then title and one line of essentials. The whole
 * card links to that event's card on the Events page.
 */
export function EventPassCard({ pass }: { pass: EventPass }) {
  const virtual = pass.format === 'virtual';
  const waitlisted = pass.rsvp === 'waitlisted';
  const stub = virtual ? 'bg-signature-forest' : 'bg-signature-coral';
  const where = virtual ? 'Online' : pass.location || 'Venue to be announced';

  return (
    <Link
      to={`/app/events#event-${pass.eventId}`}
      aria-label={`${pass.title}, ${pass.start.toLocaleDateString(undefined, { dateStyle: 'full' })}. ${waitlisted ? 'Waitlisted' : 'Attending'}. Open event`}
      className="relative flex min-h-[88px] overflow-hidden rounded-lg border border-hairline bg-canvas transition-colors duration-150 hover:border-border-strong active:bg-surface-soft"
    >
      <div className={`flex w-[76px] shrink-0 flex-col items-center justify-center ${stub} px-xs text-on-primary`}>
        <span className="text-[11px] font-medium uppercase tracking-[0.1em]">
          {pass.start.toLocaleDateString(undefined, { month: 'short' })}
        </span>
        <span className="font-haas-disp text-[32px] leading-none">{pass.start.getDate()}</span>
      </div>

      <div aria-hidden="true" className="relative w-0 border-l-2 border-dashed border-hairline">
        <span className="absolute -left-[11px] -top-[11px] h-[20px] w-[20px] rounded-full border border-hairline bg-canvas" />
        <span className="absolute -bottom-[11px] -left-[11px] h-[20px] w-[20px] rounded-full border border-hairline bg-canvas" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-xxs p-md">
        <span
          className={`text-[11px] font-medium uppercase tracking-[0.08em] ${waitlisted ? 'text-signature-coral' : 'text-success'}`}
        >
          {waitlisted ? 'Waitlisted' : 'You’re attending'}
        </span>
        <span className="truncate text-label-md text-ink">{pass.title}</span>
        <span className="truncate text-body-md text-muted">
          {pass.start.toLocaleTimeString(undefined, TIME_OPTS)} · {where}
        </span>
      </div>
    </Link>
  );
}
