import type { Profile } from '../../firebase/repositories/profilesRepository';
import { findBatch } from '../../lib/batches';

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
        {profile.hasFounderOrg && (
          <span className="ml-auto shrink-0 rounded-sm bg-signature-cream px-xs py-xxs text-caption text-ink">
            Founder
          </span>
        )}
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
    </div>
  );
}
