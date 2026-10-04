import { collection, doc, documentId, getDoc, getDocs, limit as fsLimit, query, where } from 'firebase/firestore';
import { db } from '../init';
import {
  DIRECTORY_INDEX_COLLECTION,
  DIRECTORY_INDEX_META_ID,
} from '../../lib/directoryIndexFormat';

/**
 * Read side of the member-name index (see lib/directoryIndexFormat.ts for the
 * design). The automation (automation/src/directoryIndexJob.ts) is the ONLY
 * writer; firestore.rules denies every client write.
 *
 * Read cost, by design:
 *  - fetchDirectoryIndexMeta: ONE small document;
 *  - fetchDirectoryShards: ONE query for all the shards that changed (never one
 *    request per shard). A query is billed per document returned plus a single
 *    extra read for the membership check in firestore.rules — a per-document
 *    get() would pay that extra read every time.
 */

export interface DirectoryIndexMeta {
  schema: number;
  shardCount: number;
  /** shard number (as text) → version stamp; a changed number means "re-download this shard". */
  versions: Record<string, number>;
  count: number;
}

export interface DirectoryShardDoc {
  v: number;
  d: string;
}

/** Firestore's limit for an `in` filter — and the page ceiling enforced by firestore.rules. */
const IN_LIMIT = 30;

export async function fetchDirectoryIndexMeta(): Promise<DirectoryIndexMeta | null> {
  if (!db) return null;
  const snapshot = await getDoc(doc(db, DIRECTORY_INDEX_COLLECTION, DIRECTORY_INDEX_META_ID));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  const versions: Record<string, number> = {};
  if (data.versions && typeof data.versions === 'object') {
    for (const [key, value] of Object.entries(data.versions as Record<string, unknown>)) {
      if (typeof value === 'number') versions[key] = value;
    }
  }
  return {
    schema: typeof data.schema === 'number' ? data.schema : 0,
    shardCount: typeof data.shardCount === 'number' ? data.shardCount : 0,
    versions,
    count: typeof data.count === 'number' ? data.count : 0,
  };
}

/** Downloads the named shard documents (e.g. ["s0","s3"]) with a single query. */
export async function fetchDirectoryShards(ids: string[]): Promise<Record<string, DirectoryShardDoc>> {
  const out: Record<string, DirectoryShardDoc> = {};
  if (!db || ids.length === 0) return out;
  const wanted = ids.slice(0, IN_LIMIT);
  const snapshot = await getDocs(
    query(collection(db, DIRECTORY_INDEX_COLLECTION), where(documentId(), 'in', wanted), fsLimit(IN_LIMIT)),
  );
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    out[docSnap.id] = {
      v: typeof data.v === 'number' ? data.v : 0,
      d: typeof data.d === 'string' ? data.d : '',
    };
  }
  return out;
}
