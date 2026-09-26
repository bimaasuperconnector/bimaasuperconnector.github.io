import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin';
import { getCalendarClient } from './googleCalendar';
import { logJobRun } from './auditLog';
import { createEventNotification } from './notifications';

const ORGANIZER_TIMEZONE = 'Asia/Kolkata';

/**
 * Creates/updates real Google Calendar events for Phase 13's alumni
 * events, and keeps their attendee list in sync as people RSVP or
 * cancel over time. Reuses the EXACT SAME `bimaasuperconnector@gmail.com`
 * OAuth credentials Phase 8 already set up (GOOGLE_CALENDAR_CLIENT_ID/
 * _SECRET/_REFRESH_TOKEN) — no new Google configuration is required for
 * this phase. Architecture rationale (organizer-as-attendee-inviter,
 * consumer Gmail account, no domain-wide delegation) is identical to
 * Phase 8's calendarJob.ts; see that file's header comment.
 *
 * Unlike a Phase 5 match (whose participant list is fixed the moment
 * matching runs), an event's attendee list changes continuously as
 * people RSVP or withdraw right up until the event happens. So this
 * job does two passes:
 *
 * 1. Upcoming, still-scheduled events: create the Calendar event if it
 *    doesn't have one yet, THEN (whether just-created or already
 *    existing) diff the current `attending` RSVP list against the
 *    last-synced list stored in `syncedAttendeeUids` and, only if
 *    something actually changed, patch the Calendar event's attendees
 *    and notify newly-added attendees. This avoids a needless Calendar
 *    API call (and a needless re-send of the invite email to everyone)
 *    on every single daily run for an event nobody has RSVPed to since
 *    the last sync.
 * 2. Cancelled events that still have a live Calendar entry: cancel
 *    the Calendar event too, once, and remember that it's been handled
 *    so a future run doesn't keep retrying a event Calendar has
 *    already forgotten.
 *
 * Scope, per the 2026-09-26 quota-optimization standing directive:
 * pass 1 is INDEX-BACKED (`status == 'scheduled' && startTime >= X`),
 * not a full collection scan — an improvement over Phase 8's
 * calendarJob.ts, which explicitly scanned the whole `matches`
 * collection as a documented scale assumption. Pass 2 (cancelled
 * events) is a plain equality filter with no range/orderBy, and is
 * expected to stay small at this project's scale — documented here as
 * a scale assumption rather than silently relied upon, same posture as
 * Phase 8's note.
 */
