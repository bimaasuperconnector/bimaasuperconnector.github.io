import { FieldPath, Timestamp, type DocumentData, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin';
import {
  DIRECTORY_INDEX_COLLECTION,
  DIRECTORY_INDEX_META_ID,
  DIRECTORY_INDEX_SCHEMA,
  DIRECTORY_INDEX_SHARDS,
  type DirectoryEntry,
  decodeShard,
  encodeShard,
  entryFromProfileData,
  shardDocId,
  shardOf,
} from '../../src/lib/directoryIndexFormat';

/**
 * Keeps the member-name index (directoryIndex/*) in step with `profiles`.
 * The browser downloads that index once and searches names locally for free
 * (see src/lib/directoryIndex.ts) — this job is the only thing that writes it.
 *
 * READ COST OF THIS JOB (it counts against the same daily quota):
 *  - normal run: 1 read for the meta document + one read per profile changed
 *    since the previous run + one read per index shard those changes touch.
 *    With nothing changed that is 1–2 reads per run;
 *  - full rebuild (first ever run, or on request): one read per profile
 *    (≈ the member count, once).
 * Every write is a single atomic batch (changed shards + meta together), so a
 * member's browser never sees a version that points at a half-written shard.
 *
 * Safe to re-run at any time: shard contents are derived from profiles, so a
 * repeat run simply produces the same result.
 */

/** How far before "now" the next incremental run looks back, to be safe against clock skew and in-flight writes. */
const SAFETY_WINDOW_MS = 5 * 60 * 1000;
const PAGE_SIZE = 500;
/** Only the fields entryFromProfileData needs — keeps the data downloaded small (reads are unchanged). */
const PROFILE_FIELDS = [
  'approved',
  'displayName',
  'batchNumber',
  'currentOrganizationName',
  'currentTitle',
  'headline',
  'hasFounderOrg',
  'openToWork',
  'photoURL',
  'photoFileId',
  'updatedAt',
];

export interface DirectoryIndexSyncResult {
  mode: 'full' | 'incremental';
  profilesRead: number;
  shardsWritten: number;
  members: number;
}

function metaRef() {
  return db.collection(DIRECTORY_INDEX_COLLECTION).doc(DIRECTORY_INDEX_META_ID);
}

function shardRef(shard: number) {
  return db.collection(DIRECTORY_INDEX_COLLECTION).doc(shardDocId(shard));
}

async function pageThrough(
  build: (after: QueryDocumentSnapshot<DocumentData> | null) => FirebaseFirestore.Query,
  onDoc: (doc: QueryDocumentSnapshot<DocumentData>) => void,
): Promise<number> {
  let after: QueryDocumentSnapshot<DocumentData> | null = null;
  let total = 0;
  for (;;) {
    const snapshot = await build(after).limit(PAGE_SIZE).get();
    for (const doc of snapshot.docs) onDoc(doc);
    total += snapshot.size;
    if (snapshot.size < PAGE_SIZE) return total;
    after = snapshot.docs[snapshot.docs.length - 1];
  }
}

async function fullRebuild(runStart: number): Promise<DirectoryIndexSyncResult> {
  const buckets: DirectoryEntry[][] = Array.from({ length: DIRECTORY_INDEX_SHARDS }, () => []);
  const profilesRead = await pageThrough(
    (after) => {
      const q = db.collection('profiles').select(...PROFILE_FIELDS).orderBy(FieldPath.documentId());
      return after ? q.startAfter(after.id) : q;
    },
    (doc) => {
      const entry = entryFromProfileData(doc.id, doc.data());
      if (entry) buckets[shardOf(entry.uid)].push(entry);
    },
  );

  const batch = db.batch();
  const versions: Record<string, number> = {};
  const counts: Record<string, number> = {};
  let members = 0;
  buckets.forEach((entries, shard) => {
    versions[String(shard)] = runStart;
    counts[String(shard)] = entries.length;
    members += entries.length;
    batch.set(shardRef(shard), { v: runStart, n: entries.length, d: encodeShard(entries) });
  });
  batch.set(metaRef(), {
    schema: DIRECTORY_INDEX_SCHEMA,
    shardCount: DIRECTORY_INDEX_SHARDS,
    versions,
    counts,
    count: members,
    syncedThrough: runStart - SAFETY_WINDOW_MS,
    updatedAt: Timestamp.fromMillis(runStart),
  });
  await batch.commit();
  return { mode: 'full', profilesRead, shardsWritten: DIRECTORY_INDEX_SHARDS, members };
}

async function incrementalSync(
  runStart: number,
  meta: DocumentData,
): Promise<DirectoryIndexSyncResult> {
  const since = Timestamp.fromMillis(meta.syncedThrough as number);
  // uid → new entry, or null when the profile must no longer be searchable.
  const changed = new Map<string, DirectoryEntry | null>();
  const profilesRead = await pageThrough(
    (after) => {
      const q = db
        .collection('profiles')
        .where('updatedAt', '>', since)
        .orderBy('updatedAt')
        .select(...PROFILE_FIELDS);
      return after ? q.startAfter(after) : q;
    },
    (doc) => changed.set(doc.id, entryFromProfileData(doc.id, doc.data())),
  );

  const versions: Record<string, number> = { ...(meta.versions as Record<string, number>) };
  const counts: Record<string, number> = { ...(meta.counts as Record<string, number> | undefined) };
  const touched = new Map<number, Array<[string, DirectoryEntry | null]>>();
  for (const [uid, entry] of changed) {
    const shard = shardOf(uid);
    const list = touched.get(shard) ?? [];
    list.push([uid, entry]);
    touched.set(shard, list);
  }

  const batch = db.batch();
  let shardsWritten = 0;
  if (touched.size > 0) {
    const shards = [...touched.keys()];
    // ONE round trip for every shard these changes touch.
    const snapshots = await db.getAll(...shards.map(shardRef));
    snapshots.forEach((snapshot, i) => {
      const shard = shards[i];
      const entries = new Map<string, DirectoryEntry>();
      for (const e of decodeShard(snapshot.exists ? snapshot.data()?.d : '')) entries.set(e.uid, e);
      for (const [uid, entry] of touched.get(shard) ?? []) {
        if (entry) entries.set(uid, entry);
        else entries.delete(uid);
      }
      const data = encodeShard([...entries.values()]);
      // Skip the write when the change didn't alter what is searchable (e.g. an edit to a field the index doesn't hold).
      if (snapshot.exists && snapshot.data()?.d === data) return;
      versions[String(shard)] = runStart;
      counts[String(shard)] = entries.size;
      batch.set(shardRef(shard), { v: runStart, n: entries.size, d: data });
      shardsWritten += 1;
    });
  }

  const members = Object.values(counts).reduce((sum, n) => sum + n, 0);
  // The cursor always advances (even when nothing changed) so the same documents are never re-read next run.
  batch.set(
    metaRef(),
    {
      schema: DIRECTORY_INDEX_SCHEMA,
      shardCount: DIRECTORY_INDEX_SHARDS,
      versions,
      counts,
      count: members,
      syncedThrough: runStart - SAFETY_WINDOW_MS,
      updatedAt: Timestamp.fromMillis(runStart),
    },
    { merge: false },
  );
  await batch.commit();
  return { mode: 'incremental', profilesRead, shardsWritten, members };
}

/** Builds or refreshes the index. `full` forces a rebuild from every profile. */
export async function runDirectoryIndexSync(options: { full?: boolean } = {}): Promise<DirectoryIndexSyncResult> {
  const runStart = Date.now();
  const metaSnap = await metaRef().get();
  const meta = metaSnap.exists ? (metaSnap.data() ?? null) : null;
  const usable =
    meta !== null &&
    meta.schema === DIRECTORY_INDEX_SCHEMA &&
    meta.shardCount === DIRECTORY_INDEX_SHARDS &&
    typeof meta.syncedThrough === 'number' &&
    meta.versions !== null &&
    typeof meta.versions === 'object';
  if (options.full || !usable) return fullRebuild(runStart);
  return incrementalSync(runStart, meta as DocumentData);
}
