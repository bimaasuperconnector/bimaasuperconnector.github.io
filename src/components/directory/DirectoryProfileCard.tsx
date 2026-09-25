import type { Profile } from '../../firebase/repositories/profilesRepository';
import { findBatch } from '../../lib/batches';
import { ContactButtons } from './ContactButtons';

export function DirectoryProfileCard({ profile }: { profile: Profile }) {
  const batch = profile.batchNumber !== null ? findBatch(profile.batchNumber) : undefined;

  return (
    <div className="rounded-md border border-hairline p-md">
      <div className="flex items-center gap-sm">
        {profile.photoURL ? (
          <img src={profile.photoURL} alt="" className="h-12 w-12 rounded-full" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-surface-soft" />
        )}
        <div className="min-w-0">
          <p className="truncate text-label-md text-ink">
            {profile.displayName || 'Unnamed alum'}
          </p>
          {batch && <p className="text-body-md text-muted">{batch.label}</p>}
        </div>
        <div className="ml-auto flex shrink-0 gap-xs">
          {profile.hasFounderOrg && (
            <span className="rounded-sm bg-signature-cream px-xs py-xxs text-caption text-ink">
              Founder
            </span>
          )}
          {profile.openToWork && (
            <span className="rounded-sm bg-signature-mint px-xs py-xxs text-caption text-ink">
              Open to Work
            </span>
          )}
        </div>
      </div>

      {profile.headline && <p className="mt-sm text-body-md text-body">{profile.headline}</p>}

      {profile.currentOrganizationName && (
        <p className="mt-xs text-body-md text-muted">
          {profile.currentTitle ? `${profile.currentTitle} at ` : ''}
          {profile.currentOrganizationName}
        </p>
      )}

      {profile.location && <p className="mt-xs text-body-md text-muted">📍 {profile.location}</p>}

      {profile.skills.length > 0 && (
        <p className="mt-sm text-body-md text-body">{profile.skills.slice(0, 6).join(', ')}</p>
      )}

      {profile.openToWork && profile.openToWorkRoles.length > 0 && (
        <p className="mt-sm text-body-md text-body">
          <span className="text-muted">Looking for: </span>
          {profile.openToWorkRoles.join(', ')}
        </p>
      )}
      {profile.openToWork && profile.openToWorkNote && (
        <p className="mt-xs text-body-md text-muted">{profile.openToWorkNote}</p>
      )}

      <ContactButtons contact={profile.contactVisible} />
    </div>
  );
}
