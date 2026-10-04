import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import {
  type DirectoryMode,
  type DirectoryPage,
  type Profile,
  getProfilesByIds,
  queryDirectory,
} from '../firebase/repositories/profilesRepository';
import { getDirectoryIndex, isDirectoryIndexReady, searchDirectoryByName } from './directoryIndex';
import { liteProfileFromEntry } from './liteProfile';
import type { IndexedEntry } from './nameSearch';

/**
 * ONE search implementation shared by the header search bar and the
 * Directory page, so both run exactly the same queries
 * (profilesRepository.queryDirectory) with the same rules.
 *
 * Quota protections, all in this file:
 *  - live (as-you-type) search only for prefix modes (name, location), only
 *    from 2 characters, and only after a 600 ms pause — never per keystroke;
 *    tag/batch modes run on Enter / the Search button / selection instead;
 *  - the FIRST page of any (mode, value) is cached in memory for 5 minutes,
 *    so repeating a search, reopening the bar, or pressing Back from a
 *    profile costs zero reads;
 *  - out-of-date responses are discarded instead of re-queried;
 *  - the header asks for small pages (8) and offers "Load more" /
 *    "Open in Directory" rather than pulling 24 profiles per keystroke;
 *  - NAME search runs against the local member-name index
 *    (lib/directoryIndex.ts): any word of a name matches (first, middle,
 *    last) and finding people costs ZERO Firestore reads. Only the profile
 *    documents actually shown are fetched (none at all for the header's
 *    `lite` rows). If the index isn't available yet, name search falls back
 *    to the original server-side prefix query.
 */

export type SearchPickerKind = 'batch' | 'badge' | 'chapter';

export interface SearchModeConfig {
  id: DirectoryMode;
  label: string;
  /** Needs typed text or a choice from a list before it can run. */
  needsInput: boolean;
  placeholder: string;
  /** Set for the modes that are chosen from a drop-down list rather than typed. */
  picker?: SearchPickerKind;
}

export const SEARCH_MODES: SearchModeConfig[] = [
  { id: 'name', label: 'Name', needsInput: true, placeholder: 'Search alumni by name' },
  { id: 'batch', label: 'Batch', needsInput: true, placeholder: 'Choose a batch', picker: 'batch' },
  { id: 'location', label: 'Location', needsInput: true, placeholder: 'Search by city' },
  { id: 'chapter', label: 'Chapter', needsInput: true, placeholder: 'Choose a chapter', picker: 'chapter' },
  { id: 'badge', label: 'Badge', needsInput: true, placeholder: 'Choose a club or committee', picker: 'badge' },
  { id: 'skill', label: 'Skill', needsInput: true, placeholder: 'A skill, e.g. Product design' },
  { id: 'interest', label: 'Interest', needsInput: true, placeholder: 'A networking interest' },
  { id: 'founders', label: 'Entrepreneurs', needsInput: false, placeholder: 'Alumni who founded ventures' },
  { id: 'openToWork', label: 'Open to Work', needsInput: false, placeholder: 'Alumni open to new roles' },
  { id: 'all', label: 'All members', needsInput: false, placeholder: 'Everyone in the network' },
];

export function modeConfig(mode: DirectoryMode): SearchModeConfig {
  return SEARCH_MODES.find((m) => m.id === mode) ?? SEARCH_MODES[0];
}

const LIVE_MODES: DirectoryMode[] = ['name', 'location'];
const LIVE_MIN_CHARS = 2;
const LIVE_DEBOUNCE_MS = 600;
const LOCAL_DEBOUNCE_MS = 150;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 60;

const pageCache = new Map<string, { page: DirectoryPage; at: number }>();

function cacheKey(mode: DirectoryMode, value: string, pageSize: number) {
  return `${mode}|${value.trim().toLowerCase()}|${pageSize}`;
}

