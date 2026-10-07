import { doc, getDoc } from 'firebase/firestore';
import { db } from '../init';
import { listOwnRsvps } from './eventRsvpsRepository';

/** The few fields the Home "boarding pass" needs — nothing more is kept. */
export interface EventPass {
  eventId: string;
  title: string;
  start: Date;
  end: Date;
  format: 'virtual' | 'physical';
  location: string;
  rsvp: 'attending' | 'waitlisted';
}

/**
 * Upcoming events the member has RSVPed to, for the Home dashboard.
 *
 * Quota design (10,000-member scale):
 *  - ONE query for the member's own RSVP docs (`uid == me`), then one single-
 *    document read per RSVP — never the Events page's multi-query visible-
 *    events fan-out (up to ~50 docs per query).
 *  - Events that have ended, or no longer exist, are remembered per device
 *    (localStorage) and are never read again, so the per-visit cost is only
 *    the member's still-upcoming events.
 *  - The finished result is cached in sessionStorage for 10 minutes: opening
 *    Home repeatedly costs zero reads. RSVP / withdraw on the Events page
 *    calls invalidateEventPasses() so the card is never stale after a change.
 *  - Strictly read-only: no Firestore writes at all.
 */
const TTL_MS = 10 * 60 * 1000;
const MAX_REMEMBERED_ENDED = 300;

const passesKey = (uid: string) => `sc:event-passes:${uid}`;
const endedKey = (uid: string) => `sc:ended-events:${uid}`;

interface Stored {
  at: number;
  passes: (Omit<EventPass, 'start' | 'end'> & { start: number; end: number })[];
}

function readCache(uid: string): EventPass[] | null {
  try {
    const raw = window.sessionStorage.getItem(passesKey(uid));
    if (!raw) return null;
    const stored = JSON.parse(raw) as Stored;
    if (Date.now() - stored.at > TTL_MS) return null;
    return stored.passes.map((p) => ({ ...p, start: new Date(p.start), end: new Date(p.end) }));
  } catch {
    return null;
  }
}

function writeCache(uid: string, passes: EventPass[]) {
  try {
    const stored: Stored = {
      at: Date.now(),
      passes: passes.map((p) => ({ ...p, start: p.start.getTime(), end: p.end.getTime() })),
    };
    window.sessionStorage.setItem(passesKey(uid), JSON.stringify(stored));
  } catch {
    // storage unavailable — the next visit simply re-reads
  }
}

function readEnded(uid: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(endedKey(uid));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeEnded(uid: string, ended: Set<string>) {
  try {
    window.localStorage.setItem(endedKey(uid), JSON.stringify([...ended].slice(-MAX_REMEMBERED_ENDED)));
  } catch {
    // best-effort only
  }
}

/** Call after the member RSVPs / withdraws so Home reflects it immediately. */
export function invalidateEventPasses(uid: string) {
  try {
    window.sessionStorage.removeItem(passesKey(uid));
  } catch {
    // nothing to clear
  }
}

export async function loadUpcomingEventPasses(uid: string): Promise<EventPass[]> {
  const cached = readCache(uid);
  if (cached) return cached.filter((p) => p.end.getTime() > Date.now());

  if (!db) throw new Error('Firestore is not configured.');
  const firestore = db;
  const rsvps = (await listOwnRsvps(uid)).filter((r) => r.status === 'attending' || r.status === 'waitlisted');
  const ended = readEnded(uid);
  const candidates = rsvps.filter((r) => !ended.has(r.eventId));

  const now = Date.now();
  let endedChanged = false;
  const results = await Promise.all(
    candidates.map(async (r): Promise<EventPass | null> => {
      try {
        const snap = await getDoc(doc(firestore, 'events', r.eventId));
        if (!snap.exists()) {
          ended.add(r.eventId); // deleted — never read again
          endedChanged = true;
          return null;
        }
        const d = snap.data();
        const end: Date = d.endTime?.toDate?.() ?? new Date(0);
        if (end.getTime() <= now) {
          ended.add(r.eventId);
          endedChanged = true;
          return null;
        }
        if (d.status === 'cancelled') return null;
        return {
          eventId: r.eventId,
          title: String(d.title ?? ''),
          start: d.startTime?.toDate?.() ?? end,
          end,
          format: d.format === 'physical' ? 'physical' : 'virtual',
          location: String(d.location ?? ''),
          rsvp: r.status as 'attending' | 'waitlisted',
        };
      } catch {
        return null; // one unreadable event must not hide the rest
      }
    }),
  );
  if (endedChanged) writeEnded(uid, ended);

  const passes = results.filter((p): p is EventPass => p !== null).sort((a, b) => a.start.getTime() - b.start.getTime());
  writeCache(uid, passes);
  return passes;
}
