import { BellRequestIcon, CheckIcon, GuideIcon, InstallAppIcon } from '../icons/NavIcons';
import { isStandalone } from '../../lib/pwa';
import type { AppActions, GuideTab } from './useAppActions';

/**
 * The "App" section of the profile-photo popup: install the site as an app,
 * enable notifications, or open the illustrated step-by-step guide.
 */
export function AppSection({
  actions,
  itemClass,
  onOpenGuide,
  onCloseMenu,
}: {
  actions: AppActions;
  itemClass: string;
  onOpenGuide: (tab: GuideTab) => void;
  onCloseMenu: () => void;
}) {
  const { install, notif, notifMessage, enableNotifications } = actions;
  const installed = install.installed || isStandalone();

  const notifSub =
    notifMessage ??
    (notif === 'granted'
      ? 'On for this device'
      : notif === 'denied'
        ? 'Blocked — tap to see how to turn on'
        : 'Get a heads-up on this device');

  return (
    <div role="group" aria-label="App">
      <p className="px-sm pb-xxs pt-xs text-caption font-medium uppercase tracking-wide text-muted">App</p>

      <button
        type="button"
        role="menuitem"
        disabled={installed}
        onClick={() => {
          onCloseMenu();
          void install.run();
        }}
        className={`${itemClass} disabled:cursor-default disabled:opacity-100`}
      >
        {installed ? <CheckIcon /> : <InstallAppIcon />}
        <span className="min-w-0">
          <span className="block">{installed ? 'App installed' : 'Install app'}</span>
          <span className="block truncate text-caption text-muted">
            {installed ? 'You’re using the installed app' : 'Add to your home screen or desktop'}
          </span>
        </span>
      </button>

      <button
        type="button"
        role="menuitem"
        disabled={notif === 'granted'}
        onClick={() => void enableNotifications()}
        className={`${itemClass} disabled:cursor-default disabled:opacity-100`}
      >
        {notif === 'granted' ? <CheckIcon /> : <BellRequestIcon width={20} height={20} />}
        <span className="min-w-0">
          <span className="block">{notif === 'granted' ? 'Notifications on' : 'Enable notifications'}</span>
          <span className="block text-caption text-muted">{notifSub}</span>
        </span>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onCloseMenu();
          onOpenGuide('install');
        }}
        className={itemClass}
      >
        <GuideIcon />
        <span className="min-w-0">
          <span className="block">Setup guide</span>
          <span className="block text-caption text-muted">iPhone, iPad, Android, Windows, Mac</span>
        </span>
      </button>
    </div>
  );
}
