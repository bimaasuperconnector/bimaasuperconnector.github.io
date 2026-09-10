import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin';
import { logJobRun } from './auditLog';
import { createNotification } from './notifications';
import { orchestrateCycle } from '../../src/lib/matching/cycleOrchestration';
import { DEFAULT_CONNECTION_METER } from '../../src/lib/connectionMeter';
import type { MatchCandidate, PairHistoryRecord } from '../../src/lib/matching/types';

/**
 * Finds every cycle whose registration has closed but hasn't been
 * matched yet, and runs Phase 5's `orchestrateCycle` against real data.
 * Idempotent: if `matches` already exist for a cycleId (e.g. a prior
 * run wrote results but crashed before advancing the cycle's status),
 * this job detects that and just advances the status without
 * re-matching — running the algorithm twice would produce a DIFFERENT
 * result each time relative to evolving pair history, which must never
 * happen for a cycle that's already been committed.
 */
export async function runMatchingJob(): Promise<void> {
  const dueCycles = await db
    .collection('connectionCycles')
    .where('status', '==', 'registration_closed')
    .get();

  for (const cycleDoc of dueCycles.docs) {
    const cycleId = cycleDoc.id;

    const existingMatches = await db.collection('matches').where('cycleId', '==', cycleId).limit(1).get();
    if (!existingMatches.empty) {
      await cycleDoc.ref.set({ status: 'matching_complete', updatedAt: Timestamp.now() }, { merge: true });
      await logJobRun({
        jobName: 'matching',
        cycleId,
        status: 'skipped',
        summary: 'Matches already existed for this cycle; advanced status without re-matching.',
      });
      continue;
    }

    try {
      const candidates = await buildCandidates(cycleId);
      const pairHistory = await fetchPairHistory();
      const result = orchestrateCycle(cycleId, candidates, pairHistory);

      await writeMatchResults(cycleId, result);
      await cycleDoc.ref.set({ status: 'matching_complete', updatedAt: Timestamp.now() }, { merge: true });

      await logJobRun({
        jobName: 'matching',
        cycleId,
        status: 'success',
        summary: `${result.pairs.length} pairs, ${result.groups.length} groups, ${result.unmatched.length} unmatched.`,
      });
    } catch (err) {
      await logJobRun({
        jobName: 'matching',
        cycleId,
        status: 'failure',
        summary: 'Matching job threw an error.',
        error: err instanceof Error ? err.message : String(err),
      });
      // Deliberately re-throw: a failed matching run must not be
      // silently swallowed, and the cycle stays 'registration_closed'
      // so the next scheduled run retries it automatically.
      throw err;
    }
  }
}

async function buildCandidates(cycleId: string): Promise<MatchCandidate[]> {
  const registrations = await db
    .collection('connectionRegistrations')
    .where('cycleId', '==', cycleId)
    .get();

  const candidates: MatchCandidate[] = [];
  for (const regDoc of registrations.docs) {
    const reg = regDoc.data();
    const uid = reg.uid as string;

    const [profileSnap, meterSnap] = await Promise.all([
      db.collection('profiles').doc(uid).get(),
      db.collection('connectionMeters').doc(uid).get(),
    ]);

    if (!profileSnap.exists) {
      // No profile means no matchable signal at all — skip rather than
      // matching someone on empty data. They show up as unmatched.
      continue;
    }
    const profile = profileSnap.data()!;
    const connectionMeter = meterSnap.exists ? (meterSnap.data()!.score as number) : DEFAULT_CONNECTION_METER;

    candidates.push({
      uid,
      batchNumber: profile.batchNumber ?? null,
      interests: profile.interests ?? [],
      skills: profile.skills ?? [],
      networkingPurpose: profile.networkingPurpose ?? [],
      organizations: (profile.organizations ?? []).map((o: { name: string; isFounder: boolean }) => ({
        name: o.name,
        isFounder: o.isFounder,
      })),
      connectionMeter,
      slot: reg.slot,
      mode: reg.mode,
    });
  }
  return candidates;
}

async function fetchPairHistory(): Promise<PairHistoryRecord[]> {
  const snapshot = await db.collection('pairHistory').get();
  return snapshot.docs.map((d) => d.data() as PairHistoryRecord);
}

async function writeMatchResults(
  cycleId: string,
  result: Awaited<ReturnType<typeof orchestrateCycle>>,
): Promise<void> {
  let matchIndex = 0;

  async function writeMatch(type: 'pair' | 'group', uids: string[]) {
    const matchId = `${cycleId}_${type}_${matchIndex++}`;
    await db.collection('matches').doc(matchId).set({
      cycleId,
      type,
      participantUids: uids,
      createdAt: Timestamp.now(),
    });

    for (const uid of uids) {
      const others = uids.filter((u) => u !== uid);
      await db
        .collection('matchParticipants')
        .doc(`${matchId}_${uid}`)
        .set({ uid, matchId, cycleId, otherParticipantUids: others, createdAt: Timestamp.now() });

      await createNotification(
        uid,
        'matched',
        "You've been matched!",
        type === 'pair'
          ? 'You have a new SuperConnector connection this cycle. Check the app to see who.'
          : `You've been placed in a small circle of ${uids.length} for this cycle.`,
        cycleId,
      );
    }

    // Record every pairwise combination in pairHistory, so future
    // cycles' repeat-match penalty (Phase 5) sees this match — for a
    // pair that's one row; for a small circle it's every combination
    // within the group.
    for (let i = 0; i < uids.length; i++) {
      for (let j = i + 1; j < uids.length; j++) {
        const [a, b] = [uids[i], uids[j]].sort();
        await db.collection('pairHistory').doc(`${a}_${b}_${cycleId}`).set({
          uidA: a,
          uidB: b,
          cycleId,
          createdAt: Timestamp.now(),
        });
      }
    }
  }

  for (const pair of result.pairs) {
    await writeMatch('pair', [pair.uidA, pair.uidB]);
  }
  for (const group of result.groups) {
    await writeMatch('group', group.uids);
  }
}
