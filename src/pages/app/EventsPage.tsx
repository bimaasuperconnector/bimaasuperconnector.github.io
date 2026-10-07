import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOwnProfile } from '../../context/OwnProfileContext';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorNote, PageHeader, SkeletonList } from '../../components/ui/PageHeader';
import { TargetingEditor } from '../../components/events/TargetingEditor';
import { EventCard } from '../../components/events/EventCard';
import {
  type AlumniEvent,
  type EventFormFields,
  cancelEvent,
  createEvent,
  deleteEvent,
  queryVisibleEvents,
} from '../../firebase/repositories/eventsRepository';
import {
  type EventRsvp,
  listEventAttendees,
  listOwnRsvps,
  upsertRsvp,
  withdrawRsvp,
} from '../../firebase/repositories/eventRsvpsRepository';
import {
  EMPTY_EVENT_TARGETING,
  type EventRsvpStatus,
  type EventTargeting,
  isValidCapacity,
} from '../../lib/events';
import { invalidateEventPasses } from '../../firebase/repositories/eventPassesRepository';
import { type ReportReason, REPORT_REASONS, reportEvent } from '../../firebase/repositories/reportsRepository';

const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam',
  inappropriate: 'Inappropriate',
  scam: 'Scam',
  other: 'Other',
};

