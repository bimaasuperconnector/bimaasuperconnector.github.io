import type { ReactNode } from 'react';
import type { BrowserId, DeviceId } from '../../lib/pwa';
import {
  AndroidBrowser,
  AndroidInstallDialog,
  DesktopAddressInstall,
  DesktopAppResult,
  DesktopInstallDialog,
  DesktopMenu,
  HomeScreenResult,
  IpadAddScreen,
  IpadBrowser,
  IpadShareSheet,
  IphoneAddScreen,
  IphoneBrowser,
  IphoneShareSheet,
  MacAddToDock,
  MacSafariFileMenu,
  NotificationBanner,
  NotificationPromptDesktop,
  NotificationPromptMobile,
} from './illustrations';

export interface Step {
  title: string;
  body: string;
  art?: ReactNode;
}

export interface BrowserGuide {
  id: BrowserId;
  label: string;
  /** Shown above the steps, e.g. "Firefox can't install web apps on desktop". */
  note?: string;
  steps: Step[];
}

export interface DeviceGuide {
  id: DeviceId;
  label: string;
  browsers: BrowserGuide[];
  notifications: { note?: string; steps: Step[]; blocked: string };
}

const openApp = (where: string): Step => ({
  title: 'Open the app',
  body: `Open SuperConnector from ${where}. It now runs in its own window without browser bars, and you stay signed in.`,
});

/* ------------------------------ iPhone / iPad ------------------------------ */

function iosSteps(kind: 'iphone' | 'ipad', browser: BrowserId): Step[] {
  const isPhone = kind === 'iphone';
  const first: Step =
    browser === 'safari'
      ? isPhone
        ? { title: 'Tap the Share button', body: 'In Safari, tap the Share icon (a square with an arrow) in the bottom toolbar.', art: <IphoneBrowser variant="bottom" /> }
        : { title: 'Tap the Share button', body: 'In Safari, tap the Share icon (a square with an arrow) at the top right of the toolbar.', art: <IpadBrowser /> }
      : browser === 'chrome'
        ? isPhone
          ? { title: 'Tap the Share icon', body: 'In Chrome, tap the Share icon next to the address bar. If you don’t see it, tap ⋯ then Share.', art: <IphoneBrowser variant="top" /> }
          : { title: 'Tap the Share icon', body: 'In Chrome, tap the Share icon at the top right, next to the address bar.', art: <IpadBrowser /> }
        : isPhone
          ? { title: 'Open the menu, then Share', body: `In ${browser === 'edge' ? 'Edge' : 'Firefox'}, tap the ⋯ (or ≡) menu, then choose Share.`, art: <IphoneBrowser variant="menu" /> }
          : { title: 'Open the menu, then Share', body: `In ${browser === 'edge' ? 'Edge' : 'Firefox'}, open the menu and choose Share (or the Share icon in the toolbar).`, art: <IpadBrowser /> };

  return [
    first,
    {
      title: 'Choose “Add to Home Screen”',
      body: 'Scroll the list until you see Add to Home Screen. On iOS 26 you may need to tap View More (⋯) first. If it isn’t listed, open this page in Safari and try again.',
      art: isPhone ? <IphoneShareSheet /> : <IpadShareSheet />,
    },
    {
      title: 'Tap “Add”',
      body: 'Leave “Open as Web App” switched on (it’s on by default), keep the name SuperConnector, then tap Add.',
      art: isPhone ? <IphoneAddScreen /> : <IpadAddScreen />,
    },
    {
      ...openApp('the new icon on your Home Screen'),
      body: 'Always open SuperConnector from the Home Screen icon. It runs full-screen like a regular app, and this is also what lets iOS ask about notifications.',
      art: <HomeScreenResult device={isPhone ? 'phone' : 'tablet'} />,
    },
  ];
}

