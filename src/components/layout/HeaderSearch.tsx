import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/Avatar';
import { ArrowLeftIcon, CloseIcon, SearchIcon } from '../icons/NavIcons';
import { allBatches, findBatch } from '../../lib/batches';
import { SEARCH_MODES, modeConfig, useDirectorySearch } from '../../lib/useDirectorySearch';
import type { Profile } from '../../firebase/repositories/profilesRepository';
import { useDismiss } from './usePopover';

const BATCHES = allBatches();

type Search = ReturnType<typeof useDirectorySearch>;

function secondaryLine(profile: Profile): string {
  const batch = profile.batchNumber !== null ? findBatch(profile.batchNumber)?.label : undefined;
  const role = profile.currentOrganizationName
    ? `${profile.currentTitle ? `${profile.currentTitle} at ` : ''}${profile.currentOrganizationName}`
    : profile.headline;
  return [batch, role].filter(Boolean).join(' · ');
}

/** Minimal result row: photo, name, batch + current role. Opens the full profile. */
function ResultRow({ profile, ownUid, onOpen }: { profile: Profile; ownUid?: string; onOpen: () => void }) {
  const to = profile.uid === ownUid ? '/app/profile' : `/app/directory/${profile.uid}`;
  return (
    <Link
      to={to}
      state={{ profile }}
      onClick={onOpen}
      data-result-row
      className="flex min-h-[56px] items-center gap-sm rounded-lg px-sm py-xs text-left transition-colors duration-150 hover:bg-surface-soft active:bg-surface-strong"
    >
      <Avatar src={profile.photoURL} sizeClass="h-10 w-10" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-xs">
          <span className="truncate text-label-md text-ink">{profile.displayName || 'Unnamed alum'}</span>
          {profile.hasFounderOrg && <span className="chip bg-signature-cream">Founder</span>}
          {profile.openToWork && <span className="chip bg-signature-mint">Open to Work</span>}
        </span>
        <span className="block truncate text-body-md text-muted">{secondaryLine(profile) || 'SuperConnector member'}</span>
      </span>
    </Link>
  );
}

/**
 * Everything under the search bar: the advanced search options (search-by
 * modes, batch picker, refine) and the results. Rendered as a popover on
 * desktop and as the body of a full-screen sheet on phones.
 */
