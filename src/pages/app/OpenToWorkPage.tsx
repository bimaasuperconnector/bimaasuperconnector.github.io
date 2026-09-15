import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { TagInput } from '../../components/profile/TagInput';
import { DirectoryProfileCard } from '../../components/directory/DirectoryProfileCard';
import {
  type Profile,
  getProfile,
  queryDirectory,
  saveOwnProfile,
} from '../../firebase/repositories/profilesRepository';

export function OpenToWorkPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [others, setOthers] = useState<Profile[]>([]);
  const [othersLoading, setOthersLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getProfile(user.uid)
      .then(setProfile)
      .catch(() => setError("Couldn't load your profile."))
      .finally(() => setLoading(false));

    queryDirectory({ mode: 'openToWork' })
      .then((page) => setOthers(page.profiles))
      .catch(() => {
        /* non-fatal — the self-toggle above still works even if this list fails to load */
      })
      .finally(() => setOthersLoading(false));
  }, [user]);

  async function handleSave() {
    if (!user || !profile) return;
    setError(null);
    setSaving(true);
    try {
      await saveOwnProfile(user, profile);
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !profile) {
    return <p className="text-body-md text-muted">Loading…</p>;
  }

  const visibleOthers = others.filter((o) => o.uid !== user?.uid);

  return (
    <div>
      <div className="rounded-md border border-hairline p-xl">
        <h1 className="text-title-lg text-ink">Open to Work</h1>
        <p className="mt-sm text-body-md text-body">
          Let fellow alumni know you're exploring new opportunities. Visible only
          to other approved members, never publicly.
        </p>

        <label className="mt-lg flex items-center gap-sm text-label-md text-ink">
          <input
            type="checkbox"
            checked={profile.openToWork}
            onChange={(e) => setProfile({ ...profile, openToWork: e.target.checked })}
          />
          I'm open to work
        </label>

        {profile.openToWork && (
          <div className="mt-lg space-y-lg">
            <TagInput
              label="Roles you're looking for"
              placeholder="e.g. Product Manager"
              values={profile.openToWorkRoles}
              onChange={(openToWorkRoles) => setProfile({ ...profile, openToWorkRoles })}
            />
            <div>
              <label className="text-label-md text-ink" htmlFor="otw-note">
                Note <span className="text-muted">(optional)</span>
              </label>
              <textarea
                id="otw-note"
                value={profile.openToWorkNote}
                onChange={(e) => setProfile({ ...profile, openToWorkNote: e.target.value })}
                rows={3}
                maxLength={500}
                placeholder="Availability, location constraints, anything helpful"
                className="mt-xs block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
              />
            </div>
          </div>
        )}

        {error && <p className="mt-md text-body-md text-signature-coral">{error}</p>}

        <Button variant="primary" className="mt-lg" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <div className="mt-xl">
        <h2 className="text-title-sm text-ink">Other alumni open to work</h2>
        {othersLoading ? (
          <p className="mt-md text-body-md text-muted">Loading…</p>
        ) : visibleOthers.length === 0 ? (
          <p className="mt-md text-body-md text-muted">Nobody else has marked themselves open to work yet.</p>
        ) : (
          <div className="mt-md grid gap-md md:grid-cols-2 lg:grid-cols-3">
            {visibleOthers.map((p) => (
              <DirectoryProfileCard key={p.uid} profile={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
