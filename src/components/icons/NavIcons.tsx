import type { SVGProps } from 'react';

/**
 * Phase 15 addition: "a single-color-scheme SVG icon system for every
 * nav item/section" (FEATURE_SUPERCONNECTOR.md Phase 15 scope note).
 *
 * Every icon here is a plain stroke-based line glyph using
 * `stroke="currentColor"` and no fill — the same single-color
 * convention already used by AppShell's hamburger/close icon since the
 * 2026-09-08 mobile-nav bugfix. That means an icon's color is entirely
 * controlled by the surrounding text color class (e.g. `text-body` /
 * `text-ink` on the active nav link), so this file carries no color
 * tokens of its own and never drifts from Design-superconnector.md's
 * "restrained use of color" direction. 24x24 viewBox throughout,
 * rendered at a smaller pixel size via width/height props so every
 * icon lines up on the same grid.
 *
 * These are nav/section glyphs only (recognizable at a glance, not
 * decorative illustration) — consistent with the design system's
 * "no gradient, no atmospheric backdrop" stance and its general
 * preference for whitespace/typography/color-block over ornament.
 */

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  width: 20,
  height: 20,
  'aria-hidden': true,
};

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9h12v-9" />
      <path d="M10 19v-5h4v5" />
    </svg>
  );
}

export function ProfileIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" />
    </svg>
  );
}

export function DirectoryIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4.5" width="16" height="15" rx="1.5" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </svg>
  );
}

export function SuperConnectorIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="8.5" cy="9" r="3" />
      <circle cx="16" cy="15.5" r="3" />
      <path d="M10.8 11.2l3.4 2.2" />
    </svg>
  );
}

export function JobsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="8" width="17" height="11" rx="1.5" />
      <path d="M8.5 8V6a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 6v2" />
      <path d="M3.5 12.5h17" />
    </svg>
  );
}

export function OpenToWorkIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 4v16" />
      <path d="M6 5h11l-2.5 3L17 11H6" />
    </svg>
  );
}

export function EventsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="5.5" width="16" height="14" rx="1.5" />
      <path d="M4 9.5h16" />
      <path d="M8 4v3M16 4v3" />
    </svg>
  );
}

export function EntrepreneurshipIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5c2.8 2 4 4.4 4 6.8a4 4 0 1 1-8 0c0-2.4 1.2-4.8 4-6.8Z" />
      <path d="M9.5 19.5h5M12 16.3v3.2" />
    </svg>
  );
}

export function NotificationsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6.5 10.5a5.5 5.5 0 0 1 11 0c0 4 1.3 5.2 1.3 5.2H5.2S6.5 14.5 6.5 10.5Z" />
      <path d="M10.2 18.5a1.8 1.8 0 0 0 3.6 0" />
    </svg>
  );
}

export function AdminIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5 5 6v5.5c0 4.2 3 7.4 7 9 4-1.6 7-4.8 7-9V6l-7-2.5Z" />
      <path d="M9.3 12l1.9 1.9L14.9 10" />
    </svg>
  );
}

export function BellRequestIcon(props: IconProps) {
  return (
    <svg {...base} width={18} height={18} {...props}>
      <path d="M6.5 10.5a5.5 5.5 0 0 1 11 0c0 4 1.3 5.2 1.3 5.2H5.2S6.5 14.5 6.5 10.5Z" />
      <path d="M10.2 18.5a1.8 1.8 0 0 0 3.6 0" />
    </svg>
  );
}
