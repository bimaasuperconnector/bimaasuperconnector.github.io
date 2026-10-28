import { useCallback, useEffect, useState } from 'react';
import {
  detectEnvironment,
  needsInstallForNotifications,
  readNotificationSupport,
  requestNotificationPermission,
  useInstallAction,
  type NotificationSupport,
} from '../../lib/pwa';

export type GuideTab = 'install' | 'notifications';

/**
 * One place for the two "App" actions, shared by the profile-menu section and
 * the guide dialog. Client-only: no Firestore access at all.
 */
export function useAppActions(openGuide: (tab: GuideTab) => void) {
  const install = useInstallAction(useCallback(() => openGuide('install'), [openGuide]));
  const [notif, setNotif] = useState<NotificationSupport>(() => readNotificationSupport());
  const [notifMessage, setNotifMessage] = useState<string | null>(null);

  // The permission can be changed from browser settings while the page is open.
  useEffect(() => {
    const refresh = () => setNotif(readNotificationSupport());
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const enableNotifications = useCallback(async () => {
    setNotifMessage(null);
    const env = detectEnvironment();
    if (needsInstallForNotifications(env)) {
      // iPhone/iPad only allow notifications for an app added to the Home Screen.
      openGuide('install');
      return;
    }
    const current = readNotificationSupport();
    if (current === 'unsupported') {
      setNotifMessage("This browser doesn't support notifications.");
      return;
    }
    if (current === 'denied') {
      openGuide('notifications');
      return;
    }
    if (current === 'granted') return;
    const result = await requestNotificationPermission();
    setNotif(result);
    if (result === 'denied') setNotifMessage('Blocked. Open the guide to turn it back on.');
  }, [openGuide]);

  return { install, notif, notifMessage, enableNotifications };
}

export type AppActions = ReturnType<typeof useAppActions>;
