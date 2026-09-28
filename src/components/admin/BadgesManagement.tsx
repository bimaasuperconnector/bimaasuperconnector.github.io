import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import {
  type Badge,
  type BadgeColorKey,
  BADGE_COLOR_KEYS,
  createBadge,
  deleteBadge,
  listBadges,
} from '../../firebase/repositories/badgesRepository';

/** Maps each palette key to a small color swatch class — same signature-card tokens as Design-superconnector.md. */
const SWATCH_CLASSES: Record<BadgeColorKey, string> = {
  ink: 'bg-ink',
  coral: 'bg-signature-coral',
  forest: 'bg-signature-forest',
  cream: 'bg-signature-cream',
  peach: 'bg-signature-peach',
  mint: 'bg-signature-mint',
  yellow: 'bg-signature-yellow',
  mustard: 'bg-signature-mustard',
};

/**
 * super_admin-only badge-catalog management, rendered in AdminIndexPage
 * alongside RoleManagement (same trust tier — a badge is a platform-wide
 * taxonomy decision, not batch-scoped). Members pick up to 5 of these
 * for their own profile via BadgePicker.tsx on the Profile page.
 */
export function BadgesManagement() {
  const { user } = useAuth();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [colorKey, setColorKey] = useState<BadgeColorKey>('ink');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    listBadges()
      .then(setBadges)
      .catch(() => setError("Couldn't load badges."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function submit() {
    if (!user || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createBadge(user, name, colorKey);
      setName('');
      setColorKey('ink');
      load();
    } catch {
      setError("Couldn't create that badge. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteBadge(id);
      setBadges((prev) => prev.filter((b) => b.id !== id));
    } catch {
      setError("Couldn't delete that badge. Please try again.");
    }
  }

  return (
    <div className="mt-lg rounded-md border border-hairline p-lg">
      <h2 className="text-title-sm text-ink">Badges</h2>
      <p className="mt-xs text-body-md text-muted">
        Create badges members can add to their own profile (up to 5 each) — e.g. "Messcom",
        "Finclub", "Astronomy Club".
      </p>

      {error && <p className="mt-sm text-body-md text-signature-coral">{error}</p>}

      <div className="mt-md flex flex-wrap items-end gap-sm">
        <div>
          <label className="text-caption text-muted" htmlFor="badge-name">
            Badge name
          </label>
          <input
            id="badge-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="e.g. Astronomy Club"
            className="mt-xs block rounded-sm border border-hairline px-md py-xs text-body-md"
          />
        </div>
        <div>
          <label className="text-caption text-muted" htmlFor="badge-color">
            Color
          </label>
          <select
            id="badge-color"
            value={colorKey}
            onChange={(e) => setColorKey(e.target.value as BadgeColorKey)}
            className="mt-xs block rounded-sm border border-hairline px-md py-xs text-body-md"
          >
            {BADGE_COLOR_KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="primary"
          className="px-md py-xs"
          disabled={saving || !name.trim()}
          onClick={() => void submit()}
        >
          {saving ? 'Adding…' : 'Add badge'}
        </Button>
      </div>

      <div className="mt-lg">
        {loading ? (
          <p className="text-body-md text-muted">Loading…</p>
        ) : badges.length === 0 ? (
          <p className="text-body-md text-muted">No badges yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-sm">
            {badges.map((badge) => (
              <li
                key={badge.id}
                className="flex items-center gap-xs rounded-sm border border-hairline px-md py-xs"
              >
                <span className={`h-3 w-3 rounded-full ${SWATCH_CLASSES[badge.colorKey]}`} />
                <span className="text-body-md text-ink">{badge.name}</span>
                <button
                  type="button"
                  onClick={() => void remove(badge.id)}
                  className="text-caption text-muted hover:text-signature-coral"
                  aria-label={`Delete ${badge.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
