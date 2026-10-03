import { useEffect, useState } from 'react';
import { listBadges } from '../firebase/repositories/badgesRepository';
import { listChapters } from '../firebase/repositories/chaptersRepository';

/**
 * Loads one of the two small admin-managed catalogs, only while `enabled`.
 * The underlying repositories share an in-memory cache
 * (lib/catalogCache.ts), so any number of components using these hooks cost
 * at most one Firestore read of each catalog per 10 minutes.
 */
function useLoadedList<T>(loader: () => Promise<T[]>, enabled: boolean) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    loader()
      .then((result) => {
        if (!cancelled) setItems(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `loader` is a stable module-level function in both callers below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { items, loading, failed };
}

export function useBadgeCatalog(enabled = true) {
  return useLoadedList(listBadges, enabled);
}

export function useChapterCatalog(enabled = true) {
  return useLoadedList(listChapters, enabled);
}
