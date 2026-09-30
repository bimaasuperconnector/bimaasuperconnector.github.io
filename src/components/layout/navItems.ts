import type { ComponentType, SVGProps } from 'react';
import {
  AdminIcon,
  DirectoryIcon,
  EntrepreneurshipIcon,
  EventsIcon,
  HomeIcon,
  JobsIcon,
  ProfileIcon,
  SuperConnectorIcon,
} from '../icons/NavIcons';

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  /** Greyed out and not navigable (used for members whose application is still pending). */
  disabled?: boolean;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/**
 * Every signed-in destination. Notifications is no longer a sidebar item —
 * it lives in the header bell (with a "View all" link to /app/notifications,
 * which is unchanged).
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/app', label: 'Home', end: true, Icon: HomeIcon },
  { to: '/app/directory', label: 'Directory', Icon: DirectoryIcon },
  { to: '/app/superconnector', label: 'SuperConnector', Icon: SuperConnectorIcon },
  { to: '/app/events', label: 'Events', Icon: EventsIcon },
  { to: '/app/jobs', label: 'Jobs', Icon: JobsIcon },
  { to: '/app/entrepreneurship', label: 'Entrepreneurship', Icon: EntrepreneurshipIcon },
  { to: '/app/profile', label: 'My profile', Icon: ProfileIcon },
];

export const ADMIN_NAV_ITEM: NavItem = { to: '/app/admin', label: 'Admin', Icon: AdminIcon };

/** The four destinations pinned in the phone bottom bar; everything else sits behind "More". */
export const BOTTOM_NAV_PATHS = ['/app', '/app/directory', '/app/superconnector', '/app/events'];
