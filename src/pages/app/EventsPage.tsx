import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { TargetingEditor } from '../../components/events/TargetingEditor';
import { EventCard } from '../../components/events/EventCard';
import { getProfile, type Profile } from '../../firebase/repositories/profilesRepository';
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
import { type EventRsvpStatus, type EventTargeting, isValidCapacity } from '../../lib/events';
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

  if (sent) return <p className="mt-xs text-caption text-muted">Reported — thanks for flagging this.</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-xs text-caption text-muted hover:underline">
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
    <div className="mt-xs rounded-sm bg-surface-soft p-sm">
      <div className="flex gap-sm">
        {REPORT_REASONS.map((r) => (
          <label key={r} className="flex items-center gap-xxs text-caption text-body">
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
        className="mt-xs block w-full rounded-sm border border-hairline px-sm py-xxs text-caption"
      />
      <div className="mt-xs flex gap-sm">
        <Button variant="secondary" className="px-sm py-xxs text-caption" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button variant="primary" className="px-sm py-xxs text-caption" disabled={sending} onClick={() => void submit()}>
          {sending ? 'Sending…' : 'Submit report'}
        </Button>
      </div>
    </div>
  );
}

const EMPTY_TARGETING: EventTargeting = {
  targetType: 'everyone',
  targetBatchNumbers: [],
  targetCityLower: '',
  targetUids: [],
};

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
    <div className="mt-sm rounded-sm border border-hairline bg-surface-soft p-md">
      <div className="flex items-center justify-between">
        <p className="text-label-md text-ink">Manage: {event.title}</p>
        <button type="button" onClick={onClose} className="text-caption text-muted hover:text-ink">
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
            <ul className="mt-xs space-y-xxs text-caption text-body">
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
        <div className="mt-md flex gap-sm">
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<AlumniEvent[]>([]);
  const [myRsvps, setMyRsvps] = useState<Record<string, EventRsvpStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managingId, setManagingId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EventFormFields>(defaultFormFields());
  const [targeting, setTargeting] = useState<EventTargeting>(EMPTY_TARGETING);
  const [creating, setCreating] = useState(false);

  async function loadAll() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const myProfile = profile ?? (await getProfile(user.uid));
      setProfile(myProfile);
      const [visible, rsvps] = await Promise.all([
        queryVisibleEvents({
          uid: user.uid,
          batchNumber: myProfile?.batchNumber ?? null,
          locationLower: myProfile?.locationLower ?? '',
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

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleCreate() {
    if (!user) return;
    setCreating(true);
    setError(null);
    try {
      await createEvent(user, form, targeting);
      setForm(defaultFormFields());
      setTargeting(EMPTY_TARGETING);
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
    setMyRsvps((prev) => ({ ...prev, [event.id]: status }));
  }

  async function handleWithdraw(eventId: string) {
    if (!user) return;
    await withdrawRsvp(eventId, user.uid);
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
    (targeting.targetType !== 'selected' || targeting.targetUids.length > 0);

  const myOrganizedEvents = events.filter((e) => e.organizerUid === user?.uid);
  const otherUpcomingEvents = events
    .filter((e) => e.organizerUid !== user?.uid && e.status !== 'cancelled')
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-title-lg text-ink">Events</h1>
        <Button variant="primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'Create event'}
        </Button>
      </div>
      <p className="mt-sm text-body-md text-body">
        Alumni meetups, virtual or in person. RSVP below, or organize your own for everyone, a batch, a
        city, or a hand-picked list of people.
      </p>

      {error && <p className="mt-md text-body-md text-signature-coral">{error}</p>}

      {showForm && (
        <div className="mt-lg rounded-md border border-hairline p-xl">
          <div className="grid gap-md md:grid-cols-2">
            <input
              placeholder="Event title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="rounded-sm border border-hairline px-md py-xs text-body-md"
            />
            <select
              value={form.format}
              onChange={(e) => setForm({ ...form, format: e.target.value as EventFormFields['format'] })}
              className="rounded-sm border border-hairline px-md py-xs text-body-md"
            >
              <option value="virtual">Virtual</option>
              <option value="physical">In person</option>
            </select>
          </div>

          {form.format === 'physical' ? (
            <input
              placeholder="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="mt-md block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
            />
          ) : (
            <input
              placeholder="Note for attendees (e.g. link shared closer to the date)"
              value={form.virtualNote}
              onChange={(e) => setForm({ ...form, virtualNote: e.target.value })}
              maxLength={300}
              className="mt-md block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
            />
          )}

          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            maxLength={3000}
            className="mt-md block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
          />

          <div className="mt-md grid gap-md md:grid-cols-2">
            <div>
              <label className="text-body-md text-body">Starts</label>
              <input
                type="datetime-local"
                value={toLocalInputValue(form.startTime)}
                onChange={(e) => setForm({ ...form, startTime: new Date(e.target.value) })}
                className="mt-xs block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
              />
            </div>
            <div>
              <label className="text-body-md text-body">Ends</label>
              <input
                type="datetime-local"
                value={toLocalInputValue(form.endTime)}
                onChange={(e) => setForm({ ...form, endTime: new Date(e.target.value) })}
                className="mt-xs block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
              />
            </div>
          </div>

          <div className="mt-md grid gap-md md:grid-cols-2">
            <div>
              <label className="text-body-md text-body">RSVP deadline (optional)</label>
              <input
                type="datetime-local"
                value={form.rsvpDeadline ? toLocalInputValue(form.rsvpDeadline) : ''}
                onChange={(e) => setForm({ ...form, rsvpDeadline: e.target.value ? new Date(e.target.value) : null })}
                className="mt-xs block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
              />
            </div>
            <div>
              <label className="text-body-md text-body">Capacity (optional)</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={form.capacity ?? ''}
                onChange={(e) => setForm({ ...form, capacity: e.target.value ? Number(e.target.value) : null })}
                placeholder="Unlimited"
                className="mt-xs block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
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
        <div className="mt-xl">
          <h2 className="text-title-sm text-ink">Your events</h2>
          <div className="mt-md space-y-md">
            {myOrganizedEvents.map((event) => (
              <div key={event.id}>
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
        </div>
      )}

      <div className="mt-xl">
        <h2 className="text-title-sm text-ink">Upcoming</h2>
        {loading ? (
          <p className="mt-md text-body-md text-muted">Loading…</p>
        ) : otherUpcomingEvents.length === 0 ? (
          <p className="mt-md text-body-md text-muted">No upcoming events right now.</p>
        ) : (
          <div className="mt-md space-y-md">
            {otherUpcomingEvents.map((event) => (
              <div key={event.id}>
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
    </div>
  );
}
