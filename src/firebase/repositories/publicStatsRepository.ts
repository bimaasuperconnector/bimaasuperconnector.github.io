import { doc, getDoc } from 'firebase/firestore';
import { db } from '../init';

export interface PublicStats {
  approvedMembers: number;
  connectionsMade: number;
  eventsHosted: number;
  foundersInNetwork: number;
  updatedAt: Date | null;
}

const CACHE_KEY = 'sc:publicStats:v1';
// The automation job that writes this document runs once a day (see
// automation/src/publicStatsJob.ts), so an hour-old cached copy is
// never meaningfully stale — caching client-side means a signed-out
// visitor who reloads the landing page a few times in one session
// costs Firestore exactly one read, not one per reload.
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEnvelope {
  cachedAt: number;
  stats: {
    approvedMembers: number;
    connectionsMade: number;
    eventsHosted: number;
    foundersInNetwork: number;
    updatedAt: string | null;
  };
}

function readCache(): PublicStats | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope;
    if (!parsed.cachedAt || Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return {
      ...parsed.stats,
      updatedAt: parsed.stats.updatedAt ? new Date(parsed.stats.updatedAt) : null,
    };
  } catch {
    return null;
  }
}

function writeCache(stats: PublicStats) {
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        cachedAt: Date.now(),
        stats: { ...stats, updatedAt: stats.updatedAt ? stats.updatedAt.toISOString() : null },
      } satisfies CacheEnvelope),
    );
  } catch {
    // Best-effort only (private/incognito browsing or a full storage
    // quota just means the next visit costs one more read) — never
    // block the landing page on this.
  }
}

/**
 * Reads the single `systemConfig/publicStats` document — the one
 * document the public landing page may read while signed out (see the
 * dedicated exception in firestore.rules' `systemConfig` block, and
 * ARCHITECTURE.md's "Public landing page exposes only safe aggregate
 * statistics"). Only automation (Admin SDK — see
 * automation/src/publicStatsJob.ts) ever writes this document; the
 * client never runs its own count() aggregation to produce these
 * numbers, so an anonymous landing-page visitor never triggers a query
 * of their own — just one bounded document `get`, cached locally.
 *
 * Returns null (never throws) if Firestore isn't configured, the
 * document doesn't exist yet (e.g. automation hasn't run once), or the
 * read fails for any reason — the landing page renders its hero/story
 * content either way and simply omits the stats row.
 */
export async function getPublicStats(): Promise<PublicStats | null> {
  const cached = readCache();
  if (cached) return cached;

  if (!db) return null;
  try {
    const snapshot = await getDoc(doc(db, 'systemConfig', 'publicStats'));
    if (!snapshot.exists()) return null;

    const data = snapshot.data();
    const stats: PublicStats = {
      approvedMembers: typeof data.approvedMembers === 'number' ? data.approvedMembers : 0,
      connectionsMade: typeof data.connectionsMade === 'number' ? data.connectionsMade : 0,
      eventsHosted: typeof data.eventsHosted === 'number' ? data.eventsHosted : 0,
      foundersInNetwork: typeof data.foundersInNetwork === 'number' ? data.foundersInNetwork : 0,
      updatedAt: data.updatedAt?.toDate?.() ?? null,
    };
    writeCache(stats);
    return stats;
  } catch {
    return null;
  }
}