export async function runEventsCalendarJob(): Promise<void> {
  let calendar;
  try {
    calendar = getCalendarClient();
  } catch (err) {
    await logJobRun({
      jobName: 'events-calendar',
      status: 'skipped',
      summary: 'Calendar integration not configured; skipping.',
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  let created = 0;
  let synced = 0;
  let cancelled = 0;

  // --- Pass 1: upcoming, scheduled events ---
  // A day of slack on the lower bound catches an event happening
  // "today" even if the cron ran a few hours after its start time —
  // per AUTOMATION.md, GitHub Actions cron is not an exact scheduler.
  const lowerBound = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
  const upcoming = await db
    .collection('events')
    .where('status', '==', 'scheduled')
    .where('startTime', '>=', lowerBound)
    .get();

  const emailCache = new Map<string, string | null>();
  async function resolveEmail(uid: string): Promise<string | null> {
    if (emailCache.has(uid)) return emailCache.get(uid)!;
    const snap = await db.collection('users').doc(uid).get();
    const email = (snap.data()?.email as string | undefined) ?? null;
    emailCache.set(uid, email);
    return email;
  }

  for (const eventDoc of upcoming.docs) {
    const eventId = eventDoc.id;
    const event = eventDoc.data();

    try {
      const attendingSnap = await db
        .collection('eventRsvps')
        .where('eventId', '==', eventId)
        .where('status', '==', 'attending')
        .get();
      const attendingUids: string[] = attendingSnap.docs.map((d) => d.data().uid as string);
      // The in-app organizer is always invited to their own event's
      // real Calendar entry too, in addition to whoever has RSVPed.
      const inviteUids = Array.from(new Set([event.organizerUid, ...attendingUids]));

      if (!event.calendarEventId) {
        // Layer 2 idempotency, same defense-in-depth pattern as Phase
        // 8's calendarJob.ts: a prior run may have created the Calendar
        // event successfully but crashed before writing calendarEventId
        // back to Firestore.
        const existing = await calendar.events.list({
          calendarId: 'primary',
          privateExtendedProperty: [`eventId=${eventId}`],
          maxResults: 1,
        });
        const existingEvent = existing.data.items?.[0];

        if (existingEvent) {
          await eventDoc.ref.set(
            {
              calendarEventId: existingEvent.id,
              calendarEventHtmlLink: existingEvent.htmlLink ?? null,
              meetLink: existingEvent.hangoutLink ?? null,
              syncedAttendeeUids: inviteUids,
            },
            { merge: true },
          );
          synced++;
          continue;
        }

        const attendeeEmails: string[] = [];
        for (const uid of inviteUids) {
          const email = await resolveEmail(uid);
          if (email) attendeeEmails.push(email);
        }

        const startTime: Date = event.startTime.toDate();
        const endTime: Date = event.endTime.toDate();

        const response = await calendar.events.insert({
          calendarId: 'primary',
          sendUpdates: 'all',
          conferenceDataVersion: event.format === 'virtual' ? 1 : 0,
          requestBody: {
            summary: `SuperConnector event: ${event.title}`,
            description: event.description || 'An alumni meetup organized through SuperConnector.',
            location: event.format === 'physical' ? event.location : undefined,
            start: { dateTime: startTime.toISOString(), timeZone: ORGANIZER_TIMEZONE },
            end: { dateTime: endTime.toISOString(), timeZone: ORGANIZER_TIMEZONE },
            attendees: attendeeEmails.map((email) => ({ email })),
            conferenceData:
              event.format === 'virtual'
                ? {
                    createRequest: {
                      requestId: eventId,
                      conferenceSolutionKey: { type: 'hangoutsMeet' },
                    },
                  }
                : undefined,
            extendedProperties: { private: { eventId } },
          },
        });

        const createdEvent = response.data;
        await eventDoc.ref.set(
          {
            calendarEventId: createdEvent.id ?? null,
            calendarEventHtmlLink: createdEvent.htmlLink ?? null,
            meetLink: createdEvent.hangoutLink ?? null,
            syncedAttendeeUids: inviteUids,
          },
          { merge: true },
        );

        for (const uid of inviteUids) {
          await createEventNotification(
            uid,
            'event_calendar_ready',
            'Your event is on the calendar',
            `Check your email — a calendar invite for "${event.title}"${
              createdEvent.hangoutLink ? ' (with a Google Meet link)' : ''
            } has been sent.`,
            eventId,
          );
        }

        created++;
      } else {
        // Already created — only touch Calendar again if the actual
        // set of invitees has changed since the last sync.
        const previouslySynced: string[] = Array.isArray(event.syncedAttendeeUids)
          ? event.syncedAttendeeUids
          : [];
        const previousSet = new Set(previouslySynced);
        const currentSet = new Set(inviteUids);
        const changed =
          previousSet.size !== currentSet.size || inviteUids.some((uid) => !previousSet.has(uid));
        if (!changed) continue;

        const attendeeEmails: string[] = [];
        for (const uid of inviteUids) {
          const email = await resolveEmail(uid);
          if (email) attendeeEmails.push(email);
        }

        await calendar.events.patch({
          calendarId: 'primary',
          eventId: event.calendarEventId,
          sendUpdates: 'all',
          requestBody: { attendees: attendeeEmails.map((email) => ({ email })) },
        });

        await eventDoc.ref.set({ syncedAttendeeUids: inviteUids }, { merge: true });

        // Notify only the newly-added invitees — not everyone again —
        // so re-syncing an event with one new RSVP doesn't re-notify
        // the whole existing attendee list.
        const newlyAdded = inviteUids.filter((uid) => !previousSet.has(uid));
        for (const uid of newlyAdded) {
          await createEventNotification(
            uid,
            'event_calendar_ready',
            'Your event is on the calendar',
            `Check your email — a calendar invite for "${event.title}" has been sent.`,
            eventId,
          );
        }

        synced++;
      }
    } catch (err) {
      await logJobRun({
        jobName: 'events-calendar',
        status: 'failure',
        summary: `Failed to create/sync calendar event for event ${eventId}.`,
        error: err instanceof Error ? err.message : String(err),
      });
      // Do not re-throw: one bad event shouldn't block calendar
      // sync for every other event in this run. Retried next run.
    }
  }

  // --- Pass 2: cancelled events with a live Calendar entry ---
  const cancelledEvents = await db.collection('events').where('status', '==', 'cancelled').get();
  for (const eventDoc of cancelledEvents.docs) {
    const event = eventDoc.data();
    if (!event.calendarEventId || event.calendarCancelSynced === true) continue;
    try {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: event.calendarEventId,
        sendUpdates: 'all',
      });
      cancelled++;
    } catch (err) {
      // A 404/410 here means Calendar already considers it gone (e.g. a
      // prior run's delete succeeded but this Firestore write didn't) —
      // treat that as success rather than retrying forever. Any other
      // error is logged and retried on the next run.
      const message = err instanceof Error ? err.message : String(err);
      if (!/410|404|deleted/i.test(message)) {
        await logJobRun({
          jobName: 'events-calendar',
          status: 'failure',
          summary: `Failed to cancel calendar event for event ${eventDoc.id}.`,
          error: message,
        });
        continue;
      }
    }
    await eventDoc.ref.set({ calendarCancelSynced: true }, { merge: true });
  }

  await logJobRun({
    jobName: 'events-calendar',
    status: 'success',
    summary: `Created ${created} event(s), synced attendees for ${synced}, cancelled ${cancelled} Calendar entr${
      cancelled === 1 ? 'y' : 'ies'
    }.`,
  });
}
