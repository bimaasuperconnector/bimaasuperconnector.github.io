import type { OrganizationEntry, Profile } from '../../firebase/repositories/profilesRepository';
import { findBatch } from '../../lib/batches';
import { ContactButtons } from '../directory/ContactButtons';

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
  const batch = profile.batchNumber !== null ? findBatch(profile.batchNumber) : undefined;
  const isActive = organization.endYear === null;

  return (
    <div className="rounded-md border border-hairline p-md">
      <div className="flex items-start justify-between gap-sm">
        <p className="text-label-md text-ink">{organization.name || 'Unnamed venture'}</p>
        <span
          className={`shrink-0 rounded-sm px-xs py-xxs text-caption text-ink ${
            isActive ? 'bg-signature-mint' : 'bg-surface-strong'
          }`}
        >
          {isActive ? 'Active' : 'Past venture'}
        </span>
      </div>

      {organization.title && <p className="mt-xs text-body-md text-muted">{organization.title}</p>}

      {organization.startYear && (
        <p className="mt-xs text-body-md text-muted">
          {organization.startYear}–{organization.endYear ?? 'present'}
        </p>
      )}

      <div className="mt-md flex items-center gap-sm border-t border-hairline pt-md">
        {profile.photoURL ? (
          <img src={profile.photoURL} alt="" className="h-8 w-8 rounded-full" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-surface-soft" />
        )}
        <div className="min-w-0">
          <p className="truncate text-body-md text-ink">{profile.displayName || 'Unnamed alum'}</p>
          {batch && <p className="text-caption text-muted">{batch.label}</p>}
        </div>
      </div>

      <ContactButtons contact={profile.contactVisible} />
    </div>
  );
}
