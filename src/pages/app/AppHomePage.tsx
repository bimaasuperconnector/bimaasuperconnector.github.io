import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserRecord } from '../../context/UserRecordContext';
import { useOwnProfile } from '../../context/OwnProfileContext';
import { PageHeader, SkeletonList } from '../../components/ui/PageHeader';
import { NotificationItem } from '../../components/notifications/NotificationItem';
import { currentCycle, formatCycleDates } from '../../lib/cycles';
import { getCycleState } from '../../firebase/repositories/cyclesRepository';
import { getOwnRegistration, type Registration } from '../../firebase/repositories/registrationsRepository';
import { listOwnNotifications, type Notification } from '../../firebase/repositories/notificationsRepository';
import { loadAdminMetrics, type AdminMetrics } from '../../firebase/repositories/adminMetricsRepository';
import {
  ProfileIcon,
  DirectoryIcon,
  SuperConnectorIcon,
  JobsIcon,
  OpenToWorkIcon,
  EventsIcon,
  EntrepreneurshipIcon,
  NotificationsIcon,
  AdminIcon,
  ClockIcon,
} from '../../components/icons/NavIcons';

const QUICK_LINKS = [
  { to: '/app/directory', label: 'Directory', description: 'Search the batch by name, org, skill or city.', Icon: DirectoryIcon },
  { to: '/app/superconnector', label: 'SuperConnector', description: "This month's 1:1 or small-circle registration.", Icon: SuperConnectorIcon },
  { to: '/app/jobs', label: 'Jobs', description: 'Open roles posted by fellow alumni.', Icon: JobsIcon },
  { to: '/app/open-to-work', label: 'Open to Work', description: 'See who is exploring what is next.', Icon: OpenToWorkIcon },
  { to: '/app/events', label: 'Events', description: 'Upcoming meetups, virtual and in person.', Icon: EventsIcon },
  { to: '/app/entrepreneurship', label: 'Entrepreneurship', description: 'Ventures founded across the network.', Icon: EntrepreneurshipIcon },
];

/**
 * Phase 15 replaces the Phase 0 "Welcome" placeholder card with a real
 * dashboard — per that phase's scope note: "a redesigned Home as a
 * real dashboard (metrics, highlights, navigation hub) rather than the
 * current placeholder welcome card." Every read here is either a
 * single document scoped to the signed-in caller's own uid (profile,
 * registration, notifications) or the existing admin-only count()
 * aggregation already built for Phase 11's admin dashboard — no new
 * query shape, no new Firestore index, consistent with this project's
 * standing quota-optimization directive.
 */