function ReportEventControl({ eventId, reporterUid }: { eventId: string; reporterUid: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('spam');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) return <p className="mt-xs px-xs text-caption text-muted">Reported — thanks for flagging this.</p>;
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-xxs inline-flex min-h-[36px] items-center px-xs text-caption text-muted underline-offset-2 hover:underline"
      >
        Report this event
      </button>
    );
  }

  async function submit() {
    setSending(true);
    try {
      await reportEvent(reporterUid, eventId, reason, note);
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-xs rounded-lg bg-surface-soft p-md">
      <div className="flex flex-wrap gap-md">
        {REPORT_REASONS.map((r) => (
          <label key={r} className="flex min-h-[32px] items-center gap-xs text-body-md text-body">
            <input type="radio" name={`event-reason-${eventId}`} checked={reason === r} onChange={() => setReason(r)} />
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
        className="field mt-xs block w-full"
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

function defaultFormFields(): EventFormFields {
  const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    title: '',
    description: '',
    format: 'virtual',
    location: '',
    virtualNote: '',
    startTime: start,
    endTime: end,
    rsvpDeadline: null,
    capacity: null,
  };
}

function toLocalInputValue(date: Date): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

/** Attendee-management panel for one event, shown only to its organizer. */
function ManageEventPanel({
  event,
  onClose,
  onChanged,
}: {
  event: AlumniEvent;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [attendees, setAttendees] = useState<EventRsvp[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listEventAttendees(event.id, event.organizerUid)
      .then(setAttendees)
      .finally(() => setLoading(false));
  }, [event.id, event.organizerUid]);

  const attending = attendees.filter((a) => a.status === 'attending');
  const waitlisted = attendees.filter((a) => a.status === 'waitlisted');

  async function handleCancel() {
    setBusy(true);
    try {
      await cancelEvent(event.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteEvent(event.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fade-enter mt-sm rounded-lg border border-hairline bg-surface-soft p-lg">
      <div className="flex items-center justify-between gap-md">
        <p className="text-label-md text-ink">Manage: {event.title}</p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-[44px] items-center px-xs text-body-md text-muted active:text-ink"
        >
          Close
        </button>
      </div>
      {loading ? (
        <p className="mt-sm text-body-md text-muted">Loading attendees…</p>
      ) : (
        <>
          <p className="mt-sm text-body-md text-body">
            {attending.length} attending{event.capacity != null ? ` / ${event.capacity} capacity` : ''}
            {waitlisted.length > 0 ? ` · ${waitlisted.length} waitlisted` : ''}
          </p>
          {attendees.length === 0 ? (
            <p className="mt-xs text-body-md text-muted">No RSVPs yet.</p>
          ) : (
            <ul className="mt-xs space-y-xxs text-body-md text-body [overflow-wrap:anywhere]">
              {attendees.map((a) => (
                <li key={a.id}>
                  {a.uid} — {a.status}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {event.status !== 'cancelled' && (
        <div className="mt-md flex flex-wrap gap-sm">
          <Button variant="secondary" className="px-md py-xs" disabled={busy} onClick={() => void handleCancel()}>
            Cancel event
          </Button>
          {attendees.length === 0 && (
            <Button
              variant="secondary"
              className="px-md py-xs text-signature-coral"
              disabled={busy}
              onClick={() => void handleDelete()}
            >
              Delete event
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function EventsPage() {
  const { user } = useAuth();
  const { hash } = useLocation();
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // The member's own profile comes from the shell's single live listener —
  // no separate read for the batch/city needed to compute event visibility.
  const { profile, loaded: profileLoaded } = useOwnProfile();
  const [events, setEvents] = useState<AlumniEvent[]>([]);
  const [myRsvps, setMyRsvps] = useState<Record<string, EventRsvpStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managingId, setManagingId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EventFormFields>(defaultFormFields());
  const [targeting, setTargeting] = useState<EventTargeting>(EMPTY_EVENT_TARGETING);
  const [creating, setCreating] = useState(false);

  async function loadAll() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [visible, rsvps] = await Promise.all([
        queryVisibleEvents({
          uid: user.uid,
          batchNumber: profile?.batchNumber ?? null,
          cityCanonicalLower: profile?.cityCanonicalLower ?? '',
          chapterIds: profile?.chapterIds ?? [],
          badgeIds: profile?.badgeIds ?? [],
        }),
        listOwnRsvps(user.uid),
      ]);
      setEvents(visible);
      const map: Record<string, EventRsvpStatus> = {};
      for (const r of rsvps) {
        if (r.status !== 'cancelled') map[r.eventId] = r.status;
      }
      setMyRsvps(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load events.");
    } finally {
      setLoading(false);
    }
  }

  // Waits for the own-profile listener's first snapshot so the targeted
  // queries use the member's real batch/city (and run once, not twice).
  useEffect(() => {
    if (!profileLoaded) return;
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileLoaded]);

  // Deep link from the Home event pass (/app/events#event-<id>): once the
  // list has rendered, scroll to that card and flash a ring around it.
  useEffect(() => {
    if (loading || !hash.startsWith('#event-')) return;
    const id = hash.slice('#event-'.length);
    const el = document.getElementById(`event-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    setHighlightId(id);
    const t = window.setTimeout(() => setHighlightId(null), 2600);
    return () => window.clearTimeout(t);
  }, [loading, hash, events]);

  async function handleCreate() {
    if (!user) return;
    setCreating(true);
    setError(null);
    try {
      await createEvent(user, form, targeting);
      setForm(defaultFormFields());
      setTargeting(EMPTY_EVENT_TARGETING);
      setShowForm(false);
      await loadAll();
    } catch {
      setError("Couldn't create that event. Please check the fields and try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRespond(event: AlumniEvent, status: 'attending' | 'waitlisted') {
    if (!user) return;
    await upsertRsvp(event.id, user.uid, event.organizerUid, status);
    invalidateEventPasses(user.uid);
    setMyRsvps((prev) => ({ ...prev, [event.id]: status }));
  }

  async function handleWithdraw(eventId: string) {
    if (!user) return;
    await withdrawRsvp(eventId, user.uid);
    invalidateEventPasses(user.uid);
    setMyRsvps((prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  }

  const canSubmit =
    form.title.trim() &&
    form.endTime > form.startTime &&
    (form.format !== 'physical' || form.location.trim()) &&
    isValidCapacity(form.capacity) &&
    (targeting.targetType !== 'batch' || targeting.targetBatchNumbers.length > 0) &&
    (targeting.targetType !== 'city' || targeting.targetCityLower.trim()) &&
    (targeting.targetType !== 'chapter' || targeting.targetChapterIds.length > 0) &&
    (targeting.targetType !== 'badge' || targeting.targetBadgeIds.length > 0) &&
    (targeting.targetType !== 'selected' || targeting.targetUids.length > 0);

  const myOrganizedEvents = events.filter((e) => e.organizerUid === user?.uid);
  const otherUpcomingEvents = events
    .filter((e) => e.organizerUid !== user?.uid && e.status !== 'cancelled')
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return (
    <div>
      <PageHeader
        title="Events"
        description="Alumni meetups, virtual or in person. RSVP below, or organize your own for everyone, a batch, a city, a chapter, a club or committee badge, or a hand-picked list of people."
        actions={
          <Button variant="primary" onClick={() => setShowForm((s) => !s)} aria-expanded={showForm}>
            {showForm ? 'Cancel' : 'Create event'}
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
          <h2 className="font-haas-disp text-title-md text-ink">New event</h2>
          <div className="mt-md grid gap-md md:grid-cols-2">
            <div>
              <label className="text-label-md text-ink" htmlFor="event-title">
                Event title
              </label>
              <input
                id="event-title"
                placeholder="Event title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="field mt-xxs block w-full"
              />
            </div>
            <div>
              <label className="text-label-md text-ink" htmlFor="event-format">
                Format
              </label>
              <select
                id="event-format"
                value={form.format}
                onChange={(e) => setForm({ ...form, format: e.target.value as EventFormFields['format'] })}
                className="field mt-xxs block w-full"
              >
                <option value="virtual">Virtual</option>
                <option value="physical">In person</option>
              </select>
            </div>
          </div>

          <div className="mt-md">
            {form.format === 'physical' ? (
              <>
                <label className="text-label-md text-ink" htmlFor="event-location">
                  Location
                </label>
                <input
                  id="event-location"
                  placeholder="Location"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="field mt-xxs block w-full"
                />
              </>
            ) : (
              <>
                <label className="text-label-md text-ink" htmlFor="event-note">
                  Note for attendees
                </label>
                <input
                  id="event-note"
                  placeholder="e.g. link shared closer to the date"
                  value={form.virtualNote}
                  onChange={(e) => setForm({ ...form, virtualNote: e.target.value })}
                  maxLength={300}
                  className="field mt-xxs block w-full"
                />
              </>
            )}
          </div>

          <div className="mt-md">
            <label className="text-label-md text-ink" htmlFor="event-description">
              Description
            </label>
            <textarea
              id="event-description"
              placeholder="What is this event about?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              maxLength={3000}
              className="field mt-xxs block w-full"
            />
          </div>

          <div className="mt-md grid gap-md md:grid-cols-2">
            <div>
              <label className="text-label-md text-ink" htmlFor="event-start">
                Starts
              </label>
              <input
                id="event-start"
                type="datetime-local"
                value={toLocalInputValue(form.startTime)}
                onChange={(e) => setForm({ ...form, startTime: new Date(e.target.value) })}
                className="field mt-xxs block w-full"
              />
            </div>
            <div>
              <label className="text-label-md text-ink" htmlFor="event-end">
                Ends
              </label>
              <input
                id="event-end"
                type="datetime-local"
                value={toLocalInputValue(form.endTime)}
                onChange={(e) => setForm({ ...form, endTime: new Date(e.target.value) })}
                className="field mt-xxs block w-full"
              />
            </div>
          </div>

          <div className="mt-md grid gap-md md:grid-cols-2">
            <div>
              <label className="text-label-md text-ink" htmlFor="event-deadline">
                RSVP deadline <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="event-deadline"
                type="datetime-local"
                value={form.rsvpDeadline ? toLocalInputValue(form.rsvpDeadline) : ''}
                onChange={(e) => setForm({ ...form, rsvpDeadline: e.target.value ? new Date(e.target.value) : null })}
                className="field mt-xxs block w-full"
              />
            </div>
            <div>
              <label className="text-label-md text-ink" htmlFor="event-capacity">
                Capacity <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="event-capacity"
                type="number"
                min={1}
                max={1000}
                inputMode="numeric"
                value={form.capacity ?? ''}
                onChange={(e) => setForm({ ...form, capacity: e.target.value ? Number(e.target.value) : null })}
                placeholder="Unlimited"
                className="field mt-xxs block w-full"
              />
            </div>
          </div>

          <div className="mt-md">
            <TargetingEditor value={targeting} onChange={setTargeting} />
          </div>

          <Button variant="primary" className="mt-lg" disabled={!canSubmit || creating} onClick={() => void handleCreate()}>
            {creating ? 'Creating…' : 'Create event'}
          </Button>
        </div>
      )}

      {myOrganizedEvents.length > 0 && (
        <section className="mt-xl" aria-labelledby="your-events">
          <h2 id="your-events" className="font-haas-disp text-title-md text-ink">
            Your events
          </h2>
          <div className="mt-md space-y-lg">
            {myOrganizedEvents.map((event) => (
              <div key={event.id} id={`event-${event.id}`} className={`scroll-mt-24 rounded-lg transition-shadow duration-500 ${highlightId === event.id ? 'ring-2 ring-info-border ring-offset-2' : ''}`}>
                <EventCard
                  event={event}
                  myRsvpStatus={myRsvps[event.id] ?? null}
                  onRespond={(status) => handleRespond(event, status)}
                  onWithdraw={() => handleWithdraw(event.id)}
                  canManage
                  onManage={() => setManagingId(managingId === event.id ? null : event.id)}
                />
                {managingId === event.id && (
                  <ManageEventPanel
                    event={event}
                    onClose={() => setManagingId(null)}
                    onChanged={() => {
                      setManagingId(null);
                      void loadAll();
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-xl" aria-labelledby="upcoming-events">
        <h2 id="upcoming-events" className="font-haas-disp text-title-md text-ink">
          Upcoming
        </h2>
        <div className="mt-md">
          {loading ? (
            <SkeletonList count={2} heightClass="h-[260px]" />
          ) : otherUpcomingEvents.length === 0 ? (
            <EmptyState title="No upcoming events right now">
              Organize one for everyone, a batch or a city — it takes a minute.
            </EmptyState>
          ) : (
            <div className="space-y-lg">
              {otherUpcomingEvents.map((event) => (
                <div key={event.id} id={`event-${event.id}`} className={`scroll-mt-24 rounded-lg transition-shadow duration-500 ${highlightId === event.id ? 'ring-2 ring-info-border ring-offset-2' : ''}`}>
                  <EventCard
                    event={event}
                    myRsvpStatus={myRsvps[event.id] ?? null}
                    onRespond={(status) => handleRespond(event, status)}
                    onWithdraw={() => handleWithdraw(event.id)}
                  />
                  {user && <ReportEventControl eventId={event.id} reporterUid={user.uid} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