function iosGuide(kind: 'iphone' | 'ipad'): DeviceGuide {
  const isPhone = kind === 'iphone';
  const browsers: BrowserId[] = ['safari', 'chrome', 'edge', 'firefox'];
  const labels: Record<string, string> = { safari: 'Safari', chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox' };
  return {
    id: kind,
    label: isPhone ? 'iPhone' : 'iPad',
    browsers: browsers.map((b) => ({
      id: b,
      label: labels[b],
      note: b === 'safari' ? undefined : 'Needs iOS/iPadOS 16.4 or newer. If “Add to Home Screen” is missing, use Safari — it always has it.',
      steps: iosSteps(kind, b),
    })),
    notifications: {
      note: 'On iPhone and iPad, notifications only work for the app added to your Home Screen (iOS/iPadOS 16.4 or newer). They can’t be switched on from a normal Safari tab.',
      steps: [
        { title: 'Launch from the Home Screen icon', body: 'Close Safari and open SuperConnector from its Home Screen icon (see the install steps above).' },
        { title: 'Open the profile menu → App', body: 'Tap your profile photo at the top right, then tap Enable notifications.' },
        { title: 'Tap “Allow”', body: 'iOS will ask for permission. Tap Allow.', art: <NotificationPromptMobile /> },
        { title: 'You’re set', body: 'Notifications from SuperConnector now appear on your lock screen and Notification Centre.', art: <NotificationBanner /> },
      ],
      blocked: 'Open Settings → Notifications → SuperConnector and switch on Allow Notifications.',
    },
  };
}

/* ------------------------------ Android ------------------------------ */

const androidResult = (): Step => ({
  ...openApp('your Home screen or app drawer'),
  art: <HomeScreenResult device="phone" />,
});

function androidGuide(): DeviceGuide {
  return {
    id: 'android',
    label: 'Android',
    browsers: [
      {
        id: 'chrome',
        label: 'Chrome',
        steps: [
          { title: 'Tap the ⋮ menu', body: 'Tap the three dots at the top right of Chrome.', art: <AndroidBrowser position="top" icon="dots" open={false} items={[]} hl={0} tag="Tap ⋮" /> },
          { title: 'Choose “Install app”', body: 'Tap Install app. On some versions it’s called Add to Home screen, then Install.', art: <AndroidBrowser position="top" icon="dots" open items={['New tab', 'History', 'Install app', 'Settings']} hl={2} tag="Install app" /> },
          { title: 'Confirm', body: 'Tap Install in the pop-up. The icon is added to your Home screen and app drawer.', art: <AndroidInstallDialog /> },
          androidResult(),
        ],
      },
      {
        id: 'samsung',
        label: 'Samsung Internet',
        steps: [
          { title: 'Tap the ≡ menu', body: 'Tap the three-line menu at the bottom right.', art: <AndroidBrowser position="bottom" icon="bars" open={false} items={[]} hl={0} tag="Tap ≡" /> },
          { title: 'Choose “Add page to”', body: 'Tap Add page to, then Home screen (or Apps screen). If you see an install icon in the address bar, you can tap that instead.', art: <AndroidBrowser position="bottom" icon="bars" open items={['Bookmarks', 'Add page to', 'Share', 'Settings']} hl={1} tag="Add page to" /> },
          { title: 'Confirm', body: 'Tap Add (or Install) to finish.', art: <AndroidInstallDialog primary="Add" /> },
          androidResult(),
        ],
      },
      {
        id: 'edge',
        label: 'Edge',
        steps: [
          { title: 'Tap the ≡ menu', body: 'Tap the three-line menu at the bottom of Edge.', art: <AndroidBrowser position="bottom" icon="bars" open={false} items={[]} hl={0} tag="Tap ≡" /> },
          { title: 'Choose “Add to phone”', body: 'Tap Add to phone (it may appear as Install).', art: <AndroidBrowser position="bottom" icon="bars" open items={['Downloads', 'Add to phone', 'Share', 'Settings']} hl={1} tag="Add to phone" /> },
          { title: 'Confirm', body: 'Tap Install in the pop-up.', art: <AndroidInstallDialog /> },
          androidResult(),
        ],
      },
      {
        id: 'firefox',
        label: 'Firefox',
        steps: [
          { title: 'Tap the ⋮ menu', body: 'Tap the three dots at the top right of Firefox.', art: <AndroidBrowser position="top" icon="dots" open={false} items={[]} hl={0} tag="Tap ⋮" /> },
          { title: 'Choose “Install”', body: 'Tap Install, then Add to Home screen if asked.', art: <AndroidBrowser position="top" icon="dots" open items={['New tab', 'Bookmarks', 'Install', 'Settings']} hl={2} tag="Install" /> },
          { title: 'Confirm', body: 'Tap Add to finish.', art: <AndroidInstallDialog primary="Add" /> },
          androidResult(),
        ],
      },
    ],
    notifications: {
      steps: [
        { title: 'Open the profile menu → App', body: 'Tap your profile photo at the top right, then tap Enable notifications.' },
        { title: 'Tap “Allow”', body: 'Your browser asks for permission. Tap Allow.', art: <NotificationPromptMobile /> },
        { title: 'You’re set', body: 'Notifications now appear in your status bar and notification shade.', art: <NotificationBanner /> },
      ],
      blocked: 'Touch and hold the SuperConnector icon → App info → Notifications and switch them on. In the browser you can also use ⋮ → Settings → Site settings → Notifications.',
    },
  };
}

/* ------------------------------ Windows / Mac ------------------------------ */

function desktopNotifications(os: 'windows' | 'mac'): DeviceGuide['notifications'] {
  return {
    steps: [
      { title: 'Open the profile menu → App', body: 'Click your profile photo at the top right, then click Enable notifications.' },
      { title: 'Click “Allow”', body: 'Your browser asks for permission just under the address bar. Click Allow.', art: <NotificationPromptDesktop os={os} /> },
      { title: 'You’re set', body: os === 'windows' ? 'Notifications appear at the bottom right and in the Action Centre.' : 'Notifications appear at the top right and in Notification Centre.', art: <NotificationBanner /> },
    ],
    blocked:
      os === 'windows'
        ? 'Click the icon left of the address (lock or sliders) → Notifications → Allow. Also check Windows Settings → System → Notifications that your browser is on.'
        : 'Click the icon left of the address → Notifications → Allow. Also check System Settings → Notifications that your browser or the SuperConnector app is allowed.',
  };
}

function chromiumDesktop(os: 'windows' | 'mac', id: 'chrome' | 'edge' | 'brave'): BrowserGuide {
  const isEdge = id === 'edge';
  const label = id === 'chrome' ? 'Chrome' : id === 'edge' ? 'Edge' : 'Brave';
  return {
    id,
    label,
    steps: [
      {
        title: 'Click the install icon',
        body: isEdge
          ? 'At the right end of the address bar, click the App available icon (a small box with a plus).'
          : 'At the right end of the address bar, click the install icon (a screen with a down arrow).',
        art: <DesktopAddressInstall os={os} glyph={isEdge ? 'plus' : 'monitor'} />,
      },
      {
        title: 'Or use the menu',
        body: isEdge
          ? 'No icon? Click ⋯ → Apps → Install this site as an app.'
          : 'No icon? Click ⋮ → Cast, save and share → Install page as app (some versions say Install SuperConnector).',
        art: <DesktopMenu os={os} parent={isEdge ? 'Apps' : 'Cast, save and share'} child={isEdge ? 'Install this site as an app' : 'Install page as app…'} />,
      },
      { title: 'Click “Install”', body: 'Confirm in the pop-up. SuperConnector opens in its own window.', art: <DesktopInstallDialog os={os} /> },
      {
        title: 'Find and pin it',
        body:
          os === 'windows'
            ? 'It’s now in your Start menu. Right-click its taskbar icon and choose Pin to taskbar to keep it handy.'
            : 'It’s now in your Applications folder and Dock. Keep it in the Dock for one-click access.',
        art: <DesktopAppResult os={os} />,
      },
    ],
  };
}

const firefoxDesktop: BrowserGuide = {
  id: 'firefox',
  label: 'Firefox',
  note: 'Firefox on desktop can’t install web apps. Open SuperConnector in Edge or Chrome to install it. You can still use it in Firefox as a normal website, and bookmark it.',
  steps: [
    { title: 'Switch browser to install', body: 'Copy the address bimaasuperconnector.github.io into Edge or Chrome, then follow that browser’s steps.' },
    { title: 'Prefer to stay in Firefox?', body: 'Press Ctrl+D (Cmd+D on Mac) to bookmark it. You can also pin the tab: right-click the tab → Pin Tab.' },
  ],
};

function windowsGuide(): DeviceGuide {
  return {
    id: 'windows',
    label: 'Windows',
    browsers: [chromiumDesktop('windows', 'edge'), chromiumDesktop('windows', 'chrome'), chromiumDesktop('windows', 'brave'), firefoxDesktop],
    notifications: desktopNotifications('windows'),
  };
}

function macGuide(): DeviceGuide {
  return {
    id: 'mac',
    label: 'Mac',
    browsers: [
      {
        id: 'safari',
        label: 'Safari',
        note: 'Needs macOS Sonoma (14) or newer with Safari 17+.',
        steps: [
          { title: 'Open the File menu', body: 'In the menu bar, click File, then Add to Dock… (You can also click the Share button in the toolbar and pick Add to Dock.)', art: <MacSafariFileMenu /> },
          { title: 'Click “Add”', body: 'Keep the name SuperConnector and click Add.', art: <MacAddToDock /> },
          { title: 'Open it from the Dock', body: 'SuperConnector now opens as its own app, without Safari’s toolbar. It’s also in your Applications folder.', art: <DesktopAppResult os="mac" /> },
        ],
      },
      chromiumDesktop('mac', 'chrome'),
      chromiumDesktop('mac', 'edge'),
      chromiumDesktop('mac', 'brave'),
      firefoxDesktop,
    ],
    notifications: desktopNotifications('mac'),
  };
}

export const GUIDES: DeviceGuide[] = [iosGuide('iphone'), iosGuide('ipad'), androidGuide(), windowsGuide(), macGuide()];

export function guideFor(device: DeviceId): DeviceGuide {
  return GUIDES.find((g) => g.id === device) ?? GUIDES[0];
}

/** Best matching browser tab for the detected browser on a device. */
export function pickBrowser(guide: DeviceGuide, browser: BrowserId): BrowserId {
  if (guide.browsers.some((b) => b.id === browser)) return browser;
  if (guide.browsers.some((b) => b.id === 'chrome')) return 'chrome';
  return guide.browsers[0].id;
}