export function AppHomePage() {
  const { user } = useAuth();
  const { record } = useUserRecord();
  // Own profile: the shell's single live listener — no read of its own here.
  const { profile, loaded: profileLoaded } = useOwnProfile();
  const cycle = currentCycle();
  const isAnyAdmin = record?.role === 'super_admin' || record?.role === 'batch_admin';

  const [registration, setRegistration] = useState<Registration | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [adminMetrics, setAdminMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loads: Promise<void>[] = [
      Promise.all([getOwnRegistration(cycle.id, user.uid), getCycleState(cycle.id)]).then(
        ([reg, cycleState]) => {
          if (cancelled) return;
          setRegistration(reg);
          setRegistrationOpen(!cycleState || cycleState.status === 'registration_open');
        },
      ),
      // Only the 3 newest are needed for the preview (was: the whole history).
      listOwnNotifications(user.uid, 3).then((latest) => {
        if (!cancelled) setNotifications(latest);
      }),
    ];

    // Admin metrics are their own count() aggregation calls — only
    // fetched for an admin viewer, so a regular member's Home page
    // never pays for a dashboard they can't see.
    if (isAnyAdmin) {
      loads.push(
        loadAdminMetrics().then((m) => {
          if (!cancelled) setAdminMetrics(m);
        }),
      );
    }

    Promise.allSettled(loads).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cycle.id is stable per render/day
  }, [user, isAnyAdmin]);

  const firstName = user?.displayName?.split(' ')[0] ?? profile?.displayName?.split(' ')[0];
  const profileLoading = !profileLoaded;

  return (
    <div className="space-y-xl">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        description="Your alumni network, in one place: profile, directory, monthly connections, jobs and events."
      />

      <div className="grid gap-md md:grid-cols-2">
        {/* This month's cycle: a signature colour block */}
        <section className="rounded-lg bg-signature-forest p-lg text-on-dark md:p-xl">
          <div className="flex items-center gap-sm">
            <SuperConnectorIcon />
            <h2 className="font-haas-disp text-title-md text-on-dark">This month's SuperConnector</h2>
          </div>
          <p className="mt-sm flex items-center gap-xs text-body-md text-on-dark/85">
            <ClockIcon width={16} height={16} />
            {formatCycleDates(cycle)}
          </p>
          {loading ? (
            <div className="skeleton mt-md h-5 w-2/3 !bg-none !bg-white/15" />
          ) : registration ? (
            <p className="mt-md text-body-md text-signature-mint">
              You're registered ({registration.slot === 'both' ? 'Saturday or Sunday' : registration.slot}).
            </p>
          ) : registrationOpen ? (
            <p className="mt-md text-body-md text-on-dark/90">You haven't registered for this cycle yet.</p>
          ) : (
            <p className="mt-md text-body-md text-on-dark/80">Registration is closed for this cycle.</p>
          )}
          <Link
            to="/app/superconnector"
            className="mt-lg inline-flex min-h-[44px] items-center rounded-lg bg-canvas px-lg text-button text-ink active:bg-surface-strong"
          >
            {registration ? 'View your registration' : 'Register now'}
          </Link>
        </section>

        {/* Profile completeness */}
        <section className="surface-card p-lg md:p-xl">
          <div className="flex items-center gap-sm text-ink">
            <ProfileIcon />
            <h2 className="font-haas-disp text-title-md text-ink">Your profile</h2>
          </div>
          {profileLoading ? (
            <div className="skeleton mt-md h-10" />
          ) : profile?.isComplete ? (
            <p className="mt-sm text-body-md text-success">Complete — batch, headline and bio are all set.</p>
          ) : (
            <p className="copy mt-sm">Add a batch and headline so other alumni can find and recognize you.</p>
          )}
          <Link
            to="/app/profile"
            className="mt-lg inline-flex min-h-[44px] items-center rounded-lg border border-hairline bg-canvas px-lg text-button text-ink active:bg-surface-strong"
          >
            {profile?.isComplete ? 'Edit your profile' : 'Complete your profile'}
          </Link>
        </section>
      </div>

      {/* Admin snapshot: only rendered for an admin viewer */}
      {isAnyAdmin && adminMetrics && (
        <section className="surface-card p-lg md:p-xl">
          <div className="flex items-center justify-between gap-md">
            <div className="flex items-center gap-sm text-ink">
              <AdminIcon />
              <h2 className="font-haas-disp text-title-md text-ink">Admin snapshot</h2>
            </div>
            <Link to="/app/admin" className="inline-flex min-h-[44px] items-center text-body-md text-link">
              Open admin console →
            </Link>
          </div>
          <dl className="mt-md grid grid-cols-2 gap-sm sm:grid-cols-4">
            {[
              ['Pending approvals', adminMetrics.pendingApprovals],
              ['Pending jobs', adminMetrics.pendingJobs],
              ['Open reports', adminMetrics.openReports],
              ['Approved members', adminMetrics.approvedMembers],
            ].map(([label, value]) => (
              <div key={label} className="surface-soft-card p-md">
                <dd className="font-haas-disp text-display-md text-ink">{value}</dd>
                <dt className="text-body-md text-muted">{label}</dt>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Quick navigation */}
      <section>
        <h2 className="font-haas-disp text-title-md text-ink">Explore</h2>
        <div className="mt-md grid gap-sm sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map(({ to, label, description, Icon }) => (
            <Link
              key={to}
              to={to}
              className="surface-card flex items-start gap-md p-md transition-colors duration-150 hover:border-border-strong hover:bg-surface-soft active:bg-surface-strong/60"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-soft text-ink">
                <Icon />
              </span>
              <span className="min-w-0">
                <span className="block text-label-md text-ink">{label}</span>
                <span className="block text-body-md text-muted">{description}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent notifications preview */}
      <section className="surface-card overflow-hidden">
        <div className="flex items-center justify-between gap-md px-lg pt-lg">
          <div className="flex items-center gap-sm text-ink">
            <NotificationsIcon />
            <h2 className="font-haas-disp text-title-md text-ink">Recent activity</h2>
          </div>
          <Link to="/app/notifications" className="inline-flex min-h-[44px] items-center text-body-md text-link">
            View all →
          </Link>
        </div>
        {loading ? (
          <div className="p-lg pt-sm">
            <SkeletonList count={2} heightClass="h-14" />
          </div>
        ) : notifications.length === 0 ? (
          <p className="px-lg pb-lg pt-xs text-body-md text-muted">No notifications yet.</p>
        ) : (
          <ul className="mt-xs divide-y divide-hairline border-t border-hairline">
            {notifications.map((n) => (
              <li key={n.id}>
                <NotificationItem notification={n} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
