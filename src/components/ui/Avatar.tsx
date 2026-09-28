import { useState } from 'react';

interface AvatarProps {
  /** The member's UPLOADED photo URL, or null/undefined if they have none. */
  src?: string | null;
  /** Tailwind size classes, e.g. "h-8 w-8". */
  sizeClass?: string;
  className?: string;
}

/**
 * The one place a member photo is ever rendered.
 *
 * SuperConnector deliberately shows ONLY photos members uploaded
 * themselves (stored on ImageKit) — never a Google account picture. A
 * member without an uploaded photo gets this neutral built-in
 * placeholder (a generic person silhouette, drawn as an inline SVG so
 * there is no image file to host, load or break). If an uploaded photo
 * ever fails to load, it falls back to the same placeholder.
 */
export function Avatar({ src, sizeClass = 'h-10 w-10', className = '' }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (src && src !== failedSrc) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailedSrc(src)}
        className={`${sizeClass} shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${sizeClass} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-strong text-border-strong ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-[70%] w-[70%]" fill="currentColor">
        <circle cx="12" cy="8.5" r="4.25" />
        <path d="M3.5 21c0-4.7 3.8-7.5 8.5-7.5s8.5 2.8 8.5 7.5v.5h-17V21z" />
      </svg>
    </span>
  );
}
