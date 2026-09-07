import { type FormEvent, useState } from 'react';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { Button } from '../../components/ui/Button';
import { DirectoryProfileCard } from '../../components/directory/DirectoryProfileCard';
import { allBatches } from '../../lib/batches';
import {
  type DirectoryMode,
  type Profile,
  queryDirectory,
} from '../../firebase/repositories/profilesRepository';

const BATCHES = allBatches();

const MODES: { id: DirectoryMode; label: string }[] = [
  { id: 'all', label: 'All members' },
  { id: 'batch', label: 'Batch' },
  { id: 'name', label: 'Name' },
  { id: 'location', label: 'Location' },
  { id: 'skill', label: 'Skill' },
  { id: 'interest', label: 'Interest' },
  { id: 'founders', label: 'Entrepreneurs' },
];

export function DirectoryPage() {
  const [mode, setMode] = useState<DirectoryMode>('all');
  const [inputValue, setInputValue] = useState('');
  const [refineText, setRefineText] = useState('');

  const [results, setResults] = useState<Profile[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(nextMode: DirectoryMode, value: string, append: boolean) {
    setLoading(true);
    setError(null);
    try {
      const page = await queryDirectory({
        mode: nextMode,
        value: nextMode === 'batch' ? Number(value) : value,
        cursor: append ? cursor : null,
      });
      setResults((prev) => (append ? [...prev, ...page.profiles] : page.profiles));
      setCursor(page.lastDoc);
      setHasMore(page.hasMore);
      setHasSearched(true);
    } catch {
      setError("Couldn't load the directory. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleModeChange(nextMode: DirectoryMode) {
    setMode(nextMode);
    setInputValue('');
    setResults([]);
    setCursor(null);
    setHasMore(false);
    setHasSearched(false);
    if (nextMode === 'all' || nextMode === 'founders') {
      void runSearch(nextMode, '', false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!inputValue.trim()) return;
    void runSearch(mode, inputValue.trim(), false);
  }

  const needsInput =
    mode === 'batch' || mode === 'name' || mode === 'location' || mode === 'skill' || mode === 'interest';

  const visibleResults = refineText.trim()
    ? results.filter((profile) => {
        const needle = refineText.trim().toLowerCase();
        const haystack = [
          profile.currentOrganizationName,
          profile.currentTitle,
          ...profile.organizations.map((o) => `${o.name} ${o.title}`),
          ...profile.education.map((e) => `${e.institution} ${e.degree} ${e.field}`),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      })
    : results;

  return (
    <div>
      <h1 className="text-title-lg text-ink">Directory</h1>
      <p className="mt-sm text-body-md text-body">
        Browse approved alumni. Pick one way to search at a time — Firestore
        doesn't support free-text search across multiple fields at once, so
        combining filters isn't available yet.
      </p>

      <div className="mt-lg flex flex-wrap gap-xs">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => handleModeChange(m.id)}
            className={`rounded-pill px-md py-xs text-body-md ${
              mode === m.id ? 'bg-primary text-on-primary' : 'border border-hairline text-body'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {needsInput && (
        <form onSubmit={handleSubmit} className="mt-md flex gap-sm">
          {mode === 'batch' ? (
            <select
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="rounded-sm border border-hairline px-md py-xs text-body-md"
            >
              <option value="">Select a batch…</option>
              {BATCHES.map((b) => (
                <option key={b.id} value={b.batchNumber}>
                  {b.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                mode === 'name'
                  ? 'Start of a name…'
                  : mode === 'location'
                    ? 'Start of a city…'
                    : mode === 'skill'
                      ? 'A skill, e.g. "Product design"'
                      : 'A networking interest'
              }
              className="flex-1 rounded-sm border border-hairline px-md py-xs text-body-md"
            />
          )}
          <Button type="submit" variant="primary" disabled={!inputValue.trim() || loading}>
            Search
          </Button>
        </form>
      )}

      {hasSearched && results.length > 0 && (
        <div className="mt-lg">
          <label className="text-body-md text-muted" htmlFor="refine">
            Refine these {results.length} result{results.length === 1 ? '' : 's'} by organization,
            institution, or role
          </label>
          <input
            id="refine"
            type="text"
            value={refineText}
            onChange={(e) => setRefineText(e.target.value)}
            placeholder="e.g. Google, MBA, Product Manager…"
            className="mt-xs block w-full max-w-[420px] rounded-sm border border-hairline px-md py-xs text-body-md"
          />
        </div>
      )}

      {error && <p className="mt-md text-body-md text-signature-coral">{error}</p>}

      <div className="mt-lg grid gap-md md:grid-cols-2 lg:grid-cols-3">
        {visibleResults.map((profile) => (
          <DirectoryProfileCard key={profile.uid} profile={profile} />
        ))}
      </div>

      {hasSearched && !loading && visibleResults.length === 0 && (
        <p className="mt-lg text-body-md text-muted">No matching alumni found.</p>
      )}

      {loading && <p className="mt-lg text-body-md text-muted">Loading…</p>}

      {hasMore && !loading && (
        <div className="mt-lg">
          <Button variant="secondary" onClick={() => void runSearch(mode, inputValue, true)}>
            Load more
          </Button>
        </div>
      )}

      {!hasSearched && !loading && (
        <p className="mt-lg text-body-md text-muted">
          Choose "All members" or search by batch, name, location, skill, or
          interest to get started.
        </p>
      )}
    </div>
  );
}
