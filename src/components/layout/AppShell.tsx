import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Container } from '../ui/Container';
import { Avatar } from '../ui/Avatar';
import { subscribeToProfile } from '../../firebase/repositories/profilesRepository';
import { useAuth } from '../../context/AuthContext';
import { useUserRecord } from '../../context/UserRecordContext';
import {
  HomeIcon,
  ProfileIcon,
  DirectoryIcon,
  SuperConnectorIcon,
  JobsIcon,
  OpenToWorkIcon,
  EventsIcon,
  EntrepreneurshipIcon,
  NotificationsIcon,
  AdminIcon,
} from '../icons/NavIcons';

const navItems = [
  { to: '/app', label: 'Home', end: true, Icon: HomeIcon },
  { to: '/app/profile', label: 'Profile', Icon: ProfileIcon },
  { to: '/app/directory', label: 'Directory', Icon: DirectoryIcon },
  { to: '/app/superconnector', label: 'SuperConnector', Icon: SuperConnectorIcon },
  { to: '/app/jobs', label: 'Jobs', Icon: JobsIcon },
  { to: '/app/open-to-work', label: 'Open to Work', Icon: OpenToWorkIcon },
  { to: '/app/events', label: 'Events', Icon: EventsIcon },
  { to: '/app/entrepreneurship', label: 'Entrepreneurship', Icon: EntrepreneurshipIcon },
  { to: '/app/notifications', label: 'Notifications', Icon: NotificationsIcon },
];

export function AppShell() {
  const { user, signOutUser } = useAuth();
  const { record } = useUserRecord();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // The member's own UPLOADED photo (never their Google picture). One live
  // listener on their own profile document: one read at sign-in, then one
  // per change, so the header updates the moment a new photo is saved.
  const [ownPhotoURL, setOwnPhotoURL] = useState<string | null>(null);
  const ownUid = user?.uid;
  useEffect(() => {
    if (!ownUid) return;
    return subscribeToProfile(ownUid, (profile) => setOwnPhotoURL(profile?.photoURL ?? null));
  }, [ownUid]);

  const isAnyAdmin = record?.role === 'super_admin' || record?.role === 'batch_admin';
  const items = isAnyAdmin
    ? [...navItems, { to: '/app/admin', label: 'Admin', end: false, Icon: AdminIcon }]
    : navItems;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* Accessibility: a real skip link, per SECURITY_AND_TESTING.md's
          "screen-reader semantics for important controls" test category
          — keyboard/screen-reader users can jump straight past the
          nav instead of tabbing through 9-10 links on every page. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-lg focus:top-lg focus:z-10 focus:rounded-sm focus:bg-primary focus:px-md focus:py-sm focus:text-on-primary"
      >
        Skip to content
      </a>
      <header className="border-b border-hairline">
        <Container className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-sm">
            {/* Mobile-only menu toggle. Fixes a real bug: the sidebar
                nav below is `hidden` under the md breakpoint with no
                mobile equivalent at all, so every tab past Home was
                completely unreachable on a phone. */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              className="-ml-xs flex h-10 w-10 items-center justify-center rounded-sm text-ink md:hidden"
            >
              {mobileMenuOpen ? (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
                </svg>
              )}
            </button>
            <Link to="/app" className="text-title-sm font-haas-disp text-ink">
              SuperConnector
            </Link>
          </div>
          <div className="flex items-center gap-sm text-body-md text-body">
            <Avatar src={ownPhotoURL} sizeClass="h-8 w-8" />
            <span className="hidden sm:inline">{user?.displayName ?? user?.email}</span>
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="text-link hover:text-link-active"
            >
              Sign out
            </button>
          </div>
        </Container>

        {/* Mobile menu: a full-width dropdown under the header, only
            rendered when toggled open, only visible below md. */}
        {mobileMenuOpen && (
          <nav className="border-t border-hairline md:hidden">
            <ul className="space-y-xs p-md">
              {items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-sm rounded-sm px-sm py-sm text-body-md ${
                        isActive ? 'bg-surface-soft text-ink' : 'text-body'
                      }`
                    }
                  >
                    <item.Icon />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <div className="flex flex-1">
        <nav className="hidden w-[220px] shrink-0 border-r border-hairline p-lg md:block">
          <ul className="space-y-xs">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-sm rounded-sm px-sm py-xs text-body-md transition-colors duration-150 ${
                      isActive ? 'bg-surface-soft text-ink' : 'text-body hover:text-ink'
                    }`
                  }
                >
                  <item.Icon />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main id="main-content" className="flex-1 p-lg md:p-xxl">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
