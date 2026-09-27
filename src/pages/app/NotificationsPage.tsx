import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listOwnNotifications, type Notification } from '../../firebase/repositories/notificationsRepository';
import { BellRequestIcon } from '../../components/icons/NavIcons';

type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

/**
 * Phase 15 scope note: "a notifications-tab control that triggers the
 * browser's push-notification permission prompt (for the PWA)." This
 * is scoped exactly to that: requesting the browser's Notification
 * permission and reflecting its state. It deliberately does NOT build
 * actual push delivery (Firebase Cloud Messaging, a VAPID key,
 * combining it with the existing vite-plugin-pwa service worker) —
 * that's a materially larger, separate architecture decision (new
 * Google/Firebase configuration, a second service-worker concern) that
 * wasn't asked for here and would need its own explicit sign-off per
 * CLAUDE.md section 14, not folded in silently. Granting permission
 * today lays the groundwork for that later; it does not itself cause
 * anything to be sent.
 */
function usePermissionState(): [PermissionState, () => void] {
  const [state, setState] = useState<PermissionState>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission as PermissionState;
  });

  const request = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    Notification.requestPermission().then((result) => setState(result as PermissionState));
  };

  return [state, request];
}

export function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permission, requestPermission] = usePermissionState();

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

      {permission !== 'unsupported' && (
        <div className="mt-lg flex items-center justify-between gap-md rounded-sm border border-hairline p-md">
          <div className="flex items-center gap-sm">
            <span className="text-ink">
              <BellRequestIcon />
            </span>
            <div>
              <p className="text-label-md text-ink">Browser notifications</p>
              <p className="text-body-md text-muted">
                {permission === 'granted'
                  ? "Enabled on this device. You'll still see everything here either way."
                  : permission === 'denied'
                    ? 'Blocked in this browser. Enable it from your browser/site settings if you change your mind.'
                    : 'Get a heads-up on this device when something new happens — on top of this page.'}
              </p>
            </div>
          </div>
          {permission === 'default' && (
            <button
              type="button"
              onClick={requestPermission}
              className="shrink-0 rounded-lg bg-primary px-md py-sm text-button text-on-primary"
            >
              Enable
            </button>
          )}
        </div>
      )}

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
