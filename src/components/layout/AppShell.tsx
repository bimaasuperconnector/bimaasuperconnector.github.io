import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserRecord } from '../../context/UserRecordContext';
import { OwnProfileProvider, useOwnProfile } from '../../context/OwnProfileContext';
import { NotificationsIcon, MoreIcon, CloseIcon } from '../icons/NavIcons';
import { ADMIN_NAV_ITEM, BOTTOM_NAV_PATHS, NAV_ITEMS, type NavItem } from './navItems';
import { AccountMenu } from './AccountMenu';
import { HeaderSearch } from './HeaderSearch';
import { NotificationsPane } from '../notifications/NotificationsPane';
import { useNotificationsFeed } from '../notifications/useNotificationsFeed';

/** Returns to the top of the page whenever the signed-in route changes. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function BrandMark() {
  return (
    <Link
      to="/app"
      aria-label="BIM AA, home"
      className="flex shrink-0 items-center gap-sm rounded-lg text-ink"
    >
      {/* Same logo asset and wordmark as the public landing header, with the
          12px corner radius the site's buttons use. */}
      <img
        src="/assets/branding/logo-192.png"
        width={32}
        height={32}
        alt=""
        className="h-8 w-8 shrink-0 rounded-lg"
      />
      <span aria-hidden="true" className="whitespace-nowrap font-haas-disp text-title-sm font-medium text-ink">
        BIM&nbsp;AA
      </span>
    </Link>
  );
}

function SideNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Main"
      className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[232px] shrink-0 overflow-y-auto border-r border-hairline p-md md:block"
    >
      <ul className="space-y-xxs">
        {items.map((item) => (
          <li key={item.to}>
            {item.disabled ? (
              <span
                aria-disabled="true"
                title="Available once your application is approved"
                className="flex min-h-[44px] cursor-not-allowed items-center gap-sm rounded-lg px-sm text-body-md text-border-strong opacity-60"
              >
                <item.Icon />
                {item.label}
              </span>
            ) : (
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center gap-sm rounded-lg px-sm text-body-md transition-colors duration-150 ${
                    isActive
                      ? 'bg-surface-strong/60 font-medium text-ink'
                      : 'text-body hover:bg-surface-soft hover:text-ink active:bg-surface-strong/60'
                  }`
                }
              >
                <item.Icon />
                {item.label}
              </NavLink>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Phone-only bottom bar: four pinned destinations + a "More" sheet for the rest. */
function BottomNav({ items, pinnedPaths = BOTTOM_NAV_PATHS }: { items: NavItem[]; pinnedPaths?: string[] }) {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);

  const pinned = pinnedPaths.map((to) => items.find((i) => i.to === to)).filter(Boolean) as NavItem[];
  const rest = items.filter((i) => !pinnedPaths.includes(i.to));
  const moreActive = rest.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`));

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoreOpen(false);
        moreTriggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const tabClass = (active: boolean) =>
    `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-[2px] text-[11px] leading-tight transition-colors duration-150 ${
      active ? 'font-medium text-ink' : 'text-muted'
    }`;
  const iconWrap = (active: boolean) =>
    `flex h-8 w-14 items-center justify-center rounded-lg transition-colors duration-150 ${
      active ? 'bg-surface-strong/70' : ''
    }`;

  return (
    <>
      <nav
        aria-label="Main"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas md:hidden"
      >
        <ul className="mx-auto flex max-w-[560px] items-stretch">
          {pinned.map((item) => (
            <li key={item.to} className="flex flex-1">
              {item.disabled ? (
                <span aria-disabled="true" className={`${tabClass(false)} cursor-not-allowed text-border-strong opacity-60`}>
                  <span className={iconWrap(false)}>
                    <item.Icon width={22} height={22} />
                  </span>
                  {item.label === 'SuperConnector' ? 'Connect' : item.label}
                </span>
              ) : (
                <NavLink to={item.to} end={item.end} className={({ isActive }) => tabClass(isActive)}>
                  {({ isActive }) => (
                    <>
                      <span className={iconWrap(isActive)}>
                        <item.Icon width={22} height={22} />
                      </span>
                      {item.label === 'SuperConnector' ? 'Connect' : item.label}
                    </>
                  )}
                </NavLink>
              )}
            </li>
          ))}
          <li className="flex flex-1">
            <button
              ref={moreTriggerRef}
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={tabClass(moreActive || moreOpen)}
            >
              <span className={iconWrap(moreActive || moreOpen)}>
                <MoreIcon width={22} height={22} />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div aria-hidden="true" onClick={() => setMoreOpen(false)} className="fade-enter absolute inset-0 bg-ink/40" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More destinations"
            className="sheet-enter pb-safe absolute inset-x-0 bottom-0 rounded-t-lg bg-canvas p-md shadow-[0_-12px_32px_rgba(24,29,38,0.18)]"
          >
            <div className="flex items-center justify-between px-xs">
              <h2 className="font-haas-disp text-title-sm font-medium text-ink">More</h2>
              <button
                ref={closeRef}
                type="button"
                className="icon-btn"
                aria-label="Close menu"
                onClick={() => {
                  setMoreOpen(false);
                  moreTriggerRef.current?.focus();
                }}
              >
                <CloseIcon />
              </button>
            </div>
            <ul className="mt-xs grid grid-cols-2 gap-sm">
              {rest.map((item) => (
                <li key={item.to}>
                  {item.disabled ? (
                    <span
                      aria-disabled="true"
                      className="flex min-h-[64px] cursor-not-allowed items-center gap-sm rounded-lg border border-hairline px-md text-body-md text-border-strong opacity-60"
                    >
                      <item.Icon />
                      {item.label}
                    </span>
                  ) : (
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `flex min-h-[64px] items-center gap-sm rounded-lg border px-md text-body-md transition-colors duration-150 active:bg-surface-strong ${
                          isActive ? 'border-primary bg-surface-soft text-ink' : 'border-hairline text-ink'
                        }`
                      }
                    >
                      <item.Icon />
                      {item.label}
                    </NavLink>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

function ShellContents() {
  const { user, signOutUser } = useAuth();
  const { record } = useUserRecord();
  const { profile } = useOwnProfile();
  const { pathname } = useLocation();
  const isPending = record?.status === 'pending';
  // A pending applicant has no access to notifications (no read/count calls are made for them).
  const feed = useNotificationsFeed(isPending ? undefined : user?.uid);
  const [paneOpen, setPaneOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);

  const isAnyAdmin = record?.role === 'super_admin' || record?.role === 'batch_admin';
  const items: NavItem[] = isPending
    ? NAV_ITEMS.map((item) => ({ ...item, disabled: item.to !== '/app/profile' }))
    : isAnyAdmin
      ? [...NAV_ITEMS, ADMIN_NAV_ITEM]
      : NAV_ITEMS;
  // For a pending applicant the profile is the only live destination, so pin it first.
  const pinnedPaths = isPending
    ? ['/app/profile', '/app', '/app/directory', '/app/superconnector']
    : BOTTOM_NAV_PATHS;

  const openPane = useCallback(() => {
    setPaneOpen(true);
    feed.markOpened();
  }, [feed.markOpened]);
  const closePane = useCallback(() => {
    setPaneOpen(false);
    bellRef.current?.focus();
  }, []);

  // Route changes dismiss the pane without stealing focus.
  useEffect(() => {
    setPaneOpen(false);
  }, [pathname]);

  const name = profile?.displayName || record?.displayName || user?.displayName || 'Your account';
  const email = user?.email ?? record?.email ?? '';

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* Accessibility: a real skip link so keyboard/screen-reader users can
          jump past the header and navigation on every page. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-lg focus:top-lg focus:z-[70] focus:rounded-sm focus:bg-primary focus:px-md focus:py-sm focus:text-on-primary"
      >
        Skip to content
      </a>
      <ScrollToTop />

      <header className="sticky top-0 z-50 border-b border-hairline bg-canvas">
        <div className="mx-auto flex h-16 w-full max-w-content items-center gap-xs px-md md:gap-md md:px-lg">
          <BrandMark />
          {isPending ? <div className="flex-1" /> : <HeaderSearch />}

          {!isPending && (
          <button
            ref={bellRef}
            type="button"
            onClick={() => (paneOpen ? closePane() : openPane())}
            aria-haspopup="dialog"
            aria-expanded={paneOpen}
            aria-label={feed.unread > 0 ? `Notifications, ${feed.unread > 9 ? 'more than 9' : feed.unread} new` : 'Notifications'}
            className="icon-btn"
          >
            <NotificationsIcon width={22} height={22} />
            {feed.unread > 0 && (
              <span
                aria-hidden="true"
                className="absolute right-[6px] top-[6px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-signature-coral px-[5px] text-[11px] font-medium leading-none text-on-primary ring-2 ring-canvas"
              >
                {feed.unread > 9 ? '9+' : feed.unread}
              </span>
            )}
          </button>
          )}

          <AccountMenu
            photoURL={profile?.photoURL ?? null}
            name={name}
            email={email}
            isAdmin={isAnyAdmin}
            onSignOut={() => void signOutUser()}
          />
        </div>
      </header>

      {!isPending && <NotificationsPane open={paneOpen} onClose={closePane} feed={feed} />}

      {isPending && (
        <div role="status" className="border-b border-hairline bg-signature-cream">
          <p className="mx-auto w-full max-w-content px-md py-sm text-body-md text-ink md:px-lg">
            <span className="font-medium">Pending approval.</span> Complete your profile so your batch
            representative can recognise you. Everything else unlocks once you're approved.
          </p>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-content flex-1">
        <SideNav items={items} />
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 px-md pb-[calc(88px+env(safe-area-inset-bottom,0px))] pt-lg outline-none md:px-xl md:pb-xxl md:pt-xl"
        >
          {/* Keyed on the path so each page eases in on navigation. */}
          <div key={`${pathname}:${record?.status ?? ''}`} className="page-enter mx-auto w-full max-w-[1040px]">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav items={items} pinnedPaths={pinnedPaths} />
    </div>
  );
}

export function AppShell() {
  const { user } = useAuth();
  const { record } = useUserRecord();
  return (
    <OwnProfileProvider uid={user?.uid} source={record?.status === 'pending' ? 'pending' : 'profile'}>
      <ShellContents />
    </OwnProfileProvider>
  );
}

