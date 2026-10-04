import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DIRECTORY_INDEX_SCHEMA, encodeShard } from '../directoryIndexFormat';

const fetchMeta = vi.fn();
const fetchShards = vi.fn();
vi.mock('../../firebase/repositories/directoryIndexRepository', () => ({
  fetchDirectoryIndexMeta: (...a: unknown[]) => fetchMeta(...a),
  fetchDirectoryShards: (...a: unknown[]) => fetchShards(...a),
}));

function entry(uid: string, name: string) {
  return { uid, name, batch: 35, role: '', photoURL: '', founder: false, openToWork: false };
}

function stubWindow() {
  const store = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
  return store;
}

const SHARD_COUNT = 2;
function metaWith(v0: number, v1: number) {
  return { schema: DIRECTORY_INDEX_SCHEMA, shardCount: SHARD_COUNT, versions: { '0': v0, '1': v1 }, count: 3 };
}
const shardData = {
  s0: { v: 1, d: encodeShard([entry('u1', 'Sandeep Balaji'), entry('u2', 'Priya Rao')]) },
  s1: { v: 1, d: encodeShard([entry('u3', 'Balaji Subramanian')]) },
};

async function load() {
  vi.resetModules();
  return import('../directoryIndex');
}

describe('directory index loading and caching', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T10:00:00Z'));
    fetchMeta.mockReset();
    fetchShards.mockReset();
    store = stubWindow();
  });

  it('first search downloads meta + all shards (one shards query), then finds a LAST name', async () => {
    fetchMeta.mockResolvedValue(metaWith(1, 1));
    fetchShards.mockResolvedValue(shardData);
    const m = await load();
    const index = await m.getDirectoryIndex();
    expect(index).not.toBeNull();
    expect(fetchMeta).toHaveBeenCalledTimes(1);
    expect(fetchShards).toHaveBeenCalledTimes(1);
    expect(fetchShards).toHaveBeenCalledWith(['s0', 's1']);
    expect(m.searchDirectoryByName(index!, 'balaji').map((e) => e.name)).toEqual(
      expect.arrayContaining(['Sandeep Balaji', 'Balaji Subramanian']),
    );
    expect(m.isDirectoryIndexReady()).toBe(true);
  });

  it('further searches within 20 minutes cost ZERO reads', async () => {
    fetchMeta.mockResolvedValue(metaWith(1, 1));
    fetchShards.mockResolvedValue(shardData);
    const m = await load();
    await m.getDirectoryIndex();
    vi.advanceTimersByTime(19 * 60 * 1000);
    await m.getDirectoryIndex();
    await m.getDirectoryIndex();
    expect(fetchMeta).toHaveBeenCalledTimes(1);
    expect(fetchShards).toHaveBeenCalledTimes(1);
  });

  it('a new page load (fresh module) reuses the saved copy: zero reads while it is fresh', async () => {
    fetchMeta.mockResolvedValue(metaWith(1, 1));
    fetchShards.mockResolvedValue(shardData);
    let m = await load();
    await m.getDirectoryIndex();
    vi.advanceTimersByTime(5 * 60 * 1000);
    m = await load(); // simulates a browser reload
    const index = await m.getDirectoryIndex();
    expect(index?.entries.length).toBe(3);
    expect(fetchMeta).toHaveBeenCalledTimes(1);
    expect(fetchShards).toHaveBeenCalledTimes(1);
  });

  it('after 20 minutes only the meta is re-read when nothing changed', async () => {
    fetchMeta.mockResolvedValue(metaWith(1, 1));
    fetchShards.mockResolvedValue(shardData);
    const m = await load();
    await m.getDirectoryIndex();
    vi.advanceTimersByTime(21 * 60 * 1000);
    await m.getDirectoryIndex();
    expect(fetchMeta).toHaveBeenCalledTimes(2);
    expect(fetchShards).toHaveBeenCalledTimes(1); // no shard re-download
  });

  it('re-downloads ONLY the shard whose version changed', async () => {
    fetchMeta.mockResolvedValueOnce(metaWith(1, 1));
    fetchShards.mockResolvedValueOnce(shardData);
    const m = await load();
    await m.getDirectoryIndex();
    vi.advanceTimersByTime(21 * 60 * 1000);
    fetchMeta.mockResolvedValueOnce(metaWith(1, 2));
    fetchShards.mockResolvedValueOnce({ s1: { v: 2, d: encodeShard([entry('u3', 'Balaji Subramanian'), entry('u4', 'New Member')]) } });
    const index = await m.getDirectoryIndex();
    expect(fetchShards).toHaveBeenLastCalledWith(['s1']);
    expect(index?.entries.map((e) => e.name)).toContain('New Member');
    expect(index?.entries.length).toBe(4);
  });

  it('returns null (caller falls back to the server query) when the index does not exist yet, and does not retry for a few minutes', async () => {
    fetchMeta.mockResolvedValue(null);
    const m = await load();
    expect(await m.getDirectoryIndex()).toBeNull();
    expect(await m.getDirectoryIndex()).toBeNull();
    expect(fetchMeta).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(6 * 60 * 1000);
    await m.getDirectoryIndex();
    expect(fetchMeta).toHaveBeenCalledTimes(2);
  });

  it('returns null when the index has an unknown schema', async () => {
    fetchMeta.mockResolvedValue({ ...metaWith(1, 1), schema: 999 });
    const m = await load();
    expect(await m.getDirectoryIndex()).toBeNull();
    expect(fetchShards).not.toHaveBeenCalled();
  });

  it('serves a stale saved copy if Firestore cannot be reached', async () => {
    fetchMeta.mockResolvedValueOnce(metaWith(1, 1));
    fetchShards.mockResolvedValueOnce(shardData);
    let m = await load();
    await m.getDirectoryIndex();
    vi.advanceTimersByTime(3 * 60 * 60 * 1000);
    fetchMeta.mockRejectedValueOnce(new Error('offline'));
    m = await load();
    const index = await m.getDirectoryIndex();
    expect(index?.entries.length).toBe(3);
  });

  it('concurrent first searches share ONE load', async () => {
    fetchMeta.mockResolvedValue(metaWith(1, 1));
    fetchShards.mockResolvedValue(shardData);
    const m = await load();
    await Promise.all([m.getDirectoryIndex(), m.getDirectoryIndex(), m.getDirectoryIndex()]);
    expect(fetchMeta).toHaveBeenCalledTimes(1);
    expect(fetchShards).toHaveBeenCalledTimes(1);
  });

  it('clearDirectoryIndexCache removes the saved member list (sign-out)', async () => {
    fetchMeta.mockResolvedValue(metaWith(1, 1));
    fetchShards.mockResolvedValue(shardData);
    const m = await load();
    await m.getDirectoryIndex();
    expect(store.size).toBe(1);
    m.clearDirectoryIndexCache();
    expect(store.size).toBe(0);
    expect(m.isDirectoryIndexReady()).toBe(false);
  });
});
