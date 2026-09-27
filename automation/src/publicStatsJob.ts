import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin';
import { logJobRun } from './auditLog';

/**
 * Computes the small set of numbers the signed-out public landing page
 * is allowed to show — ARCHITECTURE.md: "Public landing page exposes
 * only safe aggregate statistics" — and writes them to the one
 * deliberately-public `systemConfig/publicStats` document (see the
 * `configId == 'publicStats'` exception carved out in firestore.rules'
 * otherwise admin-only `systemConfig` block).
 *
 * Every number is a count() aggregation via the Admin SDK, not a
 * documents-download-and-count — the same discipline this project's
 * 2026-09-26 quota-optimization pass established for the client-side
 * admin dashboard (adminMetricsRepository.ts), applied here even
 * though the Admin SDK bypasses Firestore Rules and could technically
 * fetch anything: cheap by design, not just by rule. None of these
 * counts needs a composite index — every filter is a single equality
 * clause, or no filter at all, on a field Phase 3/9's existing
 * single-field/composite indexes already cover.
 *
 * Deliberately NOT computed per landing-page visit: it runs once a
 * day, alongside every other scheduled job, so an anonymous visitor
 * never triggers a live aggregation query — see
 * publicStatsRepository.ts on the client side for the read/cache path.
 */
export async function runPublicStatsJob(): Promise<void> {
  const [approvedMembers, connectionsMade, eventsHosted, foundersInNetwork] = await Promise.all([
    db.collection('users').where('status', '==', 'approved').count().get(),
    // Counts connection *events* (one-to-one pairs or small circles),
    // not participant-rows — the `matches` collection has exactly one
    // document per pairing/circle, regardless of its size, which is
    // the more honest "how many connections have happened" number for
    // a public page than counting matchParticipants rows would be.
    db.collection('matches').count().get(),
    // Total events ever organized (scheduled or since cancelled) — a
    // simple, unfiltered count is the cheapest possible query and
    // reveals nothing sensitive (not attendee lists, not who
    // organized what).
    db.collection('events').count().get(),
    db.collection('profiles').where('hasFounderOrg', '==', true).count().get(),
  ]);

  await db.doc('systemConfig/publicStats').set(
    {
      approvedMembers: approvedMembers.data().count,
      connectionsMade: connectionsMade.data().count,
      eventsHosted: eventsHosted.data().count,
      foundersInNetwork: foundersInNetwork.data().count,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  await logJobRun({
    jobName: 'public-stats',
    status: 'success',
    summary: `Recomputed public landing-page stats (${approvedMembers.data().count} approved members, ${connectionsMade.data().count} connections made).`,
  });
}
