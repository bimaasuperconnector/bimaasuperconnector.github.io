import { useState } from 'react';
import { Button } from '../ui/Button';
import { allBatches } from '../../lib/batches';
import { normalizeCity, normalizeCityLower } from '../../lib/geography';
import { findUserByEmail } from '../../firebase/repositories/usersRepository';
import { useBadgeCatalog, useChapterCatalog } from '../../lib/useCatalog';
import {
  EMPTY_EVENT_TARGETING,
  EVENT_TARGET_TYPES,
  EVENT_TARGET_TYPE_LABELS,
  MAX_TARGET_BADGES,
  MAX_TARGET_CHAPTERS,
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
 * A checkbox-chip list of catalog entries (chapters or badges) for event
 * targeting. Keeps `ids` and their display `labels` in lock-step so the
 * event can show "Chennai Chapter" with no catalog read later.
 */
function CatalogChoice({
  items,
  loading,
  failed,
  emptyText,
  max,
  ids,
  labels,
  onChange,
}: {
  items: { id: string; name: string }[];
  loading: boolean;
  failed: boolean;
  emptyText: string;
  max: number;
  ids: string[];
  labels: string[];
  onChange: (ids: string[], labels: string[]) => void;
}) {
  if (loading) return <p className="mt-sm text-caption text-muted">Loading…</p>;
  if (failed) return <p className="mt-sm text-caption text-signature-coral">Couldn't load the list. Please try again.</p>;
  if (items.length === 0) return <p className="mt-sm text-caption text-muted">{emptyText}</p>;

  function toggle(id: string, name: string) {
    const index = ids.indexOf(id);
    if (index >= 0) {
      onChange(
        ids.filter((_, i) => i !== index),
        labels.filter((_, i) => i !== index),
      );
      return;
    }
    if (ids.length >= max) return;
    onChange([...ids, id], [...labels, name]);
  }

  return (
    <div className="mt-sm">
      <div className="flex max-h-40 flex-wrap gap-xs overflow-y-auto rounded-sm border border-hairline p-sm">
        {items.map((item) => {
          const checked = ids.includes(item.id);
          return (
            <label
              key={item.id}
              className={`flex items-center gap-xxs text-caption text-body ${!checked && ids.length >= max ? 'opacity-40' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={!checked && ids.length >= max}
                onChange={() => toggle(item.id, item.name)}
              />
              {item.name}
            </label>
          );
        })}
      </div>
      <p className="mt-xs text-caption text-muted">
        Members in <strong>any</strong> of the ones you tick can see and RSVP. Up to {max}.
      </p>
    </div>
  );
}

/**
 * Picks exactly one of everyone/batch/city/chapter/badge/selected — mirrors
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
  // Raw text the organizer is typing, kept separate from the normalized
  // `value.targetCityLower` that actually gets saved — reformatting the
  // input on every keystroke (as normalizeCity() would do to a
  // controlled value) is a jarring UX; this keeps what's on screen
  // exactly what was typed while still storing the canonical key.
  const [cityDraft, setCityDraft] = useState('');

  // The catalogs are only fetched once the matching option is chosen (and are
  // cached app-wide, so this is at most one read of each per 10 minutes).
  const chapters = useChapterCatalog(value.targetType === 'chapter');
  const badges = useBadgeCatalog(value.targetType === 'badge');

  function setType(targetType: EventTargetType) {
    onChange({ ...EMPTY_EVENT_TARGETING, targetType });
    setSelectedPeople([]);
    setCityDraft('');
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
        <div className="mt-sm">
          <input
            type="text"
            placeholder="e.g. Bengaluru or Bangalore"
            value={cityDraft}
            onChange={(e) => {
              setCityDraft(e.target.value);
              onChange({ ...value, targetCityLower: normalizeCityLower(e.target.value) });
            }}
            className="block w-full max-w-[320px] field"
          />
          {/* Phase 14: the city is normalized against a controlled reference
              table (src/lib/geography.ts) before it's stored, the same
              table a profile's own city is normalized against — so an
              event targeted at "Bangalore" reaches members whose profile
              says "Bengaluru" (or vice versa) instead of missing them on
              a raw-text mismatch. */}
          {value.targetCityLower && (
            <p className="mt-xs text-caption text-muted">
              Will reach members whose city matches: <strong>{normalizeCity(value.targetCityLower)}</strong>
            </p>
          )}
        </div>
      )}

      {value.targetType === 'chapter' && (
        <CatalogChoice
          items={chapters.items}
          loading={chapters.loading}
          failed={chapters.failed}
          emptyText="No chapters have been created yet."
          max={MAX_TARGET_CHAPTERS}
          ids={value.targetChapterIds}
          labels={value.targetLabels}
          onChange={(ids, labels) => onChange({ ...value, targetChapterIds: ids, targetLabels: labels })}
        />
      )}

      {value.targetType === 'badge' && (
        <CatalogChoice
          items={badges.items}
          loading={badges.loading}
          failed={badges.failed}
          emptyText="No badges have been created yet."
          max={MAX_TARGET_BADGES}
          ids={value.targetBadgeIds}
          labels={value.targetLabels}
          onChange={(ids, labels) => onChange({ ...value, targetBadgeIds: ids, targetLabels: labels })}
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
              className="flex-1 field"
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
