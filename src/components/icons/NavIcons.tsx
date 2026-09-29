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

/* ------------------------------------------------------------------
   Post-login UI revamp additions: header, search, contact and event
   glyphs. Same conventions as above (stroke = currentColor, 24x24 grid);
   the two brand marks (LinkedIn, WhatsApp) are single-colour filled
   glyphs so they stay recognisable at 20px.
   ------------------------------------------------------------------ */

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function ExpandIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
    </svg>
  );
}

export function CollapseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 10h-6V4M4 14h6v6M14 10l7-7M10 14l-7 7" />
    </svg>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="6" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="18" cy="12" r="1.2" />
    </svg>
  );
}

export function SignOutIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10" />
      <path d="M14 8l4 4-4 4M18 12H9.5" />
    </svg>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20.5s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" />
      <circle cx="12" cy="10.5" r="2.2" />
    </svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4.5 7.5 7.5 6 7.5-6" />
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6.6 4.5h2.6l1.3 3.6-1.7 1.2a10.5 10.5 0 0 0 5.3 5.3l1.2-1.7 3.6 1.3v2.6a1.8 1.8 0 0 1-1.9 1.8C10.7 18.2 5.8 13.3 4.8 6.4a1.8 1.8 0 0 1 1.8-1.9Z" />
    </svg>
  );
}

/** Filled brand mark (LinkedIn "in" tile). */
export function LinkedInIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden="true" {...props}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

/** Filled brand mark (WhatsApp speech bubble + handset). */
export function WhatsAppIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden="true" {...props}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19c.9-3 3-4.5 5.5-4.5s4.6 1.5 5.5 4.5" />
      <path d="M15.5 5.8a3 3 0 0 1 0 5.4M17 14.7c1.8.5 3 1.9 3.5 4.3" />
    </svg>
  );
}

export function VideoIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="6.5" width="12" height="11" rx="2" />
      <path d="m15.5 10.5 5-2.5v8l-5-2.5" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.4 3.5 5.2 3.5 8.5s-1 6.1-3.5 8.5c-2.5-2.4-3.5-5.2-3.5-8.5s1-6.1 3.5-8.5Z" />
    </svg>
  );
}
