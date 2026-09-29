import { type FormEvent, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorNote, PageHeader, SkeletonList } from '../../components/ui/PageHeader';
import { DirectoryProfileCard } from '../../components/directory/DirectoryProfileCard';
import { SearchIcon } from '../../components/icons/NavIcons';
import { allBatches } from '../../lib/batches';
import type { DirectoryMode } from '../../firebase/repositories/profilesRepository';
import { SEARCH_MODES, modeConfig, useDirectorySearch } from '../../lib/useDirectorySearch';

const BATCHES = allBatches();
const VALID_MODES = new Set<string>(SEARCH_MODES.map((m) => m.id));

/**
 * The full Directory page. It runs the exact same search as the header bar
 * (lib/useDirectorySearch.ts → queryDirectory) — same modes, same live-search
 * and caching rules — with a roomier layout and 24-per-page results. The
 * current search is mirrored into the URL (?mode=…&q=…), so coming back from
 * someone's profile restores it from the in-memory page cache with zero
 * additional reads.
 */
export function DirectoryPage() {
  // The header search's "Open in Directory" link carries a fresh nonce in
  // router state so this page restarts from the URL it was sent; the page's
  // own URL mirroring (replace navigations) never changes it.
  const nonce = (useLocation().state as { searchNonce?: number } | null)?.searchNonce ?? 0;
  return <DirectoryContents key={nonce} />;
}

function DirectoryContents() {
  const [params, setParams] = useSearchParams();
  const paramMode = params.get('mode');
  const initialMode: DirectoryMode = paramMode && VALID_MODES.has(paramMode) ? (paramMode as DirectoryMode) : 'name';
  const initialValue = params.get('q') ?? '';

  const search = useDirectorySearch({ pageSize: 24, initialMode, initialValue, runInitial: true });
  const config = modeConfig(search.mode);
  const textMode = config.needsInput && search.mode !== 'batch';

  // Mirror the active search in the URL (replace, so Back leaves the page).
  useEffect(() => {
    if (!search.hasSearched) return;
    const next = new URLSearchParams();
    next.set('mode', search.mode);
    if (search.value.trim()) next.set('q', search.value.trim());
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
    // params/setParams intentionally omitted: this only reacts to the search itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.hasSearched, search.mode, search.value]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (textMode) search.submit();
  }

  return (
    <div>
      <PageHeader
        title="Directory"
        description="Browse approved alumni. Pick one way to search at a time; open anyone to see their full profile."
      />

      <div className="surface-card mt-lg p-md md:p-lg">
        <div className="-mx-md flex gap-xs overflow-x-auto px-md pb-xxs no-scrollbar md:mx-0 md:flex-wrap md:overflow-visible md:px-0" role="group" aria-label="Search by">
          {SEARCH_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className="tab-chip shrink-0"
              aria-pressed={search.mode === m.id}
              onClick={() => search.selectMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {config.needsInput && (
          <form onSubmit={handleSubmit} className="mt-md flex flex-col gap-sm sm:flex-row" role="search">
            {search.mode === 'batch' ? (
              <>
                <label htmlFor="directory-batch" className="sr-only">
                  Batch
                </label>
                <select
                  id="directory-batch"
                  value={search.value}
                  onChange={(e) =>
                    e.target.value ? search.runWith('batch', e.target.value) : search.selectMode('batch')
                  }
                  className="field w-full sm:max-w-[320px]"
                >
                  <option value="">Select a batch…</option>
                  {BATCHES.map((b) => (
                    <option key={b.id} value={b.batchNumber}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <div className="relative flex-1">
                  <span aria-hidden="true" className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2 text-muted">
                    <SearchIcon width={18} height={18} />
                  </span>
                  <label htmlFor="directory-query" className="sr-only">
                    {config.label}
                  </label>
                  <input
                    id="directory-query"
                    type="search"
                    autoComplete="off"
                    enterKeyHint="search"
                    value={search.value}
                    onChange={(e) => search.setValue(e.target.value)}
                    placeholder={config.placeholder}
                    className="field w-full !pl-[40px]"
                  />
                </div>
                <Button type="submit" variant="primary" className="px-lg py-sm" disabled={!search.value.trim() || search.loading}>
                  Search
                </Button>
              </>
            )}
          </form>
        )}

        {textMode && (search.mode === 'name' || search.mode === 'location') && (
          <p className="mt-xs text-caption text-muted">Results appear as you type (from 2 letters), or press Enter.</p>
        )}

        {search.hasSearched && search.results.length > 0 && (
          <div className="mt-md border-t border-hairline pt-md">
            <label htmlFor="refine" className="text-caption text-muted">
              Refine these {search.results.length} result{search.results.length === 1 ? '' : 's'} by organization,
              institution or role
            </label>
            <input
              id="refine"
              type="text"
              value={search.refineText}
              onChange={(e) => search.setRefineText(e.target.value)}
              placeholder="e.g. Google, MBA, Product Manager…"
              className="field mt-xxs block w-full md:max-w-[420px]"
            />
          </div>
        )}
      </div>

      {search.error && (
        <div className="mt-md">
          <ErrorNote>{search.error}</ErrorNote>
        </div>
      )}

      <div className="mt-lg" aria-live="polite">
        {search.loading && search.results.length === 0 && <SkeletonList count={4} heightClass="h-[104px]" />}

        {search.visibleResults.length > 0 && (
          <ul className="grid gap-md sm:grid-cols-2 xl:grid-cols-3">
            {search.visibleResults.map((profile) => (
              <li key={profile.uid}>
                <DirectoryProfileCard profile={profile} />
              </li>
            ))}
          </ul>
        )}

        {search.hasSearched && !search.loading && search.visibleResults.length === 0 && !search.error && (
          <EmptyState title="No matching alumni found">Try a different spelling, another search type, or fewer filters.</EmptyState>
        )}

        {!search.hasSearched && !search.loading && !search.error && (
          <EmptyState title="Find someone in the network">
            Choose "All members", or search by name, batch, city, skill or interest to get started.
          </EmptyState>
        )}

        {search.hasMore && (
          <div className="mt-lg flex justify-center">
            <Button variant="secondary" disabled={search.loading} onClick={search.loadMore}>
              {search.loading ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
