import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin';
import { getCalendarClient } from './googleCalendar';
import { logJobRun } from './auditLog';
import { createNotification } from './notifications';
import { currentCycle, meetingWindow, type Cycle } from '../../src/lib/cycles';

const ORGANIZER_TIMEZONE = 'Asia/Kolkata';

/**
 * Creates a real Google Calendar event (with a Meet link) for every
 * match that doesn't have one yet. Scans the whole `matches` collection
 * rather than filtering by cycle status — this project's alumni-network
 * scale means that collection stays small, so an in-memory filter is
 * simpler and more robust than trying to couple calendar-eligibility to
 * cycle status transitions. Explicitly a scale assumption, documented
 * here rather than silently relied upon.
 *
 * Idempotency has two layers, per AUTOMATION.md's "before creating an
 * external resource, check Firestore for an existing external ID":
 * 1. Fast path — skip if `calendarEventId` is already set on the match.
 * 2. Defense in depth — before calling the Calendar API, also query
 *    Calendar itself for an event carrying this matchId as a private
 *    extended property. This specifically guards against the failure
 *    mode step 1 can't catch: the event WAS created successfully but
 *    the subsequent Firestore write (recording calendarEventId) failed
 *    or the process crashed in between — a bare "check Firestore first"
 *    would miss that and create a duplicate on retry.
 */
export async function runCalendarJob(): Promise<void> {
  let calendar;
  try {
    calendar = getCalendarClient();
  } catch (err) {
    // Calendar isn't configured yet (Phase 8 secrets not set up). Log
    // and skip rather than crash the whole automation run — Phases
    // 1-7 must keep working even if the owner hasn't finished Phase
    // 8's setup yet.
    await logJobRun({
      jobName: 'calendar',
      status: 'skipped',
      summary: 'Calendar integration not configured; skipping.',
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  const matchesSnapshot = await db.collection('matches').get();
  const pending = matchesSnapshot.docs.filter((d) => !d.data().calendarEventId);
  if (pending.length === 0) return;

  const cycleCache = new Map<string, Cycle>();
  async function getCycle(cycleId: string): Promise<Cycle> {
    if (cycleCache.has(cycleId)) return cycleCache.get(cycleId)!;
    const snap = await db.collection('connectionCycles').doc(cycleId).get();
    const data = snap.data()!;
    const cycle: Cycle = {
      id: cycleId,
      year: data.year,
      month: data.month,
      saturday: (data.saturday as Timestamp).toDate(),
      sunday: (data.sunday as Timestamp).toDate(),
    };
    cycleCache.set(cycleId, cycle);
    return cycle;
  }

  let created = 0;
  let skippedExisting = 0;

  for (const matchDoc of pending) {
    const matchId = matchDoc.id;
    const match = matchDoc.data();

    try {
      // Layer 2 idempotency check: does Calendar already have an event
      // for this matchId (from a prior run that crashed before writing
      // back to Firestore)?
      const existing = await calendar.events.list({
        calendarId: 'primary',
        privateExtendedProperty: [`matchId=${matchId}`],
        maxResults: 1,
      });
      const existingEvent = existing.data.items?.[0];
      if (existingEvent) {
        await matchDoc.ref.set(
          {
            calendarEventId: existingEvent.id,
            calendarEventHtmlLink: existingEvent.htmlLink ?? null,
            meetLink: existingEvent.hangoutLink ?? null,
          },
          { merge: true },
        );
        skippedExisting++;
        continue;
      }

      const cycle = await getCycle(match.cycleId);
      const window = meetingWindow(cycle, match.meetingDay);

      const attendeeUids: string[] = match.participantUids;
      const attendeeEmails: string[] = [];
      for (const uid of attendeeUids) {
        const userSnap = await db.collection('users').doc(uid).get();
        const email = userSnap.data()?.email;
        if (email) attendeeEmails.push(email);
      }

      const summary =
        match.type === 'pair'
          ? 'SuperConnector: your 1:1 connection'
          : `SuperConnector: your small circle (${attendeeUids.length} people)`;

      const response = await calendar.events.insert({
        calendarId: 'primary',
        sendUpdates: 'all', // sends the actual invite email to every attendee
        conferenceDataVersion: 1,
        requestBody: {
          summary,
          description:
            "A monthly SuperConnector introduction. Reply to this invite to let the organizer know if the time doesn't work.",
          start: { dateTime: window.start.toISOString(), timeZone: ORGANIZER_TIMEZONE },
          end: { dateTime: window.end.toISOString(), timeZone: ORGANIZER_TIMEZONE },
          attendees: attendeeEmails.map((email) => ({ email })),
          conferenceData: {
            createRequest: {
              requestId: matchId, // stable, so a retried insert reuses the same conference request
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
          extendedProperties: { private: { matchId, cycleId: match.cycleId } },
        },
      });

      const event = response.data;
      await matchDoc.ref.set(
        {
          calendarEventId: event.id ?? null,
          calendarEventHtmlLink: event.htmlLink ?? null,
          meetLink: event.hangoutLink ?? null,
          meetingStartAt: Timestamp.fromDate(window.start),
          meetingEndAt: Timestamp.fromDate(window.end),
        },
        { merge: true },
      );

      for (const uid of attendeeUids) {
        await createNotification(
          uid,
          'calendar_ready',
          'Your meeting is on the calendar',
          `Check your email — a calendar invite for your SuperConnector meeting${
            event.hangoutLink ? ' (with a Google Meet link)' : ''
          } has been sent.`,
          match.cycleId,
        );
      }

      created++;
    } catch (err) {
      await logJobRun({
        jobName: 'calendar',
        cycleId: match.cycleId,
        status: 'failure',
        summary: `Failed to create calendar event for match ${matchId}.`,
        error: err instanceof Error ? err.message : String(err),
      });
      // Do not re-throw: one bad match shouldn't block calendar
      // creation for every other match in this run. It stays without a
      // calendarEventId and gets retried on the next scheduled run.
    }
  }

  await logJobRun({
    jobName: 'calendar',
    cycleId: currentCycle().id,
    status: 'success',
    summary: `Created ${created} calendar event(s); ${skippedExisting} recovered from a prior partial run.`,
  });
}
