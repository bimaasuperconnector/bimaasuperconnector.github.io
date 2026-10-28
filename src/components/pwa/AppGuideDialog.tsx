import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon, CloseIcon, InstallAppIcon, BellRequestIcon } from '../icons/NavIcons';
import { detectEnvironment, isStandalone, type BrowserId, type DeviceId } from '../../lib/pwa';
import { GUIDES, guideFor, pickBrowser } from './guides';
import type { AppActions, GuideTab } from './useAppActions';

/**
 * Full "Get the app" guide: pick your device and browser, then follow
 * illustrated, numbered steps for installing and for turning on
 * notifications. Opens on the visitor's own device/browser by default.
 */
export function AppGuideDialog({
  onClose,
  initialTab,
  actions,
}: {
  onClose: () => void;
  initialTab: GuideTab;
  actions: AppActions;
}) {
  const [env] = useState(detectEnvironment);
  const [device, setDevice] = useState<DeviceId>(env.device);
  const [browser, setBrowser] = useState<BrowserId>(() => pickBrowser(guideFor(env.device), env.browser));
  const [tab, setTab] = useState<GuideTab>(initialTab);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Modal behaviour: focus in, Escape out, Tab trapped, page scroll locked, focus restored.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const guide = guideFor(device);
  const browserGuide = guide.browsers.find((b) => b.id === browser) ?? guide.browsers[0];
  const steps = tab === 'install' ? browserGuide.steps : guide.notifications.steps;
  const note = tab === 'install' ? browserGuide.note : guide.notifications.note;
  const detectedLabel = `${guideFor(env.device).label}`;
  const standalone = isStandalone();

  const chooseDevice = (id: DeviceId) => {
    setDevice(id);
    setBrowser(pickBrowser(guideFor(id), id === env.device ? env.browser : 'chrome'));
  };

  const { install, notif, enableNotifications } = actions;

  return createPortal(
    <div className="fade-enter fixed inset-0 z-[80] flex items-end justify-center bg-ink/40 md:items-center md:p-lg">
      <div className="absolute inset-0" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-guide-title"
        className="sheet-enter relative flex h-[100dvh] w-full flex-col bg-canvas md:h-auto md:max-h-[90vh] md:max-w-3xl md:rounded-lg md:shadow-[0_24px_64px_rgba(24,29,38,0.28)]"
      >
        <header className="flex items-start justify-between gap-sm border-b border-hairline px-md py-md md:px-lg">
          <div>
            <h2 id="app-guide-title" className="font-haas-disp text-title-lg text-ink">
              Get the SuperConnector app
            </h2>
            <p className="mt-xxs text-body-md text-muted">
              Add it to your device like any other app, then switch on notifications. You’re on{' '}
              <span className="font-medium text-ink">{detectedLabel}</span>.
            </p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close guide" className="icon-btn -mr-xs">
            <CloseIcon />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-md py-md pb-safe md:px-lg">
          {/* Quick actions */}
          <div className="flex flex-col gap-xs sm:flex-row">
            <button
              type="button"
              disabled={install.installed || standalone}
              onClick={() => void install.run()}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-xs rounded-lg bg-primary px-lg text-button font-medium text-on-primary transition-colors duration-150 active:bg-primary-active disabled:cursor-not-allowed disabled:opacity-60"
            >
              {install.installed || standalone ? <CheckIcon /> : <InstallAppIcon />}
              {install.installed || standalone ? 'App installed' : 'Install app on this device'}
            </button>
            <button
              type="button"
              disabled={notif === 'granted'}
              onClick={() => void enableNotifications()}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-xs rounded-lg border border-hairline bg-canvas px-lg text-button font-medium text-ink transition-colors duration-150 hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {notif === 'granted' ? <CheckIcon /> : <BellRequestIcon />}
              {notif === 'granted' ? 'Notifications on' : 'Enable notifications'}
            </button>
          </div>

          {/* Device */}
          <p className="mb-xs mt-lg text-caption font-medium uppercase tracking-wide text-muted">Your device</p>
          <div role="tablist" aria-label="Device" className="no-scrollbar -mx-md flex gap-xs overflow-x-auto px-md md:mx-0 md:px-0">
            {GUIDES.map((g) => (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={device === g.id}
                onClick={() => chooseDevice(g.id)}
                className="tab-chip shrink-0"
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Browser (install only) */}
          {tab === 'install' && (
            <>
              <p className="mb-xs mt-md text-caption font-medium uppercase tracking-wide text-muted">Your browser</p>
              <div role="tablist" aria-label="Browser" className="no-scrollbar -mx-md flex gap-xs overflow-x-auto px-md md:mx-0 md:px-0">
                {guide.browsers.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    role="tab"
                    aria-selected={browserGuide.id === b.id}
                    onClick={() => setBrowser(b.id)}
                    className="tab-chip shrink-0"
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Install / notifications */}
          <div role="tablist" aria-label="Guide section" className="mt-lg flex gap-xs border-b border-hairline">
            {(
              [
                ['install', 'Install the app'],
                ['notifications', 'Turn on notifications'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`-mb-px min-h-[44px] border-b-2 px-sm text-label-md transition-colors duration-150 ${
                  tab === id ? 'border-ink text-ink' : 'border-transparent text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {note && (
            <div role="note" className="mt-md rounded-md bg-signature-cream px-md py-sm text-body-md text-ink" style={{ lineHeight: 1.5 }}>
              {note}
            </div>
          )}

          <ol className="mt-lg flex flex-col gap-xl">
            {steps.map((step, i) => (
              <li key={`${device}-${browser}-${tab}-${i}`} className="grid gap-md md:grid-cols-2 md:items-center">
                <div className="flex gap-sm">
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-body-md font-medium text-on-primary"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-haas text-label-md font-medium text-ink">{step.title}</h3>
                    <p className="copy mt-xxs">{step.body}</p>
                  </div>
                </div>
                {step.art && <div className="mx-auto w-full max-w-[360px]">{step.art}</div>}
              </li>
            ))}
          </ol>

          {tab === 'notifications' && (
            <div className="mt-xl rounded-lg bg-surface-soft p-md">
              <p className="text-label-md font-medium text-ink">Blocked it by mistake?</p>
              <p className="copy mt-xxs">{guide.notifications.blocked}</p>
            </div>
          )}

          <p className="mt-xl text-caption text-muted">
            The pictures are simplified illustrations. Your browser’s buttons may look slightly different, but the coral
            outline always marks what to tap or click.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
