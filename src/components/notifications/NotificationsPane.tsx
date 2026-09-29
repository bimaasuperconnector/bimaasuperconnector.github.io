import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloseIcon, CollapseIcon, ExpandIcon } from '../icons/NavIcons';
import { NotificationItem } from './NotificationItem';
import { BrowserPermission } from './BrowserPermission';
import type { NotificationsFeed } from './useNotificationsFeed';

/**
 * The bell's pane. Opens over the page content: a compact card under the
 * bell on desktop that can be expanded into a full-height side panel, and a
 * full-screen sheet on phones. Content is the same feed as the full
 * Notifications page (which remains at /app/notifications).
 */
export function NotificationsPane({
  open,
  onClose,
  feed,
}: {
  open: boolean;
  onClose: () => void;
  feed: NotificationsFeed;
}) {
  const [expanded, setExpanded] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Phones show the pane full-screen, so stop the page behind it scrolling.
    const previous = document.body.style.overflow;
    if (window.matchMedia('(max-width: 767px)').matches || expanded) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose, expanded]);

  if (!open) return null;

  return (
    <>
      {/* Click-away layer. Sits under the header so the bell itself stays
          clickable; dimmed only when the pane is expanded. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fade-enter fixed inset-x-0 bottom-0 top-16 z-40 hidden md:block ${expanded ? 'bg-ink/30' : ''}`}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        className={`pop-enter fixed inset-0 z-[60] flex flex-col bg-canvas transition-all duration-200 md:z-40 md:border md:border-hairline md:shadow-[0_16px_40px_rgba(24,29,38,0.14)] ${
          expanded
            ? 'md:inset-auto md:bottom-0 md:right-0 md:top-16 md:w-[min(640px,100vw)] md:rounded-none md:rounded-tl-lg'
            : 'md:inset-auto md:right-md md:top-[72px] md:max-h-[calc(100vh-88px)] md:w-[420px] md:rounded-lg'
        }`}
      >
        <header className="flex items-center justify-between gap-sm border-b border-hairline px-md py-sm">
          <h2 className="font-haas-disp text-title-sm font-medium text-ink">Notifications</h2>
          <div className="flex items-center gap-xxs">
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              aria-pressed={expanded}
              aria-label={expanded ? 'Collapse notifications panel' : 'Expand notifications panel'}
              className="icon-btn hidden md:inline-flex"
            >
              {expanded ? <CollapseIcon /> : <ExpandIcon />}
            </button>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close notifications" className="icon-btn">
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="p-md pb-0 empty:hidden">
            <BrowserPermission compact />
          </div>

          {feed.error && <p className="px-md pt-md text-body-md text-signature-coral">{feed.error}</p>}

          {feed.loading && feed.items.length === 0 ? (
            <div className="space-y-sm p-md" aria-busy="true" aria-label="Loading notifications">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-[68px]" />
              ))}
            </div>
          ) : feed.items.length === 0 && !feed.error ? (
            <p className="px-md py-xxl text-center text-body-md text-muted">You're all caught up — no notifications yet.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {feed.items.map((n) => (
                <li key={n.id}>
                  <NotificationItem notification={n} isNew={feed.isNew(n)} onNavigate={onClose} />
                </li>
              ))}
            </ul>
          )}

          {feed.hasMore && (
            <div className="border-t border-hairline p-md">
              <button
                type="button"
                onClick={() => void feed.loadMore()}
                disabled={feed.loadingMore}
                className="w-full rounded-lg border border-hairline bg-canvas py-sm text-button text-ink disabled:opacity-50"
              >
                {feed.loadingMore ? 'Loading…' : 'Load older'}
              </button>
            </div>
          )}
        </div>

        <footer className="pb-safe border-t border-hairline px-md py-sm">
          <Link to="/app/notifications" onClick={onClose} className="inline-flex min-h-[44px] items-center text-body-md text-link">
            View all notifications →
          </Link>
        </footer>
      </section>
    </>
  );
}
