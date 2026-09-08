import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { TagInput } from '../../components/profile/TagInput';
import { OrganizationsEditor } from '../../components/profile/OrganizationsEditor';
import { EducationEditor } from '../../components/profile/EducationEditor';
import { allBatches, findBatch } from '../../lib/batches';
import {
  type Profile,
  NETWORKING_PURPOSES,
  NETWORKING_PURPOSE_LABELS,
  emptyProfile,
  getProfile,
  saveOwnProfile,
} from '../../firebase/repositories/profilesRepository';

const BATCHES = allBatches();

export function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getProfile(user.uid)
      .then((result) => {
        if (cancelled) return;
        setProfile(result ?? emptyProfile(user.uid));
        setEditing(!result); // no profile yet -> go straight to edit mode
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your profile. Please refresh.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleSave() {
    if (!user || !profile) return;
    setError(null);
    setSaving(true);
    try {
      const isComplete = profile.batchNumber !== null && profile.headline.trim() !== '';
      await saveOwnProfile(user, { ...profile, isComplete });
      setProfile({ ...profile, isComplete });
      setEditing(false);
    } catch {
      setError("Couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !profile) {
    return <p className="text-body-md text-muted">Loading…</p>;
  }

  const batch = profile.batchNumber !== null ? findBatch(profile.batchNumber) : undefined;

  if (!editing) {
    return (
      <div className="rounded-md border border-hairline p-xl">
        <div className="flex items-start justify-between gap-md">
          <div className="flex items-center gap-md">
            {user?.photoURL && (
              <img src={user.photoURL} alt="" className="h-16 w-16 rounded-full" />
            )}
            <div>
              <h1 className="text-title-lg text-ink">{user?.displayName}</h1>
              {profile.headline && <p className="text-body-md text-body">{profile.headline}</p>}
              {batch && <p className="text-body-md text-muted">{batch.label}</p>}
            </div>
          </div>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit profile
          </Button>
        </div>

        {!profile.isComplete && (
          <p className="mt-lg rounded-sm bg-surface-soft p-md text-body-md text-body">
            Your profile isn't complete yet. Add your batch and a headline so
            other alumni can find you once the directory launches.
          </p>
        )}

        {profile.bio && <p className="mt-lg text-body-md text-body">{profile.bio}</p>}
        {profile.location && (
          <p className="mt-sm text-body-md text-muted">📍 {profile.location}</p>
        )}

        {profile.organizations.length > 0 && (
          <div className="mt-lg">
            <h2 className="text-title-sm text-ink">Organizations</h2>
            <ul className="mt-sm space-y-xs">
              {profile.organizations.map((org, i) => (
                <li key={i} className="text-body-md text-body">
                  {org.title} at {org.name}
                  {org.startYear ? ` (${org.startYear}\u2013${org.endYear ?? 'present'})` : ''}
                  {org.isFounder ? ' · Founder' : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {profile.education.length > 0 && (
          <div className="mt-lg">
            <h2 className="text-title-sm text-ink">Education</h2>
            <ul className="mt-sm space-y-xs">
              {profile.education.map((edu, i) => (
                <li key={i} className="text-body-md text-body">
                  {edu.degree} in {edu.field}, {edu.institution}
                  {edu.endYear ? ` (${edu.endYear})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {profile.skills.length > 0 && (
          <div className="mt-lg">
            <h2 className="text-title-sm text-ink">Skills</h2>
            <p className="mt-sm text-body-md text-body">{profile.skills.join(', ')}</p>
          </div>
        )}

        {profile.interests.length > 0 && (
          <div className="mt-lg">
            <h2 className="text-title-sm text-ink">Networking interests</h2>
            <p className="mt-sm text-body-md text-body">{profile.interests.join(', ')}</p>
          </div>
        )}

        {profile.networkingPurpose.length > 0 && (
          <div className="mt-lg">
            <h2 className="text-title-sm text-ink">Looking for</h2>
            <p className="mt-sm text-body-md text-body">
              {profile.networkingPurpose.map((p) => NETWORKING_PURPOSE_LABELS[p]).join(', ')}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-hairline p-xl">
      <h1 className="text-title-lg text-ink">Edit profile</h1>
      {error && <p className="mt-sm text-body-md text-signature-coral">{error}</p>}

      <div className="mt-lg space-y-lg">
        <div>
          <label className="text-label-md text-ink" htmlFor="batch">
            Batch
          </label>
          <select
            id="batch"
            value={profile.batchNumber ?? ''}
            onChange={(e) =>
              setProfile({
                ...profile,
                batchNumber: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="mt-xs block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
          >
            <option value="">Select your batch…</option>
            {BATCHES.map((b) => (
              <option key={b.id} value={b.batchNumber}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-label-md text-ink" htmlFor="headline">
            Headline
          </label>
          <input
            id="headline"
            type="text"
            value={profile.headline}
            onChange={(e) => setProfile({ ...profile, headline: e.target.value })}
            placeholder="e.g. Product Manager at Acme"
            maxLength={120}
            className="mt-xs block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
          />
        </div>

        <div>
          <label className="text-label-md text-ink" htmlFor="bio">
            Bio
          </label>
          <textarea
            id="bio"
            value={profile.bio}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            rows={4}
            maxLength={1000}
            className="mt-xs block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
          />
        </div>

        <div>
          <label className="text-label-md text-ink" htmlFor="location">
            Location
          </label>
          <input
            id="location"
            type="text"
            value={profile.location}
            onChange={(e) => setProfile({ ...profile, location: e.target.value })}
            placeholder="City, country"
            maxLength={120}
            className="mt-xs block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
          />
        </div>

        <OrganizationsEditor
          organizations={profile.organizations}
          onChange={(organizations) => setProfile({ ...profile, organizations })}
        />

        <EducationEditor
          education={profile.education}
          onChange={(education) => setProfile({ ...profile, education })}
        />

        <TagInput
          label="Skills"
          placeholder="Type a skill and press Enter"
          values={profile.skills}
          onChange={(skills) => setProfile({ ...profile, skills })}
        />

        <TagInput
          label="Networking interests"
          placeholder="Type a topic and press Enter"
          values={profile.interests}
          onChange={(interests) => setProfile({ ...profile, interests })}
        />

        <div>
          <label className="text-label-md text-ink">What are you looking for?</label>
          <div className="mt-xs space-y-xs">
            {NETWORKING_PURPOSES.map((purpose) => (
              <label key={purpose} className="flex items-center gap-xs text-body-md text-body">
                <input
                  type="checkbox"
                  checked={profile.networkingPurpose.includes(purpose)}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      networkingPurpose: e.target.checked
                        ? [...profile.networkingPurpose, purpose]
                        : profile.networkingPurpose.filter((p) => p !== purpose),
                    })
                  }
                />
                {NETWORKING_PURPOSE_LABELS[purpose]}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-sm md:grid-cols-2">
          <div>
            <label className="text-label-md text-ink" htmlFor="linkedin">
              LinkedIn
            </label>
            <input
              id="linkedin"
              type="url"
              value={profile.links.linkedin}
              onChange={(e) =>
                setProfile({ ...profile, links: { ...profile.links, linkedin: e.target.value } })
              }
              placeholder="https://linkedin.com/in/…"
              className="mt-xs block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
            />
          </div>
          <div>
            <label className="text-label-md text-ink" htmlFor="website">
              Website
            </label>
            <input
              id="website"
              type="url"
              value={profile.links.website}
              onChange={(e) =>
                setProfile({ ...profile, links: { ...profile.links, website: e.target.value } })
              }
              placeholder="https://…"
              className="mt-xs block w-full rounded-sm border border-hairline px-md py-xs text-body-md"
            />
          </div>
        </div>

        <div className="flex gap-md">
          <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
          {profile.isComplete && (
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
