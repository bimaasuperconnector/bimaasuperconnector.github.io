import { Link } from 'react-router-dom';
import type { OrganizationEntry, Profile } from '../../firebase/repositories/profilesRepository';
import { findBatch } from '../../lib/batches';
import { Avatar } from '../ui/Avatar';
import { ContactButtons } from '../directory/ContactButtons';
import { useAuth } from '../../context/AuthContext';

/**
 * Phase 12 (Entrepreneurship & organization history). Renders one
 * founder-tagged organization entry alongside its founder. Takes a
 * full `Profile` (already fetched by EntrepreneurshipPage's single
 * directory query) plus one of that profile's own `organizations[]`
 * entries — no separate read per venture, no separate collection.
 * Organization history lives entirely on the profile document, per
 * FEATURE_SUPERCONNECTOR.md's Phase 12 spec ("organization history is
 * the source of truth") and the Phase 2 decision to model
 * `isFounder` per-organization for exactly this purpose.
 */
export function VentureCard({
  profile,
  organization,
}: {
  profile: Profile;
  organization: OrganizationEntry;
}) {
  const { user } = useAuth();
  const batch = profile.batchNumber !== null ? findBatch(profile.batchNumber) : undefined;
  const isActive = organization.endYear === null;
  const to = profile.uid === user?.uid ? '/app/profile' : `/app/directory/${profile.uid}`;

  return (
    <article className="surface-card flex h-full flex-col p-lg">
      <div className="flex items-start justify-between gap-sm">
        <h3 className="font-haas-disp text-title-sm font-medium text-ink">
          {organization.name || 'Unnamed venture'}
        </h3>
        <span className={`chip shrink-0 ${isActive ? 'bg-signature-mint' : 'bg-surface-strong'}`}>
          {isActive ? 'Active' : 'Past venture'}
        </span>
      </div>

      {organization.title && <p className="mt-xxs text-body-md text-body">{organization.title}</p>}

      {organization.startYear && (
        <p className="mt-xxs text-body-md text-muted">
          {organization.startYear}–{organization.endYear ?? 'present'}
        </p>
      )}

      <Link
        to={to}
        state={{ profile }}
        className="mt-lg flex items-center gap-sm rounded-lg border-t border-hairline pt-md transition-colors duration-150 hover:opacity-80"
      >
        <Avatar src={profile.photoURL} sizeClass="h-9 w-9" />
        <div className="min-w-0">
          <p className="truncate text-label-md text-ink">{profile.displayName || 'Unnamed alum'}</p>
          {batch && <p className="text-caption text-muted">{batch.label}</p>}
        </div>
      </Link>

      <div className="mt-auto">
        <ContactButtons contact={profile.contactVisible} name={profile.displayName.split(' ')[0] || undefined} className="mt-md" />
      </div>
    </article>
  );
}
