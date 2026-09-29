import type { ReactNode } from 'react';
import type { Profile } from '../../firebase/repositories/profilesRepository';
import { NETWORKING_PURPOSE_LABELS } from '../../firebase/repositories/profilesRepository';
import { findBatch } from '../../lib/batches';
import { Avatar } from '../ui/Avatar';
import { BadgeChips } from './BadgeChips';
import { ContactButtons } from '../directory/ContactButtons';
import { GlobeIcon, MapPinIcon } from '../icons/NavIcons';

/** Signature colour blocks (Design-superconnector.md) used as the profile cover. */
const COVERS = [
  'bg-signature-forest',
  'bg-signature-coral',
  'bg-signature-peach',
  'bg-signature-mint',
  'bg-signature-cream',
  'bg-signature-yellow',
  'bg-signature-mustard',
  'bg-surface-dark',
];

function coverFor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  return COVERS[hash % COVERS.length];
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="surface-card p-lg">
      <h2 className="font-haas-disp text-title-sm font-medium text-ink">{title}</h2>
      <div className="mt-sm">{children}</div>
    </section>
  );
}

function TagList({ values }: { values: string[] }) {
  return (
    <ul className="flex flex-wrap gap-xs">
      {values.map((value) => (
        <li key={value} className="rounded-md border border-hairline bg-surface-soft px-sm py-xxs text-body-md text-ink">
          {value}
        </li>
      ))}
    </ul>
  );
}

/**
 * The full profile layout, shared by a member's own profile page and the
 * read-only view of another alum (opened from search / directory). Contact
 * methods appear as icons and only when the owner has made them visible.
 */
export function ProfileView({
  profile,
  actions,
  contactCaption,
  notice,
}: {
  profile: Profile;
  /** Right-aligned buttons beside the photo, e.g. "Edit profile". */
  actions?: ReactNode;
  /** Small line above the contact icons (own profile: "Fellow alumni will see"). */
  contactCaption?: string;
  /** Optional callout under the header (e.g. "profile isn't complete yet"). */
  notice?: ReactNode;
}) {
  const batch = profile.batchNumber !== null ? findBatch(profile.batchNumber) : undefined;
  const name = profile.displayName || 'Unnamed alum';
  const contact = profile.contactVisible;
  const website = profile.links.website?.trim();
  const websiteHref = website ? (website.startsWith('http') ? website : `https://${website}`) : '';
  const hasContact = Boolean(contact.email || contact.linkedin || contact.phone || contact.whatsapp || websiteHref);
  const hasSide =
    profile.networkingPurpose.length > 0 ||
    profile.skills.length > 0 ||
    profile.interests.length > 0 ||
    profile.openToWork;

  return (
    <div className="space-y-lg">
      <div className="surface-card overflow-hidden">
        <div aria-hidden="true" className={`h-24 md:h-32 ${coverFor(profile.uid)}`} />
        <div className="px-md pb-lg md:px-xl">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-md md:-mt-12">
            <Avatar
              src={profile.photoURL}
              sizeClass="h-20 w-20 md:h-24 md:w-24"
              className="ring-4 ring-canvas"
            />
            {actions && <div className="flex items-center gap-sm">{actions}</div>}
          </div>

          <h1 className="mt-md font-haas-disp text-title-lg text-ink md:text-display-md">{name}</h1>
          {profile.headline && <p className="mt-xxs text-title-sm text-body">{profile.headline}</p>}

          <p className="mt-sm flex flex-wrap items-center gap-x-md gap-y-xxs text-body-md text-muted">
            {batch && <span>{batch.label}</span>}
            {profile.location && (
              <span className="flex items-center gap-xxs">
                <MapPinIcon width={14} height={14} />
                {profile.location}
              </span>
            )}
          </p>

          {(profile.hasFounderOrg || profile.openToWork || profile.badges.length > 0) && (
            <div className="mt-md flex flex-wrap items-center gap-xs">
              {profile.hasFounderOrg && <span className="chip bg-signature-cream">Founder</span>}
              {profile.openToWork && <span className="chip bg-signature-mint">Open to Work</span>}
              <BadgeChips badges={profile.badges} />
            </div>
          )}

          {hasContact && (
            <div className="mt-lg">
              {contactCaption && <p className="text-caption text-muted">{contactCaption}</p>}
              <div className="mt-xs flex flex-wrap items-center gap-sm">
                <ContactButtons contact={contact} name={profile.displayName.split(' ')[0] || undefined} className="!mt-0" />
                {websiteHref && (
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${name}'s website`}
                    title="Website"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-hairline bg-canvas text-ink transition-colors duration-150 hover:border-border-strong hover:bg-surface-soft active:bg-surface-strong"
                  >
                    <GlobeIcon />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {notice}

      <div className={`grid items-start gap-lg ${hasSide ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : ''}`}>
        <div className="space-y-lg">
          {profile.bio && (
            <Section title="About">
              <p className="copy whitespace-pre-line">{profile.bio}</p>
            </Section>
          )}

          {profile.organizations.length > 0 && (
            <Section title="Experience">
              <ol className="space-y-md border-l border-hairline pl-md">
                {profile.organizations.map((org, i) => (
                  <li key={i} className="relative">
                    <span
                      aria-hidden="true"
                      className={`absolute -left-[21px] top-[5px] h-2.5 w-2.5 rounded-full ring-4 ring-canvas ${
                        org.endYear === null ? 'bg-ink' : 'bg-border-strong'
                      }`}
                    />
                    <p className="text-label-md text-ink">
                      {org.title || 'Role'} <span className="font-normal text-body">at {org.name}</span>
                    </p>
                    <p className="flex flex-wrap items-center gap-xs text-body-md text-muted">
                      {org.startYear ? `${org.startYear}\u2013${org.endYear ?? 'present'}` : org.endYear === null ? 'Current' : ''}
                      {org.isFounder && <span className="chip bg-signature-cream">Founder</span>}
                    </p>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {profile.education.length > 0 && (
            <Section title="Education">
              <ul className="space-y-sm">
                {profile.education.map((edu, i) => (
                  <li key={i}>
                    <p className="text-label-md text-ink">{edu.institution}</p>
                    <p className="text-body-md text-muted">
                      {[edu.degree, edu.field].filter(Boolean).join(' in ')}
                      {edu.endYear ? ` · ${edu.endYear}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        {hasSide && (
          <div className="space-y-lg">
            {profile.openToWork && (
              <section className="rounded-lg bg-signature-mint p-lg">
                <h2 className="font-haas-disp text-title-sm font-medium text-ink">Open to work</h2>
                {profile.openToWorkRoles.length > 0 && (
                  <p className="mt-xs text-body-md text-ink">
                    <span className="opacity-70">Looking for: </span>
                    {profile.openToWorkRoles.join(', ')}
                  </p>
                )}
                {profile.openToWorkNote && <p className="mt-xs text-body-md text-ink">{profile.openToWorkNote}</p>}
              </section>
            )}
            {profile.networkingPurpose.length > 0 && (
              <Section title="Looking for">
                <TagList values={profile.networkingPurpose.map((p) => NETWORKING_PURPOSE_LABELS[p])} />
              </Section>
            )}
            {profile.skills.length > 0 && (
              <Section title="Skills">
                <TagList values={profile.skills} />
              </Section>
            )}
            {profile.interests.length > 0 && (
              <Section title="Networking interests">
                <TagList values={profile.interests} />
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
