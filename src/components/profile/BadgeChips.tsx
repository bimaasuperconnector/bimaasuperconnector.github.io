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
export function BadgeChips({ badges }: { badges: ProfileBadgeRef[] }) {
  if (!badges || badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-xs">
      {badges.map((badge) => (
        <span
          key={badge.id}
          className={`rounded-full px-md py-xs text-caption ${
            SWATCH_CLASSES[badge.colorKey as BadgeColorKey] ?? SWATCH_CLASSES.ink
          }`}
        >
          {badge.name}
        </span>
      ))}
    </div>
  );
}
