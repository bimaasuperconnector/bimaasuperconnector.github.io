import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../ui/Avatar';
import { AdminIcon, ProfileIcon, SignOutIcon } from '../icons/NavIcons';
import { useDismiss } from './usePopover';

/**
 * The account control: ONLY the member's uploaded profile photo (or the
 * neutral placeholder) is shown as the trigger. Clicking it opens a small
 * popup with the account's name/email, a link to their profile, the admin
 * console for admins, and Sign out.
 */
export function AccountMenu({
  photoURL,
  name,
  email,
  isAdmin,
  onSignOut,
}: {
  photoURL: string | null;
  name: string;
  email: string;
  isAdmin: boolean;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useDismiss(wrapRef, open, close);

  const itemClass =
    'flex min-h-[44px] w-full items-center gap-sm rounded-md px-sm text-left text-body-md text-ink transition-colors duration-150 hover:bg-surface-soft active:bg-surface-strong';

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-shadow duration-150 focus-visible:outline-offset-1"
      >
        <Avatar src={photoURL} sizeClass="h-9 w-9" className="ring-1 ring-hairline" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="pop-enter absolute right-0 top-[calc(100%+8px)] z-50 w-[280px] max-w-[calc(100vw-24px)] rounded-lg border border-hairline bg-canvas p-xs shadow-[0_12px_32px_rgba(24,29,38,0.14)]"
        >
          <div className="flex items-center gap-sm px-sm py-sm">
            <Avatar src={photoURL} sizeClass="h-10 w-10" />
            <div className="min-w-0">
              <p className="truncate text-label-md text-ink">{name}</p>
              <p className="truncate text-caption text-muted">{email}</p>
            </div>
          </div>
          <div className="my-xs border-t border-hairline" />
          <Link role="menuitem" to="/app/profile" onClick={close} className={`${itemClass} !text-ink`}>
            <ProfileIcon /> My profile
          </Link>
          {isAdmin && (
            <Link role="menuitem" to="/app/admin" onClick={close} className={`${itemClass} !text-ink`}>
              <AdminIcon /> Admin console
            </Link>
          )}
          <div className="my-xs border-t border-hairline" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              onSignOut();
            }}
            className={itemClass}
          >
            <SignOutIcon /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
