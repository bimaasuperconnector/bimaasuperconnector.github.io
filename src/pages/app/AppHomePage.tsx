import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserRecord } from '../../context/UserRecordContext';
import { getProfile, type Profile } from '../../firebase/repositories/profilesRepository';
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
  const cycle = currentCycle();
  const isAnyAdmin = record?.role === 'super_admin' || record?.role === 'batch_admin';

  const [profile, setProfile] = useState<Profile | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [adminMetrics, setAdminMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loads: Promise<void>[] = [
      getProfile(user.uid).then((p) => {
        if (!cancelled) setProfile(p);
      }),
      Promise.all([getOwnRegistration(cycle.id, user.uid), getCycleState(cycle.id)]).then(
        ([reg, cycleState]) => {
          if (cancelled) return;
          setRegistration(reg);
          setRegistrationOpen(!cycleState || cycleState.status === 'registration_open');
        },
      ),
      listOwnNotifications(user.uid).then((all) => {
        if (!cancelled) setNotifications(all.slice(0, 3));
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

  return (
    <div className="space-y-lg">
      <div>
        <h1 className="text-title-lg text-ink">
          {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        </h1>
        <p className="mt-xs text-body-md text-body">
          Your alumni network, in one place — profile, directory, monthly connections, jobs and events.
        </p>
      </div>

      <div className="grid gap-lg md:grid-cols-2">
        {/* This month's cycle */}
        <div className="rounded-md border border-hairline p-lg">
          <div className="flex items-center gap-sm text-ink">
            <SuperConnectorIcon />
            <h2 className="text-title-md">This month's SuperConnector</h2>
          </div>
          <p className="mt-sm text-body-md text-body">{formatCycleDates(cycle)}</p>
          {loading ? (
            <p className="mt-sm text-body-md text-muted">Loading…</p>
          ) : registration ? (
            <p className="mt-sm text-body-md text-success">
              You're registered ({registration.slot === 'both' ? 'Saturday or Sunday' : registration.slot}).
            </p>
          ) : registrationOpen ? (
            <p className="mt-sm text-body-md text-body">You haven't registered for this cycle yet.</p>
          ) : (
            <p className="mt-sm text-body-md text-muted">Registration is closed for this cycle.</p>
          )}
          <Link to="/app/superconnector" className="mt-md inline-block text-body-md text-link">
            {registration ? 'View your registration' : 'Register now'} →
          </Link>
        </div>

        {/* Profile completeness */}
        <div className="rounded-md border border-hairline p-lg">
          <div className="flex items-center gap-sm text-ink">
            <ProfileIcon />
            <h2 className="text-title-md">Your profile</h2>
          </div>
          {loading ? (
            <p className="mt-sm text-body-md text-muted">Loading…</p>
          ) : profile?.isComplete ? (
            <p className="mt-sm text-body-md text-success">Complete — batch, headline and bio are all set.</p>
          ) : (
            <p className="mt-sm text-body-md text-body">
              Add a batch and headline so other alumni can find and recognize you.
            </p>
          )}
          <Link to="/app/profile" className="mt-md inline-block text-body-md text-link">
            {profile?.isComplete ? 'Edit your profile' : 'Complete your profile'} →
          </Link>
        </div>
      </div>

      {/* Admin snapshot — only rendered for an admin viewer */}
      {isAnyAdmin && adminMetrics && (
        <div className="rounded-md border border-hairline p-lg">
          <div className="flex items-center gap-sm text-ink">
            <AdminIcon />
            <h2 className="text-title-md">Admin snapshot</h2>
          </div>
          <dl className="mt-md grid grid-cols-2 gap-md text-body-md sm:grid-cols-4">
            <div>
              <dt className="text-muted">Pending approvals</dt>
              <dd className="text-title-sm text-ink">{adminMetrics.pendingApprovals}</dd>
            </div>
            <div>
              <dt className="text-muted">Pending jobs</dt>
              <dd className="text-title-sm text-ink">{adminMetrics.pendingJobs}</dd>
            </div>
            <div>
              <dt className="text-muted">Open reports</dt>
              <dd className="text-title-sm text-ink">{adminMetrics.openReports}</dd>
            </div>
            <div>
              <dt className="text-muted">Approved members</dt>
              <dd className="text-title-sm text-ink">{adminMetrics.approvedMembers}</dd>
            </div>
          </dl>
          <Link to="/app/admin" className="mt-md inline-block text-body-md text-link">
            Open admin console →
          </Link>
        </div>
      )}

      {/* Quick navigation */}
      <div>
        <h2 className="text-title-md text-ink">Explore</h2>
        <div className="mt-sm grid gap-sm sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map(({ to, label, description, Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-start gap-sm rounded-md border border-hairline p-md transition-colors duration-150 hover:border-border-strong"
            >
              <span className="mt-xxs text-ink">
                <Icon />
              </span>
              <span>
                <span className="block text-label-md text-ink">{label}</span>
                <span className="block text-body-md text-muted">{description}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent notifications preview */}
      <div className="rounded-md border border-hairline p-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-sm text-ink">
            <NotificationsIcon />
            <h2 className="text-title-md">Recent activity</h2>
          </div>
          <Link to="/app/notifications" className="text-body-md text-link">
            View all →
          </Link>
        </div>
        {loading ? (
          <p className="mt-sm text-body-md text-muted">Loading…</p>
        ) : notifications.length === 0 ? (
          <p className="mt-sm text-body-md text-muted">No notifications yet.</p>
        ) : (
          <ul className="mt-sm space-y-xs">
            {notifications.map((n) => (
              <li key={n.id} className="text-body-md text-body">
                <span className="text-ink">{n.title}</span> — {n.body}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
