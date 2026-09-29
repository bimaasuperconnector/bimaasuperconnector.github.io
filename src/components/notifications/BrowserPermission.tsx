import { useState } from 'react';
import { BellRequestIcon } from '../icons/NavIcons';

type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

/**
 * Phase 15 scope note: "a notifications-tab control that triggers the
 * browser's push-notification permission prompt (for the PWA)." This is
 * scoped exactly to that: requesting the browser's Notification permission
 * and reflecting its state. It deliberately does NOT build actual push
 * delivery (Firebase Cloud Messaging, a VAPID key, a second service-worker
 * concern) — that is a separate architecture decision needing its own
 * explicit sign-off per CLAUDE.md section 14. Granting permission today lays
 * the groundwork; it does not itself cause anything to be sent.
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

export function BrowserPermission({ compact = false }: { compact?: boolean }) {
  const [permission, requestPermission] = usePermissionState();
  if (permission === 'unsupported') return null;

  // Compact form (header pane): once a decision exists there is nothing to
  // act on, so collapse to a single quiet line.
  if (compact && permission !== 'default') return null;

  return (
    <div className="flex items-center justify-between gap-md rounded-lg bg-surface-soft p-md">
      <div className="flex min-w-0 items-start gap-sm">
        <span className="mt-xxs text-ink">
          <BellRequestIcon />
        </span>
        <div className="min-w-0">
          <p className="text-label-md text-ink">Browser notifications</p>
          <p className="text-body-md text-muted">
            {permission === 'granted'
              ? "Enabled on this device. You'll still see everything here either way."
              : permission === 'denied'
                ? 'Blocked in this browser. Enable it from your browser/site settings if you change your mind.'
                : 'Get a heads-up on this device when something new happens — on top of this list.'}
          </p>
        </div>
      </div>
      {permission === 'default' && (
        <button
          type="button"
          onClick={requestPermission}
          className="shrink-0 rounded-lg bg-primary px-md py-sm text-button text-on-primary active:bg-primary-active"
        >
          Enable
        </button>
      )}
    </div>
  );
}
