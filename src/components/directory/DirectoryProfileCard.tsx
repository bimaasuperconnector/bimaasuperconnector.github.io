import { Link } from 'react-router-dom';
import type { Profile } from '../../firebase/repositories/profilesRepository';
import { findBatch } from '../../lib/batches';
import { Avatar } from '../ui/Avatar';
import { MapPinIcon } from '../icons/NavIcons';
import { useAuth } from '../../context/AuthContext';

/**
 * Minimal search-result card: photo, name, batch, current role/organization,
 * location and the Founder / Open to Work markers — nothing else. The whole
 * card opens that person's full profile (contact options, bio, history and
 * everything else now live there). The profile already fetched by the search
 * is handed over through router state so opening it costs no extra read.
 */
export function DirectoryProfileCard({
  profile,
  showLookingFor = false,
}: {
  profile: Profile;
  /** Open to Work lists also show the roles the person is looking for. */
  showLookingFor?: boolean;
}) {
  const { user } = useAuth();
  const batch = profile.batchNumber !== null ? findBatch(profile.batchNumber) : undefined;
  const role = profile.currentOrganizationName
    ? `${profile.currentTitle ? `${profile.currentTitle} at ` : ''}${profile.currentOrganizationName}`
    : profile.headline;
  const to = profile.uid === user?.uid ? '/app/profile' : `/app/directory/${profile.uid}`;

  return (
    <Link
      to={to}
      state={{ profile }}
      className="surface-card flex h-full items-start gap-md p-md text-left transition-colors duration-150 hover:border-border-strong hover:bg-surface-soft active:bg-surface-strong/60"
    >
      <Avatar src={profile.photoURL} sizeClass="h-14 w-14" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-label-md text-ink">{profile.displayName || 'Unnamed alum'}</span>
        {batch && <span className="block text-body-md text-muted">{batch.label}</span>}
        {role && <span className="mt-xxs block truncate text-body-md text-body">{role}</span>}
        {profile.location && (
          <span className="mt-xxs flex items-center gap-xxs text-body-md text-muted">
            <MapPinIcon width={14} height={14} />
            <span className="truncate">{profile.location}</span>
          </span>
        )}
        {(profile.hasFounderOrg || profile.openToWork) && (
          <span className="mt-xs flex flex-wrap gap-xs">
            {profile.hasFounderOrg && <span className="chip bg-signature-cream">Founder</span>}
            {profile.openToWork && <span className="chip bg-signature-mint">Open to Work</span>}
          </span>
        )}
        {showLookingFor && profile.openToWork && profile.openToWorkRoles.length > 0 && (
          <span className="mt-xs block truncate text-body-md text-body">
            <span className="text-muted">Looking for: </span>
            {profile.openToWorkRoles.join(', ')}
          </span>
        )}
      </span>
    </Link>
  );
}
