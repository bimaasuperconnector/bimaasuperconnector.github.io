import { Link } from 'react-router-dom';
import type { Notification } from '../../firebase/repositories/notificationsRepository';
import { formatRelative } from '../../lib/time';
import { EventsIcon, NotificationsIcon, SuperConnectorIcon } from '../icons/NavIcons';

/** One notification row, shared by the header pane, the Home preview and the full page. */
export function NotificationItem({
  notification,
  isNew,
  onNavigate,
}: {
  notification: Notification;
  isNew?: boolean;
  onNavigate?: () => void;
}) {
  const target = notification.eventId ? '/app/events' : notification.cycleId ? '/app/superconnector' : null;
  const Icon = notification.eventId ? EventsIcon : notification.cycleId ? SuperConnectorIcon : NotificationsIcon;

  const content = (
    <>
      <span className="mt-xxs flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-soft text-ink">
        <Icon width={18} height={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-sm">
          <span className="text-label-md text-ink">{notification.title}</span>
          {isNew && (
            <span className="mt-xs flex shrink-0 items-center gap-xxs text-caption text-signature-coral">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-signature-coral" />
              New
            </span>
          )}
        </span>
        <span className="mt-xxs block text-body-md text-body">{notification.body}</span>
        {notification.createdAt && (
          <time
            dateTime={notification.createdAt.toISOString()}
            title={notification.createdAt.toLocaleString()}
            className="mt-xs block text-caption text-muted"
          >
            {formatRelative(notification.createdAt)}
          </time>
        )}
      </span>
    </>
  );

  const classes = 'flex gap-sm px-md py-md';
  return target ? (
    <Link to={target} onClick={onNavigate} className={`${classes} text-body transition-colors duration-150 hover:bg-surface-soft active:bg-surface-strong`}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}
