import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useOwnProfile } from '../../context/OwnProfileContext';
import { EmptyState, ErrorNote, PageHeader, SkeletonList } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { TagInput } from '../../components/profile/TagInput';
import { DirectoryProfileCard } from '../../components/directory/DirectoryProfileCard';
import {
  type Profile,
  queryDirectory,
  saveOwnProfile,
} from '../../firebase/repositories/profilesRepository';

export function OpenToWorkPage() {
  const { user } = useAuth();
  // Own profile from the shell's single live listener (no read here); the
  // local draft is only the form state being edited before Save.
  const { profile: livePro, loaded } = useOwnProfile();
  const [profile, setProfile] = useState<Profile | null>(null);
  const loading = !loaded;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [others, setOthers] = useState<Profile[]>([]);
  const [othersLoading, setOthersLoading] = useState(true);

  useEffect(() => {
    if (loaded && livePro && !profile) setProfile(livePro);
    // Seed the draft once, from the live profile's first value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, livePro]);

  useEffect(() => {
    if (!user) return;
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

  if (loading) {
    return <SkeletonList count={2} heightClass="h-40" />;
  }
  if (!profile) {
    return (
      <EmptyState title="Create your profile first">
        Add your name, batch and headline on the My profile page, then come back to switch on Open to Work.
      </EmptyState>
    );
  }

  const visibleOthers = others.filter((o) => o.uid !== user?.uid);

  return (
    <div>
      <PageHeader
        title="Open to Work"
        description="Let fellow alumni know you're exploring new opportunities. Visible only to other approved members, never publicly."
      />

      <div className="surface-card mt-lg p-lg md:p-xl">
        <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-md text-label-md text-ink">
          <span>I'm open to work</span>
          <input
            type="checkbox"
            role="switch"
            checked={profile.openToWork}
            onChange={(e) => setProfile({ ...profile, openToWork: e.target.checked })}
            className="h-6 w-11 cursor-pointer appearance-none rounded-full bg-border-strong transition-colors duration-200 checked:bg-signature-forest [&::before]:block [&::before]:h-5 [&::before]:w-5 [&::before]:translate-x-[2px] [&::before]:translate-y-[2px] [&::before]:rounded-full [&::before]:bg-canvas [&::before]:transition-transform [&::before]:duration-200 [&::before]:content-[''] checked:[&::before]:translate-x-[22px]"
          />
        </label>

        {profile.openToWork && (
          <div className="fade-enter mt-lg space-y-lg">
            <TagInput
              label="Roles you're looking for"
              placeholder="e.g. Product Manager"
              values={profile.openToWorkRoles}
              onChange={(openToWorkRoles) => setProfile({ ...profile, openToWorkRoles })}
            />
            <div>
              <label className="text-label-md text-ink" htmlFor="otw-note">
                Note <span className="font-normal text-muted">(optional)</span>
              </label>
              <textarea
                id="otw-note"
                value={profile.openToWorkNote}
                onChange={(e) => setProfile({ ...profile, openToWorkNote: e.target.value })}
                rows={3}
                maxLength={500}
                placeholder="Availability, location constraints, anything helpful"
                className="field mt-xs block w-full"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-md">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        <Button variant="primary" className="mt-lg" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <section className="mt-xl" aria-labelledby="otw-others">
        <h2 id="otw-others" className="font-haas-disp text-title-md text-ink">
          Other alumni open to work
        </h2>
        <div className="mt-md">
          {othersLoading ? (
            <SkeletonList count={3} heightClass="h-[104px]" />
          ) : visibleOthers.length === 0 ? (
            <EmptyState title="Nobody else yet">Nobody else has marked themselves open to work yet.</EmptyState>
          ) : (
            <ul className="grid gap-md sm:grid-cols-2 xl:grid-cols-3">
              {visibleOthers.map((p) => (
                <li key={p.uid}>
                  <DirectoryProfileCard profile={p} showLookingFor />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
