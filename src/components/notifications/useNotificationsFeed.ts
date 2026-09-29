import { useCallback, useEffect, useRef, useState } from 'react';
import {
  NOTIFICATIONS_PAGE_SIZE,
  type Notification,
  countNotificationsSince,
  listOwnNotifications,
} from '../../firebase/repositories/notificationsRepository';

/**
 * Header-bell state: an unread badge plus a lazily-loaded feed.
 *
 * Read cost per member (the point of this hook's shape):
 *  - badge: ONE count() aggregation when the app opens (billed as ~1 read),
 *    re-checked when the tab regains focus but never more than every
 *    10 minutes — no documents are downloaded to draw a number;
 *  - feed: nothing is fetched until the bell is first opened; then one
 *    bounded page (20). Reopening within 3 minutes reuses what's in memory.
 *    "Older" pages are fetched only on request.
 *
 * "Unread" is tracked per device with a last-seen timestamp in
 * localStorage, because notification documents are read-only for members
 * (firestore.rules) — there is no server-side read flag to update.
 */

const RECHECK_MS = 10 * 60 * 1000;
const REFRESH_MS = 3 * 60 * 1000;

function seenKey(uid: string) {
  return `sc:notifications-seen:${uid}`;
}

function readSeen(uid: string): Date | null {
  try {
    const raw = window.localStorage.getItem(seenKey(uid));
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function writeSeen(uid: string, date: Date) {
  try {
    window.localStorage.setItem(seenKey(uid), date.toISOString());
  } catch {
    // storage unavailable (private mode) — the badge just won't persist
  }
}

export function useNotificationsFeed(uid: string | undefined) {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  /** Items newer than this are shown as "new" in the pane (the previous last-seen time). */
  const [highlightSince, setHighlightSince] = useState<Date | null>(null);
  const [hasHighlightBaseline, setHasHighlightBaseline] = useState(false);

  const loadedAt = useRef(0);
  const checkedAt = useRef(0);

  const checkUnread = useCallback(async () => {
    if (!uid) return;
    checkedAt.current = Date.now();
    try {
      setUnread(await countNotificationsSince(uid, readSeen(uid)));
    } catch {
      // A failed badge check is silent — the bell simply shows no badge.
    }
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    setItems([]);
    setHasMore(false);
    loadedAt.current = 0;
    void checkUnread();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - checkedAt.current > RECHECK_MS) {
        void checkUnread();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [uid, checkUnread]);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const page = await listOwnNotifications(uid, NOTIFICATIONS_PAGE_SIZE);
      setItems(page);
      setHasMore(page.length === NOTIFICATIONS_PAGE_SIZE);
      loadedAt.current = Date.now();
    } catch {
      setError("Couldn't load your notifications.");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  /** Call when the pane opens: clears the badge and loads the feed if stale. */
  const markOpened = useCallback(() => {
    if (!uid) return;
    setHighlightSince(readSeen(uid));
    setHasHighlightBaseline(true);
    writeSeen(uid, new Date());
    setUnread(0);
    if (Date.now() - loadedAt.current > REFRESH_MS) void load();
  }, [uid, load]);

  const loadMore = useCallback(async () => {
    if (!uid || items.length === 0) return;
    const last = items[items.length - 1].createdAt;
    if (!last) return;
    setLoadingMore(true);
    try {
      const page = await listOwnNotifications(uid, NOTIFICATIONS_PAGE_SIZE, last);
      setItems((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...page.filter((n) => !seen.has(n.id))];
      });
      setHasMore(page.length === NOTIFICATIONS_PAGE_SIZE);
    } catch {
      setError("Couldn't load older notifications.");
    } finally {
      setLoadingMore(false);
    }
  }, [uid, items]);

  const isNew = useCallback(
    (n: Notification) => {
      if (!hasHighlightBaseline || !n.createdAt) return false;
      return highlightSince === null || n.createdAt > highlightSince;
    },
    [hasHighlightBaseline, highlightSince],
  );

  return { unread, items, loading, loadingMore, error, hasMore, markOpened, loadMore, reload: load, isNew };
}

export type NotificationsFeed = ReturnType<typeof useNotificationsFeed>;
