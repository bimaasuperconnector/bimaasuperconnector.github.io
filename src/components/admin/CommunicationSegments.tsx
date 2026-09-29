import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { EmptyState, SkeletonList } from '../ui/PageHeader';
import { allBatches } from '../../lib/batches';
import { useAuth } from '../../context/AuthContext';
import { findUserByEmail } from '../../firebase/repositories/usersRepository';
import {
  type CommunicationSegment,
  type ResolvedMember,
  type SegmentType,
  SEGMENT_TYPES,
  SEGMENT_TYPE_LABELS,
  createSegment,
  deleteSegment,
  listSegments,
  resolveSegmentMembers,
  segmentMembersToCsv,
} from '../../firebase/repositories/communicationSegmentsRepository';

const BATCHES = allBatches();

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function NewSegmentForm({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [type, setType] = useState<SegmentType>('everyone');
  const [batchNumber, setBatchNumber] = useState<number | null>(null);
  const [city, setCity] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [customUids, setCustomUids] = useState<{ uid: string; label: string }[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addPerson() {
    setLookupError(null);
    try {
      const found = await findUserByEmail(emailDraft);
      if (!found) {
        setLookupError('No member found with that email.');
        return;
      }
      if (customUids.some((p) => p.uid === found.uid)) {
        setLookupError('Already added.');
        return;
      }
      setCustomUids((prev) => [...prev, { uid: found.uid, label: found.displayName || found.email || found.uid }]);
      setEmailDraft('');
    } catch {
      setLookupError("Couldn't look that up right now.");
    }
  }

  async function submit() {
    if (!user || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createSegment(user, {
        name: name.trim(),
        type,
        batchNumber,
        cityCanonical: city.trim(),
        customUids: customUids.map((p) => p.uid),
      });
      setName('');
      setType('everyone');
      setBatchNumber(null);
      setCity('');
      setCustomUids([]);
      onCreated();
    } catch {
      setError("Couldn't save that segment. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit =
    name.trim().length > 0 &&
    (type !== 'batch' || batchNumber != null) &&
    (type !== 'city' || city.trim().length > 0) &&
    (type !== 'customUids' || customUids.length > 0);

  return (
    <div className="mt-lg rounded-lg border border-hairline p-md">
      <p className="text-label-md text-ink">New segment</p>
      <div className="mt-sm grid gap-sm md:grid-cols-2">
        <input
          type="text"
          placeholder='Segment name (e.g. "Bengaluru alumni")'
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="field"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as SegmentType)}
          className="field"
        >
          {SEGMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {SEGMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {type === 'batch' && (
        <select
          value={batchNumber ?? ''}
          onChange={(e) => setBatchNumber(e.target.value ? Number(e.target.value) : null)}
          className="mt-sm field"
        >
          <option value="">Choose a batch…</option>
          {BATCHES.map((b) => (
            <option key={b.id} value={b.batchNumber}>
              {b.label}
            </option>
          ))}
        </select>
      )}

      {type === 'city' && (
        <input
          type="text"
          placeholder="e.g. Bengaluru"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="mt-sm block w-full max-w-[320px] field"
        />
      )}

      {type === 'customUids' && (
        <div className="mt-sm">
          <div className="flex gap-sm">
            <input
              type="email"
              placeholder="member@example.com"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              className="flex-1 field"
            />
            <Button variant="secondary" className="px-md py-xs" disabled={!emailDraft.trim()} onClick={() => void addPerson()}>
              Add
            </Button>
          </div>
          {lookupError && <p className="mt-xs text-caption text-signature-coral">{lookupError}</p>}
          {customUids.length > 0 && (
            <ul className="mt-sm flex flex-wrap gap-xs">
              {customUids.map((p) => (
                <li key={p.uid} className="rounded-sm bg-surface-soft px-sm py-xxs text-caption text-ink">
                  {p.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="mt-sm text-body-md text-signature-coral">{error}</p>}

      <Button variant="primary" className="mt-md px-md py-xs" disabled={!canSubmit || saving} onClick={() => void submit()}>
        {saving ? 'Saving…' : 'Save segment'}
      </Button>
    </div>
  );
}

function SegmentRow({ segment, onDeleted }: { segment: CommunicationSegment; onDeleted: () => void }) {
  const [members, setMembers] = useState<ResolvedMember[] | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve() {
    setResolving(true);
    setError(null);
    try {
      setMembers(await resolveSegmentMembers(segment));
    } catch {
      setError("Couldn't resolve this segment right now.");
    } finally {
      setResolving(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete the segment "${segment.name}"? This can't be undone.`)) return;
    await deleteSegment(segment.id);
    onDeleted();
  }

  return (
    <li className="rounded-lg border border-hairline p-md">
      <div className="flex items-center justify-between gap-md">
        <div>
          <p className="text-label-md text-ink">{segment.name}</p>
          <p className="text-body-md text-muted">
            {SEGMENT_TYPE_LABELS[segment.type]}
            {segment.type === 'city' && segment.cityCanonical ? ` · ${segment.cityCanonical}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 gap-sm">
          <Button variant="secondary" className="px-md py-xs" disabled={resolving} onClick={() => void resolve()}>
            {resolving ? 'Resolving…' : 'Resolve'}
          </Button>
          <Button variant="secondary" className="px-md py-xs" onClick={() => void remove()}>
            Delete
          </Button>
        </div>
      </div>

      {error && <p className="mt-sm text-body-md text-signature-coral">{error}</p>}

      {members && (
        <div className="mt-sm rounded-sm bg-surface-soft p-sm">
          <p className="text-body-md text-body">
            {members.length} approved member{members.length === 1 ? '' : 's'} in this segment right now.
          </p>
          {members.length > 0 && (
            <Button
              variant="secondary"
              className="mt-xs px-md py-xs"
              onClick={() =>
                downloadCsv(`${segment.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-members.csv`, segmentMembersToCsv(members))
              }
            >
              Download CSV (name, email)
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Phase 14 (Autonomous communication & segmentation). See
 * communicationSegmentsRepository.ts for why this is a Firestore-backed
 * segment DEFINITION plus an on-demand resolve/export, not an automated
 * Google Groups sync — bimaasuperconnector@gmail.com is a standard
 * consumer Gmail account (confirmed in Phase 8), not Google Workspace,
 * so there is no Admin Directory API available to create/sync groups
 * automatically. This is the documented, intentional fallback:
 * "retain Firestore segmentation and provide an admin export/manual
 * communication path" (ARCHITECTURE.md).
 */
export function CommunicationSegments() {
  const [segments, setSegments] = useState<CommunicationSegment[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      setSegments(await listSegments());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section id="segments" className="surface-card scroll-mt-20 p-lg md:p-xl">
      <h2 className="font-haas-disp text-title-md text-ink">Communication segments</h2>
      <p className="copy mt-xs">
        Define a named group of members (a batch, a city, Open to Work, founders, or a hand-picked list), then
        resolve it whenever you actually need to reach out to see who's in it today and export their names and
        emails as a CSV.
      </p>
      <p className="mt-xs text-caption text-muted">
        This account isn't on Google Workspace, so there's no automatic Google Groups sync — paste the exported
        emails into a BCC field or a Group you manage by hand. Keep an eye on Gmail's own sending limits for
        anything close to the full membership (see AUTOMATION.md).
      </p>

      {loading ? (
        <div className="mt-lg">
          <SkeletonList count={2} heightClass="h-16" />
        </div>
      ) : segments.length === 0 ? (
        <div className="mt-lg">
          <EmptyState title="No segments saved yet" />
        </div>
      ) : (
        <ul className="mt-lg space-y-md">
          {segments.map((s) => (
            <SegmentRow key={s.id} segment={s} onDeleted={() => void refresh()} />
          ))}
        </ul>
      )}

      <div className="mt-lg border-t border-hairline pt-lg">
        <NewSegmentForm onCreated={() => void refresh()} />
      </div>
    </section>
  );
}
