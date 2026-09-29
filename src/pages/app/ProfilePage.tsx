import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useOwnProfile } from '../../context/OwnProfileContext';
import { useUserRecord } from '../../context/UserRecordContext';
import { Button } from '../../components/ui/Button';
import { TagInput } from '../../components/profile/TagInput';
import { OrganizationsEditor } from '../../components/profile/OrganizationsEditor';
import { EducationEditor } from '../../components/profile/EducationEditor';
import { ContactPrivacyEditor } from '../../components/profile/ContactPrivacyEditor';
import { deleteProfilePhotoAsset } from '../../lib/photoUpload';
import { ProfilePhotoUpload } from '../../components/profile/ProfilePhotoUpload';
import { BadgePicker } from '../../components/profile/BadgePicker';
import { ProfileView } from '../../components/profile/ProfileView';
import { ErrorNote, SkeletonList } from '../../components/ui/PageHeader';
import { allBatches } from '../../lib/batches';
import {
  type Profile,
  NETWORKING_PURPOSES,
  NETWORKING_PURPOSE_LABELS,
  emptyProfile,
  saveOwnPendingProfile,
  saveOwnProfile,
} from '../../firebase/repositories/profilesRepository';
import {
  type ProfileContact,
  emptyProfileContact,
  getOwnProfileContact,
  saveOwnProfileContact,
} from '../../firebase/repositories/profileContactsRepository';

const BATCHES = allBatches();

