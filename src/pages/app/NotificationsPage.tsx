import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listOwnNotifications, type Notification } from '../../firebase/repositories/notificationsRepository';

export function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listOwnNotifications(user.uid)
      .then((result) => {
        if (!cancelled) setNotifications(result);
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

  return (
    <div className="rounded-md border border-hairline p-xl">
      <h1 className="text-title-lg text-ink">Notifications</h1>
      <p className="mt-sm text-body-md text-body">
        Updates about your monthly connections. Read-only for now — marking
        as read is a small addition for later once this gets regular use.
      </p>

      {error && <p className="mt-md text-body-md text-signature-coral">{error}</p>}

      {loading ? (
        <p className="mt-lg text-body-md text-muted">Loading…</p>
      ) : notifications.length === 0 ? (
        <p className="mt-lg text-body-md text-muted">No notifications yet.</p>
      ) : (
        <ul className="mt-lg space-y-sm">
          {notifications.map((n) => (
            <li key={n.id} className="rounded-sm border border-hairline p-md">
              <p className="text-label-md text-ink">{n.title}</p>
              <p className="mt-xs text-body-md text-body">{n.body}</p>
              {n.createdAt && (
                <p className="mt-xs text-caption text-muted">
                  {n.createdAt.toLocaleDateString(undefined, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
