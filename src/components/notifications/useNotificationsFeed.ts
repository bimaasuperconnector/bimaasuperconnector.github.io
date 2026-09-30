import { useCallback, useEffect, useRef, useState } from 'react';
import {
  NOTIFICATIONS_PAGE_SIZE,
  type Notification,
  countNotificationsSince,
  listOwnNotifications,
} from '../../firebase/repositories/notificationsRepository';
import {
  countNewJobsFromOthers,
  listRecentJobsForFeed,
} from '../../firebase/repositories/jobsRepository';

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

function jobsSeenKey(uid: string) {
  return `sc:jobs-seen:${uid}`;
}

/** Baseline for "new jobs". First ever visit on a device starts from now, so nobody is flooded with old postings. */
function readJobsSeen(uid: string): Date {
  try {
    const raw = window.localStorage.getItem(jobsSeenKey(uid));
    const date = raw ? new Date(raw) : null;
    if (date && !Number.isNaN(date.getTime())) return date;
    const now = new Date();
    window.localStorage.setItem(jobsSeenKey(uid), now.toISOString());
    return now;
  } catch {
    return new Date();
  }
}

function writeJobsSeen(uid: string, date: Date) {
  try {
    window.localStorage.setItem(jobsSeenKey(uid), date.toISOString());
  } catch {
    // ignore — badge just won't persist
  }
}

/**
 * Device-level heads-up (only when the member already granted the
 * browser's notification permission and the app is open or backgrounded).
 * True closed-app push would need Firebase Cloud Messaging — a separate,
 * not-yet-approved architecture item (see CLAUDE.md section 14).
 */
function showJobsDeviceNotification(count: number) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const title = count === 1 ? 'New job posted' : `${count} new jobs posted`;
    const options = { body: 'Tap to see the latest openings on SuperConnector.', tag: 'sc-new-jobs' };
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.ready
        .then((reg) => reg.showNotification(title, options))
        .catch(() => new Notification(title, options));
    } else {
      new Notification(title, options);
    }
  } catch {
    // best-effort only
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

  const lastJobCount = useRef(0);

  const checkUnread = useCallback(async () => {
    if (!uid) return;
    checkedAt.current = Date.now();
    // Personal notifications (1 count read) and new jobs from others
    // (2 count reads) are independent: one failing must not blank the other.
    const [personal, jobs] = await Promise.allSettled([
      countNotificationsSince(uid, readSeen(uid)),
      countNewJobsFromOthers(uid, readJobsSeen(uid)),
    ]);
    const personalCount = personal.status === 'fulfilled' ? personal.value : 0;
    const jobCount = jobs.status === 'fulfilled' ? jobs.value : 0;
    setUnread(personalCount + jobCount);
    if (jobCount > lastJobCount.current) showJobsDeviceNotification(jobCount);
    lastJobCount.current = jobCount;
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
      const [page, recentJobs] = await Promise.all([
        listOwnNotifications(uid, NOTIFICATIONS_PAGE_SIZE),
        // A failed jobs lookup must never hide the member's own notifications.
        listRecentJobsForFeed(5).catch(() => []),
      ]);
      const jobItems: Notification[] = recentJobs
        .filter((j) => j.postedByUid !== uid)
        .map((j) => ({
          id: `job_${j.id}`,
          type: 'job_posted',
          title: 'New job posted',
          body: `${j.title} at ${j.company} · ${j.location}`,
          cycleId: null,
          eventId: null,
          jobId: j.id,
          read: false,
          createdAt: j.createdAt,
        }));
      const merged = [...page, ...jobItems].sort(
        (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
      );
      setItems(merged);
      // Paging cursor is based on personal notifications only; job items are a bounded extra.
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
    const now = new Date();
    writeSeen(uid, now);
    writeJobsSeen(uid, now);
    lastJobCount.current = 0;
    setUnread(0);
    if (Date.now() - loadedAt.current > REFRESH_MS) void load();
  }, [uid, load]);

  const loadMore = useCallback(async () => {
    if (!uid || items.length === 0) return;
    const last = [...items].reverse().find((n) => !n.jobId)?.createdAt;
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