async function cachedFirstPage(mode: DirectoryMode, value: string, pageSize: number): Promise<DirectoryPage> {
  const key = cacheKey(mode, value, pageSize);
  const hit = pageCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.page;
  const page = await queryDirectory({
    mode,
    value: mode === 'batch' ? Number(value) : value,
    pageSize,
  });
  pageCache.delete(key);
  pageCache.set(key, { page, at: Date.now() });
  while (pageCache.size > CACHE_MAX) {
    const oldest = pageCache.keys().next().value;
    if (oldest === undefined) break;
    pageCache.delete(oldest);
  }
  return page;
}

/** Where "Load more" continues from: a Firestore cursor, or a position in the local name matches. */
type PageCursor =
  | { kind: 'server'; doc: QueryDocumentSnapshot<DocumentData> }
  | { kind: 'local'; matches: IndexedEntry[]; offset: number };

interface SearchPageResult {
  profiles: Profile[];
  hasMore: boolean;
  cursor: PageCursor | null;
}

/** One page of a local name search. `lite` pages are drawn from the index alone (0 reads). */
async function localPage(
  matches: IndexedEntry[],
  offset: number,
  pageSize: number,
  lite: boolean,
): Promise<SearchPageResult> {
  const slice = matches.slice(offset, offset + pageSize);
  const profiles = lite ? slice.map(liteProfileFromEntry) : await getProfilesByIds(slice.map((e) => e.uid));
  const nextOffset = offset + slice.length;
  const hasMore = nextOffset < matches.length;
  return { profiles, hasMore, cursor: hasMore ? { kind: 'local', matches, offset: nextOffset } : null };
}

/**
 * First page of any search. Name searches use the local index when it is
 * available; every other mode (and the name fallback) uses the cached
 * server-side query exactly as before.
 */
async function firstPage(mode: DirectoryMode, value: string, pageSize: number, lite: boolean): Promise<SearchPageResult> {
  if (mode === 'name') {
    const index = await getDirectoryIndex();
    if (index) return localPage(searchDirectoryByName(index, value), 0, pageSize, lite);
  }
  const page = await cachedFirstPage(mode, value, pageSize);
  return {
    profiles: page.profiles,
    hasMore: page.hasMore,
    cursor: page.lastDoc ? { kind: 'server', doc: page.lastDoc } : null,
  };
}