export function ProfilePage() {
  const { user } = useAuth();
  const { record } = useUserRecord();
  // An applicant whose account is still awaiting approval edits a private
  // "pending approval" profile (visible only to their approvers).
  const isPending = record?.status === 'pending';
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contact, setContact] = useState<ProfileContact>(emptyProfileContact());
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ImageKit file IDs, for cleanup AFTER a successful save only (see
  // handleSave): the fileId currently stored in Firestore, and every
  // fileId uploaded during this edit session that may end up unused.
  const savedPhotoFileId = useRef<string | null>(null);
  const uploadedThisSession = useRef<Set<string>>(new Set());

  // The member's own profile arrives from the shell's single live listener
  // (context/OwnProfileContext.tsx) — this page no longer re-reads
  // profiles/{uid} on every visit. Only the private profileContacts/{uid}
  // document (owner-only) still needs its own single read, and only when
  // this page is opened.
  const { profile: liveProfile, loaded: liveLoaded, failed: liveFailed } = useOwnProfile();
  const seeded = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user || !liveLoaded || seeded.current) return;
    if (liveFailed) {
      setError("Couldn't load your profile. Please refresh.");
      setLoading(false);
      return;
    }
    seeded.current = true;
    // Seed a brand-new profile's name from the onboarding name
    // (users/{uid}.displayName, already loaded via UserRecordContext —
    // zero extra reads) rather than starting blank, which is what
    // produced "Unnamed alum" before a member's first resave.
    savedPhotoFileId.current = liveProfile?.photoFileId ?? null;
    const base = liveProfile ?? emptyProfile(user.uid, record?.displayName ?? user.displayName ?? '');
    // The applicant's batch is fixed to what they chose at sign-up — it
    // decides which batch representative reviews them.
    setProfile(isPending ? { ...base, batchNumber: record?.batchNumber ?? base.batchNumber } : base);
    setEditing(!liveProfile); // no profile yet -> go straight to edit mode
    getOwnProfileContact(user.uid)
      .then((contactResult) => {
        if (!mounted.current) return;
        // Self-healing migration: if there's no contact doc yet but an
        // old public `links.linkedin` value exists (pre-revision), carry
        // it over as the starting LinkedIn value (still private/off by
        // default until the member explicitly turns it back on) rather
        // than silently losing it.
        setContact(
          contactResult ?? {
            ...emptyProfileContact(),
            linkedinUrl: liveProfile?.links.linkedin ?? '',
          },
        );
      })
      .catch(() => {
        if (mounted.current) setError("Couldn't load your profile. Please refresh.");
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
  }, [user, liveLoaded, liveFailed, liveProfile, record, isPending]);

  async function handleSave() {
    if (!user || !profile) return;
    setError(null);
    setSaving(true);
    try {
      const isComplete =
        profile.displayName.trim() !== '' && profile.batchNumber !== null && profile.headline.trim() !== '';
      if (isPending) {
        await saveOwnPendingProfile(user, {
          ...profile,
          batchNumber: record?.batchNumber ?? profile.batchNumber,
          badges: [],
          isComplete,
        });
        await saveOwnProfileContact(user.uid, contact, 'pending');
      } else {
        await saveOwnProfile(user, { ...profile, isComplete });
        await saveOwnProfileContact(user.uid, contact);
      }
      // The photo change is now really saved, so it is finally safe to
      // delete ImageKit assets that are no longer referenced: the
      // previously-saved photo (if replaced/removed) and any photo
      // uploaded this session but not chosen in the end. Best-effort.
      const stale = new Set(uploadedThisSession.current);
      if (savedPhotoFileId.current) stale.add(savedPhotoFileId.current);
      if (profile.photoFileId) stale.delete(profile.photoFileId);
      stale.forEach((fileId) => void deleteProfilePhotoAsset(user, fileId));
      savedPhotoFileId.current = profile.photoFileId;
      uploadedThisSession.current = new Set();
      setProfile({ ...profile, isComplete });
      setEditing(false);
    } catch {
      setError("Couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !profile) {
    return error ? (
      <ErrorNote>{error}</ErrorNote>
    ) : (
      <div className="space-y-lg" aria-busy="true" aria-label="Loading your profile">
        <div className="skeleton h-[260px]" />
        <SkeletonList count={2} heightClass="h-32" />
      </div>
    );
  }

  if (!editing) {
    // Saved data comes straight from the live listener (it fires immediately
    // on a local save), so contact icons/photo reflect the latest save.
    const shown = liveProfile ?? profile;
    return (
      <ProfileView
        profile={shown}
        actions={
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit profile
          </Button>
        }
        contactCaption={isPending ? 'Your approvers will see' : 'Fellow alumni will see'}
        notice={
          isPending ? (
            <p className="rounded-lg bg-surface-soft p-md text-body-md text-body">
              {profile.isComplete
                ? 'Thanks — your profile has been submitted. Your batch representative (or an admin) will review it and confirm your alumni status. You can keep editing it until then.'
                : "Your profile isn't complete yet. Add your name and a headline so your batch representative can recognise you."}
            </p>
          ) : (
            !profile.isComplete && (
              <p className="rounded-lg bg-surface-soft p-md text-body-md text-body">
                Your profile isn't complete yet. Add your name, batch and a headline so other alumni can find you in the
                directory.
              </p>
            )
          )
        }
      />
    );
  }

  return (
    <div className="surface-card p-lg md:p-xl">
      <h1 className="font-haas-disp text-title-lg text-ink md:text-display-md">Edit profile</h1>
      {error && (
        <div className="mt-md">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="mt-lg space-y-lg">
        {user && (
          <ProfilePhotoUpload
            user={user}
            photoURL={profile.photoURL}
            onChange={({ photoURL, photoFileId }) => {
              if (photoFileId) uploadedThisSession.current.add(photoFileId);
              setProfile({ ...profile, photoURL, photoFileId });
            }}
          />
        )}

        <div>
          <label className="text-label-md text-ink" htmlFor="displayName">
            Name
          </label>
          <input
            id="displayName"
            type="text"
            value={profile.displayName}
            onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
            placeholder="Full name"
            maxLength={200}
            required
            className="mt-xs block w-full field"
          />
          <p className="mt-xs text-caption text-muted">
            Shown to fellow alumni in the directory once you're approved. You can update this any time — for example
            after a name change.
          </p>
        </div>

        <div>
          <label className="text-label-md text-ink" htmlFor="batch">
            Batch
          </label>
          <select
            id="batch"
            disabled={isPending}
            value={profile.batchNumber ?? ''}
            onChange={(e) =>
              setProfile({
                ...profile,
                batchNumber: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="mt-xs block w-full field"
          >
            <option value="">Select your batch…</option>
            {BATCHES.map((b) => (
              <option key={b.id} value={b.batchNumber}>
                {b.label}
              </option>
            ))}
          </select>
          {isPending && (
            <p className="mt-xs text-caption text-muted">
              This is the batch you applied with — it decides which batch representative reviews you.
            </p>
          )}
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
            className="mt-xs block w-full field"
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
            className="mt-xs block w-full field"
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
            className="mt-xs block w-full field"
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

        {!isPending && (
          <BadgePicker
            selected={profile.badges}
            onChange={(badges) => setProfile({ ...profile, badges })}
          />
        )}

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
            className="mt-xs block w-full max-w-[420px] field"
          />
          <p className="mt-xs text-caption text-muted">
            Always shown publicly — for LinkedIn, phone, WhatsApp and email, see "Contact &
            privacy" below, where you choose exactly what's visible.
          </p>
        </div>

        <ContactPrivacyEditor contact={contact} onChange={setContact} />

        <div className="sticky bottom-[calc(60px+env(safe-area-inset-bottom,0px))] z-30 -mx-lg flex gap-md border-t border-hairline bg-canvas px-lg py-sm md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
          <Button
            variant="primary"
            onClick={() => void handleSave()}
            disabled={saving || profile.displayName.trim() === ''}
          >
            {saving ? 'Saving…' : isPending ? 'Submit profile' : 'Save profile'}
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
