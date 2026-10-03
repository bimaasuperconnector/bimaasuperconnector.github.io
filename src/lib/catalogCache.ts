/**
 * Tiny in-memory cache for the two small, admin-managed catalogs (badges
 * and chapters). Quota optimisation: the catalogs are needed in several
 * places (Profile pickers, the header search, the Directory search, the
 * Events targeting editor, the admin panels). Without this, each of those
 * would re-read every catalog document each time it opened. With it, the
 * whole app reads each catalog at most once per 10 minutes per browser tab
 * (and concurrent callers share ONE in-flight request).
 *
 * Never persisted, never used for anything but these two catalogs. An
 * admin creating/deleting an entry calls invalidateCatalog() so the admin
 * panel always shows fresh data.
 */

const TTL_MS = 10 * 60 * 1000;

const store = new Map<string, { items: unknown[]; at: number }>();
const inflight = new Map<string, Promise<unknown[]>>();

export async function cachedCatalog<T>(key: string, loader: () => Promise<T[]>): Promise<T[]> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.items as T[];

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T[]>;

  const request = loader()
    .then((items) => {
      store.set(key, { items, at: Date.now() });
      return items;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, request);
  return request;
}

/** Synchronous peek (no read) — used to show a name for an id that has already been loaded. */
export function peekCatalog<T>(key: string): T[] | null {
  const hit = store.get(key);
  return hit && Date.now() - hit.at < TTL_MS ? (hit.items as T[]) : null;
}

export function invalidateCatalog(key: string): void {
  store.delete(key);
  inflight.delete(key);
}
