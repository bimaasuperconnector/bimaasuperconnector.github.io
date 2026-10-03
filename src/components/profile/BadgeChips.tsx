import { Link } from 'react-router-dom';
import type { ProfileBadgeRef } from '../../firebase/repositories/profilesRepository';
import type { BadgeColorKey } from '../../firebase/repositories/badgesRepository';

const SWATCH_CLASSES: Record<string, string> = {
  ink: 'bg-ink text-on-primary',
  coral: 'bg-signature-coral text-on-primary',
  forest: 'bg-signature-forest text-on-primary',
  cream: 'bg-signature-cream text-ink',
  peach: 'bg-signature-peach text-ink',
  mint: 'bg-signature-mint text-ink',
  yellow: 'bg-signature-yellow text-ink',
  mustard: 'bg-signature-mustard text-ink',
};

/** Renders the badges a member has already chosen — reads only the profile's own denormalized data, no extra Firestore cost. */
export function BadgeChips({ badges, linkable = false }: { badges: ProfileBadgeRef[]; linkable?: boolean }) {
  if (!badges || badges.length === 0) return null;
  return (
    <>
      {badges.map((badge) => {
        const className = `rounded-md px-sm py-xxs text-caption ${
          SWATCH_CLASSES[badge.colorKey as BadgeColorKey] ?? SWATCH_CLASSES.ink
        }`;
        // With `linkable`, a chip opens the Directory already searching that badge.
        return linkable ? (
          <Link
            key={badge.id}
            to={`/app/directory?mode=badge&q=${encodeURIComponent(badge.id)}`}
            className={`${className} transition-opacity duration-150 hover:opacity-85`}
            title={`See other members with the ${badge.name} badge`}
          >
            {badge.name}
          </Link>
        ) : (
          <span key={badge.id} className={className}>
            {badge.name}
          </span>
        );
      })}
    </>
  );
}
