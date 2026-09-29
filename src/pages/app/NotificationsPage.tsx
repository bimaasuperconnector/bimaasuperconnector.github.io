import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  NOTIFICATIONS_PAGE_SIZE,
  listOwnNotifications,
  type Notification,
} from '../../firebase/repositories/notificationsRepository';
import { BrowserPermission } from '../../components/notifications/BrowserPermission';
import { NotificationItem } from '../../components/notifications/NotificationItem';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorNote, PageHeader, SkeletonList } from '../../components/ui/PageHeader';

/**
 * The full notifications list (also reachable from the header bell's
 * "View all"). Read cost is bounded: one page of 20, then one further page
 * per "Load older" tap — previously this downloaded the whole history.
 */
export function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listOwnNotifications(user.uid, NOTIFICATIONS_PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setNotifications(result);
        setHasMore(result.length === NOTIFICATIONS_PAGE_SIZE);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your notifications.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const loadOlder = useCallback(async () => {
    if (!user || notifications.length === 0) return;
    const last = notifications[notifications.length - 1].createdAt;
    if (!last) return;
    setLoadingMore(true);
    try {
      const page = await listOwnNotifications(user.uid, NOTIFICATIONS_PAGE_SIZE, last);
      setNotifications((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...page.filter((n) => !seen.has(n.id))];
      });
      setHasMore(page.length === NOTIFICATIONS_PAGE_SIZE);
    } catch {
      setError("Couldn't load older notifications.");
    } finally {
      setLoadingMore(false);
    }
  }, [user, notifications]);

  return (
    <div>
      <PageHeader title="Notifications" description="Updates about your monthly connections and events." />

      {error && (
        <div className="mt-md">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="mt-lg">
        <BrowserPermission />
      </div>

      <div className="mt-lg">
        {loading ? (
          <SkeletonList count={3} heightClass="h-[80px]" />
        ) : notifications.length === 0 ? (
          <EmptyState title="No notifications yet">Updates about your connections and events will appear here.</EmptyState>
        ) : (
          <ul className="surface-card divide-y divide-hairline overflow-hidden">
            {notifications.map((n) => (
              <li key={n.id}>
                <NotificationItem notification={n} />
              </li>
            ))}
          </ul>
        )}

        {hasMore && (
          <div className="mt-lg flex justify-center">
            <Button variant="secondary" disabled={loadingMore} onClick={() => void loadOlder()}>
              {loadingMore ? 'Loading…' : 'Load older'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
