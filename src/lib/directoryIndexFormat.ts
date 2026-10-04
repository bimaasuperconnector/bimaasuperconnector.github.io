/**
 * Compact "directory index" format, shared by the browser (reads it) and
 * the trusted automation (automation/src/directoryIndexJob.ts, writes it).
 * Pure functions only — no Firebase imports — so both sides use ONE tested
 * implementation.
 *
 * WHY THIS EXISTS (read-quota design)
 * Searching members by name used to be a Firestore query on every pause
 * in typing, each one billed per profile document returned. The index
 * turns a name search into a LOCAL operation: the browser downloads a
 * tiny one-line-per-member list once, keeps it in localStorage, and
 * searches it in memory. Typing, retyping, narrowing a query and
 * searching again cost ZERO reads. The only reads are the periodic
 * refresh (see lib/directoryIndex.ts).
 *
 * LAYOUT IN FIRESTORE
 *   directoryIndex/meta   { schema, shardCount, versions{0..n-1}, count, syncedThrough }
 *   directoryIndex/s0 … s7 { v: version, n: entry count, d: "<one entry per line>" }
 *
 * Members are spread over a FIXED number of shards by a hash of their uid,
 * so one member's edit rewrites exactly one small document, and a client
 * that already holds the other shards re-downloads only the changed one.
 * Each shard is a SINGLE string field on purpose: Firestore indexes every
 * map sub-field, so a map-per-member would create thousands of needless
 * index entries per document.
 */

export const DIRECTORY_INDEX_SCHEMA = 1;
/** Fixed. Changing it requires a full rebuild (the job does this automatically). */
export const DIRECTORY_INDEX_SHARDS = 8;
export const DIRECTORY_INDEX_COLLECTION = 'directoryIndex';
export const DIRECTORY_INDEX_META_ID = 'meta';

/**
 * Where uploaded profile photos live. Stored photo URLs under this prefix are
 * shortened to just the file name inside the index (saves ~70 bytes per
 * member); anything else is kept in full.
 */
export const PHOTO_URL_PREFIX = 'https://ik.imagekit.io/bimaasuperconnector/profile-photos/';

export const ROLE_MAX_CHARS = 40;
export const NAME_MAX_CHARS = 80;

export interface DirectoryEntry {
  uid: string;
  name: string;
  batch: number | null;
  /** "Title at Organization" (or the headline), shortened — shown under the name. */
  role: string;
  /** Full photo URL, or '' for none. */
  photoURL: string;
  founder: boolean;
  openToWork: boolean;
}

const FIELD_SEP = '\t';
const LINE_SEP = '\n';

/** Removes the characters used as separators and trims/shortens to `max`. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const flat = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** Stable 32-bit FNV-1a hash → shard number. Same result in the browser and in Node. */
export function shardOf(uid: string, shardCount: number = DIRECTORY_INDEX_SHARDS): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < uid.length; i++) {
    hash ^= uid.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % shardCount;
}

export function shardDocId(shard: number): string {
  return `s${shard}`;
}

function packPhoto(uid: string, url: string): string {
  if (!url) return '';
  const own = `${PHOTO_URL_PREFIX}${uid}/`;
  if (url.startsWith(own)) return url.slice(own.length);
  return `!${url}`;
}

function unpackPhoto(uid: string, packed: string): string {
  if (!packed) return '';
  if (packed.startsWith('!')) return packed.slice(1);
  return `${PHOTO_URL_PREFIX}${uid}/${packed}`;
}

export function encodeEntry(entry: DirectoryEntry): string {
  const flags = `${entry.founder ? 'f' : ''}${entry.openToWork ? 'o' : ''}`;
  return [
    entry.uid,
    cleanText(entry.name, NAME_MAX_CHARS),
    entry.batch === null ? '' : String(entry.batch),
    cleanText(entry.role, ROLE_MAX_CHARS),
    packPhoto(entry.uid, entry.photoURL),
    flags,
  ].join(FIELD_SEP);
}

export function decodeEntry(line: string): DirectoryEntry | null {
  const parts = line.split(FIELD_SEP);
  if (parts.length < 6) return null;
  const [uid, name, batchText, role, photo, flags] = parts;
  if (!uid || !name) return null;
  const batch = batchText === '' ? null : Number(batchText);
  return {
    uid,
    name,
    batch: batch !== null && Number.isFinite(batch) ? batch : null,
    role,
    photoURL: unpackPhoto(uid, photo),
    founder: flags.includes('f'),
    openToWork: flags.includes('o'),
  };
}

export function encodeShard(entries: DirectoryEntry[]): string {
  return entries
    .slice()
    .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0))
    .map(encodeEntry)
    .join(LINE_SEP);
}

export function decodeShard(data: unknown): DirectoryEntry[] {
  if (typeof data !== 'string' || data === '') return [];
  const out: DirectoryEntry[] = [];
  for (const line of data.split(LINE_SEP)) {
    const entry = decodeEntry(line);
    if (entry) out.push(entry);
  }
  return out;
}

/**
 * Builds an index entry from a raw `profiles/{uid}` document. Returns null for
 * anything that must NOT be searchable: a profile that isn't flagged approved
 * or has no name.
 */
export function entryFromProfileData(uid: string, data: Record<string, unknown>): DirectoryEntry | null {
  if (data.approved !== true) return null;
  const name = cleanText(data.displayName, NAME_MAX_CHARS);
  if (!name) return null;

  const orgName = cleanText(data.currentOrganizationName, 60);
  const title = cleanText(data.currentTitle, 60);
  const headline = cleanText(data.headline, 80);
  const role = orgName ? (title ? `${title} at ${orgName}` : orgName) : headline;

  // Only an UPLOADED photo (one that has a photoFileId) is ever shown — the same
  // rule profilesRepository.fromSnapshot applies.
  const photoURL =
    typeof data.photoFileId === 'string' && typeof data.photoURL === 'string' ? data.photoURL : '';

  return {
    uid,
    name,
    batch: typeof data.batchNumber === 'number' ? data.batchNumber : null,
    role: cleanText(role, ROLE_MAX_CHARS),
    photoURL,
    founder: data.hasFounderOrg === true,
    openToWork: data.openToWork === true,
  };
}