/** Same-page refine (organization / institution / role) — no query, no reads. */
export function refineProfiles(profiles: Profile[], text: string): Profile[] {
  const needle = text.trim().toLowerCase();
  if (!needle) return profiles;
  return profiles.filter((profile) => {
    const haystack = [
      profile.currentOrganizationName,
      profile.currentTitle,
      profile.headline,
      ...profile.organizations.map((o) => `${o.name} ${o.title}`),
      ...profile.education.map((e) => `${e.institution} ${e.degree} ${e.field}`),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export interface UseDirectorySearchOptions {
  pageSize?: number;
  initialMode?: DirectoryMode;
  initialValue?: string;
  /** Run the initial (mode, value) immediately on mount. */
  runInitial?: boolean;
  /**
   * Draw name-search results straight from the local index — name, batch, role,
   * photo and markers only, with ZERO profile reads (the header search). Without
   * it, the profiles on the visible page are fetched in full (the Directory page).
   */
  lite?: boolean;
}

export function useDirectorySearch({
  pageSize = 24,
  initialMode = 'name',
  initialValue = '',
  runInitial = false,
  lite = false,
}: UseDirectorySearchOptions = {}) {
  const [mode, setModeState] = useState<DirectoryMode>(initialMode);
  const [value, setValue] = useState(initialValue);
  const [refineText, setRefineText] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cursorRef = useRef<PageCursor | null>(null);
  const requestRef = useRef(0);
  // The (mode, value) the CURRENT results belong to, used by loadMore.
  const activeRef = useRef<{ mode: DirectoryMode; value: string }>({ mode: initialMode, value: initialValue });

  const run = useCallback(
    async (nextMode: DirectoryMode, nextValue: string) => {
      const config = modeConfig(nextMode);
      if (config.needsInput && !nextValue.trim()) return;
      const request = ++requestRef.current;
      activeRef.current = { mode: nextMode, value: nextValue };
      setLoading(true);
      setError(null);
      try {
        const page = await firstPage(nextMode, nextValue, pageSize, lite);
        if (request !== requestRef.current) return; // a newer search superseded this one
        cursorRef.current = page.cursor;
        setResults(page.profiles);
        setHasMore(page.hasMore);
        setHasSearched(true);
      } catch {
        if (request === requestRef.current) setError("Couldn't load the directory. Please try again.");
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    },
    [pageSize, lite],
  );

  const loadMore = useCallback(async () => {
    const { mode: activeMode, value: activeValue } = activeRef.current;
    if (!cursorRef.current) return;
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const cursor = cursorRef.current;
      let page: SearchPageResult;
      if (cursor.kind === 'local') {
        page = await localPage(cursor.matches, cursor.offset, pageSize, lite);
      } else {
        const serverPage = await queryDirectory({
          mode: activeMode,
          value: activeMode === 'batch' ? Number(activeValue) : activeValue,
          pageSize,
          cursor: cursor.doc,
        });
        page = {
          profiles: serverPage.profiles,
          hasMore: serverPage.hasMore,
          cursor: serverPage.lastDoc ? { kind: 'server', doc: serverPage.lastDoc } : null,
        };
      }
      if (request !== requestRef.current) return;
      cursorRef.current = page.cursor;
      setResults((prev) => [...prev, ...page.profiles]);
      setHasMore(page.hasMore);
    } catch {
      if (request === requestRef.current) setError("Couldn't load more. Please try again.");
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [pageSize, lite]);

  const reset = useCallback(() => {
    requestRef.current++;
    cursorRef.current = null;
    setResults([]);
    setHasMore(false);
    setHasSearched(false);
    setLoading(false);
    setError(null);
    setRefineText('');
  }, []);

  /** Switching mode clears the previous results; no-input modes run at once. */
  const selectMode = useCallback(
    (next: DirectoryMode) => {
      setModeState(next);
      setValue('');
      reset();
      if (!modeConfig(next).needsInput) void run(next, '');
    },
    [reset, run],
  );

  // Live search for prefix modes: debounced, minimum length, and it skips
  // when the current results already belong to exactly this query.
  useEffect(() => {
    if (!LIVE_MODES.includes(mode)) return;
    const trimmed = value.trim();
    if (trimmed.length < LIVE_MIN_CHARS) return;
    const active = activeRef.current;
    if (active.mode === mode && active.value.trim().toLowerCase() === trimmed.toLowerCase() && hasSearched) return;
    // Lite name search over the already-loaded local index costs nothing, so it can react
    // almost instantly; anything that reads from Firestore keeps the longer pause.
    const free = lite && mode === 'name' && isDirectoryIndexReady();
    const timer = window.setTimeout(() => void run(mode, trimmed), free ? LOCAL_DEBOUNCE_MS : LIVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [mode, value, run, hasSearched, lite]);

  // Optional one-time run for a deep link (?mode=…&q=…).
  const ranInitial = useRef(false);
  useEffect(() => {
    if (!runInitial || ranInitial.current) return;
    ranInitial.current = true;
    const config = modeConfig(initialMode);
    if (!config.needsInput || initialValue.trim()) void run(initialMode, initialValue);
  }, [runInitial, initialMode, initialValue, run]);

  const visibleResults = useMemo(() => refineProfiles(results, refineText), [results, refineText]);

  return {
    mode,
    value,
    setValue,
    refineText,
    setRefineText,
    results,
    visibleResults,
    hasMore,
    loading,
    hasSearched,
    error,
    selectMode,
    /** Runs the current mode with the current value (Enter / Search button). */
    submit: () => void run(mode, value.trim()),
    /** Runs an explicit (mode, value), e.g. choosing a batch from a select. */
    runWith: (nextMode: DirectoryMode, nextValue: string) => {
      setModeState(nextMode);
      setValue(nextValue);
      void run(nextMode, nextValue);
    },
    loadMore: () => void loadMore(),
    reset,
  };
}
