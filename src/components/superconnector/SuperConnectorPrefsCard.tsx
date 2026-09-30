import { useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { Button } from '../ui/Button';
import { CheckIcon, PencilIcon } from '../icons/NavIcons';
import { ErrorNote } from '../ui/PageHeader';
import { TagInput } from '../profile/TagInput';
import {
  NETWORKING_PURPOSES,
  NETWORKING_PURPOSE_LABELS,
  type NetworkingPurpose,
  type Profile,
  saveOwnSuperConnectorPrefs,
} from '../../firebase/repositories/profilesRepository';
import {
  PREF_LABELS,
  hasCompletePrefs,
  missingPrefs,
  normalizeTags,
  sameItems,
} from '../../lib/superconnectorPrefs';

function ChipList({ values, empty }: { values: string[]; empty: string }) {
  if (values.length === 0) return <p className="text-body-md text-muted">{empty}</p>;
  return (
    <ul className="flex flex-wrap gap-xs">
      {values.map((value) => (
        <li key={value} className="rounded-sm bg-surface-soft px-sm py-xxs text-body-md text-ink">
          {value}
        </li>
      ))}
    </ul>
  );
}

/**
 * Step 1 of the SuperConnector page: the three things the matching engine
 * needs to know about a member — skills, networking interests and what
 * they're looking for. They are saved once (on the member's profile) and
 * reused every month, so the card shows a compact read-only summary once
 * complete, and opens straight into edit mode while anything is missing.
 *
 * Quota: no reads at all (the profile arrives from the shell's live
 * listener) and one write per Save.
 */
export function SuperConnectorPrefsCard({
  user,
  profile,
  editing,
  onEditingChange,
}: {
  user: FirebaseUser;
  profile: Profile;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  const [skills, setSkills] = useState<string[]>(profile.skills);
  const [interests, setInterests] = useState<string[]>(profile.interests);
  const [purposes, setPurposes] = useState<NetworkingPurpose[]>(profile.networkingPurpose);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saved = {
    skills: profile.skills,
    interests: profile.interests,
    networkingPurpose: profile.networkingPurpose,
  };
  const savedComplete = hasCompletePrefs(saved);
  const draft = { skills, interests, networkingPurpose: purposes };
  const missing = missingPrefs(draft);
  const changed =
    !sameItems(normalizeTags(skills), saved.skills) ||
    !sameItems(normalizeTags(interests), saved.interests) ||
    !sameItems(purposes, saved.networkingPurpose);

  function startEditing() {
    setSkills(profile.skills);
    setInterests(profile.interests);
    setPurposes(profile.networkingPurpose);
    setError(null);
    onEditingChange(true);
  }

  function togglePurpose(purpose: NetworkingPurpose) {
    setPurposes((current) =>
      current.includes(purpose) ? current.filter((p) => p !== purpose) : [...current, purpose],
    );
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await saveOwnSuperConnectorPrefs(user, profile, {
        skills: normalizeTags(skills),
        interests: normalizeTags(interests),
        networkingPurpose: NETWORKING_PURPOSES.filter((p) => purposes.includes(p)),
      });
      onEditingChange(false);
    } catch {
      setError("Couldn't save your details. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing && savedComplete) {
    return (
      <div className="space-y-md">
        <dl className="space-y-md">
          <div>
            <dt className="text-label-md text-ink">Skills</dt>
            <dd className="mt-xs">
              <ChipList values={profile.skills} empty="—" />
            </dd>
          </div>
          <div>
            <dt className="text-label-md text-ink">Networking interests</dt>
            <dd className="mt-xs">
              <ChipList values={profile.interests} empty="—" />
            </dd>
          </div>
          <div>
            <dt className="text-label-md text-ink">What you're looking for</dt>
            <dd className="mt-xs">
              <ChipList
                values={profile.networkingPurpose.map((p) => NETWORKING_PURPOSE_LABELS[p])}
                empty="—"
              />
            </dd>
          </div>
        </dl>
        <Button variant="secondary" onClick={startEditing} className="!px-md !py-sm">
          <PencilIcon width={16} height={16} className="mr-xs" /> Edit details
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      {error && <ErrorNote>{error}</ErrorNote>}

      <TagInput
        label="Skills"
        hint="What you're good at. We look for people whose skills complement yours."
        placeholder="Type a skill and press Enter"
        values={skills}
        onChange={setSkills}
      />

      <TagInput
        label="Networking interests"
        hint="Topics you'd love to talk about. Shared topics count the most when we match you."
        placeholder="Type a topic and press Enter"
        values={interests}
        onChange={setInterests}
      />

      <div role="group" aria-labelledby="sc-purpose-label">
        <p id="sc-purpose-label" className="text-label-md text-ink">
          What are you looking for?
        </p>
        <p className="mt-xxs text-caption text-muted">Pick everything that applies.</p>
        <div className="mt-xs flex flex-wrap gap-xs">
          {NETWORKING_PURPOSES.map((purpose) => {
            const on = purposes.includes(purpose);
            return (
              <button
                key={purpose}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => togglePurpose(purpose)}
                className={`inline-flex min-h-[44px] items-center gap-xs rounded-md border px-md text-body-md transition-colors duration-150 ${
                  on
                    ? 'border-ink bg-ink text-on-primary'
                    : 'border-hairline bg-canvas text-ink active:bg-surface-soft'
                }`}
              >
                {on && <CheckIcon width={16} height={16} strokeWidth={2.5} />}
                {NETWORKING_PURPOSE_LABELS[purpose]}
              </button>
            );
          })}
        </div>
      </div>

      {missing.length > 0 && (
        <p className="text-caption text-muted">
          Still needed: {missing.map((key) => PREF_LABELS[key]).join(', ')}.
        </p>
      )}

      <div className="flex flex-wrap gap-md">
        <Button
          variant="primary"
          onClick={() => void handleSave()}
          disabled={saving || missing.length > 0 || (savedComplete && !changed)}
        >
          {saving ? 'Saving…' : 'Save details'}
        </Button>
        {savedComplete && (
          <Button variant="secondary" onClick={() => onEditingChange(false)} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
