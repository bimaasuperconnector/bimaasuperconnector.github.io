import {
  type DirectoryIndexMeta,
  type DirectoryShardDoc,
  fetchDirectoryIndexMeta,
  fetchDirectoryShards,
} from '../firebase/repositories/directoryIndexRepository';
import { DIRECTORY_INDEX_SCHEMA, decodeShard, shardDocId } from './directoryIndexFormat';
import { type IndexedEntry, indexEntry, searchEntries } from './nameSearch';

/**
 * Browser-side owner of the member-name index.
 *
 * What a member pays in Firestore reads (this is the whole point):
 *  - first search on a device: 1 (meta) + one query for the shards, i.e. about
 *    (number of members ÷ 500) documents + 1 membership check — roughly 11
 *    reads for 4,000 members, ONCE;
 *  - later searches: 0 reads. The list lives in memory and in localStorage;
 *  - after 20 minutes the next search re-checks the small meta document (1–2
 *    reads) and downloads only the shards whose version changed;
 *  - typing, retyping, narrowing a query, "Load more": 0 reads.
 * Nothing is fetched at all until the member actually searches by name.
 *
 * If the index doesn't exist yet (the automation hasn't built it) or can't be
 * read, getDirectoryIndex() returns null and the caller falls back to the
 * original server-side name query — so search keeps working either way.
 */

const STORAGE_KEY = 'sc:directory-index:v1';
/** How long a loaded index is trusted before the next search re-checks the meta document. */
const RECHECK_MS = 20 * 60 * 1000;
/** After a failed load, don't hammer Firestore: use the fallback for this long. */
const RETRY_AFTER_FAILURE_MS = 5 * 60 * 1000;

interface StoredIndex {
  schema: number;
  checkedAt: number;
  shards: Record<string, DirectoryShardDoc>;
}

export interface LoadedDirectoryIndex {
  entries: IndexedEntry[];
}

let loaded: (LoadedDirectoryIndex & { checkedAt: number; shards: Record<string, DirectoryShardDoc> }) | null = null;
let inflight: Promise<LoadedDirectoryIndex | null> | null = null;
let unavailableUntil = 0;

function readStored(): StoredIndex | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredIndex;
    if (parsed.schema !== DIRECTORY_INDEX_SCHEMA || typeof parsed.shards !== 'object' || parsed.shards === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(value: StoredIndex): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: the in-memory copy still serves this tab.
  }
}

function buildLoaded(shards: Record<string, DirectoryShardDoc>, checkedAt: number) {
  const seen = new Set<string>();
  const entries: IndexedEntry[] = [];
  for (const shard of Object.values(shards)) {
    for (const entry of decodeShard(shard.d)) {
      if (seen.has(entry.uid)) continue;
      seen.add(entry.uid);
      entries.push(indexEntry(entry));
    }
  }
  return { entries, checkedAt, shards };
}

async function refresh(): Promise<LoadedDirectoryIndex | null> {
  const stored = loaded ?? readStored();
  const have: Record<string, DirectoryShardDoc> = stored ? { ...stored.shards } : {};

  let meta: DirectoryIndexMeta | null;
  try {
    meta = await fetchDirectoryIndexMeta();
  } catch {
    unavailableUntil = Date.now() + RETRY_AFTER_FAILURE_MS;
    // A stale copy is still far better than no name search at all.
    if (!loaded && stored) loaded = buildLoaded(have, 0);
    return loaded;
  }
  if (!meta || meta.schema !== DIRECTORY_INDEX_SCHEMA || meta.shardCount <= 0) {
    unavailableUntil = Date.now() + RETRY_AFTER_FAILURE_MS;
    return null;
  }

  const wantedIds: string[] = [];
  for (let i = 0; i < meta.shardCount; i++) wantedIds.push(shardDocId(i));
  const stale = wantedIds.filter((id) => have[id] === undefined || have[id].v !== meta.versions[id.slice(1)]);

  const next: Record<string, DirectoryShardDoc> = {};
  for (const id of wantedIds) if (have[id] !== undefined) next[id] = have[id];

  if (stale.length > 0) {
    try {
      const fresh = await fetchDirectoryShards(stale);
      for (const id of stale) {
        if (fresh[id]) next[id] = fresh[id];
        else delete next[id];
      }
    } catch {
      unavailableUntil = Date.now() + RETRY_AFTER_FAILURE_MS;
      if (!loaded && Object.keys(next).length > 0) loaded = buildLoaded(next, 0);
      return loaded;
    }
  }

  const now = Date.now();
  // Re-decode only when something actually changed.
  loaded = stale.length > 0 || !loaded ? buildLoaded(next, now) : { ...loaded, checkedAt: now };
  unavailableUntil = 0;
  writeStored({ schema: DIRECTORY_INDEX_SCHEMA, checkedAt: now, shards: next });
  return loaded;
}

/**
 * The name index, or null when it isn't available (the caller then uses the
 * server-side query). Cheap to call on every search: it only touches Firestore
 * when the in-memory copy is older than 20 minutes.
 */
export async function getDirectoryIndex(): Promise<LoadedDirectoryIndex | null> {
  const now = Date.now();
  if (loaded && now - loaded.checkedAt < RECHECK_MS) return loaded;
  if (now < unavailableUntil) return loaded;
  if (!loaded) {
    // A copy saved by an earlier visit can answer instantly if it is fresh enough.
    const stored = readStored();
    if (stored && now - stored.checkedAt < RECHECK_MS) {
      loaded = buildLoaded(stored.shards, stored.checkedAt);
      return loaded;
    }
  }
  if (!inflight) {
    inflight = refresh().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** True once an index is in memory — lets the search UI use its faster, free path. */
export function isDirectoryIndexReady(): boolean {
  return loaded !== null;
}

/** Ranked local name matches (see nameSearch.ts). Zero Firestore reads. */
export function searchDirectoryByName(index: LoadedDirectoryIndex, text: string): IndexedEntry[] {
  return searchEntries(index.entries, text);
}

/**
 * Forgets the downloaded member list. Called on sign-out so a shared computer
 * doesn't keep the alumni directory in its browser storage afterwards.
 */
export function clearDirectoryIndexCache(): void {
  loaded = null;
  inflight = null;
  unavailableUntil = 0;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clear
  }
}
