import { useCallback, useSyncExternalStore } from 'react';

/**
 * Device / browser detection, the captured "install" prompt and the
 * notification-permission helpers behind the profile menu's "App" section.
 *
 * Everything here is purely client-side: it makes ZERO Firestore reads or
 * writes (nothing about install/notification state is stored in the
 * database), so it adds nothing to the quota no matter how many members use it.
 */

export type DeviceId = 'iphone' | 'ipad' | 'android' | 'windows' | 'mac';
export type BrowserId = 'safari' | 'chrome' | 'edge' | 'firefox' | 'samsung' | 'brave' | 'opera' | 'other';

export interface Environment {
  device: DeviceId;
  browser: BrowserId;
}

export function detectEnvironment(): Environment {
  if (typeof navigator === 'undefined') return { device: 'windows', browser: 'chrome' };
  const ua = navigator.userAgent || '';

  let device: DeviceId;
  if (/iPhone|iPod/.test(ua)) device = 'iphone';
  else if (/iPad/.test(ua)) device = 'ipad';
  // iPadOS 13+ pretends to be a Mac; a real Mac has no multi-touch screen.
  else if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) device = 'ipad';
  else if (/Android/.test(ua)) device = 'android';
  else if (/Macintosh|Mac OS X/.test(ua)) device = 'mac';
  else device = 'windows'; // Windows, Linux and ChromeOS all follow the Chromium desktop steps

  let browser: BrowserId = 'other';
  if (/SamsungBrowser/.test(ua)) browser = 'samsung';
  else if (/EdgiOS|EdgA|Edg\//.test(ua)) browser = 'edge';
  else if (/OPR\/|OPiOS|Opera/.test(ua)) browser = 'opera';
  else if (/FxiOS|Firefox\//.test(ua)) browser = 'firefox';
  else if ((navigator as Navigator & { brave?: unknown }).brave) browser = 'brave';
  else if (/CriOS|Chrome\//.test(ua)) browser = 'chrome';
  else if (/Safari\//.test(ua)) browser = 'safari';

  return { device, browser };
}

/** True when the page is running as an installed app (no browser chrome). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: window-controls-overlay)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/* ------------------------------------------------------------------ */
/* Install prompt capture                                              */
/* ------------------------------------------------------------------ */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PwaState {
  /** A native install prompt has been captured and can be shown on click. */
  canPrompt: boolean;
  /** The app is installed (or is currently running as the installed app). */
  installed: boolean;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let state: PwaState = { canPrompt: false, installed: false };
let started = false;
const listeners = new Set<() => void>();

function setState(next: Partial<PwaState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

/**
 * Must run once, early (main.tsx). Chromium fires `beforeinstallprompt`
 * a single time shortly after load — long before the profile menu is ever
 * opened — so it has to be captured at module level, not inside a component.
 */
export function initPwaInstallCapture() {
  if (started || typeof window === 'undefined') return;
  started = true;
  state = { canPrompt: false, installed: isStandalone() };

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // keep the browser's mini-infobar out of the way; we show it on demand
    deferredPrompt = event as BeforeInstallPromptEvent;
    setState({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    setState({ canPrompt: false, installed: true });
  });
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', (e) => {
    if (e.matches) setState({ installed: true });
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => state;

/** Opens the browser's own install dialog. Returns true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const event = deferredPrompt;
  deferredPrompt = null; // a captured prompt can only be used once
  setState({ canPrompt: false });
  try {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === 'accepted') setState({ installed: true });
    return choice.outcome === 'accepted';
  } catch {
    return false;
  }
}

export function usePwaState(): PwaState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export type NotificationSupport = 'unsupported' | 'default' | 'granted' | 'denied';

export function readNotificationSupport(): NotificationSupport {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotificationSupport;
}

/**
 * iPhone/iPad only expose the Notification API to an app that was added to
 * the Home Screen — inside a normal Safari tab it simply does not exist.
 */
export function needsInstallForNotifications(env: Environment): boolean {
  return (env.device === 'iphone' || env.device === 'ipad') && !isStandalone();
}

/** Shows a one-off local confirmation (no server, no database). */
async function showWelcomeNotification() {
  const title = 'Notifications are on';
  const options = { body: "You'll get a heads-up here when something new happens.", tag: 'sc-notifications-enabled' };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  } catch {
    // best-effort confirmation only
  }
}

/** Must be called from a click/tap handler (browsers block it otherwise). */
export async function requestNotificationPermission(): Promise<NotificationSupport> {
  if (!('Notification' in window)) return 'unsupported';
  try {
    const result = (await Notification.requestPermission()) as NotificationSupport;
    if (result === 'granted') void showWelcomeNotification();
    return result;
  } catch {
    return readNotificationSupport();
  }
}

/** Shared by the profile-menu section and the guide dialog. */
export function useInstallAction(onNeedGuide: () => void) {
  const pwa = usePwaState();
  const run = useCallback(async () => {
    if (state.installed) return;
    if (deferredPrompt) {
      await promptInstall();
    } else {
      // iOS/iPadOS, Safari on Mac and Firefox never expose an install
      // prompt to websites — show the exact steps for this device instead.
      onNeedGuide();
    }
  }, [onNeedGuide]);
  return { ...pwa, run };
}