function SearchPanel({ search, ownUid, onOpenResult, onClose }: { search: Search; ownUid?: string; onOpenResult: () => void; onClose: () => void }) {
  const config = modeConfig(search.mode);
  const trimmed = search.value.trim();
  const isLive = search.mode === 'name' || search.mode === 'location';

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-result-row]'));
    const index = rows.indexOf(document.activeElement as HTMLElement);
    if (index === -1) return;
    event.preventDefault();
    const next = event.key === 'ArrowDown' ? rows[index + 1] : rows[index - 1];
    next?.focus();
  };

  const directoryHref = `/app/directory?mode=${search.mode}${trimmed ? `&q=${encodeURIComponent(trimmed)}` : ''}`;

  return (
    <div onKeyDown={onListKeyDown} className="p-md">
      <p className="text-caption text-muted">Search by</p>
      <div className="mt-xs flex flex-wrap gap-xs" role="group" aria-label="Search by">
        {SEARCH_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className="tab-chip"
            aria-pressed={search.mode === m.id}
            onClick={() => search.selectMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {search.mode === 'batch' && (
        <div className="mt-md">
          <label htmlFor="header-search-batch" className="text-caption text-muted">
            Batch
          </label>
          <select
            id="header-search-batch"
            value={search.value}
            onChange={(e) => (e.target.value ? search.runWith('batch', e.target.value) : search.selectMode('batch'))}
            className="field mt-xxs block w-full"
          >
            <option value="">Select a batch…</option>
            {BATCHES.map((b) => (
              <option key={b.id} value={b.batchNumber}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {config.needsInput && search.mode !== 'batch' && (
        <div className="mt-md flex items-center justify-between gap-sm">
          <p className="text-body-md text-muted">
            {isLive ? 'Type at least 2 letters — results appear as you pause.' : 'Type it in the bar and press Enter.'}
          </p>
          <button
            type="button"
            onClick={search.submit}
            disabled={!trimmed || search.loading}
            className="shrink-0 rounded-lg bg-primary px-md py-xs text-button text-on-primary transition-colors duration-150 active:bg-primary-active disabled:opacity-50"
          >
            Search
          </button>
        </div>
      )}

      <div className="mt-md border-t border-hairline pt-md" aria-live="polite">
        {search.error && <p className="text-body-md text-signature-coral">{search.error}</p>}

        {search.loading && search.results.length === 0 && (
          <div className="space-y-xs" aria-busy="true" aria-label="Searching">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-14" />
            ))}
          </div>
        )}

        {!search.hasSearched && !search.loading && !search.error && (
          <p className="py-sm text-center text-body-md text-muted">
            Find alumni by name, batch, city, skill or interest — or browse entrepreneurs and people open to work.
          </p>
        )}

        {search.hasSearched && search.results.length > 0 && (
          <>
            <div className="flex items-center justify-between gap-sm">
              <p className="text-caption text-muted">
                {search.visibleResults.length} result{search.visibleResults.length === 1 ? '' : 's'}
                {search.hasMore ? '+' : ''}
              </p>
            </div>
            <div className="mt-xs">
              <label htmlFor="header-search-refine" className="sr-only">
                Refine these results by organization, institution or role
              </label>
              <input
                id="header-search-refine"
                type="text"
                value={search.refineText}
                onChange={(e) => search.setRefineText(e.target.value)}
                placeholder="Refine by organization, institution or role"
                className="field block w-full"
              />
            </div>
          </>
        )}

        {search.hasSearched && !search.loading && search.visibleResults.length === 0 && !search.error && (
          <p className="py-sm text-center text-body-md text-muted">No matching alumni found.</p>
        )}

        {search.visibleResults.length > 0 && (
          <ul className="mt-xs space-y-xxs">
            {search.visibleResults.map((profile) => (
              <li key={profile.uid}>
                <ResultRow profile={profile} ownUid={ownUid} onOpen={onOpenResult} />
              </li>
            ))}
          </ul>
        )}

        {search.hasSearched && (
          <div className="mt-sm flex flex-wrap items-center justify-between gap-sm">
            {search.hasMore ? (
              <button
                type="button"
                onClick={search.loadMore}
                disabled={search.loading}
                className="rounded-lg border border-hairline bg-canvas px-md py-xs text-button text-ink disabled:opacity-50"
              >
                {search.loading ? 'Loading…' : 'Load more'}
              </button>
            ) : (
              <span />
            )}
            <Link to={directoryHref} state={{ searchNonce: Date.now() }} onClick={onClose} className="inline-flex min-h-[44px] items-center text-body-md text-link">
              Open in Directory →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/** The bar itself: leading search icon, mode token, text input, clear button. */
function SearchField({
  search,
  onFocus,
  onEscape,
  autoFocus,
  inputId,
}: {
  search: Search;
  onFocus?: () => void;
  onEscape?: () => void;
  autoFocus?: boolean;
  inputId: string;
}) {
  const config = modeConfig(search.mode);
  const textMode = config.needsInput && search.mode !== 'batch';
  const display =
    search.mode === 'batch' && search.value ? (findBatch(Number(search.value))?.label ?? search.value) : search.value;

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (textMode) search.submit();
      }}
      className="relative flex h-11 w-full items-center rounded-lg border border-hairline bg-surface-soft transition-colors duration-150 focus-within:border-info-border focus-within:bg-canvas focus-within:ring-2 focus-within:ring-info-border/25"
    >
      <span aria-hidden="true" className="pointer-events-none pl-sm text-muted">
        <SearchIcon width={18} height={18} />
      </span>
      <label htmlFor={inputId} className="sr-only">
        Search alumni
      </label>
      <input
        id={inputId}
        type="search"
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="search"
        value={display}
        readOnly={!textMode}
        onFocus={onFocus}
        onClick={onFocus}
        onChange={(e) => search.setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onEscape?.();
          if (e.key === 'ArrowDown') {
            const first = (e.currentTarget.form?.parentElement?.parentElement ?? document).querySelector<HTMLElement>('[data-result-row]');
            if (first) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
        placeholder={config.placeholder}
        className="h-full min-w-0 flex-1 bg-transparent px-sm text-body-md text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden max-md:text-[16px]"
      />
      <span className="mr-xs hidden shrink-0 rounded-sm bg-surface-strong px-xs py-xxs text-caption text-ink sm:inline">
        {config.label}
      </span>
      {(search.value || search.hasSearched) && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            search.selectMode(search.mode);
            search.setValue('');
          }}
          className="mr-xs flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted active:bg-surface-strong"
        >
          <CloseIcon width={16} height={16} />
        </button>
      )}
    </form>
  );
}

/**
 * The header search bar. It runs the same queries as the Directory page
 * (see lib/useDirectorySearch.ts): focusing it reveals the advanced search
 * options directly beneath, and results are minimal rows that open the
 * member's full profile.
 */
export function HeaderSearch() {
  const { user } = useAuth();
  const location = useLocation();
  const search = useDirectorySearch({ pageSize: 8, initialMode: 'name' });
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);

  const closeAll = useCallback(() => {
    setOpen(false);
    setMobileOpen(false);
  }, []);
  const closePopover = useCallback(() => setOpen(false), []);
  useDismiss(wrapRef, open, closePopover);

  // Any navigation (including browser Back) dismisses the panel.
  useEffect(() => {
    closeAll();
  }, [location.pathname, closeAll]);

  // Full-screen sheet on phones: stop the page behind it scrolling.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop / tablet: a long bar in the header; options drop beneath it. */}
      <div className="hidden min-w-0 flex-1 justify-center md:flex">
        <div ref={wrapRef} className="relative w-full max-w-[640px]">
          <SearchField
            search={search}
            inputId="header-search"
            onFocus={() => setOpen(true)}
            onEscape={() => setOpen(false)}
          />
          {open && (
            <div
              tabIndex={-1}
              className="pop-enter absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[min(640px,calc(100vh-96px))] overflow-y-auto overscroll-contain rounded-lg border border-hairline bg-canvas shadow-[0_16px_40px_rgba(24,29,38,0.14)] outline-none"
            >
              <SearchPanel
                search={search}
                ownUid={user?.uid}
                onOpenResult={() => setOpen(false)}
                onClose={() => setOpen(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Phones: an icon that opens a full-screen search sheet. */}
      <div className="flex-1 md:hidden" />
      <button
        ref={mobileTriggerRef}
        type="button"
        className="icon-btn md:hidden"
        aria-label="Search alumni"
        aria-haspopup="dialog"
        onClick={() => setMobileOpen(true)}
      >
        <SearchIcon />
      </button>

      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search alumni"
          className="sheet-enter fixed inset-0 z-[60] flex flex-col bg-canvas md:hidden"
        >
          <div className="flex h-16 shrink-0 items-center gap-xs border-b border-hairline px-sm">
            <button
              type="button"
              className="icon-btn"
              aria-label="Close search"
              onClick={() => {
                setMobileOpen(false);
                mobileTriggerRef.current?.focus();
              }}
            >
              <ArrowLeftIcon />
            </button>
            <SearchField search={search} inputId="header-search-mobile" autoFocus />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-safe">
            <SearchPanel
              search={search}
              ownUid={user?.uid}
              onOpenResult={() => setMobileOpen(false)}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}

