import { TagInput } from './TagInput';
import type { Profile } from '../../firebase/repositories/profilesRepository';

/**
 * The "Open to Work" controls, shown inside Edit profile (they used to live
 * on a separate page). Edits the same three profile fields as before and is
 * saved by the profile's single Save button, so there is no extra write.
 * Other members find open-to-work alumni through Directory -> "Open to Work".
 */
export function OpenToWorkEditor({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (next: Profile) => void;
}) {
  return (
    <div className="surface-card p-md md:p-lg">
      <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-md text-label-md text-ink">
        <span>
          I'm open to work
          <span className="mt-xxs block text-caption font-normal text-muted">
            Visible only to other approved members, never publicly.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={profile.openToWork}
          onChange={(e) => onChange({ ...profile, openToWork: e.target.checked })}
          className="h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-border-strong transition-colors duration-200 checked:bg-signature-forest [&::before]:block [&::before]:h-5 [&::before]:w-5 [&::before]:translate-x-[2px] [&::before]:translate-y-[2px] [&::before]:rounded-full [&::before]:bg-canvas [&::before]:transition-transform [&::before]:duration-200 [&::before]:content-[''] checked:[&::before]:translate-x-[22px]"
        />
      </label>

      {profile.openToWork && (
        <div className="fade-enter mt-lg space-y-lg">
          <TagInput
            label="Roles you're looking for"
            placeholder="e.g. Product Manager"
            values={profile.openToWorkRoles}
            onChange={(openToWorkRoles) => onChange({ ...profile, openToWorkRoles })}
          />
          <div>
            <label className="text-label-md text-ink" htmlFor="otw-note">
              Note <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="otw-note"
              value={profile.openToWorkNote}
              onChange={(e) => onChange({ ...profile, openToWorkNote: e.target.value })}
              rows={3}
              maxLength={500}
              placeholder="Availability, location constraints, anything helpful"
              className="field mt-xs block w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
