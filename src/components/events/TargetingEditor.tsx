import { useState } from 'react';
import { Button } from '../ui/Button';
import { allBatches } from '../../lib/batches';
import { findUserByEmail } from '../../firebase/repositories/usersRepository';
import {
  EVENT_TARGET_TYPES,
  EVENT_TARGET_TYPE_LABELS,
  MAX_TARGET_UIDS,
  type EventTargeting,
  type EventTargetType,
} from '../../lib/events';

const BATCHES = allBatches();

interface SelectedPerson {
  uid: string;
  label: string;
}

/**
 * Picks exactly one of everyone/batch/city/selected — mirrors
 * isValidEventTargeting() in src/lib/events.ts and firestore.rules.
 * Immutable after creation (see eventsRepository.ts' updateEvent),
 * which is why this editor only appears in the CREATE flow.
 *
 * "Selected members" deliberately has no browsable member list — same
 * "don't build a browse-all-5,000-members view" posture as Phase 11's
 * role management, so people are added one at a time by exact email
 * lookup via the same findUserByEmail() used there.
 */
export function TargetingEditor({
  value,
  onChange,
}: {
  value: EventTargeting;
  onChange: (next: EventTargeting) => void;
}) {
  const [emailDraft, setEmailDraft] = useState('');
  const [selectedPeople, setSelectedPeople] = useState<SelectedPerson[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  function setType(targetType: EventTargetType) {
    onChange({ targetType, targetBatchNumbers: [], targetCityLower: '', targetUids: [] });
    setSelectedPeople([]);
  }

  function toggleBatch(batchNumber: number) {
    const has = value.targetBatchNumbers.includes(batchNumber);
    onChange({
      ...value,
      targetBatchNumbers: has
        ? value.targetBatchNumbers.filter((n) => n !== batchNumber)
        : [...value.targetBatchNumbers, batchNumber],
    });
  }

  async function addPerson() {
    setLookupError(null);
    if (value.targetUids.length >= MAX_TARGET_UIDS) {
      setLookupError(`You can invite at most ${MAX_TARGET_UIDS} people this way.`);
      return;
    }
    setLooking(true);
    try {
      const found = await findUserByEmail(emailDraft);
      if (!found) {
        setLookupError('No member found with that email.');
        return;
      }
      if (value.targetUids.includes(found.uid)) {
        setLookupError('Already added.');
        return;
      }
      setSelectedPeople((prev) => [...prev, { uid: found.uid, label: found.displayName || found.email || found.uid }]);
      onChange({ ...value, targetUids: [...value.targetUids, found.uid] });
      setEmailDraft('');
    } catch {
      setLookupError("Couldn't look that up right now.");
    } finally {
      setLooking(false);
    }
  }

  function removePerson(uid: string) {
    setSelectedPeople((prev) => prev.filter((p) => p.uid !== uid));
    onChange({ ...value, targetUids: value.targetUids.filter((u) => u !== uid) });
  }

  return (
    <div>
      <label className="text-label-md text-ink">Who can see and RSVP to this event?</label>
      <div className="mt-xs flex flex-wrap gap-sm">
        {EVENT_TARGET_TYPES.map((t) => (
          <label key={t} className="flex items-center gap-xxs text-body-md text-body">
            <input type="radio" name="event-target-type" checked={value.targetType === t} onChange={() => setType(t)} />
            {EVENT_TARGET_TYPE_LABELS[t]}
          </label>
        ))}
      </div>

      {value.targetType === 'batch' && (
        <div className="mt-sm flex max-h-40 flex-wrap gap-xs overflow-y-auto rounded-sm border border-hairline p-sm">
          {BATCHES.map((b) => (
            <label key={b.id} className="flex items-center gap-xxs text-caption text-body">
              <input
                type="checkbox"
                checked={value.targetBatchNumbers.includes(b.batchNumber)}
                onChange={() => toggleBatch(b.batchNumber)}
              />
              {b.label}
            </label>
          ))}
        </div>
      )}

      {value.targetType === 'city' && (
        <input
          type="text"
          placeholder="e.g. Bengaluru"
          value={value.targetCityLower}
          onChange={(e) => onChange({ ...value, targetCityLower: e.target.value.toLowerCase() })}
          className="mt-sm block w-full max-w-[320px] rounded-sm border border-hairline px-md py-xs text-body-md"
        />
      )}

      {value.targetType === 'selected' && (
        <div className="mt-sm">
          <div className="flex gap-sm">
            <input
              type="email"
              placeholder="member@example.com"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              className="flex-1 rounded-sm border border-hairline px-md py-xs text-body-md"
            />
            <Button variant="secondary" disabled={looking || !emailDraft.trim()} onClick={() => void addPerson()}>
              {looking ? 'Looking up…' : 'Add'}
            </Button>
          </div>
          {lookupError && <p className="mt-xs text-caption text-signature-coral">{lookupError}</p>}
          {selectedPeople.length > 0 && (
            <ul className="mt-sm flex flex-wrap gap-xs">
              {selectedPeople.map((p) => (
                <li key={p.uid} className="flex items-center gap-xxs rounded-sm bg-surface-soft px-sm py-xxs text-caption text-ink">
                  {p.label}
                  <button type="button" onClick={() => removePerson(p.uid)} aria-label={`Remove ${p.label}`} className="text-muted hover:text-ink">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
