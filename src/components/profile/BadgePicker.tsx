import { useEffect, useState } from 'react';
import type { ProfileBadgeRef } from '../../firebase/repositories/profilesRepository';
import { MAX_PROFILE_BADGES } from '../../firebase/repositories/profilesRepository';
import { type Badge, listBadges } from '../../firebase/repositories/badgesRepository';

interface BadgePickerProps {
  selected: ProfileBadgeRef[];
  onChange: (badges: ProfileBadgeRef[]) => void;
}

/**
 * Lets a member pick up to MAX_PROFILE_BADGES(5) badges from the
 * super_admin-managed catalog (badgesRepository.ts). Only fetches the
 * catalog when actually rendered (the Profile edit form), never on the
 * read-only view or on Directory cards, which render the already-
 * denormalized `profile.badges` instead — see BadgeChips.tsx.
 */
export function BadgePicker({ selected, onChange }: BadgePickerProps) {
  const [catalog, setCatalog] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listBadges()
      .then(setCatalog)
      .catch(() => setCatalog([]))
      .finally(() => setLoading(false));
  }, []);

  function toggle(badge: Badge) {
    const isSelected = selected.some((b) => b.id === badge.id);
    if (isSelected) {
      onChange(selected.filter((b) => b.id !== badge.id));
      return;
    }
    if (selected.length >= MAX_PROFILE_BADGES) return;
    onChange([...selected, { id: badge.id, name: badge.name, colorKey: badge.colorKey }]);
  }

  if (loading) {
    return <p className="text-body-md text-muted">Loading badges…</p>;
  }

  if (catalog.length === 0) {
    return null;
  }

  return (
    <div>
      <label className="text-label-md text-ink">
        Badges ({selected.length}/{MAX_PROFILE_BADGES})
      </label>
      <p className="mt-xs text-caption text-muted">Pick up to {MAX_PROFILE_BADGES} to show on your profile.</p>
      <div className="mt-xs flex flex-wrap gap-xs">
        {catalog.map((badge) => {
          const isSelected = selected.some((b) => b.id === badge.id);
          const disabled = !isSelected && selected.length >= MAX_PROFILE_BADGES;
          return (
            <button
              key={badge.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(badge)}
              className={`rounded-full border px-md py-xs text-body-md transition-colors duration-150 ${
                isSelected
                  ? 'border-ink bg-ink text-on-primary'
                  : 'border-hairline text-body hover:border-border-strong'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {badge.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
